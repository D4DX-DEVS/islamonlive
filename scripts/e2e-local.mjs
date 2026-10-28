#!/usr/bin/env node
/**
 * End-to-end check of the MongoDB backend, without touching anything real.
 *
 * Starts a throwaway mongod seeded with the test fixtures, a fake S3 that
 * stands in for DigitalOcean Spaces, and `next start` on a MongoDB-mode build;
 * then walks the editor's whole journey over HTTP and checks what the public
 * site, sitemaps and feed show after each step.
 *
 *   node ../migration/next-mongo.mjs build --dist .next-e2e   (once, from migration/)
 *   node scripts/e2e-local.mjs [--dist .next-e2e] [--port 3701] [--keep]
 *
 * --keep leaves the server running afterwards (for a browser check) until Ctrl+C.
 * Never reads .env files: every variable the server needs is set here.
 */
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, scrypt } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { EJSON } from "bson";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const DIST = arg("dist", ".next-e2e");
const PORT = Number(arg("port", 3701));
const KEEP = process.argv.includes("--keep");
const BASE = `http://127.0.0.1:${PORT}`;
const SITE = "https://islamonlive.in";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXTURES = fileURLToPath(new URL("../src/lib/db/__fixtures__/", import.meta.url));

/* ---------- reporting ---------- */
let failures = 0;
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Public pages are cached with stale-while-revalidate, as in production: allow a refresh or two. */
async function eventually(probe, tries = 12) {
  let last;
  for (let i = 0; i < tries; i++) {
    last = await probe();
    if (last.ok) return last;
    await sleep(750);
  }
  return last;
}

/* ---------- fake Spaces ---------- */
const objects = new Map();
const s3 = createServer((req, res) => {
  const key = decodeURIComponent(new URL(req.url, "http://s3").pathname).replace(/^\/[^/]+\//, ""); // path style: /bucket/key
  if (req.method === "PUT") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      objects.set(key, { body: Buffer.concat(chunks), type: req.headers["content-type"], acl: req.headers["x-amz-acl"], cache: req.headers["cache-control"] });
      res.writeHead(200, { ETag: '"e2e"' }).end();
    });
  } else if (req.method === "HEAD") res.writeHead(objects.has(key) ? 200 : 404).end();
  else if (req.method === "DELETE") res.writeHead(204).end(void objects.delete(key));
  else res.writeHead(405).end();
});

/* ---------- fake WordPress ----------
   Every WordPress setting points here (overriding .env.local, which next start
   would otherwise read), so any request that still reaches WordPress is caught. */
const wpHits = [];
const wp = createServer((req, res) => {
  wpHits.push(`${req.method} ${req.url}`);
  if (KEEP) console.log(`WORDPRESS HIT ${req.method} ${req.url}`); // during a --keep browser check too
  res.writeHead(503).end();
});

/* ---------- database ---------- */
const scryptAsync = promisify(scrypt);
async function hash(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}
const fixture = (name) => EJSON.parse(readFileSync(`${FIXTURES}${name}.json`, "utf8"), { relaxed: true });

const PASSWORD = randomBytes(12).toString("base64url");
async function seed(uri) {
  const client = await MongoClient.connect(uri);
  const db = client.db("islamonlive");
  for (const name of ["posts", "pages", "media", "users", "categories", "tags"]) await db.collection(name).insertMany(fixture(name));
  const categories = fixture("categories");
  await db.collection("settings").insertOne({ _id: "site", timezone: "Asia/Kolkata", default_category: categories[0]._id });
  const base = { slug: "", description: "", link: "", path: "", avatar_url: null, avatars: {}, first_name: null, last_name: null, is_active: true };
  await db.collection("users").insertMany([
    { ...base, _id: 990001, name: "E2E Admin", slug: "e2e-admin", username: "e2e-admin", email: "admin@e2e.test", role: "administrator", roles: ["administrator"], password_hash: await hash(PASSWORD) },
    { ...base, _id: 990002, name: "E2E Editor", slug: "e2e-editor", username: "e2e-editor", email: "editor@e2e.test", role: "editor", roles: ["editor"], password_hash: await hash(PASSWORD) },
    { ...base, _id: 990003, name: "E2E Author", slug: "e2e-author", username: "e2e-author", email: "author@e2e.test", role: "author", roles: ["author"], password_hash: await hash(PASSWORD) },
  ]);
  return { client, db, categories };
}

