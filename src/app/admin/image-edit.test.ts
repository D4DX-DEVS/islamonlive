import { describe, expect, it } from "vitest";
import { capSize, clampRect, defaultOutputType, dragRect, filterString, fitAspect, NO_ADJUSTMENTS, outputName, resizeTo, rotatedBounds } from "./image-edit";

const bounds = { width: 1000, height: 500 };

describe("rotatedBounds", () => {
  it("swaps sides on a quarter turn and keeps them on a half turn", () => {
    expect(rotatedBounds(400, 300, 0)).toEqual({ width: 400, height: 300 });
    expect(rotatedBounds(400, 300, 90)).toEqual({ width: 300, height: 400 });
    expect(rotatedBounds(400, 300, 180)).toEqual({ width: 400, height: 300 });
  });

  it("grows to hold a tilted picture", () => {
    const tilted = rotatedBounds(100, 100, 45);
    expect(tilted.width).toBeCloseTo(141.421, 2);
    expect(tilted.height).toBeCloseTo(141.421, 2);
  });
});

describe("fitAspect", () => {
  it("takes everything when free", () => {
    expect(fitAspect(bounds, null)).toEqual({ x: 0, y: 0, ...bounds });
  });

  it("centres the largest box of the shape", () => {
    expect(fitAspect(bounds, 1)).toEqual({ x: 250, y: 0, width: 500, height: 500 });
    expect(fitAspect({ width: 500, height: 1000 }, 16 / 9)).toEqual({ x: 0, y: 500 - 500 / (16 / 9) / 2, width: 500, height: 500 / (16 / 9) });
  });
});

describe("clampRect", () => {
  it("moves a box back inside before shrinking it", () => {
    expect(clampRect({ x: 900, y: -20, width: 200, height: 100 }, bounds)).toEqual({ x: 800, y: 0, width: 200, height: 100 });
  });

  it("shrinks a box larger than the picture and holds the minimum", () => {
    expect(clampRect({ x: 0, y: 0, width: 2000, height: 2 }, bounds, 16)).toEqual({ x: 0, y: 0, width: 1000, height: 16 });
  });
});

describe("dragRect", () => {
  const start = { x: 100, y: 100, width: 200, height: 100 };

  it("moves the whole box without leaving the picture", () => {
    expect(dragRect(start, "move", 50, 10, bounds, null)).toEqual({ x: 150, y: 110, width: 200, height: 100 });
    expect(dragRect(start, "move", 5000, 5000, bounds, null)).toEqual({ x: 800, y: 400, width: 200, height: 100 });
  });

  it("resizes freely from a corner and stops at the edge", () => {
    expect(dragRect(start, "se", 30, 40, bounds, null)).toEqual({ x: 100, y: 100, width: 230, height: 140 });
    expect(dragRect(start, "nw", -500, -500, bounds, null)).toEqual({ x: 0, y: 0, width: 300, height: 200 });
  });

  it("never turns a box inside out", () => {
    const shrunk = dragRect(start, "e", -1000, 0, bounds, null, 16);
    expect(shrunk.width).toBe(16);
    expect(shrunk.x).toBe(100);
  });

  it("holds the shape, anchored at the opposite corner", () => {
    const square = { x: 100, y: 100, width: 100, height: 100 };
    const out = dragRect(square, "se", 50, 10, bounds, 1);
    expect(out).toEqual({ x: 100, y: 100, width: 150, height: 150 });
    const top = dragRect(square, "nw", -50, -20, bounds, 1);
    expect(top.width).toBeCloseTo(150);
    expect(top.x + top.width).toBeCloseTo(200);
    expect(top.y + top.height).toBeCloseTo(200);
  });

  it("holds the shape inside the picture", () => {
    const square = { x: 100, y: 100, width: 100, height: 100 };
    const out = dragRect(square, "se", 2000, 2000, bounds, 1);
    expect(out.width).toBeCloseTo(400);
    expect(out.height).toBeCloseTo(400);
  });
});

describe("sizes", () => {
  it("caps the longest side without enlarging", () => {
    expect(capSize({ width: 8000, height: 4000 }, 4000)).toEqual({ width: 4000, height: 2000 });
    expect(capSize({ width: 300, height: 200 }, 4000)).toEqual({ width: 300, height: 200 });
  });

  it("keeps the crop ratio when locked", () => {
    expect(resizeTo({ width: 1600, height: 900 }, "width", 800, { width: 1600, height: 900 }, true)).toEqual({ width: 800, height: 450 });
    expect(resizeTo({ width: 1600, height: 900 }, "height", 450, { width: 1600, height: 900 }, true)).toEqual({ width: 800, height: 450 });
    expect(resizeTo({ width: 1600, height: 900 }, "width", 800, { width: 1600, height: 900 }, false)).toEqual({ width: 800, height: 900 });
  });
});

describe("filters and names", () => {
  it("writes only what changed", () => {
    expect(filterString(NO_ADJUSTMENTS)).toBe("none");
    expect(filterString({ ...NO_ADJUSTMENTS, brightness: 120, grayscale: 100 })).toBe("brightness(120%) grayscale(100%)");
  });

  it("names the file for the format written", () => {
    expect(outputName("photo.final.JPG", "image/webp")).toBe("photo.final.webp");
    expect(outputName(".png", "image/jpeg")).toBe("image.jpg");
    expect(defaultOutputType("image/png")).toBe("image/png");
    expect(defaultOutputType("image/heic")).toBe("image/webp");
  });
});
