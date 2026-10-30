import { beforeEach, describe, expect, it, vi } from "vitest";
import { collection } from "@/lib/db/client";

vi.mock("@/lib/env", async (original) => ({ ...(await original<typeof import("@/lib/env")>()), DATA_SOURCE: "mongo" }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined, revalidatePath, unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/cloudflare", () => ({ purgePaths: async () => ({ ok: true }) }));

const store = await import("./store");
const { DEFAULT_LAYOUT, sanitizeLayout } = await import("./schema");
const { DEFAULT_THEME } = await import("./theme");
const ME = { id: 1, name: "Chief", role: "administrator" };

describe("homepage layout drafts", () => {
  beforeEach(async () => {
    await (await collection("home_layout")).deleteMany({});
    revalidatePath.mockClear();
  });

  it("keeps a draft out of the public layout until it is published", async () => {
    await store.saveDraft([{ kind: "banners", id: "only" }], ME);
    expect((await store.getHomeLayout()).length).toBe(DEFAULT_LAYOUT.length);
    expect((await store.getPreviewLayout()).map((s) => s.id)).toEqual(["only"]);
    expect((await store.getPreviewLayout("live")).length).toBe(DEFAULT_LAYOUT.length);
    const state = await store.getLayoutState();
    expect(state.isDefault).toBe(true);
    expect(state.draft?.map((s) => s.id)).toEqual(["only"]);
    expect(state.draftUpdatedBy).toMatchObject({ id: 1 });
  });

  it("clears the draft on publish and on discard", async () => {
    await store.saveDraft([{ kind: "banners", id: "a" }], ME);
    await store.saveHomeLayout([{ kind: "banners", id: "a" }], ME);
    let state = await store.getLayoutState();
    expect(state.draft).toBeNull();
    expect(state.sections.map((s) => s.id)).toEqual(["a"]);
    expect(state.history).toHaveLength(1);

    await store.saveDraft([{ kind: "banners", id: "b" }], ME);
    await store.discardDraft();
    state = await store.getLayoutState();
    expect(state.draft).toBeNull();
    expect((await store.getPreviewLayout()).map((s) => s.id)).toEqual(["a"]);
  });

  it("sanitizes what it stores", async () => {
    await store.saveDraft([{ kind: "image", id: "i", img: "javascript:alert(1)", href: "//evil.example" }, { kind: "nope" }], ME);
    const [only, ...rest] = await store.getPreviewLayout();
    expect(rest).toHaveLength(0);
    expect(only).toMatchObject({ kind: "image", img: "", href: "" });
  });

  it("keeps a draft style out of the public page until it is published, and restores it with its version", async () => {
    const teal = { accentColor: "#0f766e", headingSize: 120 };
    await store.saveDraft([{ kind: "banners", id: "a" }], ME, teal);
    expect((await store.getHomeTheme()).accentColor).toBe("");
    expect((await store.getPreviewTheme()).accentColor).toBe("#0f766e");
    expect((await store.getLayoutState()).draftTheme?.headingSize).toBe(120);

    await store.saveHomeLayout([{ kind: "banners", id: "a" }], ME, teal);
    expect((await store.getLayoutState()).theme.accentColor).toBe("#0f766e");
    await store.saveHomeLayout([{ kind: "banners", id: "a" }], ME, { accentColor: "#b91c1c" });
    await store.restoreHomeLayout(0, ME);
    expect((await store.getLayoutState()).theme.accentColor).toBe("#0f766e");
  });

  it("refreshes every page only when a site-wide style changes", async () => {
    const layout = [{ kind: "banners", id: "a" }];
    const wholeLayout = () => revalidatePath.mock.calls.some(([, type]) => type === "layout");
    await store.saveHomeLayout(layout, ME, { accentColor: "#0f766e" });
    expect(wholeLayout()).toBe(false);
    await store.saveHomeLayout(layout, ME, { accentColor: "#0f766e", scope: "site" });
    expect(wholeLayout()).toBe(true);
    revalidatePath.mockClear();
    await store.saveHomeLayout([{ kind: "banners", id: "b" }], ME, { accentColor: "#0f766e", scope: "site" });
    expect(wholeLayout()).toBe(false);
    await store.saveHomeLayout(layout, ME, { accentColor: "#0f766e", scope: "home" });
    expect(wholeLayout()).toBe(true);
  });

  it("restores a version from before page styles with the built-in style", async () => {
    await (await collection("home_layout")).insertOne({ _id: "home", sections: [], history: [{ sections: sanitizeLayout([{ kind: "banners", id: "old" }]), saved_at: new Date(0), saved_by: null }] });
    await store.saveHomeLayout([{ kind: "banners", id: "new" }], ME, { accentColor: "#0f766e" });
    await store.restoreHomeLayout(1, ME);
    const state = await store.getLayoutState();
    expect(state.sections.map((s) => s.id)).toEqual(["old"]);
    expect(state.theme).toEqual(DEFAULT_THEME);
  });

  it("keeps the draft's style when an autosave sends none", async () => {
    await store.saveDraft([{ kind: "banners", id: "a" }], ME, { accentColor: "#b91c1c" });
    await store.saveDraft([{ kind: "banners", id: "b" }], ME);
    expect((await store.getPreviewTheme()).accentColor).toBe("#b91c1c");
  });
});
