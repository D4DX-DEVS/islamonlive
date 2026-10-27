import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BSON, type Document } from "mongodb";
import { db } from "@/lib/db/client";
import type { Collections } from "@/lib/db/types";

/* A real slice of the migrated data (migration/make-fixtures.mjs): every category,
   every post status, sticky and image-less posts, percent-encoded Malayalam slugs,
   plus the authors, media and tags they reference. Emails and usernames are
   blanked. Stored as Extended JSON so Dates survive the round trip. */

const FIXTURE_DIR = fileURLToPath(new URL("../lib/db/__fixtures__/", import.meta.url));
const NAMES = ["posts", "pages", "media", "users", "categories", "tags"] as const satisfies readonly (keyof Collections)[];

export function loadFixture<K extends keyof Collections>(name: K): Collections[K][] {
  return BSON.EJSON.parse(readFileSync(`${FIXTURE_DIR}${name}.json`, "utf8"), { relaxed: true }) as Collections[K][];
}

/** Empty the test database and load every fixture collection. */
export async function seedFixtures(): Promise<void> {
  const database = await db();
  await database.dropDatabase();
  for (const name of NAMES) {
    const docs = loadFixture(name) as unknown as Document[];
    if (docs.length) await database.collection(name).insertMany(docs);
  }
}
