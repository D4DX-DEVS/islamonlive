import { describe, it, expect, beforeEach } from "vitest";
import { collection } from "@/lib/db/client";
import { seedFixtures, loadFixture } from "@/test/fixtures";
import { adminRest } from "./index";
import { handlePlugins } from "./plugins";
import type { AdminRequest } from "./http";

const mockAdminUser = { id: 1, username: "testuser", role: "administrator" };

async function makeRequest(
  method: string,
  route: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<AdminRequest> {
  const url = new URL(route, "http://admin.local/");
  return {
    method,
    route,
    segments: route.split("/").filter(Boolean),
    query: url.searchParams,
    headers: new Headers(headers ?? {}),
    body: body ? JSON.stringify(body) : undefined,
    user: mockAdminUser,
  };
}

describe("plugins handler", () => {
  beforeEach(async () => {
    await seedFixtures();
  });

  describe("GET /rsfv/v1/posts (featured video read)", () => {
    it("searches posts by title", async () => {
      const posts = loadFixture("posts");
      if (posts.length > 0) {
        const searchTerm = posts[0].title.substring(0, 10);
        const req = await makeRequest("GET", `/rsfv/v1/posts?post_type=post&search=${encodeURIComponent(searchTerm)}&per_page=100`);
        const res = await handlePlugins(req);
        expect(res?.status).toBe(200);
        const data = (await res?.json()) as Array<{ id: number }>;
        expect(Array.isArray(data)).toBe(true);
      }
    });

    it("returns posts with video metadata when present", async () => {
      const posts = loadFixture("posts");
      const postWithVideo = posts.find((p) => p.featured_video?.source);
      if (postWithVideo) {
        const req = await makeRequest("GET", `/rsfv/v1/posts?post_type=post&search=${encodeURIComponent(postWithVideo.title)}&per_page=100`);
        const res = await handlePlugins(req);
        const data = (await res?.json()) as Array<Record<string, unknown>>;
        const found = data.find((p) => p.id === postWithVideo._id);
        if (found) {
          expect(found.video_source).toBeDefined();
        }
      }
    });

    it("respects per_page limit", async () => {
      const req = await makeRequest("GET", "/rsfv/v1/posts?post_type=post&per_page=5");
      const res = await handlePlugins(req);
      const data = (await res?.json()) as unknown[];
      expect(data.length).toBeLessThanOrEqual(5);
    });
  });

  describe("POST /rsfv/v1/posts/update-video (featured video update)", () => {
    it("updates featured_video source and embedUrl", async () => {
      const posts = loadFixture("posts");
      if (posts.length > 0) {
        const postId = posts[0]._id;
        const req = await makeRequest("POST", "/rsfv/v1/posts/update-video", {
          post_id: postId,
          video_source: "embed",
          embed_url: "https://www.youtube.com/embed/test",
        });
        const res = await handlePlugins(req);
        expect(res?.status).toBe(200);

        const updated = await (await collection("posts")).findOne({ _id: postId });
        expect(updated?.featured_video?.source).toBe("embed");
        expect(updated?.featured_video?.embed_url).toBe("https://www.youtube.com/embed/test");
      }
    });

    it("clears featured video when source is none", async () => {
      const posts = loadFixture("posts");
      const postWithVideo = posts.find((p) => p.featured_video?.source);
      if (postWithVideo) {
        const req = await makeRequest("POST", "/rsfv/v1/posts/update-video", {
          post_id: postWithVideo._id,
          video_source: "none",
        });
        const res = await handlePlugins(req);
        expect(res?.status).toBe(200);

        const updated = await (await collection("posts")).findOne({ _id: postWithVideo._id });
        expect(updated?.featured_video?.source || "").toBe("");
      }
    });

    it("attaches an uploaded video by video_id, as lib/featured-video.ts sends it", async () => {
      const post = loadFixture("posts")[0];
      const media = await collection("media");
      await media.insertOne({ ...loadFixture("media")[0], _id: 9_200_001, mime_type: "video/mp4", source_url: "https://islamonlive.in/wp-content/uploads/2026/10/clip.mp4" });
      const res = await handlePlugins(await makeRequest("POST", "/rsfv/v1/posts/update-video", { post_id: post._id, video_source: "self", video_id: 9_200_001 }));
      expect(res?.status).toBe(200);
      const updated = await (await collection("posts")).findOne({ _id: post._id });
      expect(updated?.featured_video).toMatchObject({ source: "self", media_id: 9_200_001, url: "https://islamonlive.in/wp-content/uploads/2026/10/clip.mp4" });

      // a self video with no file clears it, as the plugin does
      await handlePlugins(await makeRequest("POST", "/rsfv/v1/posts/update-video", { post_id: post._id, video_source: "self", video_id: 0 }));
      expect((await (await collection("posts")).findOne({ _id: post._id }))?.featured_video).toBeNull();
    });

    it("refuses a video_id that is not a video", async () => {
      const post = loadFixture("posts")[0];
      const image = loadFixture("media").find((m) => m.mime_type?.startsWith("image/"))!;
      const res = await handlePlugins(await makeRequest("POST", "/rsfv/v1/posts/update-video", { post_id: post._id, video_source: "self", video_id: image._id }));
      expect(res?.status).toBe(400);
    });

    it("returns 404 for nonexistent post", async () => {
      const req = await makeRequest("POST", "/rsfv/v1/posts/update-video", {
        post_id: 999999,
        video_source: "embed",
        embed_url: "https://example.com",
      });
      const res = await handlePlugins(req);
      expect(res?.status).toBe(404);
    });
  });

  describe("POST /mpp/v2/profile-image/change (profile photo)", () => {
    it("updates user avatars from media_id", async () => {
      const users = loadFixture("users");
      const media = loadFixture("media");
      if (users.length > 0 && media.length > 0) {
        const req = await makeRequest("POST", "/mpp/v2/profile-image/change", {
          media_id: media[0]._id,
        });
        req.user = { id: users[0]._id, username: users[0].username || "user", role: users[0].role };
        const res = await handlePlugins(req);
        expect(res?.status).toBe(200);

        const updated = await (await collection("users")).findOne({ _id: users[0]._id });
        expect(updated?.avatars).toBeDefined();
        expect(Object.keys(updated?.avatars || {}).length).toBeGreaterThan(0);
      }
    });

    it("sets avatar URLs from media source_url", async () => {
      const users = loadFixture("users");
      const media = loadFixture("media");
      if (users.length > 0 && media.length > 0) {
        const req = await makeRequest("POST", "/mpp/v2/profile-image/change", {
          media_id: media[0]._id,
        });
        req.user = { id: users[0]._id, username: users[0].username || "user", role: users[0].role };
        expect((await handlePlugins(req))?.status).toBe(200);
        const updated = await (await collection("users")).findOne({ _id: users[0]._id });
        expect(updated?.avatars["full"]).toContain(media[0].source_url);
      }
    });

    it("returns 404 for nonexistent media", async () => {
      const users = loadFixture("users");
      if (users.length > 0) {
        const req = await makeRequest("POST", "/mpp/v2/profile-image/change", {
          media_id: 999999,
        });
        req.user = { id: users[0]._id, username: users[0].username || "user", role: users[0].role };
        const res = await handlePlugins(req);
        expect(res?.status).toBe(404);
      }
    });

    it("sets the photo of the user the authors screen names, and only an administrator may name someone else", async () => {
      const [media] = loadFixture("media");
      const [, other] = loadFixture("users");
      const body = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: other._id, media_id: media._id }) };
      expect((await adminRest("/mpp/v2/profile-image/change", body, { id: 1, username: "e", role: "editor" })).status).toBe(403);
      expect((await adminRest("/mpp/v2/profile-image/change", body, { id: 1, username: "a", role: "administrator" })).status).toBe(200);
      expect((await (await collection("users")).findOne({ _id: other._id }))?.avatar_url).toBe(media.source_url);
      expect((await adminRest("/mpp/v2/profile-image/change", body, { id: 0, username: "x", role: "" })).status).toBe(403);
    });
  });

  it("returns null for non-plugin routes", async () => {
    const req = await makeRequest("GET", "/wp/v2/posts");
    const res = await handlePlugins(req);
    expect(res).toBeNull();
  });
});
