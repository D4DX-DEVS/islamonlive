import type { ConfirmDialogProps } from "./ConfirmDialog";

/* Which article saves need a confirmation, and what it says. Anything that
   changes what readers see asks first: going live, scheduling, going private,
   coming off the site, or changing a live article. Saving a draft or sending it
   for review is private to the newsroom and saves straight away. */

export interface ArticleSave {
  /** Status when the editor opened: "publish" | "future" | "private" | "draft" | "pending"; null for a new article. */
  stored: string | null;
  /** The status chosen in the form: "draft" | "pending" | "publish". */
  status: string;
  visibility: string;
  scheduled: boolean;
  /** "12 Nov 2026, 09:30" for a scheduled article. */
  when: string;
  dateTouched: boolean;
}

type Confirmation = Pick<ConfirmDialogProps, "title" | "body" | "confirmLabel" | "pendingLabel" | "tone" | "icon">;

export function articleConfirmation({ stored, status, visibility, scheduled, when, dateTouched }: ArticleSave): Confirmation | null {
  const wasLive = stored === "publish";
  const wasOut = wasLive || stored === "future" || stored === "private";
  const goingPublic = status === "publish" && visibility === "public";
  if ((status === "draft" || status === "pending") && wasOut) {
    const as = status === "draft" ? "a draft" : "waiting for review";
    if (stored === "future") return { tone: "warning", icon: "clock", title: "Cancel the scheduled publish?", body: `It will not go live on its date; it is kept as ${status === "draft" ? "a draft" : "an article waiting for review"}.`, confirmLabel: "Cancel schedule", pendingLabel: "Saving…" };
    return { tone: "danger", icon: "eyeOff", title: stored === "private" ? "Take this private article back to drafts?" : "Take this article off the site?", body: stored === "private" ? `Staff can no longer open it on the site. It is kept as ${as}.` : `Readers lose it straight away: its page stops working and it leaves the homepage, its category and the feeds. It is kept as ${as}.`, confirmLabel: "Take it off the site", pendingLabel: "Unpublishing…" };
  }
  if (status === "publish" && visibility === "private" && stored !== "private") {
    return { tone: "warning", icon: "lock", title: "Make this article private?", body: wasLive ? "It comes off the public site; only signed-in staff can open it." : "Only signed-in staff will be able to open it; readers will not see it.", confirmLabel: "Make private", pendingLabel: "Saving…" };
  }
  if (goingPublic && scheduled && (stored !== "future" || dateTouched)) {
    return { tone: "primary", icon: "calendar", title: "Schedule this article?", body: `It goes live by itself on ${when} (IST). Until then readers cannot see it.`, confirmLabel: "Schedule article", pendingLabel: "Scheduling…" };
  }
  if (goingPublic && !scheduled && !wasLive) {
    return { tone: "primary", icon: "send", title: "Publish this article now?", body: "It appears on islamonlive.in straight away: on the homepage, its category page and the feeds, and search engines are told about it.", confirmLabel: "Publish now", pendingLabel: "Publishing…" };
  }
  if (goingPublic && !scheduled && wasLive) {
    return { tone: "primary", icon: "globe", title: "Update the live article?", body: "Readers see your changes as soon as you save.", confirmLabel: "Update article", pendingLabel: "Saving…" };
  }
  return null;
}
