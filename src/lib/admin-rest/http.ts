/* The request/response plumbing of the MongoDB-backed stand-in for the slice of
   the WordPress REST API the admin panel uses (see admin-rest/index.ts).

   Responses must look like WordPress's, byte for byte where the admin reads
   them: the same JSON bodies, X-WP-Total / X-WP-TotalPages on lists, and the
   same error envelope { code, message, data: { status } } — the admin routes
   surface `data.message` to editors and branch on `data.code` in places
   (term_exists, for one). */

export interface AdminUser {
  id: number;
  username: string;
  role: string;
}

export interface AdminRequest {
  method: string;
  /** REST route without the /wp-json prefix and query: "/wp/v2/posts/12", "/rsfv/v1/posts". */
  route: string;
  /** Route split on "/", empty segments dropped: ["wp","v2","posts","12"]. */
  segments: string[];
  query: URLSearchParams;
  headers: Headers;
  /** The raw body; JSON or binary depending on the endpoint. */
  body: RequestInit["body"];
  user: AdminUser;
}

export type AdminHandler = (req: AdminRequest) => Promise<Response | null>;

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=UTF-8", ...headers } });
}

/** A list response with WordPress's pagination headers. */
export function list(items: unknown[], total: number, perPage: number): Response {
  return json(items, 200, { "X-WP-Total": String(total), "X-WP-TotalPages": String(perPage > 0 ? Math.ceil(total / perPage) : 0) });
}

/** WordPress's error envelope. */
export function wpError(code: string, message: string, status: number, data: Record<string, unknown> = {}): Response {
  return json({ code, message, data: { status, ...data } }, status);
}

export const notFound = (what = "post"): Response => wpError(`rest_${what}_invalid_id`, `Invalid ${what} ID.`, 404);
export const forbidden = (): Response => wpError("rest_forbidden", "Sorry, you are not allowed to do that.", 403);

/** Parse a JSON request body the way WP does: invalid JSON is a 400, not a crash. */
export async function readJson(req: AdminRequest): Promise<Record<string, unknown> | Response> {
  if (req.body == null || req.body === "") return {};
  try {
    const text = typeof req.body === "string" ? req.body : await new Response(req.body as BodyInit).text();
    const parsed: unknown = text ? JSON.parse(text) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : wpError("rest_invalid_json", "Invalid JSON body passed.", 400);
  } catch {
    return wpError("rest_invalid_json", "Invalid JSON body passed.", 400);
  }
}

/**
 * Keep only the `_fields` WordPress was asked for (top-level names, plus dotted
 * paths like "title.rendered"); everything when absent. The admin relies on
 * this only for payload size, but matching it keeps responses comparable.
 */
export function pickFields<T extends Record<string, unknown>>(item: T, fields: string | null): Partial<T> {
  if (!fields) return item;
  const wanted = fields.split(",").map((f) => f.trim()).filter(Boolean);
  const out: Record<string, unknown> = {};
  for (const field of wanted) {
    const [top] = field.split(".");
    if (top in item) out[top] = item[top];
  }
  return out as Partial<T>;
}

/** WP's page / per_page parsing: per_page 1–100 (400 above), page ≥ 1. */
export function paging(query: URLSearchParams, defaultPerPage = 10): { page: number; perPage: number } | Response {
  const perPage = Number(query.get("per_page") ?? defaultPerPage);
  const page = Number(query.get("page") ?? 1);
  if (!Number.isInteger(perPage) || perPage < 1 || perPage > 100) return wpError("rest_invalid_param", "Invalid parameter(s): per_page", 400);
  if (!Number.isInteger(page) || page < 1) return wpError("rest_invalid_param", "Invalid parameter(s): page", 400);
  return { page, perPage };
}

/** "The page number requested is larger than the number of pages available." */
export function pastTheEnd(page: number, total: number, perPage: number): Response | null {
  return page > 1 && page > Math.ceil(total / perPage) ? wpError("rest_post_invalid_page_number", "The page number requested is larger than the number of pages available.", 400) : null;
}

/** Escape user input for use inside a RegExp. */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
