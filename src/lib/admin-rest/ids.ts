import { db } from "@/lib/db/client";

/* New WordPress-compatible ids.

   WordPress keeps posts, pages, attachments, menu items, reusable blocks and
   templates in one table (wp_posts), so they share one id sequence — and that
   id is public: /?p=123 links, the /go/post/123 redirect, the guid in the RSS
   feed. Terms (categories, tags, menus) share wp_terms' sequence; users have
   their own. New rows continue each sequence from the highest migrated id, so
   no new id can ever collide with or reuse an old one.

   The counter lives in a `counters` collection and is advanced with an atomic
   $inc, so two editors saving at once still get distinct ids. On first use it
   is seeded with $max from the existing collections (idempotent: a later $max
   with a smaller value is a no-op, and the seed never moves it backwards). */

export type IdSequence = "post" | "term" | "user";

const SOURCES: Record<IdSequence, string[]> = {
  post: ["posts", "pages", "media", "menu_items", "blocks", "navigation", "templates", "template_parts"],
  term: ["categories", "tags", "menus"],
  user: ["users"],
};

interface Counter {
  _id: IdSequence;
  seq: number;
}

async function highestExisting(sequence: IdSequence): Promise<number> {
  const database = await db();
  const tops = await Promise.all(
    SOURCES[sequence].map(async (name) => {
      const top = await database.collection<{ _id: number }>(name).find({}, { projection: { _id: 1 } }).sort({ _id: -1 }).limit(1).next();
      return typeof top?._id === "number" ? top._id : 0;
    })
  );
  return Math.max(0, ...tops);
}

/** The next unused WordPress id in a sequence. */
export async function nextId(sequence: IdSequence): Promise<number> {
  const counters = (await db()).collection<Counter>("counters");
  if (!(await counters.findOne({ _id: sequence }))) {
    await counters.updateOne({ _id: sequence }, { $max: { seq: await highestExisting(sequence) } }, { upsert: true });
  }
  const next = await counters.findOneAndUpdate({ _id: sequence }, { $inc: { seq: 1 } }, { returnDocument: "after" });
  if (!next) throw new Error(`Could not allocate a ${sequence} id`);
  return next.seq;
}
