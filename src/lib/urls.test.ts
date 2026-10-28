import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

/* Test URL rewriting, especially:
   - mediaUrl() and mediaOriginUrl() behavior with and without NEXT_PUBLIC_MEDIA_ORIGIN
   - Percent-encoding preservation (WordPress lowercase %e0%b4... vs uppercase %E0%B4)
   - Media host detection (WordPress, site, Photon)
   - Path preservation (no re-encoding that would break Malayalam slugs)
   - Trailing slash handling
 */

describe("URL rewriting", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("mediaOriginUrl() with MEDIA_ORIGIN unset (WordPress mode)", () => {
    beforeEach(() => {
      // WordPress mode: no NEXT_PUBLIC_MEDIA_ORIGIN
      delete process.env.NEXT_PUBLIC_MEDIA_ORIGIN;
    });

    it("returns WordPress origin for valid media URLs", async () => {
      const { mediaOriginUrl } = await import("@/lib/urls");
      const url = "https://admin.islamonlive.in/wp-content/uploads/2024/01/test.jpg";
      const result = mediaOriginUrl(url);
      expect(result).toMatch(/https:\/\/.+wp-content\/uploads\/2024\/01\/test\.jpg/);
      expect(result).toContain("wp-content/uploads/2024/01/test.jpg");
    });

    it("preserves percent-encoded Malayalam slugs (lowercase hex)", async () => {
      const { mediaOriginUrl } = await import("@/lib/urls");
      // WordPress stores these lowercase
      const url = "https://admin.islamonlive.in/wp-content/uploads/2024/01/%e0%b4%b8%e0%b4%bf%e0%b4%b1.jpg";
      const result = mediaOriginUrl(url);
      expect(result).toContain("%e0%b4%b8%e0%b4%bf%e0%b4%b1.jpg");
      expect(result).not.toContain("%E0%B4");
    });

    it("returns unmodified URL for non-media URLs", async () => {
      const { mediaOriginUrl } = await import("@/lib/urls");
      const url = "https://example.com/some/page.html";
      const result = mediaOriginUrl(url);
      expect(result).toBe(url);
    });

    it("handles Photon URLs (i0.wp.com)", async () => {
      const { mediaOriginUrl } = await import("@/lib/urls");
      const url = "https://i0.wp.com/admin.islamonlive.in/wp-content/uploads/2024/01/test.jpg";
      const result = mediaOriginUrl(url);
      expect(result).toContain("wp-content/uploads/2024/01/test.jpg");
    });
  });

  describe("mediaOriginUrl() with MEDIA_ORIGIN set (mongo mode with CDN)", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MEDIA_ORIGIN = "https://d4dx-storage.blr1.cdn.digitaloceanspaces.com/islamonlive";
    });

    it("returns CDN origin for valid media URLs", async () => {
      const { mediaOriginUrl } = await import("@/lib/urls");
      const url = "https://admin.islamonlive.in/wp-content/uploads/2024/01/test.jpg";
      const result = mediaOriginUrl(url);
      expect(result).toMatch(/^https:\/\/d4dx-storage\.blr1\.cdn\.digitaloceanspaces\.com\/islamonlive/);
      expect(result).toContain("wp-content/uploads/2024/01/test.jpg");
    });

    it("preserves percent-encoded Malayalam slugs on CDN", async () => {
      const { mediaOriginUrl } = await import("@/lib/urls");
      const url = "https://admin.islamonlive.in/wp-content/uploads/2024/01/%e0%b4%b8%e0%b4%bf%e0%b4%b1.jpg";
      const result = mediaOriginUrl(url);
      expect(result).toContain("%e0%b4%b8%e0%b4%bf%e0%b4%b1.jpg");
    });

    it("handles spaces and other special characters in filenames", async () => {
      const { mediaOriginUrl } = await import("@/lib/urls");
      // Space encoded as %20
      const url = "https://admin.islamonlive.in/wp-content/uploads/2024/01/my%20file.jpg";
      const result = mediaOriginUrl(url);
      expect(result).toContain("my%20file.jpg");
    });

    it("returns unmodified URL for non-media URLs", async () => {
      const { mediaOriginUrl } = await import("@/lib/urls");
      const url = "https://example.com/some/page.html";
      const result = mediaOriginUrl(url);
      expect(result).toBe(url);
    });

    it("handles Photon URLs pointing to CDN", async () => {
      const { mediaOriginUrl } = await import("@/lib/urls");
      const url = "https://i0.wp.com/admin.islamonlive.in/wp-content/uploads/2024/01/test.jpg";
      const result = mediaOriginUrl(url);
      expect(result).toMatch(/^https:\/\/d4dx-storage\.blr1\.cdn\.digitaloceanspaces\.com\/islamonlive/);
      expect(result).toContain("wp-content/uploads/2024/01/test.jpg");
    });
  });

  describe("mediaUrl() with both modes", () => {
    it("produces public site URL for media (unchanged from WordPress mode)", async () => {
      delete process.env.NEXT_PUBLIC_MEDIA_ORIGIN;
      const { mediaUrl } = await import("@/lib/urls");
      const url = "https://admin.islamonlive.in/wp-content/uploads/2024/01/test.jpg";
      const result = mediaUrl(url);
      expect(result).toContain("https://islamonlive.in/wp-content/uploads/2024/01/test.jpg");
    });

    it("preserves site URL regardless of MEDIA_ORIGIN", async () => {
      process.env.NEXT_PUBLIC_MEDIA_ORIGIN = "https://d4dx-storage.blr1.cdn.digitaloceanspaces.com/islamonlive";
      vi.resetModules();
      const { mediaUrl } = await import("@/lib/urls");
      const url = "https://admin.islamonlive.in/wp-content/uploads/2024/01/test.jpg";
      const result = mediaUrl(url);
      // mediaUrl always returns the public site URL (for HTML content)
      expect(result).toContain("https://islamonlive.in/wp-content/uploads/2024/01/test.jpg");
    });
  });

  /* Share images must stay on the public host whatever the copy points at:
     the Yoast og:image fallback is the featured image, which mongo mode already
     moved onto the CDN, and stored Yoast data still names the old admin host. */
  describe("CDN and legacy hosts map back to the public site", () => {
    const CDN = "https://d4dx-storage.blr1.cdn.digitaloceanspaces.com/islamonlive";
    beforeEach(() => {
      process.env.NEXT_PUBLIC_MEDIA_ORIGIN = CDN;
    });
    afterEach(() => {
      delete process.env.NEXT_PUBLIC_MEDIA_ORIGIN;
      delete process.env.WORDPRESS_API_URL;
    });

    it("rewrites a CDN upload URL to the site", async () => {
      const { rewriteUrl, mediaUrl } = await import("@/lib/urls");
      const url = `${CDN}/wp-content/uploads/2026/10/hamv-scaled.avif`;
      expect(rewriteUrl(url, true)).toBe("https://islamonlive.in/wp-content/uploads/2026/10/hamv-scaled.avif");
      expect(mediaUrl(url)).toBe("https://islamonlive.in/wp-content/uploads/2026/10/hamv-scaled.avif");
    });

    it("keeps a CDN URL on the CDN for next/image", async () => {
      const { mediaOriginUrl } = await import("@/lib/urls");
      const url = `${CDN}/wp-content/uploads/2026/10/a.jpg`;
      expect(mediaOriginUrl(url)).toBe(url);
    });

    it("leaves other objects in the same bucket alone", async () => {
      const { rewriteUrl } = await import("@/lib/urls");
      const other = "https://d4dx-storage.blr1.cdn.digitaloceanspaces.com/another-site/wp-content/uploads/a.jpg";
      expect(rewriteUrl(other, true)).toBe(other);
    });

    it("treats a CDN upload as internal, so JSON-LD rewriting reaches it", async () => {
      const { isInternalUrl } = await import("@/lib/urls");
      expect(isInternalUrl(`${CDN}/wp-content/uploads/2026/10/a.jpg`)).toBe(true);
      expect(isInternalUrl("https://d4dx-storage.blr1.cdn.digitaloceanspaces.com/another-site/a.jpg")).toBe(false);
    });

    it("moves admin.islamonlive.in article links onto the site whatever WORDPRESS_API_URL names", async () => {
      process.env.WORDPRESS_API_URL = "https://wp-backend.example.com/wp-json/wp/v2";
      const { rewriteUrl, isInternalUrl } = await import("@/lib/urls");
      expect(isInternalUrl("https://admin.islamonlive.in/opinion/foo/")).toBe(true);
      expect(rewriteUrl("https://admin.islamonlive.in/opinion/foo/")).toBe("/opinion/foo/");
      expect(rewriteUrl("https://admin.islamonlive.in/opinion/foo/", true)).toBe("https://islamonlive.in/opinion/foo/");
    });

    it("rewrites admin.islamonlive.in even when WORDPRESS_API_URL names another host", async () => {
      process.env.WORDPRESS_API_URL = "https://wp-backend.example.com/wp-json/wp/v2";
      const { rewriteUrl } = await import("@/lib/urls");
      const url = "https://admin.islamonlive.in/wp-content/uploads/2026/08/comst-scaled.jpeg";
      expect(rewriteUrl(url, true)).toBe("https://islamonlive.in/wp-content/uploads/2026/08/comst-scaled.jpeg");
    });
  });

  describe("percent-encoding edge cases", () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_MEDIA_ORIGIN;
    });

    it("preserves zero-width joiner in Malayalam filenames", async () => {
      const { mediaOriginUrl } = await import("@/lib/urls");
      // %e2%80%8d is the zero-width joiner
      const url = "https://admin.islamonlive.in/wp-content/uploads/2024/01/%e0%b4%b8%e0%b4%bf%e2%80%8d%e0%b4%b1.jpg";
      const result = mediaOriginUrl(url);
      expect(result).toContain("%e2%80%8d");
    });

    it("does not re-encode already-encoded paths", async () => {
      const { mediaOriginUrl } = await import("@/lib/urls");
      const url = "https://admin.islamonlive.in/wp-content/uploads/2024/01/%e0%b4%b8.jpg";
      const result = mediaOriginUrl(url);
      // Should NOT be double-encoded to %25e0%25b4%25b8
      expect(result).toContain("%e0%b4%b8");
      expect(result).not.toContain("%25");
    });
  });

  describe("rewriteUrl() preserves behavior", () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_MEDIA_ORIGIN;
    });

    it("rewrites WordPress media to public site", async () => {
      const { rewriteUrl } = await import("@/lib/urls");
      const url = "https://admin.islamonlive.in/wp-content/uploads/2024/01/test.jpg";
      const result = rewriteUrl(url);
      expect(result).toContain("https://islamonlive.in/wp-content/uploads/2024/01/test.jpg");
    });

    it("rewrites WordPress permalinks to relative paths", async () => {
      const { rewriteUrl } = await import("@/lib/urls");
      const url = "https://admin.islamonlive.in/opinion/test-article/";
      const result = rewriteUrl(url);
      expect(result).toBe("/opinion/test-article/");
    });

    it("returns external URLs unchanged", async () => {
      const { rewriteUrl } = await import("@/lib/urls");
      const url = "https://example.com/some/page";
      const result = rewriteUrl(url);
      expect(result).toBe(url);
    });
  });

  describe("toSitePath() preserves percent-encoding", () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_MEDIA_ORIGIN;
    });

    it("converts WordPress URL to site path with trailing slash", async () => {
      const { toSitePath } = await import("@/lib/urls");
      const url = "https://admin.islamonlive.in/opinion/test/";
      const result = toSitePath(url);
      expect(result).toBe("/opinion/test/");
    });

    it("preserves lowercase percent-encoding in Malayalam paths", async () => {
      const { toSitePath } = await import("@/lib/urls");
      const url = "https://admin.islamonlive.in/opinion/%e0%b4%b8%e0%b4%bf%e0%b4%b1/";
      const result = toSitePath(url);
      expect(result).toBe("/opinion/%e0%b4%b8%e0%b4%bf%e0%b4%b1/");
      expect(result).not.toContain("%E0%B4");
    });

    it("adds trailing slash when missing", async () => {
      const { toSitePath } = await import("@/lib/urls");
      const url = "https://admin.islamonlive.in/opinion/test";
      const result = toSitePath(url);
      expect(result).toBe("/opinion/test/");
    });

    it("preserves query string but drops fragment", async () => {
      const { toSitePath } = await import("@/lib/urls");
      const url = "https://admin.islamonlive.in/search/?q=test#results";
      const result = toSitePath(url);
      expect(result).toContain("?q=test");
      expect(result).not.toContain("#results");
    });

    it("handles path-only input without URL parsing", async () => {
      const { toSitePath } = await import("@/lib/urls");
      const path = "/opinion/test/";
      const result = toSitePath(path);
      expect(result).toBe("/opinion/test/");
    });
  });
});

