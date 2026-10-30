import { revalidatePath, revalidateTag } from "next/cache";
import { DATA_SOURCE } from "@/lib/env";
import { collection } from "@/lib/db/client";
import { cached } from "@/lib/db/cache";
import { purgePaths } from "@/lib/cloudflare";
import { DEFAULT_LAYOUT, sanitizeLayout, type HomeSection } from "@/lib/home-layout/schema";
import { DEFAULT_THEME, sanitizeTheme, type HomeTheme } from "@/lib/home-layout/theme";
import type { HomeLayoutVersion, StaffRef } from "@/lib/db/types";

/* Where the homepage arrangement lives: one document in home_layout.

   `sections` (with `theme`, the page-wide fonts, colours and sizes) is what
   readers see. `draft` is the builder's work in progress:
   autosaved as the administrator edits, rendered only by the admin preview
   (/preview/home), and moved into `sections` on publish; `draft_theme` goes
   with it the same way. Reads for the public
   page are cached under the "home-layout" tag, which a publish drops along
   with the rendered "/". */

export const HOME_LAYOUT_TAG = "home-layout";
const HISTORY_LIMIT = 10;

const readLayout = cached(
  "home-layout",
  async (): Promise<{ sections: HomeSection[] | null; theme: HomeTheme | null }> => {
    const doc = await (await collection("home_layout")).findOne({ _id: "home" }, { projection: { sections: 1, theme: 1 } });
    return { sections: doc?.sections ?? null, theme: doc?.theme ?? null };
  },
  { revalidate: 3600, tags: [HOME_LAYOUT_TAG] },
);

/** The sections the public homepage renders. The built-in default when nothing was published or the read fails. */
export async function getHomeLayout(): Promise<HomeSection[]> {
  if (DATA_SOURCE !== "mongo") return DEFAULT_LAYOUT;
  try {
    const saved = (await readLayout()).sections;
    // re-validated on the way out too: a hand-edited document must not break the page
    return saved ? sanitizeLayout(saved) : DEFAULT_LAYOUT;
  } catch (error) {
    console.error("[home-layout] read failed, using the default:", error instanceof Error ? error.message : error);
    return DEFAULT_LAYOUT;
  }
}

/** The published page style; the built-in one when nothing was published or the read fails. */
export async function getHomeTheme(): Promise<HomeTheme> {
  if (DATA_SOURCE !== "mongo") return DEFAULT_THEME;
  try {
    return sanitizeTheme((await readLayout()).theme);
  } catch (error) {
    console.error("[home-layout] style read failed, using the default:", error instanceof Error ? error.message : error);
    return DEFAULT_THEME;
  }
}

/** What the preview renders: the draft when there is one, else the published layout. Uncached. */
export async function getPreviewLayout(source: "draft" | "live" = "draft"): Promise<HomeSection[]> {
  if (DATA_SOURCE !== "mongo") return DEFAULT_LAYOUT;
  const doc = await (await collection("home_layout")).findOne({ _id: "home" });
  const sections = (source === "draft" ? doc?.draft : null) ?? doc?.sections;
  return sections ? sanitizeLayout(sections) : DEFAULT_LAYOUT;
}

/** The page style the preview renders, chosen the same way as getPreviewLayout. Uncached. */
export async function getPreviewTheme(source: "draft" | "live" = "draft"): Promise<HomeTheme> {
  if (DATA_SOURCE !== "mongo") return DEFAULT_THEME;
  const doc = await (await collection("home_layout")).findOne({ _id: "home" }, { projection: { theme: 1, draft: 1, draft_theme: 1 } });
  return sanitizeTheme(source === "draft" && doc?.draft ? doc.draft_theme ?? doc.theme : doc?.theme);
}

