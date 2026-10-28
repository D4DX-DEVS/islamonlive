import { beforeEach, describe, expect, it } from "vitest";
import { collection } from "@/lib/db/client";
import { recordBeacon } from "./store";
import type { Beacon } from "./shared";

const UA = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const ctx = (iso: string) => ({ userAgent: UA, siteHost: "islamonlive.in", now: new Date(iso) });
const start: Beacon = { id: "view-aaaaaaaaaaaa", v: "visitor-aaaaaaaaaa", s: "session-aaaaaaaaa", ev: "start", k: "article", p: "/shariah/post/", a: 7, c: [3], rh: "www.google.com", nv: true, en: true, e: 0, sd: 5 };

describe("recordBeacon", () => {
  beforeEach(async () => {
    await (await collection("analytics_views")).deleteMany({});
  });

  it("stores one view with what it is, where it came from and on what device", async () => {
    await recordBeacon(start, ctx("2026-10-28T04:00:00Z"));
    const doc = await (await collection("analytics_views")).findOne({ _id: start.id });
    expect(doc).toMatchObject({ v: start.v, s: start.s, day: "2026-10-28", k: "article", p: "/shariah/post/", a: 7, c: [3], dev: "mobile", src: "search", ref: "www.google.com", nv: true, en: true, e: 0, sd: 5 });
    expect(JSON.stringify(doc)).not.toContain("Android");
  });

  it("counts a repeated start (a re-render, a retry) once", async () => {
    await recordBeacon(start, ctx("2026-10-28T04:00:00Z"));
    await recordBeacon(start, ctx("2026-10-28T04:00:01Z"));
    expect(await (await collection("analytics_views")).countDocuments()).toBe(1);
  });

  it("lets pings raise active time and scroll depth but never lower them", async () => {
    await recordBeacon(start, ctx("2026-10-28T04:00:00Z"));
    await recordBeacon({ ...start, ev: "ping", e: 40, sd: 60 }, ctx("2026-10-28T04:01:00Z"));
    // a late, out-of-order ping with smaller totals
    await recordBeacon({ ...start, ev: "ping", e: 20, sd: 30 }, ctx("2026-10-28T04:00:30Z"));
    const doc = await (await collection("analytics_views")).findOne({ _id: start.id });
    expect(doc).toMatchObject({ e: 40, sd: 60 });
    expect(doc?.ls.toISOString()).toBe("2026-10-28T04:01:00.000Z");
  });

  it("never lets a later beacon change what the view is", async () => {
    await recordBeacon(start, ctx("2026-10-28T04:00:00Z"));
    await recordBeacon({ ...start, ev: "end", k: "home", p: "/", a: undefined, rh: "t.co", e: 90 }, ctx("2026-10-28T05:00:00Z"));
    const doc = await (await collection("analytics_views")).findOne({ _id: start.id });
    expect(doc).toMatchObject({ k: "article", p: "/shariah/post/", a: 7, src: "search", day: "2026-10-28", e: 90 });
  });

  it("makes good a lost start from the first ping", async () => {
    await recordBeacon({ ...start, ev: "ping", e: 30, sd: 50 }, ctx("2026-10-28T04:00:30Z"));
    expect(await (await collection("analytics_views")).findOne({ _id: start.id })).toMatchObject({ k: "article", a: 7, e: 30, sd: 50 });
  });

  it("files a view under its IST day", async () => {
    await recordBeacon(start, ctx("2026-10-27T19:00:00Z"));
    expect((await (await collection("analytics_views")).findOne({ _id: start.id }))?.day).toBe("2026-10-28");
  });
});
