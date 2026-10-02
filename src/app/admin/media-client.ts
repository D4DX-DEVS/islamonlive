import { useEffect, useState } from "react";
import { IMAGE_TYPES, UPLOAD_LIMIT_BYTES, UPLOAD_LIMIT_LABEL, VIDEO_TYPES } from "@/lib/admin-upload";

export type UploadedMedia = { id: number; url: string; alt: string; mime: string; width: number | null; height: number | null };

/** A photo over this is re-saved smaller before it is sent; the limit itself is the host's, not ours. */
const SHRINK_ABOVE = UPLOAD_LIMIT_BYTES * 0.75;
const LONGEST_EDGE = 2000;

const mebibytes = (bytes: number) => `${(bytes / 1_048_576).toFixed(1)} MB`;

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Makes a picture small enough to upload. Phone photos are routinely 5–10 MB,
 * more than the host accepts in one request, so large ones are re-saved at up
 * to 2000 px as WebP (JPEG where the browser cannot write WebP). Anything that
 * already fits, and animated GIFs, go through untouched.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error(`${file.name} is not a PNG, JPG, WebP or GIF image.`);
  if (file.size <= SHRINK_ABOVE) return file;
  if (file.type === "image/gif") throw new Error(`${file.name} is ${mebibytes(file.size)}; GIFs can be up to ${UPLOAD_LIMIT_LABEL}.`);
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error(`${file.name} could not be read as an image.`);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  for (const scale of [1, 0.75, 0.55]) {
    const ratio = Math.min(1, (LONGEST_EDGE * scale) / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) break;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.86, 0.72, 0.58]) {
      let blob = await encode(canvas, "image/webp", quality);
      let extension = "webp";
      if (blob?.type !== "image/webp") {
        // No WebP encoder here; JPEG has no transparency, so paint white behind the picture first.
        context.globalCompositeOperation = "destination-over"; context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
        blob = await encode(canvas, "image/jpeg", quality); extension = "jpg";
      }
      if (blob && blob.size <= UPLOAD_LIMIT_BYTES) { bitmap.close(); return new File([blob], `${baseName}.${extension}`, { type: blob.type }); }
    }
  }
  bitmap.close();
  throw new Error(`${file.name} is still larger than ${UPLOAD_LIMIT_LABEL} after shrinking it.`);
}

/** Checks a video against what can be uploaded here, before any bytes are sent. */
export function checkVideo(file: File): string | null {
  if (!VIDEO_TYPES.includes(file.type)) return `${file.name} is not an MP4, WebM, MOV or OGG video.`;
  if (file.size > UPLOAD_LIMIT_BYTES) return `${file.name} is ${mebibytes(file.size)}. Videos can be up to ${UPLOAD_LIMIT_LABEL} here; for anything longer, upload it to YouTube or Vimeo and paste the link.`;
  return null;
}

/** Sends a file to the WordPress media library through the admin API. */
export async function uploadMedia(file: File, kind: "image" | "video", alt = ""): Promise<UploadedMedia> {
  const form = new FormData();
  form.set("file", file); form.set("kind", kind);
  if (alt.trim()) form.set("alt", alt.trim());
  let response: Response;
  try { response = await fetch("/api/admin/media/", { method: "POST", body: form }); } catch { throw new Error("Could not reach the server. Check the connection and try again."); }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.item) throw new Error(body?.error || (response.status === 413 ? `The server refused the upload because it is larger than ${UPLOAD_LIMIT_LABEL}.` : "The upload did not go through. Try again."));
  return body.item as UploadedMedia;
}

/** A temporary address for showing a chosen file before it is uploaded; null until the browser has made it. */
export function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const next = file ? URL.createObjectURL(file) : null;
    let active = true;
    queueMicrotask(() => { if (active) setUrl(next); });
    return () => { active = false; if (next) URL.revokeObjectURL(next); };
  }, [file]);
  return url;
}
