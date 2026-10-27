import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/* DigitalOcean Spaces, where uploads live since WordPress went away.

   Media records keep two keys: `key` ("wp-content/uploads/2026/10/x.jpg",
   the path under the site) and `spaces_key`, the full object key with the
   islamonlive/ folder in front. Uploads take the first and return the second;
   deletes take the second, so a record can always delete its own file.

   Credentials come from DO_SPACES_KEY / DO_SPACES_SECRET and are never logged. */

// same resolution as migration/target.mjs, which filled the bucket
const folder = () => (process.env.DO_SPACES_FOLDER ?? "islamonlive").replace(/^\/+|\/+$/g, "");
const bucket = () => process.env.DO_SPACES_BUCKET || "";

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    const endpoint = process.env.DO_SPACES_ENDPOINT || "blr1.digitaloceanspaces.com";
    client = new S3Client({
      region: /([a-z]{3}\d)\.digitaloceanspaces/.exec(endpoint)?.[1] ?? "us-east-1",
      endpoint: endpoint.includes("://") ? endpoint : `https://${endpoint}`,
      credentials: { accessKeyId: process.env.DO_SPACES_KEY || "", secretAccessKey: process.env.DO_SPACES_SECRET || "" },
      forcePathStyle: false,
    });
  }
  return client;
}

/** The full object key for a site path ("wp-content/uploads/…"). */
export function objectKey(key: string): string {
  const path = key.replace(/^\/+/, "");
  return folder() ? `${folder()}/${path}` : path;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.name || error.message : "unknown error";
}

/**
 * Store a file publicly. `key` is the decoded path under the site
 * ("wp-content/uploads/2026/10/x.jpg"); returns the object key, or null when
 * Spaces refused it.
 */
export async function uploadToSpaces(key: string, mimeType: string, body: Uint8Array | string): Promise<string | null> {
  const Key = objectKey(key);
  try {
    await s3().send(new PutObjectCommand({ Bucket: bucket(), Key, Body: body, ContentType: mimeType, ACL: "public-read", CacheControl: "public, max-age=31536000, immutable" }));
    return Key;
  } catch (error) {
    console.error(`Spaces upload failed (${reason(error)})`);
    return null;
  }
}

/** Delete by full object key (a media record's spaces_key). */
export async function deleteFromSpaces(fullKey: string): Promise<boolean> {
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: fullKey }));
    return true;
  } catch (error) {
    console.error(`Spaces delete failed (${reason(error)})`);
    return false;
  }
}

/** Whether a site path already has a file, so an upload never overwrites one. */
export async function existsInSpaces(key: string): Promise<boolean> {
  try {
    await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: objectKey(key) }));
    return true;
  } catch {
    return false;
  }
}
