import type { YoastHead } from "@/lib/seo";
import type { Device, PageKind, Source } from "@/lib/analytics/shared";

/* Document shapes in the "islamonlive" database, exactly as the WordPress
   migration wrote them (migration/mongo-load.mjs, MAP). `_id` is the WordPress
   id, so ids in URLs, redirects and post.categories keep meaning the same thing.

   WordPress conventions carried over on purpose:
   - `link` is the absolute permalink, `path` its pathname with WP's lowercase
     percent-encoding (/opinion/%e0%b4%b8.../). Never re-encode it.
   - `date` / `modified` are site-local without offset, `*_gmt` UTC without
     offset; `published_at` / `updated_at` are real Dates for sorting.
   - title / excerpt / content are the *rendered* HTML WordPress served. */

export type PostStatus = "publish" | "future" | "draft" | "pending" | "private" | "trash";

export interface FeaturedVideo {
  source: string | null;
  embed_url: string | null;
  media_id: number | null;
  url: string | null;
  poster_id: number | null;
  poster_url: string | null;
}

export interface PostDoc {
  _id: number;
  status: PostStatus;
  slug: string;
  link: string;
  path: string;
  title: string;
  excerpt: string;
  content: string;
  content_sha256: string;
  /** Classic-editor source; null where only the rendered HTML was exported. */
  content_raw: string | null;
  password: string | null;
  author_id: number | null;
  featured_media_id: number | null;
  /** WordPress order; the first entry is what the permalink was built from. */
  categories: number[];
  primary_category_id: number | null;
  tags: number[];
  format: string;
  sticky: boolean;
  comment_status: string;
  featured_video: FeaturedVideo | null;
  seo: YoastHead | null;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  published_at: Date | null;
  updated_at: Date | null;
  /** Previous paths when slug changed (for redirects) */
  old_paths?: string[];
  /** Yoast SEO meta fields (title, description, keywords) */
  meta?: Record<string, string>;
  /** Original slug before trash, for untrash restoration */
  desired_slug?: string;
  /** Status before trash (_wp_trash_meta_status) */
  trashed_from?: PostStatus;
  /** The excerpt as the editor typed it; "" for an auto-excerpt. Absent on migrated posts. */
  excerpt_raw?: string;
  /** A draft whose date was never set: publishing it stamps the publish time, as WordPress does. */
  date_floating?: boolean;
}

export interface PageDoc {
  _id: number;
  status: PostStatus;
  slug: string;
  link: string;
  path: string;
  parent_id: number;
  title: string;
  excerpt: string;
  content: string;
  content_raw: string | null;
  template: string;
  author_id: number | null;
  featured_media_id: number | null;
  seo: YoastHead | null;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  published_at: Date | null;
  updated_at: Date | null;
}

export interface MediaSize {
  /** File name only; it sits in the same uploads folder as the original. */
  file: string;
  width: number;
  height: number;
  mime: string;
  filesize: number | null;
}

export interface MediaDoc {
  _id: number;
  post_id: number | null;
  status: string;
  slug: string;
  title: string;
  alt_text: string;
  caption: string;
  mime_type: string | null;
  /** "wp-content/uploads/2024/03/x.jpg", decoded. Null for broken records. */
  key: string | null;
  /** Object key in Spaces (key under the islamonlive/ folder). */
  spaces_key: string | null;
  /** Original public URL, https://islamonlive.in/wp-content/uploads/… */
  source_url: string;
  width: number | null;
  height: number | null;
  filesize: number | null;
  sizes: Record<string, MediaSize>;
  original_file: string | null;
  /** False for the handful of records that point at a folder, not a file. */
  is_file: boolean;
  date: string;
  modified: string;
  uploaded_at: Date | null;
  /** Uploader, for files added through the admin after the migration. */
  author_id?: number;
}

export interface UserDoc {
  _id: number;
  name: string;
  slug: string;
  description: string;
  link: string;
  path: string;
  /** Profile photo if uploaded, else WP's Gravatar URL, which is always the grey placeholder. */
  avatar_url: string | null;
  /** WP avatar_urls (Gravatar, keys 24/48/96) overlaid with Metronet sizes (full/96/150/…). */
  avatars: Record<string, string>;
  username: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  locale: string | null;
  roles: string[];
  role: string;
  registered_at: Date | null;
  password_hash: string | null;
  is_active: boolean;
  seo: YoastHead | null;
}

export interface TermDoc {
  _id: number;
  name: string;
  slug: string;
  description: string;
  link: string;
  path: string;
  count: number;
  seo: YoastHead | null;
}

export interface CategoryDoc extends TermDoc {
  parent_id: number;
}

export type TagDoc = TermDoc;

export interface BannerDoc {
  _id: string;
  /** Promo link destination (relative or absolute URL). */
  href: string;
  /** Image URL (must be rewritable media URL or external). */
  img: string;
  /** Image natural width in pixels. */
  width: number;
  /** Image natural height in pixels. */
  height: number;
  /** Alt text for accessibility. */
  alt: string;
  /** When this banner was created/updated; used for cache invalidation. */
  updated_at?: Date;
}

export interface SettingsDoc {
  _id: "site";
  default_category?: number;
  [key: string]: unknown;
}

/** One page view, written by /api/analytics/collect (see docs/analytics-plan.md). Short keys: there are many. */
export interface AnalyticsViewDoc {
  /** random view id from the browser */
  _id: string;
  /** visitor and session ids, random */
  v: string;
  s: string;
  /** started, last seen */
  t: Date;
  ls: Date;
  /** IST day the view started, YYYY-MM-DD */
  day: string;
  k: PageKind;
  p: string;
  a?: number;
  c?: number[];
  dev: Device;
  src: Source;
  /** referring domain or utm_source */
  ref?: string;
  /** first visit ever, first view of the session */
  nv: boolean;
  en: boolean;
  /** active seconds, furthest scroll depth 0–100 (both only ever raised) */
  e: number;
  sd: number;
}

/** The sums the reports add up, from raw views or from rollups. Scroll figures count article views only. */
export interface AnalyticsMeasures {
  views: number;
  activeSeconds: number;
  articleViews: number;
  articleActiveSeconds: number;
  scrollSum: number;
  /** article views scrolled to 25, 50, 75 and 90 % */
  r25: number;
  r50: number;
  r75: number;
  r90: number;
  /** sessions that started here, and how many of them were engaged */
  sessions: number;
  engagedSessions: number;
}

/** Totals for one closed day and one combination of dimensions, rolled up from analytics_views. */
export interface AnalyticsDailyDoc extends AnalyticsMeasures {
  /** the dimensions below, joined with "|" */
  _id: string;
  day: string;
  dev: Device;
  src: Source;
  nv: boolean;
  k: PageKind;
  /** article id, or the path for other pages */
  key: number | string;
  ref: string | null;
  c: number[] | null;
}

export interface Collections {
  posts: PostDoc;
  pages: PageDoc;
  media: MediaDoc;
  users: UserDoc;
  categories: CategoryDoc;
  tags: TagDoc;
  banners: BannerDoc;
  settings: SettingsDoc;
  analytics_views: AnalyticsViewDoc;
  analytics_daily: AnalyticsDailyDoc;
  analytics_meta: { _id: string; [key: string]: unknown };
}
