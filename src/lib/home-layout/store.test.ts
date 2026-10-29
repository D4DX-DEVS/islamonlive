import { beforeEach, describe, expect, it, vi } from "vitest";
import { collection } from "@/lib/db/client";

vi.mock("@/lib/env", async (original) => ({ ...(await original<typeof import("@/lib/env")>()), DATA_SOURCE: "mongo" }));
vi.mock("next/cache", () => ({ revalidateTag: () => undefined, revalidatePath: () => undefined, unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/cloudflare", () => ({ purgePaths: async () => ({ ok: true }) }));

const store = await import("./store");
const { DEFAULT_LAYOUT } = await import("./schema");
const ME = { id: 1, name: "Chief", role: "administrator" };

describe("homepage layout drafts", () => {
  beforeEach(async () => {
    await (await collection("home_layout")).deleteMany({});
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
});
