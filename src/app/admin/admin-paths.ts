import type { StaffRole, Tab } from "./ui";

/* Each workspace screen has its own address, so a reload, a bookmark or a tab
   left open overnight comes back to the same screen. "edit" has none of its
   own: the article is held in memory, so its address is the list it came from. */

const PATHS: Record<Tab, string> = {
  overview: "/admin/",
  articles: "/admin/articles/",
  new: "/admin/new/",
  edit: "/admin/articles/",
  authors: "/admin/authors/",
  analytics: "/admin/analytics/",
  homepage: "/admin/homepage/",
  team: "/admin/team/",
  activity: "/admin/activity/",
};

const BY_SEGMENT = new Map<string, Tab>(
  (Object.keys(PATHS) as Tab[]).filter((tab) => tab !== "overview" && tab !== "edit").map((tab) => [tab, tab]),
);

export const pathForTab = (tab: Tab): string => PATHS[tab];

/** The screen a path under /admin names, or null for one that is not a screen. */
export function tabFromSegments(segments: string[] | undefined): Tab | null {
  if (!segments?.length) return "overview";
  if (segments.length > 1) return null;
  return BY_SEGMENT.get(segments[0]) ?? null;
}

export function tabFromPath(pathname: string): Tab | null {
  const rest = pathname.replace(/^\/admin\/?/, "");
  if (rest === pathname && pathname !== "/admin") return null;
  return tabFromSegments(rest.split("/").filter(Boolean));
}

/** Screens only some staff may open: anyone else lands on the Overview instead. */
export function allowedTab(tab: Tab, role: StaffRole, analytics: boolean): Tab {
  if (tab === "analytics") return analytics ? tab : "overview";
  if (tab === "homepage" || tab === "team" || tab === "activity") return role === "administrator" ? tab : "overview";
  return tab;
}
