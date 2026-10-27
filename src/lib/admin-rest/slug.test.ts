import { describe, expect, it } from "vitest";
import { sanitizeTitle, uniqueSlug } from "@/lib/admin-rest/slug";
import { decodeEntities } from "@/lib/wp-model";
import { loadFixture } from "@/test/fixtures";

describe("sanitizeTitle (WordPress sanitize_title, save context)", () => {
  it("handles ASCII the way WordPress does", () => {
    expect(sanitizeTitle("Hello World")).toBe("hello-world");
    expect(sanitizeTitle("  Gaza: What’s next?  ")).toBe("gaza-whats-next");
    expect(sanitizeTitle("Version 2.0 — released")).toBe("version-2-0-released");
    expect(sanitizeTitle("Café déjà vu")).toBe("cafe-deja-vu");
    expect(sanitizeTitle("<b>Bold</b> & brave")).toBe("bold-brave");
    expect(sanitizeTitle("a/b 100%")).toBe("a-b-100");
  });

  it("encodes Malayalam as lowercase UTF-8 escapes and drops zero-width joiners", () => {
    expect(sanitizeTitle("ഇസ്ലാം")).toBe(encodeURIComponent("ഇസ്ലാം").toLowerCase());
    expect(sanitizeTitle("ഖുര്‍ആന്")).toBe(encodeURIComponent("ഖുര്ആന്").toLowerCase());
  });

  it("never touches Malayalam two-part vowel signs (no NFD)", () => {
    const word = "കൊണ്ട്"; // ൊ would split under NFD
    expect(decodeURIComponent(sanitizeTitle(word))).toBe(word);
  });

  it("caps slugs at 200 encoded octets without splitting a character", () => {
    const slug = sanitizeTitle("മ".repeat(100));
    expect(slug.length).toBeLessThanOrEqual(200);
    expect(slug.length % 9).toBe(0); // each മ is 3 bytes = 9 chars encoded
    expect(() => decodeURIComponent(slug)).not.toThrow();
  });

  it("reproduces the Malayalam slugs WordPress generated from titles", () => {
    /* Editors now type English slugs by hand, so only the archive's
       title-derived (percent-encoded) slugs can be checked. Slugs carrying a
       zero-width joiner/non-joiner predate WordPress stripping them and are
       left out: those characters are dropped now, by design. */
    // starts with an encoded Malayalam letter (U+0D00–0D7F); hand-typed English slugs with a stray ʿ don't count
    const derived = loadFixture("posts").filter((p) => /^%e0%b[45]/.test(p.slug) && !/%e2%80%8[cd]/.test(p.slug));
    const results = derived.map((p) => ({ want: p.slug.replace(/-\d+$/, ""), got: sanitizeTitle(decodeEntities(p.title)) }));
    const exact = results.filter(({ want, got }) => want === got);
    // the fixture slice holds a handful; checked against the whole archive on 2026-10-27 (see commit message)
    expect(derived.length).toBeGreaterThanOrEqual(4);
    expect(exact.length / derived.length).toBeGreaterThan(0.9);
  });
});

describe("uniqueSlug", () => {
  it("returns the slug when free, else -2, -3 … like wp_unique_post_slug", async () => {
    const taken = new Set(["news", "news-2"]);
    expect(await uniqueSlug("fresh", async (s) => taken.has(s))).toBe("fresh");
    expect(await uniqueSlug("news", async (s) => taken.has(s))).toBe("news-3");
  });

  it("shortens a 200-octet slug so the suffix fits, without breaking an escape", async () => {
    const long = sanitizeTitle("മ".repeat(100));
    const next = await uniqueSlug(long, async (s) => s === long);
    expect(next.length).toBeLessThanOrEqual(200);
    expect(next.endsWith("-2")).toBe(true);
    expect(() => decodeURIComponent(next)).not.toThrow();
  });
});
