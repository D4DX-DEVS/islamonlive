import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import proxy from "./proxy";

const call = (method: string, headers: Record<string, string>) =>
  proxy(new NextRequest("https://islamonlive.in/api/admin/team/", { method, headers: { host: "islamonlive.in", ...headers } }));

describe("proxy: admin API cross-site check", () => {
  it("refuses a state-changing call from another origin, sibling subdomains included", async () => {
    expect((await call("POST", { origin: "https://evil.example" })).status).toBe(403);
    expect((await call("DELETE", { origin: "https://ramadan.islamonlive.in" })).status).toBe(403);
    expect((await call("PATCH", { origin: "null" })).status).toBe(403);
    expect((await call("POST", { "sec-fetch-site": "cross-site" })).status).toBe(403);
  });

  it("lets same-origin calls, reads and non-browser clients through to the handler", async () => {
    expect((await call("POST", { origin: "https://islamonlive.in" })).status).toBe(200);
    expect((await call("GET", { origin: "https://evil.example" })).status).toBe(200);
    expect((await call("POST", {})).status).toBe(200);
  });
});