/* ---------- HTTP helpers ----------
   The site enforces trailing slashes (a POST to /api/admin/media is 308'd),
   so every admin call uses the slashed URL, exactly as the admin UI does. */
function login(username, password = PASSWORD) {
  return fetch(`${BASE}/api/admin/login/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
}
async function session(username) {
  const res = await login(username);
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { status: res.status, cookie };
}
const page = (path) => fetch(`${BASE}${path}`, { redirect: "manual" });
const text = async (path) => (await page(path)).text();
const pathOf = (link) => new URL(link).pathname;

function articleForm(fields, image) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, typeof v === "string" ? v : JSON.stringify(v));
  if (image) form.set("featuredImage", new File([image], "e2e-photo.jpg", { type: "image/jpeg" }));
  return form;
}
// smallest JPEG header the upload check accepts (EXIF marker, as phones write)
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 0x10, 0x45, 0x78, 0x69, 0x66, 0, 0, 0xff, 0xd9]);
const MP4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);

/** "YYYY-MM-DDTHH:MM" in IST, what the editor's date picker sends. */
const ist = (ms) => new Date(ms + 5.5 * 3600_000).toISOString().slice(0, 16);

/* ---------- the journey ---------- */
async function journey({ db, categories }) {
  const [catA, catB] = categories;

  // auth
  check("wrong password is refused", (await login("e2e-admin", "nope")).status === 401);
  check("an author cannot sign in to the admin", (await login("e2e-author")).status === 401);
  check("admin API refuses an anonymous caller", (await fetch(`${BASE}/api/admin/posts/`)).status === 401);
  const admin = await session("e2e-admin");
  const editor = await session("e2e-editor");
  check("administrator and editor can sign in", admin.status === 200 && editor.status === 200 && admin.cookie.includes("iol_admin_session") && editor.cookie.includes("iol_admin_session"));
  const as = (who) => (path, init = {}) => fetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers ?? {}), Cookie: who.cookie } });
  const ed = as(editor);
  const ad = as(admin);

  // listing what WordPress would list
  const list = await (await ed("/api/admin/posts/?status=any")).json();
  check("editor sees the article list with totals", Array.isArray(list.items) && list.items.length > 0 && list.total > 0, JSON.stringify(list).slice(0, 200));

  // media
  const upForm = new FormData();
  upForm.set("file", new File([JPEG], "Inline Photo.jpg", { type: "image/jpeg" }));
  upForm.set("alt", "Alt from editor");
  const up = await ed("/api/admin/media/", { method: "POST", body: upForm });
  const upData = await up.json();
  const upKey = upData.item ? `islamonlive/${decodeURIComponent(new URL(upData.item.url).pathname.slice(1))}` : "";
  check("editor uploads an image; it lands in Spaces, public and immutable", up.status === 201 && objects.get(upKey)?.acl === "public-read" && /immutable/.test(objects.get(upKey)?.cache ?? ""), `${up.status} ${JSON.stringify(upData).slice(0, 200)} keys=${[...objects.keys()].join(",")}`);
  check("its alt text is stored", (await db.collection("media").findOne({ _id: upData.item?.id }))?.alt_text === "Alt from editor");

  const fake = new FormData();
  fake.set("file", new File([new TextEncoder().encode("<svg onload=alert(1)>")], "x.jpg", { type: "image/jpeg" }));
  check("an SVG/HTML file disguised as a JPEG is refused", (await ed("/api/admin/media/", { method: "POST", body: fake })).status === 415);

  const vid = new FormData();
  vid.set("file", new File([MP4], "clip.mp4", { type: "video/mp4" }));
  vid.set("kind", "video");
  const vidRes = await ed("/api/admin/media/", { method: "POST", body: vid });
  const video = (await vidRes.json()).item;
  check("editor uploads a featured video file", vidRes.status === 201 && Boolean(video?.id));

  // create + publish
  const title = "ഇ2ഇ പരിശോധന: Q&A - it's live";
  const created = await ed("/api/admin/posts/", {
    method: "POST",
    body: articleForm({ title, content: "<p>ആദ്യ ഖണ്ഡിക. First paragraph of the e2e article.</p><p><img src=\"/wp-content/uploads/2026/10/e2e-inline.jpg\" alt=\"inline\"></p><p>Second.</p>", status: "publish", categories: [catA._id], tags: ["e2e tag", "ടെസ്റ്റ്"], excerpt: "", seo: { description: "A custom meta description written by the editor for this e2e article." }, featuredVideo: { source: "self", mediaId: video?.id } }, JPEG),
  });
  const post = (await created.json()).item ?? {};
  check("editor publishes an article with a featured image, tags, SEO and video", created.status === 201 && post.status === "publish", JSON.stringify(post).slice(0, 300));
  const doc = await db.collection("posts").findOne({ _id: post.id });
  if (!doc) throw new Error("the article was not created; the remaining checks depend on it");
  const path = doc.path;
  // the editor hands back /wp-content/… paths; they are stored as full addresses, as WordPress stores them
  const savedHtml = `${doc.content ?? ""} ${doc.content_raw ?? ""}`;
  check("a picture in the text is stored with its full islamonlive.in address", savedHtml.includes(`src="${SITE}/wp-content/uploads/2026/10/e2e-inline.jpg"`) && !savedHtml.includes(`src="/wp-content/`), savedHtml.slice(0, 200));
  check("it gets a WordPress-style URL under its category", /^\/[^?]+\/$/.test(path) && path.includes(catA.slug), path);
  check("its new tags were created on the way", (doc?.tags?.length ?? 0) === 2);
  check("its featured video is attached", doc?.featured_video?.source === "self" && doc.featured_video.media_id === video?.id);
  check("its dates are IST / UTC pairs", doc && Date.parse(`${doc.date_gmt}Z`) === doc.published_at.getTime() && Date.parse(`${doc.date}Z`) - doc.published_at.getTime() === 5.5 * 3600_000);

  const html = await (await eventually(async () => {
    const r = await page(path);
    return { ok: r.status === 200, r };
  })).r.text();
  check("the article is live on the public site", html.includes("First paragraph of the e2e article"));
  check("its <title> and canonical are right", html.includes(`<link rel="canonical" href="${SITE}${path}"/>`) && /<title>[^<]*ഇ2ഇ/.test(html));
  check("the custom meta description is used", html.includes('content="A custom meta description written by the editor for this e2e article."'));
  check("it carries Article JSON-LD and an og:image", html.includes('"@type":"Article"') && /property="og:image"/.test(html));
  // share images and structured data name the public site, as on WordPress: never the CDN, the backend or the WordPress host
  const metaImages = [...html.matchAll(/<meta (?:property="og:image"|name="twitter:image") content="([^"]+)"/g)].map((m) => m[1]);
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("");
  check("og:image, twitter:image and JSON-LD stay on islamonlive.in", metaImages.length >= 2 && metaImages.every((u) => u.startsWith(`${SITE}/wp-content/uploads/`)) && !/digitaloceanspaces\.com|admin\.islamonlive\.in|127\.0\.0\.1/.test(jsonLd), `${metaImages.join(" ")} ${(jsonLd.match(/https?:\/\/(?:[^"/]*digitaloceanspaces\.com|admin\.islamonlive\.in|127\.0\.0\.1)[^"]*/) ?? [""])[0]}`);

  const inSitemap = await eventually(async () => ({ ok: (await text("/post-sitemap.xml")).includes(`${SITE}${path}`) }));
  check("it appears in post-sitemap.xml", inSitemap.ok);
  check("it appears in the news sitemap", (await eventually(async () => ({ ok: (await text("/news-sitemap.xml")).includes(`${SITE}${path}`) }))).ok);
  const feed = await eventually(async () => {
    const xml = await text("/feed/");
    return { ok: xml.includes(`${SITE}${path}`), xml };
  });
  check("it leads the RSS feed, and the feed stays well-formed", feed.ok && feed.xml.includes("Q&#038;A") && !/&(?!#?\w+;)/.test(feed.xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")));
  const legacy = await page(`/?p=${post.id}`);
  check("its /?p=ID link 301s to the article", legacy.status === 301 && (legacy.headers.get("location") ?? "").endsWith(path));
  check("the category page lists it", (await eventually(async () => ({ ok: (await text(pathOf(catA.link))).includes(path) }))).ok);

  // reader analytics: beacons as lib/analytics/tracker.ts sends them, then what the administrator sees
  const READER_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
  const reader = { id: `e2e-view-${randomBytes(6).toString("hex")}`, v: "e2e-visitor-000001", s: "e2e-session-00001", k: "article", p: path, a: post.id, c: [catA._id], rh: "www.google.com", nv: true, en: true, e: 0, sd: 0 };
  const beacon = (body, headers = {}) => fetch(`${BASE}/api/analytics/collect`, { method: "POST", headers: { "Content-Type": "text/plain", "User-Agent": READER_UA, ...headers }, body: JSON.stringify(body) });
  const started = await beacon({ ...reader, ev: "start" });
  await beacon({ ...reader, ev: "start" }); // a re-render sending start again
  await beacon({ ...reader, ev: "ping", e: 12, sd: 60 });
  await beacon({ ...reader, ev: "end", e: 28, sd: 93 });
  await beacon({ ...reader, ev: "ping", e: 20, sd: 70 }); // late and out of order
  const views = await db.collection("analytics_views").find({ a: post.id }).toArray();
  check("a reader's start, pings and end make one view holding the largest totals", started.status === 204 && views.length === 1 && views[0].e === 28 && views[0].sd === 93 && views[0].src === "search" && views[0].dev === "mobile", JSON.stringify(views));
  check("the view keeps no IP address or browser string", !/Pixel|Android|127\.0\.0\.1/.test(JSON.stringify(views)));
  await beacon({ ...reader, id: `${reader.id}-bot`, ev: "start" }, { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });
  await beacon({ ...reader, id: `${reader.id}-staff`, ev: "start" }, { Cookie: editor.cookie });
  check("crawlers and signed-in staff are not counted", (await db.collection("analytics_views").countDocuments({ a: post.id })) === 1);
  const summary = await (await ad("/api/admin/analytics/summary?range=today")).json();
  const top = summary.topViewed?.find((a) => a.id === post.id);
  check("the administrator's dashboard shows the read, with the article's path, date and thumbnail", summary.totals?.articleViews >= 1 && top?.path === path && top?.publishedAt === doc.date && Boolean(top?.image) && summary.sources?.some((s) => s.id === "search"), `${JSON.stringify(summary.totals)} ${JSON.stringify(top)}`);
  check("editors cannot open reader analytics, and their Overview leaves it out", (await ed("/api/admin/analytics/summary")).status === 403 && (await (await ed("/api/admin/overview/?days=30")).json()).reader === null);
  const table = await (await ad(`/api/admin/analytics/articles?range=today&q=${post.id}`)).json();
  check("the article table lists it with its exact visitors", table.data?.[0]?.id === post.id && table.data[0].visitors === 1, JSON.stringify(table).slice(0, 300));
  const detail = await (await ad(`/api/admin/analytics/articles/${post.id}?range=today`)).json();
  check("its breakdown shows the active time and where the reader stopped", detail.totals?.avgArticleSeconds === 28 && detail.totals?.reached?.["90"] === 1, JSON.stringify(detail.totals));
  const live = await (await ad("/api/admin/analytics/live")).json();
  check("live readers include it", live.pages?.some((p) => p.kind === "article" && Number(p.key) === post.id), JSON.stringify(live).slice(0, 300));

  // edit: categories change keeps the URL; slug change moves it with a redirect
  const edit = (fields) => ed(`/api/admin/posts/?id=${post.id}`, { method: "PUT", body: articleForm({ title, content: "<p>Edited body.</p>", status: "publish", categories: [catB._id], excerpt: "", ...fields }) });
  // dates are kept to whole seconds, as WordPress keeps them: an edit inside the publishing second cannot move modified
  await sleep(1100);
  const e1 = await edit({});
  const afterEdit = await db.collection("posts").findOne({ _id: post.id });
  check("editing body and categories keeps the published URL", e1.status === 200 && afterEdit.path === path, `${e1.status} ${afterEdit?.path}`);
  check("editing never moves the publish time", afterEdit.published_at.getTime() === doc.published_at.getTime());
  check("editing updates modified (sitemap lastmod)", afterEdit.modified_gmt > doc.modified_gmt, `${doc.modified_gmt} -> ${afterEdit.modified_gmt}`);
  const e2 = await edit({ slug: "e2e-renamed" });
  const renamed = await db.collection("posts").findOne({ _id: post.id });
  check("renaming the slug moves the URL and remembers the old one", e2.status === 200 && renamed.path.endsWith("/e2e-renamed/") && renamed.old_paths?.includes(path), JSON.stringify({ path: renamed?.path, old: renamed?.old_paths }));
  const oldUrl = await eventually(async () => {
    const r = await page(path);
    return { ok: r.status === 301 && (r.headers.get("location") ?? "").endsWith(renamed.path), r };
  });
  check("the old URL permanently redirects to the new one", oldUrl.ok, `${oldUrl.r.status} ${JSON.stringify(Object.fromEntries(oldUrl.r.headers))}`);
  check("the new URL serves the edited article", (await eventually(async () => ({ ok: (await text(renamed.path)).includes("Edited body.") }))).ok);

  // drafts and scheduling
  const draft = (await (await ed("/api/admin/posts/", { method: "POST", body: articleForm({ title: "E2E draft only", content: "<p>secret draft</p>", status: "draft", categories: [catA._id], excerpt: "" }) })).json()).item;
  const draftDoc = await db.collection("posts").findOne({ _id: draft?.id });
  check("a draft stays off the site, sitemap and feed", draftDoc?.status === "draft" && (await page(`/${catA.slug}/e2e-draft-only/`)).status === 404 && !(await text("/post-sitemap.xml")).includes("e2e-draft-only") && !(await text("/feed/")).includes("secret draft"));

  const later = (await (await ed("/api/admin/posts/", { method: "POST", body: articleForm({ title: "E2E scheduled", content: "<p>scheduled body</p>", status: "publish", date: ist(Date.now() + 86_400_000), categories: [catA._id], excerpt: "" }) })).json()).item;
  const laterDoc = await db.collection("posts").findOne({ _id: later?.id });
  check("a future date makes it scheduled, not live", laterDoc?.status === "future" && (await page(laterDoc.path)).status === 404, `${laterDoc?.status}`);
  // its time has come: move the instant and both clocks together, as if a day had passed
  const due = new Date(Math.floor(Date.now() / 1000) * 1000 - 1000);
  const clock = (d) => d.toISOString().slice(0, 19);
  await db.collection("posts").updateOne({ _id: later.id }, { $set: { published_at: due, date_gmt: clock(due), date: clock(new Date(due.getTime() + 5.5 * 3600_000)) } });
  check("the cron route refuses a wrong secret", (await fetch(`${BASE}/api/cron/publish/`, { headers: { Authorization: "Bearer wrong-secret-value" } })).status === 401);
  const cron = await (await fetch(`${BASE}/api/cron/publish/`, { headers: { Authorization: `Bearer ${process.env.E2E_CRON_SECRET}` } })).json();
  check("the cron publishes it once its time comes", cron.published?.includes(later.id) && (await db.collection("posts").findOne({ _id: later.id }))?.status === "publish", JSON.stringify(cron));
  check("and it is then live", (await eventually(async () => ({ ok: (await page(laterDoc.path)).status === 200 }))).ok);

  // taxonomy + authors
  const cat = await ed("/api/admin/categories/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "E2E Category" }) });
  check("editor creates a category", cat.status === 201);
  const authors = await ad("/api/admin/authors/");
  check("admin loads the authors screen", authors.status === 200);
  // a staff account made on the authors screen can sign in with its temporary password
  const account = (fields) => {
    const form = new FormData();
    for (const [k, v] of Object.entries({ name: "E2E New Editor", username: "e2e-new-editor", email: "new-editor@e2e.test", password: `${PASSWORD}-new`, role: "editor", ...fields })) form.set(k, v);
    return form;
  };
  check("an editor cannot create accounts", (await ed("/api/admin/authors/", { method: "POST", body: account({ username: "e2e-sneaky", email: "sneaky@e2e.test", role: "administrator" }) })).status === 403);
  check("admin creates an editor account", (await ad("/api/admin/authors/", { method: "POST", body: account() })).status === 201);
  check("the new editor signs in with the temporary password", (await login("e2e-new-editor", `${PASSWORD}-new`)).status === 200);
  check("a made-up role is refused", (await ad("/api/admin/authors/", { method: "POST", body: account({ username: "e2e-x", email: "x@e2e.test", role: "superadmin" }) })).status === 400);
  const stored = await db.collection("users").findOne({ username: "e2e-new-editor" });
  check("the password is stored only as a hash", stored?.role === "editor" && /^scrypt\$/.test(stored?.password_hash ?? "") && !JSON.stringify(stored).includes(`${PASSWORD}-new`));

  // trash
  const del = await ed(`/api/admin/posts/?id=${post.id}`, { method: "DELETE" });
  check("trashing takes the article down", del.status === 200 && (await eventually(async () => ({ ok: (await page(renamed.path)).status === 404 }))).ok);
  check("and out of the sitemap", (await eventually(async () => ({ ok: !(await text("/post-sitemap.xml")).includes("e2e-renamed") }))).ok);

  // /go/ (and so /?p=ID) only resolves what an anonymous visitor may see
  check("/go/ does not reveal a draft", (await page(`/go/post/${draft.id}/`)).status === 404);
  check("/go/ does not reveal a staff account", (await page("/go/author/990001/")).status === 404);
  check("/go/ answers 404, not 500, for odd types", (await page("/go/constructor/1/")).status === 404);

  // author archives keep their Yoast head
  const author = fixture("users").find((u) => u.seo?.canonical && fixture("posts").some((p) => p.status === "publish" && p.author_id === u._id));
  if (author) {
    const authorHtml = await text(pathOf(author.link));
    check("an author page keeps its Yoast canonical and Person schema", authorHtml.includes(`<link rel="canonical" href="${author.seo.canonical}"/>`) && authorHtml.includes('"Person"'));
  }

  // what never changes
  check("WordPress admin URLs lead to the new admin", (await page("/wp-admin/")).headers.get("location")?.endsWith("/admin/"));
  check("xmlrpc.php is gone (410)", (await page("/xmlrpc.php")).status === 410);
  check("a migrated article still renders", (await page(fixture("posts").find((p) => p.status === "publish").path)).status === 200);
}

/* ---------- run ---------- */
// any answer, or a connection that never answers, means the port is taken
if (await fetch(`${BASE}/`, { signal: AbortSignal.timeout(3000) }).then(() => true, (e) => e?.name === "TimeoutError")) {
  console.error(`Something is already listening on ${BASE}; stop it or pass --port.`);
  process.exit(2);
}
const mongod = await MongoMemoryServer.create();
const seeded = await seed(mongod.getUri());
await new Promise((r) => s3.listen(0, "127.0.0.1", r));
await new Promise((r) => wp.listen(0, "127.0.0.1", r));
const WP_FAKE = `http://127.0.0.1:${wp.address().port}`;
process.env.E2E_CRON_SECRET = randomBytes(24).toString("base64url");
const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_DIST_DIR: DIST,
  DATA_SOURCE: "mongo",
  MONGODB_URI: mongod.getUri(),
  NEXT_PUBLIC_MEDIA_ORIGIN: "https://d4dx-storage.blr1.cdn.digitaloceanspaces.com/islamonlive",
  ADMIN_SESSION_SECRET: randomBytes(32).toString("base64url"),
  CRON_SECRET: process.env.E2E_CRON_SECRET,
  // the browser check drives an automated browser on purpose (crawlers are still dropped)
  ANALYTICS_ALLOW_AUTOMATION: "1",
  DO_SPACES_ENDPOINT: `http://127.0.0.1:${s3.address().port}`,
  DO_SPACES_BUCKET: "e2e-bucket",
  DO_SPACES_FOLDER: "islamonlive",
  DO_SPACES_KEY: "e2e",
  DO_SPACES_SECRET: "e2e",
  INDEXNOW_KEY: "",
  NEXT_TELEMETRY_DISABLED: "1",
  WORDPRESS_API_URL: `${WP_FAKE}/wp-json/wp/v2`,
  NEXT_PUBLIC_WORDPRESS_URL: WP_FAKE,
  /* Nothing outside this machine: next start would fill any variable left
     undefined from .env.local, so every outbound service is switched off here.
     Reader events go to a throwaway file, never the real Redis or Google
     Analytics; publishing never purges the real Cloudflare cache or pushes. */
  ANALYTICS_STORE_PATH: join(tmpdir(), `iol-e2e-analytics-${process.pid}.ndjson`),
  UPSTASH_REDIS_REST_URL: "",
  UPSTASH_REDIS_REST_TOKEN: "",
  KV_REST_API_URL: "",
  KV_REST_API_TOKEN: "",
  GA_MEASUREMENT_ID: "",
  GA_API_SECRET: "",
  CLOUDFLARE_ZONE_ID: "",
  CLOUDFLARE_API_TOKEN: "",
  ONESIGNAL_REST_API_KEY: "",
  NOTIFY_SECRET: "",
  IG_ACCESS_TOKEN: "",
};
// next's own entry point under this node, no npx and no shell: the pid is the server itself, so stopping it cannot orphan it
const NEXT_BIN = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const server = spawn(process.execPath, [NEXT_BIN, "start", "-p", String(PORT), "-H", "127.0.0.1"], { cwd: ROOT, env });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

async function stop() {
  // the tree, synchronously: next start forks a worker on some platforms
  if (process.platform === "win32" && server.pid) spawnSync(`${process.env.SystemRoot ?? "C:/Windows"}/System32/taskkill.exe`, ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill();
  s3.close();
  wp.close();
  rmSync(env.ANALYTICS_STORE_PATH, { force: true });
  await seeded.client.close();
  await mongod.stop();
}

try {
  for (let i = 0; i < 60; i++) {
    if ((await fetch(`${BASE}/robots.txt`).catch(() => null))?.ok) break;
    await sleep(1000);
  }
  await journey(seeded);
} catch (error) {
  check("journey completed without throwing", false, error?.stack ?? String(error));
}
check("no request reached WordPress", wpHits.length === 0, wpHits.slice(0, 5).join(", "));
console.log(`\n${results.length - failures}/${results.length} checks passed`);
if (failures) console.log(`server log (last 3000 chars):\n${serverLog.slice(-3000)}`);
if (KEEP) {
  console.log(`\nServer left running at ${BASE} — admin login: e2e-admin / ${PASSWORD} (throwaway database ${mongod.getUri()}). Ctrl+C to stop.`);
  process.on("SIGINT", async () => process.exit((await stop(), failures ? 1 : 0)));
} else {
  await stop();
  process.exit(failures ? 1 : 0);
}
