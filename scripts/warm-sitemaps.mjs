#!/usr/bin/env node
/* Warm every sitemap file after a deploy.

   Each child sitemap fans out to ten WordPress REST calls the first time it is
   asked for, which can take 10-20 s cold; once rendered it is cached for an
   hour and served in milliseconds. Googlebot's first request must never be the
   cold one — a crawler timeout on a sitemap file reads as "these URLs are
   gone" — so this walks the index and requests every file once, a few at a
   time, right after the site is up.

   Usage:
     node scripts/warm-sitemaps.mjs https://islamonlive.in
     node scripts/warm-sitemaps.mjs http://localhost:3000 --concurrency 2

   Exit code is 1 if any file did not answer 200. */

const args = process.argv.slice(2);
const BASE = (args.find((a) => !a.startsWith("--")) ?? "").replace(/\/+$/, "");
if (!BASE) {
  console.error("usage: node scripts/warm-sitemaps.mjs <site-url> [--concurrency N]");
  process.exit(2);
}
const ci = args.indexOf("--concurrency");
const CONCURRENCY = ci >= 0 ? Math.max(1, Number(args[ci + 1]) || 3) : 3;
const UA = "islamonlive-sitemap-warmer/1.0";

async function fetchText(url) {
  const started = Date.now();
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(120_000) });
  const text = await res.text();
  return { status: res.status, text, ms: Date.now() - started };
}

const index = await fetchText(`${BASE}/sitemap_index.xml`);
console.log(`${index.status} ${index.ms}ms  /sitemap_index.xml`);
if (index.status !== 200) process.exit(1);

const children = [...index.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
// the index advertises the public host; warm the same paths on the host given
const paths = children.map((u) => new URL(u).pathname);
console.log(`${paths.length} child sitemaps, concurrency ${CONCURRENCY}`);

let failed = 0;
let next = 0;
async function worker() {
  while (next < paths.length) {
    const path = paths[next++];
    try {
      const r = await fetchText(`${BASE}${path}`);
      const urls = (r.text.match(/<url>/g) ?? []).length;
      console.log(`${r.status} ${String(r.ms).padStart(6)}ms  ${path}  (${urls} urls)`);
      if (r.status !== 200) failed++;
    } catch (e) {
      failed++;
      console.log(`ERR ${path}  ${e instanceof Error ? e.message : e}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(failed ? `${failed} file(s) failed` : "all sitemaps warm");
process.exit(failed ? 1 : 0);
