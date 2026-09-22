import { NextRequest, NextResponse } from "next/server";
import { getPosts, featuredImage, postPath, stripHtml, decodeEntities } from "@/lib/wordpress";
import {
  authed,
  baseBody,
  cancel,
  configured,
  post as postToOneSignal,
  SITE,
  subscriptionTags,
} from "@/lib/onesignal";

export const dynamic = "force-dynamic";

/* The daily reading nudge readers switch on at /settings.

   Scheduling model: the reader tags their OneSignal subscription with
   `reminder_time` (lib/push.ts), and this route runs ONCE a day and queues one
   notification per quarter-hour slot, each filtered to that tag and marked
   `delayed_option: "timezone"`. OneSignal then delivers it at that local time in
   every subscriber's own timezone. That is what lets any delivery time run off
   a single daily cron — a Vercel Hobby project only gets one.

   The time is free-form on the settings page (a preset or a typed one) and
   snapped to a 15-minute grid there, so walking all 96 slots covers every
   reader. Slots nobody picked come back from OneSignal as "no subscribers" and
   are skipped — see the `empty` count in the response.

   Idempotent per day and slot, so a manual re-run can't double-send. */

const STEP = 15;
const SLOTS: string[] = [];
for (let t = 0; t < 24 * 60; t += STEP) {
  SLOTS.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
}

/** OneSignal wants "9:00AM", not "09:00" */
function toClock(slot: string): string {
  const [h, m] = slot.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!configured()) return NextResponse.json({ ok: false, error: "OneSignal not configured" }, { status: 502 });

  const [latest] = await getPosts({ perPage: 1 }).catch(() => []);
  if (!latest) return NextResponse.json({ ok: false, error: "no posts" }, { status: 502 });

  // one date stamp for the whole batch, so every slot dedupes on the same day
  const day = new Date().toISOString().slice(0, 10);
  const body = {
    title: decodeEntities(stripHtml(latest.title.rendered)),
    message: decodeEntities(stripHtml(latest.excerpt.rendered)).slice(0, 180),
    url: `${SITE}${postPath(latest)}`,
    image: featuredImage(latest)?.url,
  };

  // 96 calls, 8 at a time — OneSignal rate-limits bursts
  const results: ({ slot: string } & Awaited<ReturnType<typeof postToOneSignal>>)[] = [];
  for (let i = 0; i < SLOTS.length; i += 8) {
    const batch = await Promise.all(
      SLOTS.slice(i, i + 8).map(async (slot) => {
        const out = await postToOneSignal({
          ...baseBody({ ...body, externalId: `reminder-${day}-${slot}` }),
          filters: [{ field: "tag", key: "reminder_time", relation: "=", value: slot }],
          delayed_option: "timezone",
          delivery_time_of_day: toClock(slot),
        });
        return { slot, ...out };
      })
    );
    results.push(...batch);
  }

  // a slot with nobody tagged comes back as an "All included players are not
  // subscribed" error — that is a normal empty audience, not a failure
  const sent = results.filter((r) => r.ok);
  const empty = results.length - sent.length;
  return NextResponse.json({ ok: true, day, post: latest.id, sent: sent.map((r) => r.slot), empty });
}

/* ---------------------------------------------------------------- catch-up --

   The batch above is built once a day, from the tags that exist at that moment.
   A reader who switches the reminder on — or moves it — after that run is not
   in any of the 96 sends, so their first nudge would not arrive until the next
   day, which reads as a broken switch. This queues that one reader's nudge for
   today.

   Delivery here is an absolute instant rather than `delayed_option: "timezone"`:
   the browser tells us its own UTC offset, so the moment can be worked out
   exactly, and a slot that has already gone by locally is reported back as such
   instead of being pushed out late.

   No secret guards it — it is called from the settings page. What stops it
   being a way to push a stranger's device is the tag check: the subscription
   has to already be asking for the very slot being queued, and only that
   reader's own browser can set that tag. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CatchUpRequest {
  /** the reader's OneSignal push subscription */
  subscriptionId?: unknown;
  /** the slot they just saved, "HH:MM" on the 15-minute grid */
  time?: unknown;
  /** Date#getTimezoneOffset(): minutes to ADD to local time to get UTC */
  offsetMinutes?: unknown;
  /** a catch-up queued earlier today, to be called off first */
  cancelId?: unknown;
  /** call that one off and queue nothing — the reader switched the nudge off */
  cancelOnly?: unknown;
}

