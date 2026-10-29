import { describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, blankSection, groupSections, safeHref, sanitizeLayout, type HomeSection } from "./schema";

describe("sanitizeLayout", () => {
  it("keeps the default layout unchanged", () => {
    expect(sanitizeLayout(DEFAULT_LAYOUT)).toEqual(DEFAULT_LAYOUT);
  });

  it("drops unknown kinds and non-objects", () => {
    expect(sanitizeLayout([{ kind: "script" }, null, 5, { kind: "banners", id: "b" }])).toEqual([{ id: "b", kind: "banners", enabled: true, placement: "full", visibility: "all" }]);
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

  it("forces the hero full width", () => {
    expect(sanitizeLayout([{ kind: "hero", placement: "side" }])[0].placement).toBe("full");
  });

  it("rejects a non-list and too many sections", () => {
    expect(() => sanitizeLayout({})).toThrow();
    expect(() => sanitizeLayout(Array.from({ length: 41 }, () => ({ kind: "banners" })))).toThrow();
  });
});

describe("safeHref", () => {
  it("allows site-relative and http(s) only", () => {
    expect(safeHref("/category/x")).toBe("/category/x");
    expect(safeHref("https://a.b/c")).toBe("https://a.b/c");
    expect(safeHref("//evil.com")).toBe("");
    expect(safeHref("data:text/html,x")).toBe("");
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
