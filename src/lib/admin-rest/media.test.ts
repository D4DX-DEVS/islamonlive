import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/spaces", () => ({
  uploadToSpaces: vi.fn(async (key: string) => `islamonlive/${key}`),
  deleteFromSpaces: vi.fn(async () => true),
  existsInSpaces: vi.fn(async () => false),
}));

import { collection } from "@/lib/db/client";
import { deleteFromSpaces, existsInSpaces, uploadToSpaces } from "@/lib/spaces";
import { loadFixture, seedFixtures } from "@/test/fixtures";
import { adminRest } from "./index";

/* Through adminRest, with the bodies lib/admin-media.ts and the posts route
   really send (an ArrayBuffer), so a handler that only copes with test-shaped
   input cannot pass. */

const editor = { id: 1, username: "editor", role: "editor" };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 0x10, 0x45, 0x78, 0x69, 0x66, 0, 0]); // EXIF, as phones write
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 0x20, 0, 0, 0, 0x10]);
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);

const upload = (bytes: Uint8Array, type: string, name: string) =>
  adminRest("/wp/v2/media", { method: "POST", headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"` }, body: bytes.slice().buffer }, editor);
const post = (path: string, body: unknown) => adminRest(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, editor);

describe("/wp/v2/media", () => {
  beforeEach(async () => {
    await seedFixtures();
    vi.mocked(uploadToSpaces).mockClear();
    vi.mocked(deleteFromSpaces).mockClear();
    vi.mocked(existsInSpaces).mockResolvedValue(false);
  });

  it("stores an editor's EXIF JPEG under this month's uploads folder and answers like WordPress", async () => {
    const res = await upload(JPEG, "image/jpeg", "Mosque_photo.jpg");
    expect(res.status).toBe(201);
    const data = await res.json();
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date()).replace("-", "/");
    expect(data).toMatchObject({ type: "attachment", media_type: "image", mime_type: "image/jpeg", title: { raw: "Mosque_photo" } });
    expect(data.source_url).toBe(`https://islamonlive.in/wp-content/uploads/${month}/Mosque_photo.jpg`);
    expect(vi.mocked(uploadToSpaces)).toHaveBeenCalledWith(`wp-content/uploads/${month}/Mosque_photo.jpg`, "image/jpeg", expect.any(Uint8Array));
    const stored = await (await collection("media")).findOne({ _id: data.id });
    expect(stored).toMatchObject({ spaces_key: `islamonlive/wp-content/uploads/${month}/Mosque_photo.jpg`, status: "inherit", author_id: 1 });
    expect(stored?.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("gives a new id above every migrated post and attachment", async () => {
    const ids = [...loadFixture("posts"), ...loadFixture("media")].map((d) => d._id);
    const data = await (await upload(PNG, "image/png", "a.png")).json();
    expect(data.id).toBeGreaterThan(Math.max(...ids));
    expect(data.media_details).toMatchObject({ width: 32, height: 16 });
  });

  it("takes article videos", async () => {
    const res = await upload(MP4, "video/mp4", "clip.mp4");
    expect(res.status).toBe(201);
    expect((await res.json()).media_type).toBe("video");
  });

  it("numbers a clashing file name the way wp_unique_filename does", async () => {
    vi.mocked(existsInSpaces).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const data = await (await upload(PNG, "image/png", "logo.png")).json();
    expect(data.source_url).toMatch(/\/logo-1\.png$/);
  });

  it("refuses bytes that do not match the declared type (an HTML or SVG page renamed .jpg)", async () => {
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");
    expect((await upload(html, "image/jpeg", "x.jpg")).status).toBe(415);
    expect((await upload(html, "image/svg+xml", "x.svg")).status).toBe(415);
    expect(vi.mocked(uploadToSpaces)).not.toHaveBeenCalled();
  });

  it("reports a storage failure instead of saving a record without a file", async () => {
    vi.mocked(uploadToSpaces).mockResolvedValueOnce(null);
    const before = await (await collection("media")).countDocuments();
    expect((await upload(PNG, "image/png", "a.png")).status).toBe(500);
    expect(await (await collection("media")).countDocuments()).toBe(before);
  });

  it("updates alt text, caption and title", async () => {
    const media = loadFixture("media")[0];
    const res = await post(`/wp/v2/media/${media._id}`, { alt_text: "Alt", caption: "Cap", title: "T" });
    expect(res.status).toBe(200);
    expect(await (await collection("media")).findOne({ _id: media._id })).toMatchObject({ alt_text: "Alt", caption: "Cap", title: "T" });
  });

  it("deletes the record and its files by their stored keys, only with force=true", async () => {
    const media = loadFixture("media").find((m) => m.spaces_key && Object.keys(m.sizes).length)!;
    expect((await adminRest(`/wp/v2/media/${media._id}`, { method: "DELETE" }, editor)).status).toBe(501);
    const res = await adminRest(`/wp/v2/media/${media._id}?force=true`, { method: "DELETE" }, editor);
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(true);
    const keys = vi.mocked(deleteFromSpaces).mock.calls.map((c) => c[0]);
    expect(keys).toContain(media.spaces_key);
    expect(keys.every((k) => k.startsWith("islamonlive/wp-content/uploads/") && !k.startsWith("islamonlive/islamonlive/"))).toBe(true);
    expect(await (await collection("media")).findOne({ _id: media._id })).toBeNull();
  });

  it("answers 404 for an unknown id, as WordPress does", async () => {
    expect((await adminRest("/wp/v2/media/99999999", {}, editor)).status).toBe(404);
  });

  it("is closed to anyone below editor", async () => {
    const res = await adminRest("/wp/v2/media", { method: "POST", headers: { "Content-Type": "image/png" }, body: PNG.slice().buffer }, { id: 9, username: "a", role: "author" });
    expect(res.status).toBe(403);
  });
});
