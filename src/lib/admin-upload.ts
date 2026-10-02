/*
 * What the admin may upload, shared by the browser (to say no early) and the
 * server (which has the final word). No imports, so either side can load it.
 *
 * Uploads go browser → this app → WordPress, because the WordPress login lives
 * in an encrypted server-side cookie. Serverless hosts (Vercel) refuse request
 * bodies over 4.5 MB before they reach us, so the cap sits just under that.
 */
export const UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;
export const UPLOAD_LIMIT_LABEL = "4 MB";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/ogg"];

/** A profile photo is held to a smaller limit than other uploads. */
export const PHOTO_LIMIT_BYTES = 2 * 1024 * 1024;
