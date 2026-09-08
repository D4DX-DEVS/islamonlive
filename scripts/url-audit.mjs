#!/usr/bin/env node
/* URL migration audit.

   Takes the URLs the old WordPress site advertised (its Yoast sitemaps, or a
   plain list), requests each one on the new frontend, and writes a CSV with
   what a crawler would see there: status, redirect chain, canonical, title,
   description, robots, image and content presence — plus an `issues` column
   naming anything that would cost the URL its ranking.

   Usage:
     node scripts/url-audit.mjs --base https://staging.islamonlive.in \
       --sitemap https://islamonlive.in/post-sitemap.xml \
       --sitemap https://islamonlive.in/post-sitemap23.xml \
       --limit 500 --concurrency 8 --out audit.csv

     node scripts/url-audit.mjs --base http://localhost:3600 --urls urls.txt

   The old URLs' paths are replayed verbatim on --base (percent-encoding and
   trailing slash untouched), because that is exactly what Google will do.
   Exit code is 1 when any URL has an issue, so it can gate a deploy. */

const args = parseArgs(process.argv.slice(2));
const BASE = (args.base ?? "").replace(/\/+$/, "");
if (!BASE) die("--base is required (the frontend to test, e.g. https://staging.islamonlive.in)");

// canonicals must point at the public site, whatever host we are testing on
const PUBLIC = (args.public ?? "https://islamonlive.in").replace(/\/+$/, "");
const LIMIT = Number(args.limit ?? Infinity);
const CONCURRENCY = Number(args.concurrency ?? 6);
const OUT = args.out ?? "url-audit.csv";
const UA = "Mozilla/5.0 (compatible; islamonlive-migration-audit/1.0)";

const oldUrls = await collectUrls();
console.error(`auditing ${oldUrls.length} URLs against ${BASE} (concurrency ${CONCURRENCY})`);

const rows = [];
let index = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const { writeFileSync } = await import("node:fs");
writeFileSync(OUT, toCsv(rows));
summarise(rows);
process.exit(rows.some((r) => r.issues) ? 1 : 0);

/* ------------------------------------------------------------------ audit */

async function worker() {
  while (index < oldUrls.length) {
    const url = oldUrls[index++];
    try {
      rows.push(await audit(url));
    } catch (error) {
      rows.push({ old_url: url, issues: `fetch failed: ${error.message}` });
    }
    if (rows.length % 50 === 0) console.error(`  ${rows.length}/${oldUrls.length}`);
  }
}

async function audit(oldUrl) {
  const path = pathOf(oldUrl);
  const row = { old_url: oldUrl, new_url: BASE + path, hops: 0 };

  // follow redirects by hand so the chain is recorded, not hidden
  let current = row.new_url;
  let res;
  for (let hop = 0; hop <= 5; hop++) {
    res = await fetch(current, { redirect: "manual", headers: { "User-Agent": UA } });
    if (hop === 0) row.status = res.status;
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      row.hops = hop + 1;
      current = new URL(res.headers.get("location"), current).href;
      if (hop === 0) row.redirect_to = current;
      continue;
    }
    break;
  }
  row.final_url = current;
  row.final_status = res.status;
  row.x_robots = res.headers.get("x-robots-tag") ?? "";

  const html = res.headers.get("content-type")?.includes("text/html") ? await res.text() : "";
  row.canonical = attr(html, /<link[^>]+rel="canonical"[^>]*>/i, "href");
  row.title = text(html, /<title[^>]*>([^<]*)<\/title>/i);
  row.description = attr(html, /<meta[^>]+name="description"[^>]*>/i, "content");
  row.robots = attr(html, /<meta[^>]+name="robots"[^>]*>/i, "content");
  row.og_image = attr(html, /<meta[^>]+property="og:image"[^>]*>/i, "content");
  row.has_jsonld = /application\/ld\+json/.test(html) ? "yes" : "no";
  row.has_h1 = /<h1[\s>]/i.test(html) ? "yes" : "no";
  // a rough size of the article body, so an empty shell shows up as one. Runs
  // to the end of <main> rather than the first </div>: WP bodies nest divs
  row.body_chars = (html.match(/class="reader-body[^"]*"[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? "").replace(/<[^>]+>/g, "").length;
  row.indexable = row.final_status === 200 && !/noindex/i.test(row.robots) && !/noindex/i.test(row.x_robots) ? "yes" : "no";

  row.issues = issuesFor(row, path);
  return row;
}

