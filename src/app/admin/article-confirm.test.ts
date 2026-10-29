import { describe, expect, it } from "vitest";
import { articleConfirmation, type ArticleSave } from "./article-confirm";

const save = (patch: Partial<ArticleSave>): ArticleSave => ({ stored: null, status: "draft", visibility: "public", scheduled: false, when: "12 Nov 2026, 09:30", dateTouched: false, ...patch });

describe("articleConfirmation", () => {
  it("lets drafts and review submissions save without asking", () => {
    expect(articleConfirmation(save({}))).toBeNull();
    expect(articleConfirmation(save({ status: "pending" }))).toBeNull();
    expect(articleConfirmation(save({ stored: "draft", status: "pending" }))).toBeNull();
  });

  it("asks before anything goes live", () => {
    expect(articleConfirmation(save({ status: "publish" }))?.title).toBe("Publish this article now?");
    expect(articleConfirmation(save({ stored: "draft", status: "publish" }))?.confirmLabel).toBe("Publish now");
    expect(articleConfirmation(save({ stored: "future", status: "publish" }))?.title).toBe("Publish this article now?");
  });

  it("asks before changing a live article, scheduling, or going private", () => {
    expect(articleConfirmation(save({ stored: "publish", status: "publish" }))?.title).toBe("Update the live article?");
    expect(articleConfirmation(save({ status: "publish", scheduled: true }))?.body).toContain("12 Nov 2026, 09:30");
    expect(articleConfirmation(save({ stored: "future", status: "publish", scheduled: true }))).toBeNull();
    expect(articleConfirmation(save({ stored: "future", status: "publish", scheduled: true, dateTouched: true }))?.title).toBe("Schedule this article?");
    expect(articleConfirmation(save({ stored: "publish", status: "publish", visibility: "private" }))?.tone).toBe("warning");
  });

  it("warns in red before taking a live article down", () => {
    const down = articleConfirmation(save({ stored: "publish", status: "draft" }));
    expect(down?.tone).toBe("danger");
    expect(down?.title).toBe("Take this article off the site?");
    expect(articleConfirmation(save({ stored: "future", status: "draft" }))?.title).toBe("Cancel the scheduled publish?");
  });
});
