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
