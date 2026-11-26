import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/wp-admin";
import { uploadMedia, UploadError } from "@/lib/admin-media";
import { AUDIO_LIMIT_BYTES, AUDIO_TYPES, IMAGE_TYPES, UPLOAD_LIMIT_BYTES, UPLOAD_LIMIT_LABEL, VIDEO_TYPES } from "@/lib/admin-upload";

export const dynamic = "force-dynamic";

/** Uploads one image (for the article editor) or one video (for the featured video) or one audio file (article audio) to the media library. */
export async function POST(request: Request) {
  try {
    if (!await getAdminSession()) return NextResponse.json({ error: "Admin authentication required" }, { status: 401 });
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    const kind = form.get("kind");
    const allowed = kind === "video" ? VIDEO_TYPES : kind === "audio" ? AUDIO_TYPES : IMAGE_TYPES;
    const item = await uploadMedia(file, { allowed, limit: kind === "audio" ? AUDIO_LIMIT_BYTES : UPLOAD_LIMIT_BYTES, limitLabel: UPLOAD_LIMIT_LABEL, alt: String(form.get("alt") || "") });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: message.includes("authentication") ? 401 : 502 });
  }
}
