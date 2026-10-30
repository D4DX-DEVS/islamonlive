import { describe, expect, it } from "vitest";
import { MIN_PASSWORD, passwordProblem } from "./password-policy";

describe("passwordProblem", () => {
  it("accepts a long, unremarkable passphrase", () => {
    expect(passwordProblem("correct horse battery staple", { username: "desk", email: "desk@x.in" })).toBeNull();
  });

  it("refuses anything shorter than the minimum", () => {
    expect(passwordProblem("a".repeat(MIN_PASSWORD - 1) + "")).toMatch(/at least/);
  });

  it("refuses passwords off the guessing lists and single repeated characters", () => {
    expect(passwordProblem("Password1234")).toMatch(/too easy/);
    expect(passwordProblem("zzzzzzzzzzzzzz")).toMatch(/too easy/);
  });

  it("refuses a password built from the account's own name or email", () => {
    expect(passwordProblem("new.editor-2026!", { username: "new.editor" })).toMatch(/username or email/);
    expect(passwordProblem("writer@x.in-pass", { email: "writer@x.in" })).toMatch(/username or email/);
  });

  it("refuses absurd lengths", () => {
    expect(passwordProblem("x".repeat(201) + "y")).toMatch(/too long/);
  });
});
