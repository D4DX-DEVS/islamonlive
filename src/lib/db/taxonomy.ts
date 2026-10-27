import { TTL } from "@/lib/cache";
import { toWPCategory } from "@/lib/db/adapt";
import { cached } from "@/lib/db/cache";
import { collection } from "@/lib/db/client";
import { publicFilter, slugCandidates } from "@/lib/db/posts";
import type { CategoryDoc } from "@/lib/db/types";
import type { WPCategory } from "@/lib/wp-model";

/* Categories and tags from MongoDB, mirroring the wordpress.ts functions of the
   same names. Counts are computed once from published posts and cached, so they
   stay current as editors publish. */

/**
 * Cached computation of live counts for all categories and tags. Returns
 * {categories, tags} objects (id → count) as plain objects since the cache
 * JSON-serializes results and would turn Maps into {}. A failure throws rather
 * than being cached for an hour as "no posts anywhere"; a term absent from the
 * result has no published posts, so its count is 0, as WordPress counts it.
 */
export const allTermCounts = cached(
  "taxonomy:counts",
  async (): Promise<{
    categories: Record<number, number>;
    tags: Record<number, number>;
  }> => {
    const posts = await collection("posts");
    const categoryResult = await posts
      .aggregate<{ _id: number; count: number }>([
        { $match: publicFilter() },
        { $unwind: "$categories" },
        { $group: { _id: "$categories", count: { $sum: 1 } } },
      ])
      .toArray();

    const tagResult = await posts
      .aggregate<{ _id: number; count: number }>([
        { $match: publicFilter() },
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
      ])
      .toArray();

    const categories: Record<number, number> = {};
    const tags: Record<number, number> = {};
    for (const r of categoryResult) categories[r._id] = r.count;
    for (const r of tagResult) tags[r._id] = r.count;

    return { categories, tags };
  },
  { revalidate: TTL.taxonomy, tags: ["wp", "wp:categories", "wp:tags"] },
);

async function categoriesImpl(perPage = 50): Promise<WPCategory[]> {
  const maxPerPage = Math.max(1, Math.min(perPage, 100));
  const counts = await allTermCounts();

  // Fetch all categories to compute them locally, then sort and limit
  const docs = await (
    await collection("categories")
  )
    .find(
      {},
      {
        projection: {
          _id: 1,
          parent_id: 1,
          name: 1,
          slug: 1,
          link: 1,
          count: 1,
        },
      },
    )
    .toArray();

  // Apply computed counts, then sort by count desc (ties by name asc), then limit
  const withCounts = docs.map((doc) => ({
    ...doc,
    count: counts.categories[doc._id] ?? 0,
  }));

  withCounts.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  return withCounts.slice(0, maxPerPage).map((doc) => {
    const minimal = {
      _id: doc._id,
      parent_id: doc.parent_id,
      name: doc.name,
      slug: doc.slug,
      link: doc.link,
      count: doc.count,
    };
    return toWPCategory(minimal as CategoryDoc);
  });
}

export const getCategories = cached("categories:list", categoriesImpl, {
  revalidate: TTL.taxonomy,
  tags: ["wp", "wp:categories"],
});

async function allCategoriesImpl(): Promise<WPCategory[]> {
  const counts = await allTermCounts();

  /* Fetch all categories, apply computed counts, and sort by name ascending
     (WP default order). */
  const docs = await (
    await collection("categories")
  )
    .find(
      {},
      {
        projection: {
          _id: 1,
          parent_id: 1,
          name: 1,
          slug: 1,
          link: 1,
          count: 1,
        },
      },
    )
    .toArray();

  const withCounts = docs.map((doc) => ({
    ...doc,
    count: counts.categories[doc._id] ?? 0,
  }));

  withCounts.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

  return withCounts.map((doc) => {
    const minimal = {
      _id: doc._id,
      parent_id: doc.parent_id,
      name: doc.name,
      slug: doc.slug,
      link: doc.link,
      count: doc.count,
    };
    return toWPCategory(minimal as CategoryDoc);
  });
}

export const getAllCategories = cached("categories:all", allCategoriesImpl, {
  revalidate: TTL.taxonomy,
  tags: ["wp", "wp:categories"],
});

async function categoryBySlugImpl(slug: string): Promise<WPCategory | null> {
  const counts = await allTermCounts();
  const doc = await (
    await collection("categories")
  ).findOne(
    { slug: { $in: slugCandidates(slug) } },
    {
      projection: {
        _id: 1,
        parent_id: 1,
        name: 1,
        slug: 1,
        link: 1,
        description: 1,
        seo: 1,
        count: 1,
      },
    },
  );
  if (!doc) return null;

  const count = counts.categories[doc._id] ?? 0;
  return toWPCategory({ ...doc, count } as CategoryDoc, true);
}

export const getCategoryBySlug = cached("categories:slug", categoryBySlugImpl, {
  revalidate: TTL.taxonomy,
  tags: ["wp", "wp:categories"],
});

async function tagBySlugImpl(slug: string): Promise<WPCategory | null> {
  const counts = await allTermCounts();
  const doc = await (
    await collection("tags")
  ).findOne(
    { slug: { $in: slugCandidates(slug) } },
    {
      projection: {
        _id: 1,
        name: 1,
        slug: 1,
        link: 1,
        description: 1,
        seo: 1,
        count: 1,
      },
    },
  );
  if (!doc) return null;

  const count = counts.tags[doc._id] ?? 0;
  /* toWPCategory adds parent field for categories; omit it for tags by
     returning only the fields that tags use. */
  const result = toWPCategory({ ...doc, count } as CategoryDoc, true);
  const {
    id,
    name,
    slug: termSlug,
    count: termCount,
    description: termDesc,
    link,
    yoast_head_json,
  } = result;
  return {
    id,
    name,
    slug: termSlug,
    count: termCount,
    description: termDesc,
    link,
    yoast_head_json,
  };
}

export const getTagBySlug = cached("tags:slug", tagBySlugImpl, {
  revalidate: TTL.taxonomy,
  tags: ["wp", "wp:tags"],
});
