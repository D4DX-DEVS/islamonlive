import { NextRequest, NextResponse } from "next/server";
import { DATA_SOURCE, WP_URL } from "@/lib/env";
import { suggestPosts } from "@/lib/db/search";
import { interleave, normalizeSearch, searchVariants } from "@/lib/search";
import { toSitePath } from "@/lib/urls";

/* live type-ahead for the search box — search MongoDB or proxy WP core search
   so the browser never talks to the WP origin directly */

type Row = { title: string; url: string };
const LIMIT = 6;

async function lookupWP(q: string): Promise<Row[]> {
  const res = await fetch(`${WP_URL}/wp-json/wp/v2/search?search=${encodeURIComponent(q)}&per_page=${LIMIT}&_fields=title,url`, {
    next: { revalidate: 300 },
  });
  return res.ok ? res.json() : [];
}

function lookupMongo(q: string): Promise<Row[]> {
  return suggestPosts(q, LIMIT);
}

export async function GET(req: NextRequest) {
  const q = normalizeSearch(req.nextUrl.searchParams.get("q"));
  if (q.length < 2) return NextResponse.json([]);
  try {
    const lookup = DATA_SOURCE === "mongo" ? lookupMongo : lookupWP;

    // both Malayalam spellings of the query, merged turn about — see lib/search.ts
    const lists = await Promise.all(searchVariants(q).map((v) => lookup(v).catch((): Row[] => [])));
    const rows = interleave(lists, (r) => r.url, LIMIT);
    const sugs = rows.map((r) => {
      let path = "/";
      try {
        // toSitePath, not .pathname: WP returns the permalink on its own host
        // and without it the suggestion would link at the backend, and would
        // drop the trailing slash the routes are configured to require
        path = toSitePath(r.url);
      } catch {}
      return { title: r.title, path };
    });
    return NextResponse.json(sugs);
  } catch {
    return NextResponse.json([]);
  }
}