function issuesFor(r, path) {
  const issues = [];
  if (r.final_status !== 200) issues.push(`final status ${r.final_status}`);
  if (r.hops > 1) issues.push(`redirect chain (${r.hops} hops)`);
  if (r.status >= 300 && r.status < 400 && r.status !== 301 && r.status !== 308) issues.push(`temporary redirect ${r.status}`);
  if (r.final_status === 200) {
    const expected = PUBLIC + lowerHex(pathOf(r.final_url));
    if (!r.canonical) issues.push("missing canonical");
    else if (r.canonical.startsWith("https://admin.")) issues.push("canonical points at backend");
    else if (lowerHex(r.canonical) !== expected) issues.push(`canonical mismatch (${r.canonical})`);
    if (!r.title) issues.push("missing title");
    if (!r.description) issues.push("missing description");
    if (r.indexable === "no" && !isUtilityPath(path)) issues.push("noindex on content URL");
    if (isArticlePath(path)) {
      if (!r.og_image) issues.push("missing og:image");
      if (r.has_jsonld === "no") issues.push("missing JSON-LD");
      if (r.has_h1 === "no") issues.push("missing h1");
      if (r.body_chars < 200) issues.push(`thin/empty body (${r.body_chars} chars)`);
    }
  }
  return issues.join("; ");
}

/* --------------------------------------------------------------- helpers */

async function collectUrls() {
  const urls = [];
  for (const sitemap of toArray(args.sitemap)) {
    const xml = await (await fetch(sitemap, { headers: { "User-Agent": UA } })).text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(m[1].trim());
  }
  if (args.urls) {
    const { readFileSync } = await import("node:fs");
    urls.push(...readFileSync(args.urls, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
  }
  if (!urls.length) die("no URLs: pass --sitemap <url> (repeatable) and/or --urls <file>");
  return [...new Set(urls)].slice(0, LIMIT);
}

function pathOf(url) {
  const u = new URL(url);
  return u.pathname + u.search;
}

function lowerHex(s) {
  return s.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());
}

function isArticlePath(path) {
  // /{category...}/{slug}/ with no reserved first segment
  const first = path.split("/")[1];
  return !["category", "tag", "author", "search", "page", "feed", "wp-content"].includes(first) && path.split("/").filter(Boolean).length >= 2;
}

function isUtilityPath(path) {
  return /^\/(search|saved|settings)\//.test(path) || path.includes("?");
}

function attr(html, tagRe, name) {
  const tag = html.match(tagRe)?.[0] ?? "";
  return decode(tag.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1] ?? "");
}

function text(html, re) {
  return decode(html.match(re)?.[1] ?? "").trim();
}

function decode(s) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function toCsv(rows) {
  const cols = ["old_url", "new_url", "status", "redirect_to", "hops", "final_url", "final_status", "canonical", "title", "description", "robots", "x_robots", "indexable", "og_image", "has_jsonld", "has_h1", "body_chars", "issues"];
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
}

function summarise(rows) {
  const count = (fn) => rows.filter(fn).length;
  console.error(`\nwrote ${OUT}`);
  console.error(`  URLs audited      ${rows.length}`);
  console.error(`  200 direct        ${count((r) => r.status === 200)}`);
  console.error(`  redirected        ${count((r) => r.status >= 300 && r.status < 400)}  (chains: ${count((r) => r.hops > 1)})`);
  console.error(`  404               ${count((r) => r.final_status === 404)}`);
  console.error(`  5xx               ${count((r) => r.final_status >= 500)}`);
  console.error(`  with issues       ${count((r) => r.issues)}`);
  const byIssue = {};
  for (const r of rows) for (const i of (r.issues ?? "").split("; ").filter(Boolean)) byIssue[i.replace(/\s*\(.*\)$/, "")] = (byIssue[i.replace(/\s*\(.*\)$/, "")] ?? 0) + 1;
  for (const [issue, n] of Object.entries(byIssue).sort((a, b) => b[1] - a[1])) console.error(`    ${String(n).padStart(5)}  ${issue}`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    out[key] = key in out ? [].concat(out[key], value) : value;
  }
  return out;
}

function toArray(v) {
  return v == null ? [] : [].concat(v);
}

function die(msg) {
  console.error(msg);
  process.exit(2);
}
