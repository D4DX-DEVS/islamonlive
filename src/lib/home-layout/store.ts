import { revalidatePath, revalidateTag } from "next/cache";
import { DATA_SOURCE } from "@/lib/env";
import { collection } from "@/lib/db/client";
import { cached } from "@/lib/db/cache";
import { purgePaths } from "@/lib/cloudflare";
import { DEFAULT_LAYOUT, sanitizeLayout, type HomeSection } from "@/lib/home-layout/schema";
import type { HomeLayoutVersion, StaffRef } from "@/lib/db/types";

/* Where the homepage arrangement lives: one document in home_layout.

   `sections` is what readers see. `draft` is the builder's work in progress:
   autosaved as the administrator edits, rendered only by the admin preview
   (/preview/home), and moved into `sections` on publish. Reads for the public
   page are cached under the "home-layout" tag, which a publish drops along
   with the rendered "/". */

export const HOME_LAYOUT_TAG = "home-layout";
const HISTORY_LIMIT = 10;

const readLayout = cached(
  "home-layout",
  async (): Promise<HomeSection[] | null> => {
    const doc = await (await collection("home_layout")).findOne({ _id: "home" }, { projection: { sections: 1 } });
    return doc?.sections ?? null;
  },
  { revalidate: 3600, tags: [HOME_LAYOUT_TAG] },
);

/** The sections the public homepage renders. The built-in default when nothing was published or the read fails. */
export async function getHomeLayout(): Promise<HomeSection[]> {
  if (DATA_SOURCE !== "mongo") return DEFAULT_LAYOUT;
  try {
    const saved = await readLayout();
    // re-validated on the way out too: a hand-edited document must not break the page
    return saved ? sanitizeLayout(saved) : DEFAULT_LAYOUT;
  } catch (error) {
    console.error("[home-layout] read failed, using the default:", error instanceof Error ? error.message : error);
    return DEFAULT_LAYOUT;
  }
}

/** What the preview renders: the draft when there is one, else the published layout. Uncached. */
export async function getPreviewLayout(source: "draft" | "live" = "draft"): Promise<HomeSection[]> {
  if (DATA_SOURCE !== "mongo") return DEFAULT_LAYOUT;
  const doc = await (await collection("home_layout")).findOne({ _id: "home" });
  const sections = (source === "draft" ? doc?.draft : null) ?? doc?.sections;
  return sections ? sanitizeLayout(sections) : DEFAULT_LAYOUT;
}

export interface LayoutState {
  /** Published sections. */
  sections: HomeSection[];
  /** Unpublished work, or null. */
  draft: HomeSection[] | null;
  draftUpdatedAt: string | null;
  draftUpdatedBy: StaffRef | null;
  isDefault: boolean;
  updatedAt: string | null;
  updatedBy: StaffRef | null;
  history: { index: number; savedAt: string; savedBy: StaffRef | null; sections: number }[];
}

/** The builder's view: uncached, with who saved what and the earlier versions. */
export async function getLayoutState(): Promise<LayoutState> {
  const doc = await (await collection("home_layout")).findOne({ _id: "home" });
  return {
    sections: doc?.sections ? sanitizeLayout(doc.sections) : DEFAULT_LAYOUT,
    draft: doc?.draft ? sanitizeLayout(doc.draft) : null,
    draftUpdatedAt: doc?.draft ? doc.draft_updated_at?.toISOString() ?? null : null,
    draftUpdatedBy: doc?.draft ? doc.draft_updated_by ?? null : null,
    isDefault: !doc?.sections,
    updatedAt: doc?.updated_at?.toISOString() ?? null,
    updatedBy: doc?.updated_by ?? null,
    history: (doc?.history ?? []).map((version, index) => ({ index, savedAt: version.saved_at.toISOString(), savedBy: version.saved_by, sections: version.sections.length })),
  };
}

/** Autosave the builder's work. Readers see nothing of it until it is published. */
export async function saveDraft(input: unknown, by: StaffRef): Promise<{ savedAt: string }> {
  const draft = sanitizeLayout(input);
  const at = new Date();
  await (await collection("home_layout")).updateOne({ _id: "home" }, { $set: { draft, draft_updated_at: at, draft_updated_by: by } }, { upsert: true });
  return { savedAt: at.toISOString() };
}

export async function discardDraft(): Promise<void> {
  await (await collection("home_layout")).updateOne({ _id: "home" }, { $set: { draft: null }, $unset: { draft_updated_at: "", draft_updated_by: "" } });
}

async function publish(): Promise<void> {
  revalidateTag(HOME_LAYOUT_TAG, { expire: 0 });
  revalidatePath("/");
  await purgePaths(new Set(["/"]));
}

/** Put an arrangement live; the one it replaces goes to the top of the history, and the draft is cleared. */
export async function saveHomeLayout(input: unknown, by: StaffRef): Promise<HomeSection[]> {
  const sections = sanitizeLayout(input);
  const col = await collection("home_layout");
  const current = await col.findOne({ _id: "home" });
  const previous: HomeLayoutVersion = { sections: current?.sections ?? DEFAULT_LAYOUT, saved_at: current?.updated_at ?? new Date(0), saved_by: current?.updated_by ?? null };
  const history = [previous, ...(current?.history ?? [])].slice(0, HISTORY_LIMIT);
  await col.updateOne(
    { _id: "home" },
    { $set: { sections, updated_at: new Date(), updated_by: by, history, draft: null }, $unset: { draft_updated_at: "", draft_updated_by: "" } },
    { upsert: true },
  );
  await publish();
  return sections;
}

/** Bring back version `index` of the history (0 = the one before the current). */
export async function restoreHomeLayout(index: number, by: StaffRef): Promise<HomeSection[]> {
  const current = await (await collection("home_layout")).findOne({ _id: "home" });
  const version = current?.history?.[index];
  if (!version) throw new Error("That version is no longer in the history.");
  return saveHomeLayout(version.sections, by);
}
