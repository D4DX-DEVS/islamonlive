import { describe, expect, it } from "vitest";
import { decodePath } from "@/lib/wordpress";

/* decodePath decides whether a requested article/archive path IS the permalink
   (200) or a variant of it (308). Escapes may differ in hex case; letters may not. */
describe("decodePath", () => {
  it("matches a permalink whatever case its percent-escapes arrive in", () => {
    expect(decodePath("/opinion/%E0%B4%B8%E0%B4%BF/")).toBe(decodePath("/opinion/%e0%b4%b8%e0%b4%bf/"));
    expect(decodePath("/opinion/സി/")).toBe(decodePath("/opinion/%e0%b4%b8%e0%b4%bf/"));
  });

  it("ignores the trailing slash", () => {
    expect(decodePath("/culture/travel/x")).toBe(decodePath("/culture/travel/x/"));
  });

  it("does not fold letter case: an uppercased URL is a duplicate to redirect", () => {
    expect(decodePath("/CULTURE/TRAVEL/X/")).not.toBe(decodePath("/culture/travel/x/"));
  });

  it("survives a malformed escape, folding only the hex digits", () => {
    expect(decodePath("/a/%E0%zz/")).toBe("/a/%e0%zz");
  });
});
