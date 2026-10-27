import { TTL } from "@/lib/cache";
import { toWPPost, type ListPostDoc } from "@/lib/db/adapt";
import { cached } from "@/lib/db/cache";
import { collection, db } from "@/lib/db/client";
import { loadRefs, NEWEST_FIRST, publicFilter } from "@/lib/db/posts";
import { SITE_URL } from "@/lib/env";
import { decodeEntities, type WPPost } from "@/lib/wp-model";

/* The site's RSS 2.0, Atom and comments feeds, as WordPress served them.

   Until DATA_SOURCE=mongo, /feed/ is proxied to WordPress (next.config). Feed
   readers, aggregators and Google News have polled that output for years, so
   this reproduces it field for field — compared against the live feeds saved
   in lib/__fixtures__/feeds on 2026-10-27:

   - 10 newest posts (WordPress's posts_per_rss)
   - item links carry ?utm_source=rss&utm_medium=rss&utm_campaign=<slug>,
     added on the live site by a tracking plugin; analytics depend on them
   - guid is the ?p=ID permalink, isPermaLink="false"
   - <category> lists the post's categories, then its tags, entity-decoded
   - description = excerpt, content:encoded = full body, each followed by
     Yoast's "The post … appeared first on …" line
   - dates are RFC 822 / RFC 3339 in UTC from the *_gmt columns
   - every URL is on the public host — never admin. or the Cloudways host */

/* The site name and tagline exactly as WordPress prints them: its typography
   filter binds the last words with non-breaking spaces (U+00A0, written as
   escapes so they stay visible here), and feed readers key items on these. */
const SITE_NAME = "Islamonlive.in | The one and only Comprehensive Islamic portal in Malayalam";
const SITE_DESCRIPTION = "Discover the beauty of Islam with our comprehensive Malayalam web portal. Find informative articles, connect with like-minded individuals";
const SITE_ICON = `${SITE_URL}/wp-content/uploads/2025/06/cropped-icon-new-32x32.png`;
const GENERATOR_VERSION = "7.1.3";
const POSTS_PER_RSS = 10;

/** Backend hosts that must never leak into a feed. */
const BACKEND_HOSTS = /https?:\/\/(?:admin\.islamonlive\.in|wordpress-\d+-\d+\.cloudwaysapps\.com)/g;

export function publicUrls(html: string): string {
  return html.replace(BACKEND_HOSTS, SITE_URL);
}

/** WP *_gmt values carry no offset; they are UTC. */
function gmt(value: string | undefined): Date {
  if (!value) return new Date(0);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number): string => String(n).padStart(2, "0");

/** "Tue, 27 Oct 2026 04:52:58 +0000" — mysql2date('D, d M Y H:i:s +0000'). */
export function rfc822(date: Date): string {
  return `${DAYS[date.getUTCDay()]}, ${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`;
}

/** "2026-10-27T04:52:58Z" — Atom's format, no milliseconds. */
export function rfc3339(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}

