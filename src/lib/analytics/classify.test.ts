import { describe, expect, it } from "vitest";
import { deviceOf, isBot, normaliseBeacon, sourceOf } from "./classify";
import { addDays, istDay, istDayStart } from "./shared";

const UA = {
  chromeWindows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  androidPhone: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  androidTablet: "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipadOs: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  telegramInApp: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Telegram-Android/11.2.0",
  googlebot: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  headless: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36",
  facebookPreview: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
};

const valid = { id: "view-1234567890ab", v: "visitor-1234567890", s: "session-123456789", ev: "start", k: "article", p: "/shariah/some-post/", a: 42, c: [3, 3, 7], e: 0, sd: 0 };

describe("normaliseBeacon", () => {
  it("accepts a well-formed article beacon and dedupes its categories", () => {
    expect(normaliseBeacon(valid)).toEqual({ ...valid, ev: "start", c: [3, 7] });
  });

  it("refuses missing or malformed ids, kinds, events and paths", () => {
    for (const bad of [null, "x", { ...valid, id: "short" }, { ...valid, v: "has spaces in it!" }, { ...valid, ev: "click" }, { ...valid, k: "admin" }, { ...valid, p: "https://evil.example/" }, { ...valid, p: "//evil.example/x" }, { ...valid, a: 0 }, { ...valid, a: "abc" }]) {
      expect(normaliseBeacon(bad)).toBeNull();
    }
  });

  it("clamps active time and scroll depth instead of trusting them", () => {
    const beacon = normaliseBeacon({ ...valid, e: 10 ** 9, sd: 250 });
    expect(beacon?.e).toBe(4 * 60 * 60);
    expect(beacon?.sd).toBe(100);
    expect(normaliseBeacon({ ...valid, e: -5, sd: Number.NaN })).toMatchObject({ e: 0, sd: 0 });
  });

  it("drops the query string and fragment from the path", () => {
    expect(normaliseBeacon({ ...valid, p: "/shariah/some-post/?utm_source=fb#top" })?.p).toBe("/shariah/some-post/");
  });

  it("keeps only plain referrer hosts and utm labels", () => {
    const beacon = normaliseBeacon({ ...valid, rh: "WWW.Google.com", us: "Facebook", um: "<script>" });
    expect(beacon).toMatchObject({ rh: "www.google.com", us: "facebook" });
    expect(beacon?.um).toBeUndefined();
  });

  it("does not carry an article id or categories on other kinds of page", () => {
    const beacon = normaliseBeacon({ ...valid, k: "home", p: "/" });
    expect(beacon?.a).toBeUndefined();
    expect(beacon?.c).toBeUndefined();
  });
});

describe("isBot", () => {
  it("lets real browsers through, including in-app browsers", () => {
    for (const ua of [UA.chromeWindows, UA.androidPhone, UA.iphone, UA.telegramInApp]) expect(isBot(ua)).toBe(false);
  });

  it("stops crawlers, link previews, headless and automated browsers", () => {
    for (const ua of [UA.googlebot, UA.headless, UA.facebookPreview, "", "curl/8.4.0"]) expect(isBot(ua)).toBe(true);
    expect(isBot(UA.chromeWindows, true)).toBe(true);
  });
});

describe("deviceOf", () => {
  it("tells phones, tablets and desktops apart", () => {
    expect(deviceOf(UA.chromeWindows)).toBe("desktop");
    expect(deviceOf(UA.androidPhone)).toBe("mobile");
    expect(deviceOf(UA.iphone)).toBe("mobile");
    expect(deviceOf(UA.androidTablet)).toBe("tablet");
  });

  it("spots an iPad asking for the desktop site by its touch screen", () => {
    expect(deviceOf(UA.ipadOs, true)).toBe("tablet");
    expect(deviceOf(UA.ipadOs, false)).toBe("desktop");
  });
});

describe("sourceOf", () => {
  const site = "islamonlive.in";
  it("classifies the usual referrers", () => {
    expect(sourceOf({}, site)).toEqual({ src: "direct" });
    expect(sourceOf({ rh: "www.google.com" }, site)).toEqual({ src: "search", ref: "www.google.com" });
    expect(sourceOf({ rh: "com.google.android.googlequicksearchbox" }, site).src).toBe("search");
    expect(sourceOf({ rh: "l.facebook.com" }, site)).toEqual({ src: "social", ref: "l.facebook.com" });
    expect(sourceOf({ rh: "t.co" }, site).src).toBe("social");
    expect(sourceOf({ rh: "hajj.islamonlive.in" }, site)).toEqual({ src: "referral", ref: "hajj.islamonlive.in" });
    expect(sourceOf({ rh: "www.islamonlive.in" }, site)).toEqual({ src: "internal" });
    expect(sourceOf({ internal: true, rh: "www.google.com" }, site)).toEqual({ src: "internal" });
  });

  it("uses utm tags when a link carries them", () => {
    expect(sourceOf({ us: "whatsapp" }, site)).toEqual({ src: "social", ref: "whatsapp" });
    expect(sourceOf({ us: "weekly", um: "email" }, site)).toEqual({ src: "email", ref: "weekly" });
    expect(sourceOf({ us: "google", um: "cpc", rh: "www.google.com" }, site).src).toBe("campaign");
    expect(sourceOf({ us: "partner-site" }, site)).toEqual({ src: "campaign", ref: "partner-site" });
  });
});

describe("IST days", () => {
  it("rolls over at midnight in India, not in UTC", () => {
    expect(istDay(Date.parse("2026-10-27T18:29:59Z"))).toBe("2026-10-27");
    expect(istDay(Date.parse("2026-10-27T18:30:00Z"))).toBe("2026-10-28");
    expect(new Date(istDayStart("2026-10-28")).toISOString()).toBe("2026-10-27T18:30:00.000Z");
    expect(addDays("2026-10-28", -30)).toBe("2026-09-28");
  });
});
