// Real reels come from Instagram (islam.onlive), straight from the Instagram
// Graph API ("Instagram API with Instagram Login"). The account is ours, so a
// long-lived token for it is all that is needed — no WordPress plugin in the
// middle. The Smash Balloon feed this used to scrape was removed from WP.
//
// IG_ACCESS_TOKEN is server-only. It lives 60 days; extend it before then with
//   GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<token>
// and put the returned token back into the env.
export interface Reel {
  /** shortcode from the permalink — what Instagram's embed URLs are keyed by */
  id: string;
  url: string;
  thumbnail: string;
  /** signed CDN mp4 — plays inline, expires after a while */
  video?: string;
  title?: string;
  /** unix seconds — used to sort newest first */
  date?: number;
}

interface IgMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

interface IgPage {
  data?: IgMedia[];
  paging?: { next?: string };
}

const TOKEN = process.env.IG_ACCESS_TOKEN ?? "";
const FIELDS = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp";

/* Instagram signs its CDN links and rotates the signature, so the feed is only
   held for 20 minutes; the player re-asks /api/reel for anything that has gone
   stale in between. */
const REVALIDATE = 20 * 60;

/* Pages of the profile are walked until enough reels turn up — posts and
   carousels are mixed into the same list. Capped so an account that is mostly
   photos can't send this round the whole archive. */
const MAX_PAGES = 5;

function toReel(m: IgMedia): Reel | null {
  if (m.media_type !== "VIDEO" || !m.thumbnail_url) return null;
  const code = /\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/.exec(m.permalink)?.[1];
  if (!code) return null;
  return {
    id: code,
    url: `https://www.instagram.com/reel/${code}/`,
    thumbnail: m.thumbnail_url,
    video: m.media_url,
    title: m.caption?.replace(/\s+/g, " ").trim() || undefined,
    date: Math.floor(Date.parse(m.timestamp) / 1000) || undefined,
  };
}

async function fetchReels(limit: number, fresh: boolean): Promise<Reel[]> {
  if (!TOKEN) return [];
  const out: Reel[] = [];
  let next: string | undefined =
    `https://graph.instagram.com/me/media?fields=${FIELDS}&limit=50&access_token=${encodeURIComponent(TOKEN)}`;

  for (let i = 0; next && i < MAX_PAGES && out.length < limit; i++) {
    const res: Response | null = await fetch(
      next,
      fresh ? { cache: "no-store" } : { next: { revalidate: REVALIDATE, tags: ["instagram"] } }
    ).catch(() => null);
    if (!res?.ok) break;
    const page = (await res.json().catch(() => ({}))) as IgPage;
    for (const m of page.data ?? []) {
      const reel = toReel(m);
      if (reel && out.length < limit) out.push(reel);
    }
    next = page.paging?.next;
  }
  return out;
}

/** the feed, newest first, with signed video links */
export async function getReels(limit = 8): Promise<Reel[]> {
  const reels = await fetchReels(limit, false);
  // the API already returns newest first; sorted anyway so callers can rely on it
  return reels.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
}

/** A freshly signed video link for one reel, by its shortcode.

    The player calls this through /api/reel when a link it was given has gone
    stale mid-session, so a reel that has been sitting on screen for an hour
    still plays instead of dropping to the embed. */
export async function getReelVideo(code: string): Promise<string | null> {
  // `fresh`: the caller is here precisely because the link it had has gone
  // stale, so a cached page would just hand back the same dead link
  const reels = await fetchReels(50, true);
  return reels.find((r) => r.id === code)?.video ?? null;
}