/** WordPress's esc_attr(): also the single quote, as &#039; (Atom's category term="…"). */
export function escAttr(text: string): string {
  return escXml(text).replace(/'/g, "&#039;");
}

/** Text that is not inside CDATA. */
export function escXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** CDATA cannot contain "]]>"; split it the standard way. */
export function cdata(text: string): string {
  return `<![CDATA[${text.split("]]>").join("]]]]><![CDATA[>")}]]>`;
}

export interface FeedPost {
  post: WPPost;
  dateGmt: string;
  modifiedGmt: string;
}

/** The ten newest public posts, with bodies. */
async function latestImpl(): Promise<FeedPost[]> {
  const docs = await (await collection("posts"))
    .find(publicFilter(), { projection: { content_raw: 0, password: 0, content_sha256: 0, seo: 0 } })
    .sort(NEWEST_FIRST)
    .limit(POSTS_PER_RSS)
    .toArray();
  const refs = await loadRefs(docs as ListPostDoc[]);
  return docs.map((doc) => ({ post: toWPPost(doc, refs, true), dateGmt: doc.date_gmt, modifiedGmt: doc.modified_gmt }));
}

export const latestFeedPosts = cached("feed:latest", latestImpl, { revalidate: TTL.posts, tags: ["wp", "wp:posts"] });

/* Feed bodies pass through WordPress's the_content_feed filters, where
   wp_staticize_emoji() runs wp_encode_emoji(): each character in its emoji
   table is written as a hex entity. In this archive that is the zero-width
   joiner Malayalam spellings use (ര്‍ comes out as ര്&#x200d;) and the emoji
   variation selector. Left raw, every item's bytes would differ. */
function feedContent(html: string): string {
  return publicUrls(html).replace(/[‍️]/g, (ch) => `&#x${ch.charCodeAt(0).toString(16)};`);
}

function permalink(post: WPPost): string {
  return publicUrls(post.link);
}

/** The tracked link the live feed hands out; &#038; is how WordPress escapes the & in it. */
function trackedLink(post: WPPost): string {
  return `${permalink(post)}?utm_source=rss&#038;utm_medium=rss&#038;utm_campaign=${post.slug}`;
}

/** Yoast's RSS footer (Search Appearance → RSS, "after content"). */
function appearedFirst(post: WPPost): string {
  return `<p>The post <a href="${permalink(post)}">${post.title.rendered}</a> appeared first on <a href="${SITE_URL}">${SITE_NAME}</a>.</p>\n`;
}

function termNames(post: WPPost): string[] {
  const [categories = [], tags = []] = post._embedded?.["wp:term"] ?? [];
  return [...categories, ...tags].map((t) => decodeEntities(t.name));
}

function authorName(post: WPPost): string {
  return post._embedded?.author?.[0]?.name ?? "";
}

function buildDate(posts: FeedPost[]): Date {
  return posts.reduce((latest, p) => (gmt(p.modifiedGmt) > latest ? gmt(p.modifiedGmt) : latest), new Date(0));
}

export function renderRss(posts: FeedPost[]): string {
  const items = posts.map(({ post, dateGmt }) => {
    // WordPress's template indents the first <category> two tabs deeper than the rest
    const categories = termNames(post).map((name, i) => `${i === 0 ? "\t\t\t\t" : "\t\t"}<category>${cdata(name)}</category>`).join("\n");
    return `\t<item>
\t\t<title>${post.title.rendered}</title>
\t\t<link>${trackedLink(post)}</link>
\t\t
\t\t<dc:creator>${cdata(authorName(post))}</dc:creator>
\t\t<pubDate>${rfc822(gmt(dateGmt))}</pubDate>
${categories}
\t\t<guid isPermaLink="false">${SITE_URL}/?p=${post.id}</guid>

\t\t\t\t\t<description>${cdata(publicUrls(post.excerpt.rendered) + appearedFirst(post))}</description>
\t\t\t\t\t\t\t\t\t\t<content:encoded>${cdata(feedContent(post.content.rendered) + appearedFirst(post))}</content:encoded>
\t\t\t\t\t
\t\t
\t\t
\t\t\t</item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"
\txmlns:content="http://purl.org/rss/1.0/modules/content/"
\txmlns:wfw="http://wellformedweb.org/CommentAPI/"
\txmlns:dc="http://purl.org/dc/elements/1.1/"
\txmlns:atom="http://www.w3.org/2005/Atom"
\txmlns:sy="http://purl.org/rss/1.0/modules/syndication/"
\txmlns:slash="http://purl.org/rss/1.0/modules/slash/"
\t>

<channel>
\t<title>${escXml(SITE_NAME)}</title>
\t<atom:link href="${SITE_URL}/feed/" rel="self" type="application/rss+xml" />
\t<link>${SITE_URL}/</link>
\t<description>${escXml(SITE_DESCRIPTION)}</description>
\t<lastBuildDate>${rfc822(buildDate(posts))}</lastBuildDate>
\t<language>en-GB</language>
\t<sy:updatePeriod>
\thourly\t</sy:updatePeriod>
\t<sy:updateFrequency>
\t1\t</sy:updateFrequency>
\t<generator>https://wordpress.org/?v=${GENERATOR_VERSION}</generator>

<image>
\t<url>${SITE_ICON}</url>
\t<title>${escXml(SITE_NAME)}</title>
\t<link>${SITE_URL}/</link>
\t<width>32</width>
\t<height>32</height>
</image>${" " /* WordPress leaves a space here; spelled out so editors cannot strip it */}
${items.join("\n")}
\t</channel>
</rss>
`;
}

export function renderAtom(posts: FeedPost[]): string {
  const entries = posts.map(({ post, dateGmt, modifiedGmt }) => {
    const categories = termNames(post).map((name) => `<category scheme="${SITE_URL}/" term="${escAttr(name)}" />`).join("");
    return `\t<entry>
\t\t<author>
\t\t\t<name>${escXml(authorName(post))}</name>
\t\t\t\t\t</author>

\t\t<title type="html">${cdata(post.title.rendered)}</title>
\t\t<link rel="alternate" type="text/html" href="${trackedLink(post)}" />

\t\t<id>${SITE_URL}/?p=${post.id}</id>
\t\t<updated>${rfc3339(gmt(modifiedGmt))}</updated>
\t\t<published>${rfc3339(gmt(dateGmt))}</published>
\t\t${categories}
\t\t<summary type="html">${cdata(publicUrls(post.excerpt.rendered) + appearedFirst(post))}</summary>

\t\t\t\t\t<content type="html" xml:base="${trackedLink(post)}">${cdata(feedContent(post.content.rendered) + appearedFirst(post))}</content>
\t\t
\t\t\t</entry>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><feed
\txmlns="http://www.w3.org/2005/Atom"
\txmlns:thr="http://purl.org/syndication/thread/1.0"
\txml:lang="en-GB"
\t>
\t<title type="text">${escXml(SITE_NAME)}</title>
\t<subtitle type="text">${escXml(SITE_DESCRIPTION)}</subtitle>

\t<updated>${rfc3339(buildDate(posts))}</updated>

\t<link rel="alternate" type="text/html" href="${SITE_URL}/" />
\t<id>${SITE_URL}/feed/atom/</id>
\t<link rel="self" type="application/atom+xml" href="${SITE_URL}/feed/atom/" />

\t<generator uri="https://wordpress.org/" version="${GENERATOR_VERSION}">WordPress</generator>
<icon>${SITE_ICON}</icon>
${entries.join("\n")}
</feed>
`;
}

/* Comments: WordPress's comment feed lists the newest approved comments. The
   archive has exactly one (a 2020 comment); the feed is kept so its URL keeps
   answering with valid RSS rather than a 404. */
export interface FeedComment {
  id: number;
  author: string;
  dateGmt: string;
  link: string;
  postTitle: string;
  html: string;
}

interface CommentDoc {
  _id: number;
  post?: number;
  status?: string;
  author_name?: string;
  date_gmt?: string;
  link?: string;
  content?: { rendered?: string };
}

async function commentsImpl(): Promise<FeedComment[]> {
  const docs = (await (await db())
    .collection<CommentDoc>("comments")
    .find({ status: "approved" })
    .sort({ date_gmt: -1 })
    .limit(POSTS_PER_RSS)
    .toArray());
  const posts = await (await collection("posts")).find({ _id: { $in: docs.map((d) => d.post ?? 0) } }, { projection: { title: 1 } }).toArray();
  const titles = new Map(posts.map((p) => [p._id, p.title]));
  return docs.map((d) => ({
    id: d._id,
    author: d.author_name ?? "",
    dateGmt: d.date_gmt ?? "",
    link: publicUrls(d.link ?? ""),
    postTitle: titles.get(d.post ?? 0) ?? "",
    html: publicUrls(d.content?.rendered ?? ""),
  }));
}

export const latestFeedComments = cached("feed:comments", commentsImpl, { revalidate: TTL.posts, tags: ["wp", "wp:comments"] });

export function renderCommentsRss(comments: FeedComment[]): string {
  const built = comments.reduce((latest, c) => (gmt(c.dateGmt) > latest ? gmt(c.dateGmt) : latest), new Date(0));
  const items = comments.map((c) => `\t<item>
\t\t<title>
\t\tComment on ${c.postTitle} by ${escXml(c.author)}\t\t</title>
\t\t<link>${c.link}</link>

\t\t<dc:creator>${cdata(c.author)}</dc:creator>
\t\t<pubDate>${rfc822(gmt(c.dateGmt))}</pubDate>
\t\t<guid isPermaLink="false">${c.link}</guid>

\t\t\t\t\t<description>${cdata(c.html.replace(/<[^>]*>/g, "").trim())}</description>
\t\t\t<content:encoded>${cdata(c.html)}</content:encoded>
\t\t
\t\t\t</item>`);
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"
\txmlns:content="http://purl.org/rss/1.0/modules/content/"
\txmlns:dc="http://purl.org/dc/elements/1.1/"
\txmlns:atom="http://www.w3.org/2005/Atom"
\txmlns:sy="http://purl.org/rss/1.0/modules/syndication/"
\t
\t>
<channel>
\t<title>
\tComments for ${escXml(SITE_NAME)}\t</title>
\t<atom:link href="${SITE_URL}/comments/feed/" rel="self" type="application/rss+xml" />
\t<link>${SITE_URL}/</link>
\t<description>${escXml(SITE_DESCRIPTION)}</description>
\t<lastBuildDate>${rfc822(built)}</lastBuildDate>
\t<sy:updatePeriod>
\thourly\t</sy:updatePeriod>
\t<sy:updateFrequency>
\t1\t</sy:updateFrequency>
\t<generator>https://wordpress.org/?v=${GENERATOR_VERSION}</generator>
${items.join("\n")}
\t</channel>
</rss>
`;
}

/** The headers every feed route sends: WordPress's types, the posts cache tier. */
export function feedResponse(body: string, type: "rss" | "atom"): Response {
  return new Response(body, {
    headers: {
      "Content-Type": `application/${type === "rss" ? "rss" : "atom"}+xml; charset=UTF-8`,
      "Cache-Control": `public, max-age=0, s-maxage=${TTL.posts}, stale-while-revalidate=3600`,
    },
  });
}

/** A data-source outage must not serve an empty-but-valid feed (readers would drop items). */
export function feedUnavailable(): Response {
  return new Response("Feed temporarily unavailable", { status: 503, headers: { "Retry-After": "600", "Cache-Control": "no-store" } });
}