export interface LayoutState {
  /** Published sections. */
  sections: HomeSection[];
  /** Unpublished work, or null. */
  draft: HomeSection[] | null;
  /** Published page style. */
  theme: HomeTheme;
  /** The draft's page style; null when there is no draft. */
  draftTheme: HomeTheme | null;
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
    theme: sanitizeTheme(doc?.theme),
    draftTheme: doc?.draft ? sanitizeTheme(doc.draft_theme ?? doc.theme) : null,
    draftUpdatedAt: doc?.draft ? doc.draft_updated_at?.toISOString() ?? null : null,
    draftUpdatedBy: doc?.draft ? doc.draft_updated_by ?? null : null,
    isDefault: !doc?.sections,
    updatedAt: doc?.updated_at?.toISOString() ?? null,
    updatedBy: doc?.updated_by ?? null,
    history: (doc?.history ?? []).map((version, index) => ({ index, savedAt: version.saved_at.toISOString(), savedBy: version.saved_by, sections: version.sections.length })),
  };
}

/** Autosave the builder's work. Readers see nothing of it until it is published. */
export async function saveDraft(input: unknown, by: StaffRef, theme?: unknown): Promise<{ savedAt: string }> {
  const draft = sanitizeLayout(input);
  const at = new Date();
  const col = await collection("home_layout");
  // a client that sends no style (an admin tab from before styles existed) keeps the draft's, else the live one
  const current = theme === undefined ? await col.findOne({ _id: "home" }, { projection: { theme: 1, draft: 1, draft_theme: 1 } }) : null;
  const draftTheme = sanitizeTheme(theme === undefined ? (current?.draft ? current.draft_theme : undefined) ?? current?.theme : theme);
  await col.updateOne({ _id: "home" }, { $set: { draft, draft_theme: draftTheme, draft_updated_at: at, draft_updated_by: by } }, { upsert: true });
  return { savedAt: at.toISOString() };
}

export async function discardDraft(): Promise<void> {
  await (await collection("home_layout")).updateOne({ _id: "home" }, { $set: { draft: null }, $unset: { draft_theme: "", draft_updated_at: "", draft_updated_by: "" } });
}

async function publish(siteStyleChanged: boolean): Promise<void> {
  revalidateTag(HOME_LAYOUT_TAG, { expire: 0 });
  revalidatePath("/");
  // a site-wide style is in the root layout: every page re-renders. Cloudflare's
  // copies of the other pages refresh on their own within s-maxage (60 s)
  if (siteStyleChanged) revalidatePath("/", "layout");
  await purgePaths(new Set(["/"]));
}

/** Put an arrangement and page style (omitted = keep the live one) live; the one it replaces goes to the top of the history, and the draft is cleared. */
export async function saveHomeLayout(input: unknown, by: StaffRef, themeInput?: unknown): Promise<HomeSection[]> {
  const sections = sanitizeLayout(input);
  const col = await collection("home_layout");
  const current = await col.findOne({ _id: "home" });
  const theme = sanitizeTheme(themeInput === undefined ? current?.theme : themeInput);
  const previous: HomeLayoutVersion = { sections: current?.sections ?? DEFAULT_LAYOUT, theme: sanitizeTheme(current?.theme), saved_at: current?.updated_at ?? new Date(0), saved_by: current?.updated_by ?? null };
  const history = [previous, ...(current?.history ?? [])].slice(0, HISTORY_LIMIT);
  await col.updateOne(
    { _id: "home" },
    { $set: { sections, theme, updated_at: new Date(), updated_by: by, history, draft: null }, $unset: { draft_theme: "", draft_updated_at: "", draft_updated_by: "" } },
    { upsert: true },
  );
  const before = previous.theme ?? DEFAULT_THEME;
  await publish(JSON.stringify(before) !== JSON.stringify(theme) && (before.scope === "site" || theme.scope === "site"));
  return sections;
}

/** Bring back version `index` of the history (0 = the one before the current). */
export async function restoreHomeLayout(index: number, by: StaffRef): Promise<HomeSection[]> {
  const current = await (await collection("home_layout")).findOne({ _id: "home" });
  const version = current?.history?.[index];
  if (!version) throw new Error("That version is no longer in the history.");
  // versions published before page styles existed bring back the built-in style
  return saveHomeLayout(version.sections, by, version.theme ?? DEFAULT_THEME);
}
