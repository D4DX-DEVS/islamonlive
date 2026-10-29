import { describe, expect, it } from "vitest";
import { daysIn, filtersQuery, parseFilters, previousRange } from "./filters";

const NOW = Date.parse("2026-10-28T06:00:00Z"); // 11:30 IST
const parse = (query: string) => parseFilters(new URLSearchParams(query), NOW);

describe("parseFilters", () => {
  it("turns presets into whole IST days ending today", () => {
    expect(parse("")).toMatchObject({ preset: "30", from: "2026-09-29", to: "2026-10-28" });
    expect(parse("range=today")).toMatchObject({ from: "2026-10-28", to: "2026-10-28" });
    expect(parse("range=7")).toMatchObject({ from: "2026-10-22", to: "2026-10-28" });
    expect(daysIn(parse("range=30") as { from: string; to: string })).toBe(30);
    expect(parse("range=90")).toHaveProperty("error");
  });

  it("refuses a range starting before the 30 days reader data is kept", () => {
    expect(parse("range=custom&from=2026-09-29&to=2026-10-28")).toMatchObject({ from: "2026-09-29" });
    expect(parse("range=custom&from=2026-09-28&to=2026-10-01")).toHaveProperty("error");
  });

  it("accepts a custom range and refuses bad ones", () => {
    expect(parse("range=custom&from=2026-10-01&to=2026-10-10")).toMatchObject({ from: "2026-10-01", to: "2026-10-10" });
    for (const bad of ["range=custom", "range=custom&from=2026-10-10&to=2026-10-01", "range=custom&from=2026-10-01&to=2026-11-01", "range=custom&from=2024-01-01&to=2026-10-01", "range=custom&from=2026-13-45&to=2026-10-01", "range=custom&from=2026-02-31&to=2026-10-01", "range=forever"]) {
      expect(parse(bad), bad).toHaveProperty("error");
    }
  });

  it("only allows known filter values", () => {
    expect(parse("device=tablet&source=social&visitor=new&category=4&article=99")).toMatchObject({ device: "tablet", source: "social", visitor: "new", category: 4, article: 99 });
    for (const bad of ["device=watch", "source=tv", "visitor=old", "category=-1", "article=abc", "category=1.5"]) expect(parse(bad), bad).toHaveProperty("error");
  });

  it("compares with the period of the same length right before", () => {
    expect(previousRange({ from: "2026-10-22", to: "2026-10-28" })).toEqual({ from: "2026-10-15", to: "2026-10-21" });
    expect(previousRange({ from: "2026-10-28", to: "2026-10-28" })).toEqual({ from: "2026-10-27", to: "2026-10-27" });
  });

  it("round-trips through the query string the dashboard builds", () => {
    const filters = parse("range=custom&from=2026-10-01&to=2026-10-10&device=mobile&visitor=returning");
    expect(parse(filtersQuery(filters as never))).toEqual(filters);
  });
});
