import { describe, expect, it } from "vitest";
import { isSessionLoss } from "./session-watch";

describe("isSessionLoss", () => {
  it("treats a 401 from the admin API as a signed-out session", () => {
    expect(isSessionLoss("/api/admin/analytics/summary?preset=7d", 401)).toBe(true);
    expect(isSessionLoss("https://islamonlive.in/api/admin/session/", 401)).toBe(true);
  });

  it("ignores a wrong password at sign-in, other statuses and other APIs", () => {
    expect(isSessionLoss("/api/admin/login/", 401)).toBe(false);
    expect(isSessionLoss("/api/admin/analytics/summary", 403)).toBe(false);
    expect(isSessionLoss("/api/admin/session/", 503)).toBe(false);
    expect(isSessionLoss("/api/track/", 401)).toBe(false);
  });
});
