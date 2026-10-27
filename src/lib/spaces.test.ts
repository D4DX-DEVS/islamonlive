import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(() => ({ send })),
  PutObjectCommand: vi.fn((input) => ({ kind: "put", input })),
  DeleteObjectCommand: vi.fn((input) => ({ kind: "delete", input })),
  HeadObjectCommand: vi.fn((input) => ({ kind: "head", input })),
}));

import { deleteFromSpaces, existsInSpaces, objectKey, uploadToSpaces } from "./spaces";

describe("spaces", () => {
  beforeEach(() => {
    send.mockReset();
    vi.stubEnv("DO_SPACES_FOLDER", "islamonlive");
    vi.stubEnv("DO_SPACES_BUCKET", "bucket");
  });

  it("puts uploads under the folder, public and immutable, and returns the object key", async () => {
    send.mockResolvedValueOnce({});
    const key = await uploadToSpaces("wp-content/uploads/2026/10/a.jpg", "image/jpeg", new Uint8Array([1]));
    expect(key).toBe("islamonlive/wp-content/uploads/2026/10/a.jpg");
    const { input } = send.mock.calls[0][0];
    expect(input).toMatchObject({ Bucket: "bucket", Key: key, ContentType: "image/jpeg", ACL: "public-read", CacheControl: "public, max-age=31536000, immutable" });
  });

  it("returns null when Spaces refuses an upload", async () => {
    send.mockRejectedValueOnce(Object.assign(new Error("denied"), { name: "AccessDenied" }));
    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
    expect(await uploadToSpaces("wp-content/uploads/x.jpg", "image/jpeg", "x")).toBeNull();
  });

  it("deletes by the full key a media record stores, without adding the folder twice", async () => {
    send.mockResolvedValueOnce({});
    expect(await deleteFromSpaces("islamonlive/wp-content/uploads/2016/03/badeeu33.jpg")).toBe(true);
    expect(send.mock.calls[0][0].input.Key).toBe("islamonlive/wp-content/uploads/2016/03/badeeu33.jpg");
  });

  it("checks existence by site path", async () => {
    send.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("NotFound"));
    expect(await existsInSpaces("wp-content/uploads/a.jpg")).toBe(true);
    expect(await existsInSpaces("wp-content/uploads/b.jpg")).toBe(false);
    expect(send.mock.calls[0][0].input.Key).toBe("islamonlive/wp-content/uploads/a.jpg");
  });

  it("works without a folder", () => {
    vi.stubEnv("DO_SPACES_FOLDER", "/");
    expect(objectKey("/wp-content/uploads/a.jpg")).toBe("wp-content/uploads/a.jpg");
  });
});
