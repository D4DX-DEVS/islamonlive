import { describe, expect, it } from "vitest";
import { allowedTab, pathForTab, tabFromPath, tabFromSegments } from "./admin-paths";

describe("admin screen addresses", () => {
  it("maps every screen to an address and back", () => {
    for (const tab of ["overview", "articles", "new", "authors", "analytics", "homepage", "team", "activity"] as const) {
      expect(tabFromPath(pathForTab(tab))).toBe(tab);
    }
  });

  it("sends an article being edited to the list, since the article is not in the address", () => {
    expect(pathForTab("edit")).toBe("/admin/articles/");
    expect(tabFromSegments(["edit"])).toBeNull();
  });

  it("accepts /admin with or without a slash and refuses anything else", () => {
    expect(tabFromPath("/admin")).toBe("overview");
    expect(tabFromPath("/admin/analytics")).toBe("analytics");
    expect(tabFromPath("/admin/analytics/x/")).toBeNull();
    expect(tabFromPath("/admin/nope/")).toBeNull();
    expect(tabFromPath("/administrator/")).toBeNull();
    expect(tabFromSegments(["constructor"])).toBeNull();
  });

  it("keeps administrators' screens from editors", () => {
    expect(allowedTab("analytics", "administrator", false)).toBe("overview");
    expect(allowedTab("analytics", "administrator", true)).toBe("analytics");
    for (const tab of ["homepage", "team", "activity"] as const) {
      expect(allowedTab(tab, "editor", true)).toBe("overview");
      expect(allowedTab(tab, "administrator", false)).toBe(tab);
    }
    expect(allowedTab("articles", "editor", false)).toBe("articles");
  });
});