export async function POST(req: NextRequest) {
  if (!configured()) return NextResponse.json({ ok: false, error: "OneSignal not configured" }, { status: 502 });

  const body = (await req.json().catch(() => ({}))) as CatchUpRequest;
  const id = typeof body.subscriptionId === "string" ? body.subscriptionId : "";
  const time = typeof body.time === "string" ? body.time : "";
  const offset = typeof body.offsetMinutes === "number" ? body.offsetMinutes : NaN;
  const cancelId = typeof body.cancelId === "string" && UUID.test(body.cancelId) ? body.cancelId : "";

  /* switching the reminder off. The id being cancelled was handed to that
     reader's own browser when the nudge was queued and is a v4 UUID, so it is
     not something a passer-by can name; nothing is sent either way. */
  if (body.cancelOnly) {
    if (!cancelId) return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
    return NextResponse.json({ ok: await cancel(cancelId), queued: false, reason: "cancelled" });
  }

  // offsets run from -12:00 to +14:00, which getTimezoneOffset reports inverted
  if (!UUID.test(id) || !SLOTS.includes(time) || !Number.isInteger(offset) || Math.abs(offset) > 840) {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  const tags = await subscriptionTags(id);
  if (!tags) return NextResponse.json({ ok: false, error: "unknown subscription" }, { status: 404 });
  if (tags.reminder_time !== time) {
    // the tag is written by the same click that calls this, and OneSignal can be
    // a beat behind — the reader loses nothing, tomorrow's batch has them
    return NextResponse.json({ ok: true, queued: false, reason: "tag-not-caught-up" });
  }

  // "now" as the reader's own clock reads it, so the date is theirs, not UTC's
  const nowUtc = Date.now();
  const local = new Date(nowUtc - offset * 60_000);
  const [h, m] = time.split(":").map(Number);
  const at = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h, m) + offset * 60_000;

  // a minute of headroom: OneSignal rejects a send_after that has just passed
  if (at <= nowUtc + 60_000) {
    if (cancelId) await cancel(cancelId);
    return NextResponse.json({ ok: true, queued: false, reason: "slot-passed" });
  }

  const [latest] = await getPosts({ perPage: 1 }).catch(() => []);
  if (!latest) return NextResponse.json({ ok: false, error: "no posts" }, { status: 502 });

  // the earlier one goes first: a reader who moves 07:00 to 21:00 wants the
  // evening nudge, not both
  if (cancelId) await cancel(cancelId);

  const day = new Date(at - offset * 60_000).toISOString().slice(0, 10);
  const out = await postToOneSignal({
    ...baseBody({
      title: decodeEntities(stripHtml(latest.title.rendered)),
      message: decodeEntities(stripHtml(latest.excerpt.rendered)).slice(0, 180),
      url: `${SITE}${postPath(latest)}`,
      image: featuredImage(latest)?.url,
      // one catch-up per subscription per slot per day, however often Set is pressed
      externalId: `reminder-catchup-${day}-${time}-${id}`,
    }),
    include_subscription_ids: [id],
    send_after: new Date(at).toISOString(),
  });

  if (!out.ok) return NextResponse.json({ ok: false, queued: false, error: out.error }, { status: 502 });
  return NextResponse.json({ ok: true, queued: true, at: new Date(at).toISOString(), id: out.id });
}
