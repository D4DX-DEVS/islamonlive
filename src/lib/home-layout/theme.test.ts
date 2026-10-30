import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, SITE_SCOPE, lookStyle, safeColor, sanitizeLook, sanitizeTheme, spacingCss, themeCss } from "./theme";

describe("sanitizeTheme", () => {
  it("fills defaults and rejects unknown fonts, bad colours and wild sizes", () => {
    expect(sanitizeTheme(null)).toEqual(DEFAULT_THEME);
    const t = sanitizeTheme({ mlHeadingFont: "comic", enBodyFont: "inter", headingColor: "red;}body{display:none", titleColor: "#ABC", headingSize: 9000, textSize: "x" });
    expect(t).toMatchObject({ mlHeadingFont: "anek", enBodyFont: "inter", headingColor: "", titleColor: "#aabbcc", headingSize: 150, textSize: 100 });
  });

  it("accepts only the listed scopes, weights and spacings", () => {
    expect(sanitizeTheme({ scope: "everything", headingWeight: 650, spacing: "huge", pageBackground: "white" })).toMatchObject({ scope: "home", headingWeight: 0, spacing: "normal", pageBackground: "" });
    expect(sanitizeTheme({ scope: "site", titleWeight: "800", spacing: "roomy" })).toMatchObject({ scope: "site", titleWeight: 800, spacing: "roomy" });
  });
});

describe("safeColor", () => {
  it("accepts hex only", () => {
    expect(safeColor("#123456")).toBe("#123456");
    expect(safeColor("url(x)")).toBe("");
    expect(safeColor("#12345")).toBe("");
  });
});

describe("themeCss", () => {
  it("adds nothing but the dark-box rules for the default theme", () => {
    // reads the purple scale in dark boxes, but sets no font, size or colour variable
    expect(themeCss(DEFAULT_THEME)).not.toMatch(/font-family|--text-[a-z0-9]+:|--color-purple-\d+:|--accent-chip:/);
  });

  it("puts the English font before the Malayalam one and scales sizes", () => {
    const css = themeCss({ ...DEFAULT_THEME, enHeadingFont: "playfair", mlHeadingFont: "manjari", titleSize: 120, accentColor: "#0f766e" });
    expect(css).toContain(".home-theme :is(h1,h2,h3,h4,.font-display){font-family:var(--font-playfair), var(--font-manjari)");
    expect(css).toContain("--text-base:1.2rem");
    expect(css).toContain("--color-purple-800:#0f766e");
  });

  it("scopes a site-wide style to the public pages and puts the page background on that scope", () => {
    const css = themeCss({ ...DEFAULT_THEME, scope: "site", pageBackground: "#fff7ed", headingWeight: 600, accentColor: "#0f766e" }, SITE_SCOPE, SITE_SCOPE, `${SITE_SCOPE} main`);
    expect(css).toContain(`${SITE_SCOPE} main{--color-purple-50:`);
    expect(css).toContain(`${SITE_SCOPE}{background-color:#fff7ed}`);
    expect(css).toContain(`${SITE_SCOPE} :is(h1,h2,div.font-display){--font-weight-medium:600`);
    expect(css.split("\n").every((rule) => rule.startsWith(SITE_SCOPE))).toBe(true);
  });

  it("keeps links, bars and dim labels readable in a dark box", () => {
    const css = themeCss(DEFAULT_THEME);
    expect(css).toContain(".home-theme [data-tone=dark] :is(.text-purple-700,.text-purple-800):not(.bg-white *){color:var(--color-purple-300)}");
    expect(css).toContain(".home-theme [data-tone=dark] .border-purple-800{border-color:var(--color-purple-300)}");
  });

  it("sizes the hero's waiting plates with its live headline, spares pills and dark panels", () => {
    const css = themeCss({ ...DEFAULT_THEME, headingSize: 120, headingWeight: 700, mlBodyFont: "manjari", textColor: "#111111" });
    expect(css).toContain(".home-theme :is(h2,div.font-display){--text-lg:");
    expect(css).toContain(".home-theme :is(h1,h2,div.font-display){--font-weight-medium:700");
    expect(css).toContain(":is(button,input,select,textarea):not(.pill)");
    expect(css).toContain(":is(p,time):not([data-surface=dark] *){--color-zinc-500:#111111");
  });

  it("only writes spacing rules when spacing changes", () => {
    expect(spacingCss(DEFAULT_THEME)).toBe("");
    expect(spacingCss({ ...DEFAULT_THEME, spacing: "compact" })).toContain("margin-block-end:1.25rem");
  });
});

describe("section look", () => {
  it("drops a custom background without a colour and marks dark boxes", () => {
    expect(sanitizeLook({ background: "custom" }).background).toBe("");
    expect(lookStyle(sanitizeLook({ background: "custom", bgColor: "#111827" })).dark).toBe(true);
    expect(lookStyle(sanitizeLook({ background: "custom", bgColor: "#fef3c7" })).dark).toBe(false);
    expect(lookStyle(sanitizeLook({ background: "plain" })).boxed).toBe(false);
    expect(sanitizeLook({ hide: ["author", "author", "byline", "date"] }).hide).toEqual(["author", "date"]);
  });
});
