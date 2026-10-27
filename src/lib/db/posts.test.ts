import { beforeAll, describe, expect, it } from "vitest";
import { collection } from "@/lib/db/client";
import { categorySubtree, getPostBySlug, getPosts, getPostsPage, slugCandidates } from "@/lib/db/posts";
import type { PostDoc } from "@/lib/db/types";
import { seedFixtures, loadFixture } from "@/test/fixtures";
import { author, authorAvatar, featuredImage, postPath, primaryCategory } from "@/lib/wp-model";

const fixturePosts = loadFixture("posts");
const visible = fixturePosts
  .filter((p) => p.status === "publish")
  .sort((a, b) => (b.published_at!.getTime() - a.published_at!.getTime()) || b._id - a._id);

describe("db/posts", () => {
  beforeAll(async () => {
    await seedFixtures();
  });

  describe("lists", () => {
    it("returns the newest published posts first, 12 by default, ties broken by higher id", async () => {
      const posts = await getPosts();
      expect(posts.map((p) => p.id)).toEqual(visible.slice(0, 12).map((p) => p._id));
    });

    it("never lists drafts, pending, private or trashed posts", async () => {
      const hidden = new Set(fixturePosts.filter((p) => p.status !== "publish").map((p) => p._id));
      const { items } = await getPostsPage({ perPage: 100, page: 1 });
      expect(items.some((p) => hidden.has(p.id))).toBe(false);
    });

    it("reports WordPress-style totals and pages", async () => {
      const page = await getPostsPage({ perPage: 10 });
      expect(page.total).toBe(visible.length);
      expect(page.totalPages).toBe(Math.ceil(visible.length / 10));
    });

    it("answers a page past the end with an empty page, as wordpress.ts does for WP's 400", async () => {
      expect(await getPostsPage({ perPage: 10, page: 9999 })).toEqual({ items: [], total: 0, totalPages: 0 });
    });

    it("caps perPage at WordPress's 100", async () => {
      const { items } = await getPostsPage({ perPage: 500 });
      expect(items.length).toBe(Math.min(100, visible.length));
    });

    it("leaves the body and SEO head out of list items, like WP's _fields list", async () => {
      const [post] = await getPosts({ perPage: 1 });
      expect(post).not.toHaveProperty("content");
      expect(post).not.toHaveProperty("yoast_head_json");
      expect(post.title.rendered).toBeTruthy();
      expect(post.excerpt).toHaveProperty("rendered");
    });

    it("filters by tag and by author", async () => {
      const tagged = visible.find((p) => p.tags.length)!;
      const byTag = await getPosts({ tags: [tagged.tags[0]], perPage: 100 });
      expect(byTag.length).toBeGreaterThan(0);
      expect(byTag.every((p) => (p as { tags?: number[] }).tags?.includes(tagged.tags[0]))).toBe(true);

      const authorId = visible[0].author_id!;
      const byAuthor = await getPosts({ author: authorId, perPage: 100 });
      expect(byAuthor.map((p) => p.id)).toEqual(visible.filter((p) => p.author_id === authorId).slice(0, 100).map((p) => p._id));
    });

    it("filters by category, and by the whole subtree with includeChildren", async () => {
      const categories = loadFixture("categories");
      const parent = categories.find((c) => categories.some((child) => child.parent_id === c._id))!;
      const subtree = await categorySubtree([parent._id]);
      expect(subtree).toContain(parent._id);
      expect(subtree.length).toBeGreaterThan(1);

      const direct = await getPostsPage({ categories: [parent._id], perPage: 100 });
      const whole = await getPostsPage({ categories: [parent._id], includeChildren: true, perPage: 100 });
      expect(direct.total).toBe(visible.filter((p) => p.categories.includes(parent._id)).length);
      expect(whole.total).toBe(visible.filter((p) => p.categories.some((c) => subtree.includes(c))).length);
      expect(whole.total).toBeGreaterThanOrEqual(direct.total);
    });
  });

  describe("embeds", () => {
    it("embeds terms in the post's own category order, categories first, so primaryCategory is unchanged", async () => {
      const multi = visible.find((p) => p.categories.length > 1)!;
      const post = (await getPostBySlug(multi.slug))!;
      const [cats, tags] = post._embedded!["wp:term"]!;
      expect(cats.map((t) => t.id)).toEqual(multi.categories);
      expect(cats.every((t) => t.taxonomy === "category")).toBe(true);
      expect(tags.every((t) => t.taxonomy === "post_tag")).toBe(true);
      expect(primaryCategory(post)?.slug).toBe(cats[0].slug);
    });

    it("builds generated image sizes next to the original upload", async () => {
      const withImage = visible.find((p) => p.featured_media_id)!;
      const post = (await getPostBySlug(withImage.slug))!;
      const media = post._embedded!["wp:featuredmedia"]![0];
      const folder = media.source_url.slice(0, media.source_url.lastIndexOf("/") + 1);
      for (const size of Object.values(media.media_details?.sizes ?? {})) expect(size.source_url.startsWith(folder)).toBe(true);
      expect(featuredImage(post)?.url).toContain("/wp-content/uploads/");
    });

    it("treats a Gravatar-only author as having no photo, like WP's mpp_avatar {errors}", async () => {
      const users = loadFixture("users");
      // `avatars` also carries WP's {errors, error_data} objects for photo-less users; only strings are URLs
      const urls = (u: (typeof users)[number]) => Object.values(u.avatars ?? {}).filter((v): v is string => typeof v === "string");
      const gravatarOnly = users.find((u) => urls(u).every((url) => /gravatar\.com/.test(url)));
      const withPhoto = users.find((u) => urls(u).some((url) => !/gravatar\.com/.test(url)));
      expect(gravatarOnly && withPhoto).toBeTruthy();
      for (const [user, expectPhoto] of [[gravatarOnly, false], [withPhoto, true]] as const) {
        if (!user) continue;
        const doc = visible.find((p) => p.author_id === user._id);
        if (!doc) continue;
        const post = (await getPostBySlug(doc.slug))!;
        expect(authorAvatar(post) !== null).toBe(expectPhoto);
        expect(author(post)?.name).toBe(user.name);
      }
    });
  });

  describe("single post by slug", () => {
    it("returns the body and Yoast head", async () => {
      const doc = visible[0];
      const post = (await getPostBySlug(doc.slug))!;
      expect(post.content.rendered).toBe(doc.content);
      expect(post.yoast_head_json?.canonical ?? post.yoast_head_json?.title).toBeTruthy();
      expect(postPath(post)).toBe(doc.path);
    });

    it("finds a Malayalam post from the decoded segment, the stored form and an uppercase re-encoding", async () => {
      const encoded = visible.find((p) => /%[0-9a-f]{2}/.test(p.slug))!;
      const decoded = decodeURIComponent(encoded.slug);
      for (const input of [decoded, encoded.slug, encoded.slug.toUpperCase().replace(/%([0-9A-F]{2})/g, "%$1")]) {
        expect((await getPostBySlug(input))?.id).toBe(encoded._id);
      }
      expect(slugCandidates(decoded)).toContain(encoded.slug);
    });

    it("hides unpublished posts", async () => {
      const draft = fixturePosts.find((p) => p.status !== "publish" && p.status !== "future");
      if (draft) expect(await getPostBySlug(draft.slug)).toBeNull();
      expect(await getPostBySlug("no-such-post-anywhere")).toBeNull();
    });

    it("publishes a scheduled post once its time has passed, and not before", async () => {
      const posts = await collection("posts");
      const base = { ...visible[0], content_raw: null } as PostDoc;
      const due = { ...base, _id: 9_000_001, slug: "scheduled-due", status: "future" as const, published_at: new Date(Date.now() - 60_000) };
      const later = { ...base, _id: 9_000_002, slug: "scheduled-later", status: "future" as const, published_at: new Date(Date.now() + 3_600_000) };
      await posts.insertMany([due, later]);
      try {
        expect((await getPostBySlug("scheduled-due"))?.id).toBe(9_000_001);
        expect(await getPostBySlug("scheduled-later")).toBeNull();
        expect((await getPosts({ perPage: 1 }))[0].id).toBe(9_000_001);
      } finally {
        await posts.deleteMany({ _id: { $in: [9_000_001, 9_000_002] } });
      }
    });
  });
});
