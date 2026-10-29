import { collection } from "@/lib/db/client";
import type { AdminActivityDoc, StaffRef } from "@/lib/db/types";

/* The admin's audit trail: who created, edited, published or trashed an
   article, uploaded a file, or changed an account or the homepage.

   Recording is best effort. A failed write is logged and swallowed, never
   turned into a failed save: the article is already stored by then. */

/** Entries older than this are dropped by MongoDB itself. */
const RETENTION_DAYS = 730;

export type ActivityAction =
  | "post.create" | "post.update" | "post.publish" | "post.trash"
  | "media.upload" | "media.delete"
  | "user.create" | "user.update" | "user.delete" | "user.remove"
  | "layout.update" | "layout.restore";

export const ACTION_LABELS: Record<ActivityAction, string> = {
  "post.create": "created an article",
  "post.update": "edited an article",
  "post.publish": "published an article",
  "post.trash": "moved an article to the trash",
  "media.upload": "uploaded a file",
  "media.delete": "deleted a file",
  "user.create": "added an account",
  "user.update": "changed an account",
  "user.delete": "deleted an account",
  "user.remove": "removed someone from the team",
  "layout.update": "updated the homepage layout",
  "layout.restore": "restored an earlier homepage layout",
};

const holder = globalThis as typeof globalThis & { __iolActivityIndexes?: Promise<void> };

function ensureIndexes(): Promise<void> {
  holder.__iolActivityIndexes ??= (async () => {
    await (await collection("admin_activity")).createIndexes([
      { key: { at: -1 }, name: "at" },
      { key: { "actor.id": 1, at: -1 }, name: "actor_at" },
      { key: { at: 1 }, name: "ttl", expireAfterSeconds: RETENTION_DAYS * 86_400 },
    ]);
  })().catch((error: unknown) => {
    holder.__iolActivityIndexes = undefined;
    throw error;
  });
  return holder.__iolActivityIndexes;
}

export interface ActivityTarget {
  type: "post" | "media" | "user" | "layout";
  id: number | string | null;
  title?: string;
  link?: string | null;
}

export async function recordActivity(actor: StaffRef, action: ActivityAction, target: ActivityTarget): Promise<void> {
  try {
    await ensureIndexes().catch(() => undefined);
    const doc: AdminActivityDoc = {
      at: new Date(),
      actor: { id: actor.id, name: actor.name, role: actor.role },
      action,
      target: { type: target.type, id: target.id, title: (target.title ?? "").slice(0, 300), link: target.link ?? null },
    };
    await (await collection("admin_activity")).insertOne(doc);
  } catch (error) {
    console.error(`[activity] ${action} not recorded:`, error instanceof Error ? error.message : error);
  }
}

export interface ActivityQuery {
  actorId?: number;
  action?: string;
  page: number;
  perPage: number;
}

export interface ActivityEntry {
  id: string;
  at: string;
  actor: StaffRef;
  action: string;
  label: string;
  target: AdminActivityDoc["target"];
}

export async function listActivity({ actorId, action, page, perPage }: ActivityQuery): Promise<{ items: ActivityEntry[]; total: number }> {
  const filter: Record<string, unknown> = {};
  if (actorId) filter["actor.id"] = actorId;
  if (action && action in ACTION_LABELS) filter.action = action;
  else if (action && /^(post|media|user|layout)$/.test(action)) filter.action = { $regex: `^${action}\\.` };
  const col = await collection("admin_activity");
  const [docs, total] = await Promise.all([
    col.find(filter).sort({ at: -1 }).skip((page - 1) * perPage).limit(perPage).toArray(),
    col.countDocuments(filter),
  ]);
  return {
    total,
    items: docs.map((doc) => ({
      id: String(doc._id),
      at: doc.at.toISOString(),
      actor: doc.actor,
      action: doc.action,
      label: ACTION_LABELS[doc.action as ActivityAction] ?? doc.action,
      target: doc.target,
    })),
  };
}
