import type { Filter } from "mongodb";
import { TTL } from "@/lib/cache";
import { toWPPost, type ListPostDoc } from "@/lib/db/adapt";
import { cached } from "@/lib/db/cache";
import { collection } from "@/lib/db/client";
import { loadRefs, paging, publicFilter } from "@/lib/db/posts";
import type { PostDoc } from "@/lib/db/types";
import type { PostQuery, WPPage_, WPPost } from "@/lib/wp-model";

/* Post search from MongoDB — the `search` branch of a PostQuery. One spelling
   per call; lib/search.ts still fans a query out into its Malayalam variants
   and interleaves the pages. */

const SEARCH_TAGS = ["wp", "wp:posts"];
const LIST_PROJECTION = { content: 0, content_raw: 0, seo: 0, password: 0, content_sha256: 0 } as const;
const EMPTY: WPPage_<WPPost> = { items: [], total: 0, totalPages: 0 };

/** Parse search string into terms, respecting quoted phrases. */
function parseSearchTerms(search: string): string[] {
  if (!search.trim()) return [];

  const terms: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < search.length; i++) {
    const char = search[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === " " && !inQuotes) {
      if (current.trim()) terms.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) terms.push(current.trim());

  return terms.map((t) => t.replace(/"/g, ""));
}

/** Escape regex metacharacters for MongoDB $regex. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build MongoDB filters to match search terms in title, excerpt, or content. */
function buildSearchFilter(terms: string[]): Filter<PostDoc> {
  if (!terms.length) return {};

  // Each term must match in title, excerpt, or content (OR within a term, AND across terms)
  const termFilters = terms.map((term) => {
    const escaped = escapeRegex(term);
    const regex = { $regex: escaped, $options: "i" }; // case-insensitive

    return {
      $or: [{ title: regex }, { excerpt: regex }, { content: regex }],
    };
  });

  return { $and: termFilters };
}

async function searchPage(opts: PostQuery): Promise<WPPage_<WPPost>> {
  const search = (opts.search ?? "").trim();
  if (!search) return EMPTY;

  const terms = parseSearchTerms(search);
  if (!terms.length) return EMPTY;

  const { page, perPage } = paging(opts);

  const filter: Filter<PostDoc> = {
    ...publicFilter(),
    ...buildSearchFilter(terms),
  };

  // Also apply category/tag/author filters if present
  if (opts.categories?.length) filter.categories = { $in: opts.categories };
  if (opts.tags?.length) filter.tags = { $in: opts.tags };
  if (opts.author) filter.author_id = opts.author;

  const posts = await collection("posts");

  /* Use aggregation to rank on the server: compute a relevance score based on
     where each term matches (title > excerpt > content), then sort and paginate
     without loading all results into memory. */

  // Build $addFields stage to compute relevance for each post
  // Score tiers: phrase in title (1M), all terms in title (100k), any term in title (10k),
  // phrase in excerpt (1k), phrase in content (100), else (1)
  let scoreExpr: unknown = 1; // default: matched by filter, score as 1

  if (terms.length === 1) {
    // Single term: title matches are ranked first
    const term = escapeRegex(terms[0]);
    scoreExpr = {
      $cond: [
        {
          $regexMatch: { input: "$title", regex: term, options: "i" },
        },
        1000000,
        0,
      ],
    };
  } else {
    // Multi-term: WP_Query style ranking
    const phrase = terms.join(" ");
    const phraseRegex = escapeRegex(phrase);

    // Check phrase in title (highest score)
    const phraseInTitle = {
      $regexMatch: { input: "$title", regex: phraseRegex, options: "i" },
    };

    // Check all terms in title
    const allTermsInTitle = terms.reduce(
      (acc, term) => ({
        $and: [
          acc,
          {
            $regexMatch: { input: "$title", regex: escapeRegex(term), options: "i" },
          },
        ],
      }),
      true as unknown
    );

    // Check any term in title
    const anyTermInTitle = {
      $or: terms.map((term) => ({
        $regexMatch: { input: "$title", regex: escapeRegex(term), options: "i" },
      })),
    };

    // Check phrase in excerpt
    const phraseInExcerpt = {
      $regexMatch: { input: "$excerpt", regex: phraseRegex, options: "i" },
    };

    // Check phrase in content
    const phraseInContent = {
      $regexMatch: { input: "$content", regex: phraseRegex, options: "i" },
    };

    scoreExpr = {
      $cond: [
        phraseInTitle,
        1000000,
        {
          $cond: [
            allTermsInTitle,
            100000,
            {
              $cond: [
                anyTermInTitle,
                10000,
                {
                  $cond: [
                    phraseInExcerpt,
                    1000,
                    {
                      $cond: [phraseInContent, 100, 1],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  const [result] = await posts
    .aggregate<{ countResult: Array<{ total: number }>; items: PostDoc[] }>([
      { $match: filter },
      {
        $facet: {
          // Count total matches
          countResult: [{ $count: "total" }],
          // Fetch paginated results
          items: [
            { $addFields: { __searchScore: scoreExpr } },
            { $sort: { __searchScore: -1, published_at: -1, _id: -1 } },
            { $skip: (page - 1) * perPage },
            { $limit: perPage },
            { $project: LIST_PROJECTION },
          ],
        },
      },
    ])
    .toArray();

  const total = result.countResult[0]?.total ?? 0;
  if (total === 0) return EMPTY;

  const totalPages = Math.ceil(total / perPage);
  if (page > 1 && page > totalPages) return EMPTY;

  const refs = await loadRefs(result.items as ListPostDoc[]);

  return {
    items: result.items.map((d) => toWPPost(d as ListPostDoc, refs)),
    total,
    totalPages,
  };
}

export const searchPostsPage = cached("posts:search", searchPage, {
  revalidate: TTL.posts,
  tags: SEARCH_TAGS,
});

/* Type-ahead. It fires on every keystroke, so it never scans article bodies
   (≈440 MB across the archive): every word must appear in the title or the
   excerpt, newest first. The full search page still searches bodies. */
async function suggestImpl(q: string, limit: number): Promise<{ title: string; url: string }[]> {
  const terms = parseSearchTerms(q).slice(0, 5);
  if (!terms.length) return [];
  const filter: Filter<PostDoc> = {
    ...publicFilter(),
    $and: terms.map((term) => {
      const re = new RegExp(escapeRegex(term), "i");
      return { $or: [{ title: re }, { excerpt: re }] };
    }),
  };
  const docs = await (await collection("posts"))
    .find(filter, { projection: { title: 1, link: 1 } })
    .sort({ published_at: -1, _id: -1 })
    .limit(Math.min(Math.max(limit, 1), 10))
    .toArray();
  return docs.map((d) => ({ title: d.title, url: d.link }));
}

export const suggestPosts = cached("posts:suggest", suggestImpl, { revalidate: 300, tags: SEARCH_TAGS });
