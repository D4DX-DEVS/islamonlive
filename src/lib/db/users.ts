import { TTL } from "@/lib/cache";
import { toWPUser } from "@/lib/db/adapt";
import { cached } from "@/lib/db/cache";
import { collection } from "@/lib/db/client";
import { publicFilter, slugCandidates } from "@/lib/db/posts";
import type { UserDoc } from "@/lib/db/types";
import type { WPPage_, WPUser } from "@/lib/wp-model";

/* Authors from MongoDB, mirroring the wordpress.ts functions of the same names.
   Only users with published posts are visible (has_published_posts), as WordPress's
   public /users endpoint requires. */

const USER_TAGS = ["wp", "wp:users"];

/**
 * Cached list of user IDs that have published posts. Returns number[] (not Set)
 * because the data cache JSON-round-trips results, turning Sets into {}.
 */
export const authorsWithPublishedPosts = cached(
  "users:with_posts",
  async (): Promise<number[]> => {
    const posts = await collection("posts");
    const ids = await posts.distinct("author_id", publicFilter());
    return (ids as number[]).filter((id): id is number => typeof id === "number");
  },
  { revalidate: TTL.taxonomy, tags: USER_TAGS }
);

async function userBySlugImpl(slug: string): Promise<WPUser | null> {
  const publishedIds = await authorsWithPublishedPosts();
  const doc = await (
    await collection("users")
  ).findOne(
    { slug: { $in: slugCandidates(slug) }, _id: { $in: publishedIds } },
    // seo: the author page's title, canonical, OG and Person schema come from Yoast's head, as on WordPress
    { projection: { name: 1, slug: 1, description: 1, avatars: 1, link: 1, seo: 1 } }
  );
  return doc ? toWPUser(doc as UserDoc, true) : null;
}

export const getUserBySlug = cached("users:slug", userBySlugImpl, {
  revalidate: TTL.taxonomy,
  tags: USER_TAGS,
});

async function usersPageImpl(
  page = 1,
  perPage = 60
): Promise<WPPage_<WPUser>> {
  const publishedIds = await authorsWithPublishedPosts();
  const p = Math.max(1, Math.trunc(page) || 1);
  const pp = Math.max(1, Math.min(Math.trunc(perPage) || 60, 100));

  const users = await collection("users");
  const [docs, total] = await Promise.all([
    users
      .find({ _id: { $in: publishedIds } }, { projection: { name: 1, slug: 1, description: 1, avatars: 1 } })
      .collation({ locale: "en" })
      // _id breaks name ties, so skip/limit pages never repeat or drop an author
      .sort({ name: 1, _id: 1 })
      .skip((p - 1) * pp)
      .limit(pp)
      .toArray(),
    users.countDocuments({ _id: { $in: publishedIds } }),
  ]);

  const totalPages = Math.ceil(total / pp);
  // WP returns 400 for a page past the end; wordpress.ts turns that into an empty page
  if (p > 1 && p > totalPages) return { items: [], total: 0, totalPages: 0 };

  return {
    items: docs.map((doc) => {
      const user = toWPUser(doc as UserDoc);
      /* getUsersPage field set: id,name,slug,description,mpp_avatar */
      const { id, name, slug, description, mpp_avatar } = user;
      return { id, name, slug, description, ...(mpp_avatar ? { mpp_avatar } : {}) } as WPUser;
    }),
    total,
    totalPages,
  };
}

export const getUsersPage = cached("users:page", usersPageImpl, {
  revalidate: TTL.taxonomy,
  tags: USER_TAGS,
});

async function searchImpl(q: string): Promise<WPUser[]> {
  const publishedIds = await authorsWithPublishedPosts();

  /* WordPress searches user_login, user_url, user_email, user_nicename and
     display_name with a substring match. In our Mongo export, only name (display_name)
     and slug (user_nicename) are available. We search both with a case-insensitive
     regex, escaping the user input first. */
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, "i");

  const users = await collection("users");
  const docs = await users
    .find(
      {
        _id: { $in: publishedIds },
        $or: [{ name: pattern }, { slug: pattern }],
      },
      { projection: { name: 1, slug: 1 } }
    )
    // WordPress's order and page size; the search page features users[0]
    .collation({ locale: "en" })
    .sort({ name: 1, _id: 1 })
    .limit(10)
    .toArray();

  return docs.map((doc) => {
    const user = toWPUser(doc as UserDoc);
    /* searchUsers field set: id, name, slug */
    const { id, name, slug } = user;
    return { id, name, slug } as WPUser;
  });
}

export const searchUsers = cached("users:search", searchImpl, {
  revalidate: TTL.taxonomy,
  tags: USER_TAGS,
});
