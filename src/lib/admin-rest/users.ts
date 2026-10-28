import { collection } from "@/lib/db/client";
import { nextId } from "@/lib/admin-rest/ids";
import { SITE_URL } from "@/lib/env";
import { sanitizeTitle, uniqueSlug } from "@/lib/admin-rest/slug";
import { hashPassword } from "@/lib/auth/password";
import { splitAvatars } from "@/lib/db/adapt";
import { json, wpError, list, readJson, pickFields, paging, pastTheEnd, forbidden, escapeRegex } from "@/lib/admin-rest/http";
import type { UserDoc } from "@/lib/db/types";
import type { AdminRequest } from "@/lib/admin-rest/http";

/* /wp/v2/users — see admin-rest/index.ts. Returns null for requests it does not own. */

/** The roles this site uses; WordPress refuses any other with rest_user_invalid_role. */
const ROLES = ["administrator", "editor", "author"];

export async function handleUsers(req: AdminRequest): Promise<Response | null> {
  if (!req.route.startsWith("/wp/v2/users")) return null;

  const segments = req.segments;
  const userId = segments[3];

  // GET list with search
  if (req.method === "GET" && !userId) {
    return handleList(req);
  }

  // POST create
  if (req.method === "POST" && !userId) {
    if (req.user.role !== "administrator") return forbidden();
    return handleCreate(req);
  }

  // POST :id (update)
  if (req.method === "POST" && userId) {
    if (req.user.role !== "administrator") return forbidden();
    return handleUpdate(req, Number(userId));
  }

  // GET :id
  if (req.method === "GET" && userId) {
    return handleGetUser(req, Number(userId));
  }

  return null;
}

async function handleList(req: AdminRequest): Promise<Response> {
  const pagingResult = paging(req.query, 10);
  if (pagingResult instanceof Response) return pagingResult;
  const { page, perPage } = pagingResult;

  const col = await collection("users");
  const search = req.query.get("search");
  const roles = req.query.get("roles")?.split(",").map((r) => r.trim());
  const context = req.query.get("context") || "view";

  const filter: Record<string, unknown> = {};
  if (search) {
    const escapedSearch = escapeRegex(search);
    // matching on email is for administrators only (list_users); otherwise search would reveal addresses
    filter.$or = [
      { name: { $regex: escapedSearch, $options: "i" } },
      ...(req.user.role === "administrator" ? [{ email: { $regex: escapedSearch, $options: "i" } }] : []),
    ];
  }
  if (roles && roles.length > 0) {
    filter.roles = { $in: roles };
  }

  const total = await col.countDocuments(filter);
  const err = pastTheEnd(page, total, perPage);
  if (err) return err;

  const docs = await col
    .find(filter)
    .sort({ _id: 1 })
    .skip((page - 1) * perPage)
    .limit(perPage)
    .toArray();

  const fields = req.query.get("_fields");
  const items = docs.map((doc) => {
    const user = formatUser(doc, context === "edit" && req.user.role === "administrator");
    return pickFields(user, fields);
  });

  return list(items, total, perPage);
}

async function handleCreate(req: AdminRequest): Promise<Response> {
  const body = await readJson(req);
  if (body instanceof Response) return body;

  const username = String(body.username || "").trim();
  if (!username) return wpError("rest_missing_callback_param", "Missing parameter(s): username", 400);
  const roles = Array.isArray(body.roles) && body.roles.length > 0 ? body.roles.map(String) : ["author"];
  if (!roles.every((role) => ROLES.includes(role))) return wpError("rest_user_invalid_role", "Sorry, you are not allowed to give users that role.", 400);

  const col = await collection("users");

  // Check username uniqueness
  const existingUsername = await col.findOne({ username });
  if (existingUsername) {
    return wpError("existing_user_login", "Sorry, that username already exists!", 400);
  }

  // Check email uniqueness
  const email = String(body.email || "").trim();
  if (email) {
    const existingEmail = await col.findOne({ email });
    if (existingEmail) {
      return wpError("existing_user_email", "Sorry, that email address is already used!", 400);
    }
  }

  const id = await nextId("user");
  const slug = await uniqueSlug(sanitizeTitle(username), async (candidate) => {
    return (await col.findOne({ slug: candidate })) !== null;
  });

  const now = new Date();
  const doc: UserDoc = {
    _id: id,
    name: String(body.name || username).trim(),
    slug,
    description: String(body.description || "").trim(),
    link: `${SITE_URL}/author/${slug}/`,
    path: `/author/${slug}/`,
    avatar_url: null,
    avatars: {},
    username,
    email: email || null,
    first_name: String(body.first_name || "").trim() || null,
    last_name: String(body.last_name || "").trim() || null,
    nickname: String(body.nickname || username).trim(),
    locale: String(body.locale || "en_US").trim(),
    roles,
    role: roles[0],
    registered_at: now,
    // stored only as a hash, in the format the admin login verifies
    password_hash: typeof body.password === "string" && body.password ? await hashPassword(body.password) : null,
    is_active: true,
    seo: null,
  };

  await col.insertOne(doc);

  return json(formatUser(doc, true), 201);
}

async function handleUpdate(req: AdminRequest, userId: number): Promise<Response> {
  const body = await readJson(req);
  if (body instanceof Response) return body;

  const col = await collection("users");
  const doc = await col.findOne({ _id: userId });
  if (!doc) return wpError("rest_user_invalid_id", "Invalid user ID.", 404);

  const update: Partial<UserDoc> = {};
  if ("description" in body && typeof body.description === "string") update.description = body.description;
  if ("name" in body && typeof body.name === "string") update.name = body.name;
  if ("first_name" in body && typeof body.first_name === "string") update.first_name = body.first_name;
  if ("last_name" in body && typeof body.last_name === "string") update.last_name = body.last_name;
  if ("email" in body && typeof body.email === "string") update.email = body.email;

  if (Object.keys(update).length > 0) {
    await col.updateOne({ _id: userId }, { $set: update });
  }

  const updated = await col.findOne({ _id: userId });
  return json(formatUser(updated || doc, true), 200);
}

async function handleGetUser(req: AdminRequest, userId: number): Promise<Response> {
  const col = await collection("users");
  const doc = await col.findOne({ _id: userId });
  if (!doc) return wpError("rest_user_invalid_id", "Invalid user ID.", 404);

  const context = req.query.get("context") || "view";
  const fields = req.query.get("_fields");
  const user = formatUser(doc, context === "edit" && req.user.role === "administrator");
  return json(pickFields(user, fields), 200);
}

function formatUser(doc: UserDoc, includeEmail: boolean): Record<string, unknown> {
  const user: Record<string, unknown> = {
    id: doc._id,
    username: doc.username,
    name: doc.name,
    first_name: doc.first_name || "",
    last_name: doc.last_name || "",
    slug: doc.slug,
    description: doc.description,
    link: doc.link,
    locale: doc.locale,
    nickname: doc.nickname,
    registered_date: doc.registered_at?.toISOString(),
    roles: doc.roles,
    avatar_urls: Object.fromEntries(
      Object.entries(doc.avatars || {})
        .filter(([key]) => ["24", "48", "96"].includes(key))
        .filter(([, value]) => typeof value === "string" && !String(value).includes("gravatar"))
    ),
    // the uploaded photo only: Gravatar's grey placeholder and WP's "no profile picture" error are not photos
    mpp_avatar: splitAvatars(doc.avatars).mpp_avatar,
  };

  if (includeEmail) {
    user.email = doc.email;
  }

  return user;
}
