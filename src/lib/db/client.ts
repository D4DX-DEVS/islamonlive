import { MongoClient, type Collection, type Db } from "mongodb";
import type { Collections } from "@/lib/db/types";

/* The MongoDB connection for the content migrated out of WordPress.

   Server-only: MONGODB_URI is not NEXT_PUBLIC_, and the driver cannot be bundled
   for the browser, so a client component importing this fails the build loudly.

   The Atlas cluster is shared with other apps. Its connection string's default
   database belongs to one of them, so the database is named here and never taken
   from the URI. The cluster also caps operations per second for everyone on it,
   which is why every read in lib/db goes through the data cache (see cache.ts)
   and the pool stays small.

   One client per process. Next dev re-evaluates modules on every edit, so the
   promise lives on globalThis rather than in a module variable, or each reload
   would open a fresh pool and leak the old one. */

export const DB_NAME = "islamonlive";

const holder = globalThis as typeof globalThis & { __iolMongo?: Promise<MongoClient> };

function connect(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  const client = new MongoClient(uri, {
    appName: "islamonlive-web",
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
  });
  return client.connect();
}

export function mongoClient(): Promise<MongoClient> {
  if (!holder.__iolMongo) {
    // a failed connect must not be cached, or one network blip at boot would
    // wedge every later request on the same rejected promise
    holder.__iolMongo = connect().catch((error: unknown) => {
      holder.__iolMongo = undefined;
      throw error;
    });
  }
  return holder.__iolMongo;
}

export async function db(): Promise<Db> {
  return (await mongoClient()).db(DB_NAME);
}

export async function collection<K extends keyof Collections>(name: K): Promise<Collection<Collections[K]>> {
  return (await db()).collection<Collections[K]>(name);
}

/** Tests only: drop the shared client so the next call reconnects (e.g. to a new URI). */
export async function closeMongo(): Promise<void> {
  const pending = holder.__iolMongo;
  holder.__iolMongo = undefined;
  const client = await pending?.catch(() => null);
  await client?.close();
}