describe("absoluteUploads(): article HTML saved from the admin", () => {
  /* The admin's editor shows uploads as /wp-content/… so they load through the
     admin's own origin, and that is the HTML it hands back. Stored that way, an
     RSS reader (which has no page to resolve it against) gets a broken picture;
     every migrated article stores the full https://islamonlive.in address. */
  it("turns site-relative upload addresses in src, srcset and links into full ones", async () => {
    const { absoluteUploads } = await import("@/lib/urls");
    const html = '<figure><a href="/wp-content/uploads/2026/10/a.jpg"><img src="/wp-content/uploads/2026/10/a.jpg" srcset="/wp-content/uploads/2026/10/a-300x200.jpg 300w, /wp-content/uploads/2026/10/a.jpg 900w" alt="A"></a></figure>';
    expect(absoluteUploads(html)).toBe('<figure><a href="https://islamonlive.in/wp-content/uploads/2026/10/a.jpg"><img src="https://islamonlive.in/wp-content/uploads/2026/10/a.jpg" srcset="https://islamonlive.in/wp-content/uploads/2026/10/a-300x200.jpg 300w, https://islamonlive.in/wp-content/uploads/2026/10/a.jpg 900w" alt="A"></a></figure>');
  });

  it("leaves full addresses, other paths and plain text alone", async () => {
    const { absoluteUploads } = await import("@/lib/urls");
    const html = '<p>See /wp-content/uploads/ in the text.</p><img src="https://islamonlive.in/wp-content/uploads/x.jpg"><a href="/opinion/some-post/">link</a><img src="data:image/png;base64,AAAA">';
    expect(absoluteUploads(html)).toBe(html);
  });
});
