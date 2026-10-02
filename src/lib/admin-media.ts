import { wpAdminFetch } from "@/lib/wp-admin";

export type UploadedMedia = { id: number; url: string; alt: string; mime: string; width: number | null; height: number | null };

/** A refusal that is the editor's to fix (wrong type, too big) rather than a WordPress failure. */
export class UploadError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Sends a file to the WordPress media library, after checking its type and size. */
export async function uploadMedia(file: File, { allowed, limit, limitLabel, alt = "" }: { allowed: string[]; limit: number; limitLabel: string; alt?: string }): Promise<UploadedMedia> {
  if (!allowed.includes(file.type)) throw new UploadError(`${file.name || "That file"} is not a supported file type.`, 415);
  if (file.size > limit) throw new UploadError(`${file.name || "That file"} is larger than ${limitLabel}.`, 413);
  const response = await wpAdminFetch("/media", { method: "POST", headers: { "Content-Type": file.type, "Content-Disposition": `attachment; filename="${(file.name || "upload").replace(/[^\w.\-]/g, "_")}"` }, body: await file.arrayBuffer() });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) throw new UploadError(data?.message || "WordPress could not store the upload.", response.status >= 400 ? response.status : 502);
  const id = Number(data.id);
  if (alt.trim()) await wpAdminFetch(`/media/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alt_text: alt.trim() }) }).catch(() => undefined);
  return { id, url: String(data.source_url), alt: alt.trim(), mime: String(data.mime_type || file.type), width: Number(data.media_details?.width) || null, height: Number(data.media_details?.height) || null };
}
