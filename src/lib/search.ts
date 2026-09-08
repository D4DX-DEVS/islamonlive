import { getPostsPage, type WPPage_, type WPPost } from "@/lib/wordpress";

/* Search, with the one wrinkle Malayalam brings.

   The archive spans two encodings of the same letters. The chillu consonants
   ൺ ൻ ർ ൽ ൾ ൿ became single code points in Unicode 5.1 (2008); everything
   typed before that, and plenty since, spells them as consonant + virama +
   zero-width joiner. The two look identical on screen and are different bytes
   in MySQL, so WordPress's LIKE search treats them as two different words.
   Measured on 2026-09-08: "ഖുർആൻ" (atomic) matches 1,257 posts, "ഖുര്‍ആന്‍"
   (joiner form) 2,444 — a reader typing on a modern keyboard was missing two
   thirds of the archive. The zero-width non-joiner splits the archive the same
   way: "ഇസ്‌ലാം" with it matches 2,349 posts, "ഇസ്ലാം" without it 1,211.

   WordPress ANDs the words of a query, so the spellings cannot go in one
   request. A query touched by either split is run once per spelling and the
   relevance-ordered lists are merged turn and turn about, so no spelling is
   buried. A query touched by neither costs one request, as before.

   Every invisible character below is written as an escape on purpose — a
   literal ZWJ in the source is indistinguishable from nothing. */

const MAX_SEARCH = 120;

const ZWJ = "\u200D";
const ZWNJ = "\u200C";
const VIRAMA = "്";

// atomic chillu → the consonant + virama + ZWJ sequence it replaced
const CHILLU: [atomic: string, joiner: string][] = [
  ["ൺ", `ണ${VIRAMA}${ZWJ}`], // ൺ ← ണ്‍
  ["ൻ", `ന${VIRAMA}${ZWJ}`], // ൻ ← ന്‍
  ["ർ", `ര${VIRAMA}${ZWJ}`], // ർ ← ര്‍
  ["ൽ", `ല${VIRAMA}${ZWJ}`], // ൽ ← ല്‍
  ["ൾ", `ള${VIRAMA}${ZWJ}`], // ൾ ← ള്‍
  ["ൿ", `ക${VIRAMA}${ZWJ}`], // ൿ ← ക്‍
];

// virama followed by a consonant (ക…ഹ) — where a ZWNJ goes when a writer wants
// the letters kept apart (ഇസ്‌ലാം) rather than fused into a conjunct (ഇസ്ലാം)
const VIRAMA_BEFORE_CONSONANT = /്(?=[ക-ഹ])/g;

const EMPTY: WPPage_<WPPost> = { items: [], total: 0, totalPages: 0 };

/** One search string, however it arrived: control characters out, runs of
 *  whitespace folded, capped so a pasted paragraph cannot become a WP query. */
export function normalizeSearch(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH)
    .trim();
}

/** The spellings a query has to be run in — one to four. */
export function searchVariants(q: string): string[] {
  let atomic = q;
  let joiner = q;
  for (const [a, j] of CHILLU) {
    atomic = atomic.split(j).join(a);
    joiner = joiner.split(a).join(j);
  }
  const chillu = atomic === joiner ? [q] : [atomic, joiner];

  const out: string[] = [];
  for (const s of chillu) {
    const toggled = s.includes(ZWNJ) ? s.split(ZWNJ).join("") : s.replace(VIRAMA_BEFORE_CONSONANT, `${VIRAMA}${ZWNJ}`);
    for (const v of [s, toggled]) if (!out.includes(v)) out.push(v);
  }
  return out;
}

/** Interleave several ranked lists — first of each, then second of each — dropping repeats. */
export function interleave<T>(lists: T[][], key: (item: T) => unknown, limit = Infinity): T[] {
  const seen = new Set<unknown>();
  const out: T[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest && out.length < limit; i++) {
    for (const list of lists) {
      const item = list[i];
      if (item === undefined) continue;
      const k = key(item);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(item);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** A page of search results with the X-WP-Total counts, across every spelling. */
export async function searchPosts(q: string, page: number, perPage: number): Promise<WPPage_<WPPost>> {
  const variants = searchVariants(q);
  const pages = await Promise.all(variants.map((s) => getPostsPage({ search: s, perPage, page }).catch(() => EMPTY)));
  if (pages.length === 1) return pages[0];

  return {
    items: interleave(
      pages.map((p) => p.items),
      (post) => post.id
    ),
    // a post spelt more than one way is counted more than once; rare, and the
    // count is a hint, not a ledger
    total: pages.reduce((n, p) => n + p.total, 0),
    totalPages: Math.max(...pages.map((p) => p.totalPages)),
  };
}
