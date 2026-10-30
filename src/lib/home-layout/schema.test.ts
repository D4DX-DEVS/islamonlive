import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, blankSection, embedFor, groupSections, isScheduledOn, safeDay, safeHref, sanitizeLayout, todayInIndia, type HomeSection } from "./schema";

describe("sanitizeLayout", () => {
  it("keeps the default layout unchanged", () => {
    expect(sanitizeLayout(DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT);
  });

  it("drops unknown kinds and non-objects", () => {
    expect(sanitizeLayout([{ kind: "script" }, null, 5, { kind: "banners", id: "b" }])).toEqual([{ id: "b", kind: "banners", enabled: true, placement: "full", visibility: "all", look: { background: "", bgColor: "", accent: "", hide: [] }, showFrom: "", showUntil: "", items: [] }]);
  });

  it("clamps counts and strips unsafe links", () => {
    const [section] = sanitizeLayout([{ kind: "posts", id: "p", title: "  Hi  ", href: "javascript:alert(1)", count: 9999, style: "evil", categoryIds: [3, "3", -1, 2.5, 7], tagId: "x", tabs: [{ label: "A", categoryId: 4 }, { label: "", categoryId: 5 }] }]);
    expect(section).toMatchObject({ title: "Hi", href: "", count: 24, style: "grid", categoryIds: [3, 7], tagId: null, tabs: [{ label: "A", categoryId: 4 }] });
  });

  it("gives duplicate or missing ids fresh ones", () => {
    const out = sanitizeLayout([{ kind: "banners", id: "x" }, { kind: "banners", id: "x" }, { kind: "banners" }]);
    expect(new Set(out.map((s) => s.id)).size).toBe(3);
    expect(out[0].id).toBe("x");
  });

  it("defaults and clamps the arrangement of article sections", () => {
    const [grid, tiles, wild] = sanitizeLayout([{ kind: "posts", style: "grid" }, { kind: "posts", style: "portrait_grid" }, { kind: "posts", style: "list", columns: 99, phoneLayout: "zigzag" }]);
    expect(grid).toMatchObject({ columns: 0, phoneLayout: "stack" });
    expect(tiles).toMatchObject({ phoneLayout: "row" });
    expect(wild).toMatchObject({ style: "list", columns: 6, phoneLayout: "stack" });
  });

  it("keeps the video panel on a dark box", () => {
    expect(sanitizeLayout([{ kind: "watch", look: { background: "soft" } }])[0].look.background).toBe("");
    expect(sanitizeLayout([{ kind: "watch", look: { background: "dark" } }])[0].look.background).toBe("dark");
    expect(sanitizeLayout([{ kind: "watch", look: { background: "custom", bgColor: "#fef3c7" } }])[0].look).toMatchObject({ background: "", bgColor: "" });
    expect(sanitizeLayout([{ kind: "watch", look: { background: "custom", bgColor: "#1e1b4b" } }])[0].look).toMatchObject({ background: "custom", bgColor: "#1e1b4b" });
  });

  it("keeps valid schedules and drops broken ones", () => {
    const [ok, backwards, junk] = sanitizeLayout([
      { kind: "banners", showFrom: "2026-11-01", showUntil: "2026-11-30" },
      { kind: "banners", showFrom: "2026-11-30", showUntil: "2026-11-01" },
      { kind: "banners", showFrom: "2026-02-30", showUntil: "tomorrow" },
    ]);
    expect(ok).toMatchObject({ showFrom: "2026-11-01", showUntil: "2026-11-30" });
    expect(backwards).toMatchObject({ showFrom: "2026-11-30", showUntil: "" });
    expect(junk).toMatchObject({ showFrom: "", showUntil: "" });
  });

  it("keeps only banners with a safe picture, and at most ten", () => {
    const [section] = sanitizeLayout([{ kind: "banners", items: [{ img: "javascript:x" }, { img: "/a.png", href: "//evil", alt: " A ", width: 9 }, ...Array.from({ length: 12 }, () => ({ img: "https://x.test/b.png" }))] }]);
    expect(section.kind === "banners" && section.items[0]).toEqual({ img: "/a.png", href: "", alt: "A", width: 50, height: 120 });
    expect(section.kind === "banners" && section.items.length).toBe(10);
  });

  it("keeps the text block's paragraphs and drops embeds from unknown hosts", () => {
    const [ok, bad] = sanitizeLayout([
      { kind: "custom", text: "One\r\nline two\n\n\n\nTwo\u0007", buttonLabel: "Go", buttonHref: "javascript:x", embedUrl: "https://youtu.be/dQw4w9WgXcQ", align: "center" },
      { kind: "custom", embedUrl: "https://evil.example/embed.html" },
    ]);
    expect(ok).toMatchObject({ kind: "custom", text: "One\nline two\n\nTwo", buttonHref: "", embedUrl: "https://youtu.be/dQw4w9WgXcQ", align: "center" });
    expect(bad).toMatchObject({ embedUrl: "", align: "left" });
  });

  it("forces the hero full width", () => {
    expect(sanitizeLayout([{ kind: "hero", placement: "side" }])[0].placement).toBe("full");
  });

  it("rejects a non-list and too many sections", () => {
    expect(() => sanitizeLayout({})).toThrow();
    expect(() => sanitizeLayout(Array.from({ length: 41 }, () => ({ kind: "banners" })))).toThrow();
  });
});

describe("schedule", () => {
  it("reads today in India and includes both ends", () => {
    // 20:00 UTC on the 1st is 01:30 on the 2nd in India
    expect(todayInIndia(new Date("2026-11-01T20:00:00Z"))).toBe("2026-11-02");
    expect(isScheduledOn({ showFrom: "2026-11-02", showUntil: "2026-11-02" }, "2026-11-02")).toBe(true);
    expect(isScheduledOn({ showFrom: "2026-11-03", showUntil: "" }, "2026-11-02")).toBe(false);
    expect(isScheduledOn({ showFrom: "", showUntil: "2026-11-01" }, "2026-11-02")).toBe(false);
    expect(safeDay("2026-13-01")).toBe("");
  });
});

describe("embedFor", () => {
  it("rebuilds known players and refuses everything else", () => {
    expect(embedFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5")?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedFor("https://youtube.com/shorts/dQw4w9WgXcQ")?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedFor("https://vimeo.com/76979871")?.src).toBe("https://player.vimeo.com/video/76979871");
    expect(embedFor("https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=x")).toMatchObject({ src: "https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk", height: 152 });
    expect(embedFor("https://docs.google.com/forms/d/e/1FAIpQLSf-abcdefghijklmnopqrstu/viewform")?.src).toBe("https://docs.google.com/forms/d/e/1FAIpQLSf-abcdefghijklmnopqrstu/viewform?embedded=true");
    expect(embedFor("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(embedFor("https://www.youtube.com/watch?v=<script>")).toBeNull();
    expect(embedFor("https://evil.example/?v=dQw4w9WgXcQ")).toBeNull();
    expect(embedFor("javascript:alert(1)")).toBeNull();
  });

  it("takes the links people actually paste", () => {
    // a Google Maps embed with a named place, still percent-encoded, and longer than 500 characters
    const pb = `!1m18!1m12!1m3!1d3913.1!2d75.78!3d11.25!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sMasjid%20Al%20Noor%2C%20Kozhikode%20%E0%B4%95!5e0!3m2!1sen!2sin!4v1${"0".repeat(500)}`;
    const map = `https://www.google.com/maps/embed?pb=${pb}`;
    expect(embedFor(map)?.src).toBe(map);
    const [section] = sanitizeLayout([{ kind: "custom", embedUrl: map }]);
    expect(section.kind === "custom" && section.embedUrl).toBe(map);
    expect(embedFor('https://www.google.com/maps/embed?pb=!1m2"onload=alert(1)')).toBeNull();
    expect(embedFor("https://vimeo.com/76979871/abcdef1234")?.src).toBe("https://player.vimeo.com/video/76979871?h=abcdef1234");
    expect(embedFor("https://player.vimeo.com/video/76979871?h=abcdef1234")?.src).toBe("https://player.vimeo.com/video/76979871?h=abcdef1234");
    expect(embedFor("https://open.spotify.com/intl-ml/episode/4rOoJ6Egrf8K2IrywzwOMk")?.src).toBe("https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk");
  });
});

describe("safeHref", () => {
  it("allows site-relative and http(s) only", () => {
    expect(safeHref("/category/x")).toBe("/category/x");
    expect(safeHref("https://a.b/c")).toBe("https://a.b/c");
    expect(safeHref("//evil.com")).toBe("");
    expect(safeHref("data:text/html,x")).toBe("");
    expect(safeHref("/\\evil.com")).toBe("");
  });
});

describe("groupSections", () => {
  it("pairs the default layout's columns into today's rows", () => {
    const groups = groupSections(DEFAULT_LAYOUT);
    const columns = groups.find((g) => g.type === "columns");
    expect(columns?.type === "columns" && columns.rows.map((r) => [r.main.map((s) => s.id), r.side.map((s) => s.id)])).toEqual([
      [["shariah"], ["picks"]],
      [["watch", "listen"], ["columns"]],
      [["opinion"], ["culture"]],
    ]);
    expect(groups.filter((g) => g.type === "full").map((g) => g.type === "full" && g.section.id)).toEqual(["hero", "reels", "picks-mobile", "banners", "infographics"]);
  });

  it("skips disabled sections and splits blocks at full-width ones", () => {
    const s = (id: string, placement: HomeSection["placement"], enabled = true): HomeSection => ({ ...blankSection("banners"), id, placement, enabled });
    const groups = groupSections([s("a", "main"), s("off", "side", false), s("f", "full"), s("b", "side")]);
    expect(groups.map((g) => g.type)).toEqual(["columns", "full", "columns"]);
  });
});
