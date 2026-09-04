import { NextRequest, NextResponse } from "next/server";
import { getPosts, featuredImage, postPath, stripHtml, decodeEntities } from "@/lib/wordpress";
import { authed, baseBody, configured, post as postToOneSignal, SITE } from "@/lib/onesignal";

export const dynamic = "force-dynamic";

/* The daily reading nudge readers switch on at /settings.

   Scheduling model: the reader tags their OneSignal subscription with
   `reminder_time` (lib/push.ts), and this route runs ONCE a day and queues one
   notification per slot, each filtered to that tag and marked
   `delayed_option: "timezone"`. OneSignal then delivers it at that local time in
   every subscriber's own timezone. That is what lets five different delivery
   times run off a single daily cron — a Vercel Hobby project only gets one.

   Idempotent per day and slot, so a manual re-run can't double-send. */

// must stay in sync with REMINDER_SLOTS in lib/reader.ts
const SLOTS = ["06:00", "09:00", "13:00", "18:00", "21:00"];

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

  const results = await Promise.all(
    SLOTS.map(async (slot) => {
      const out = await postToOneSignal({
        ...baseBody({ ...body, externalId: `reminder-${day}-${slot}` }),
        filters: [{ field: "tag", key: "reminder_time", relation: "=", value: slot }],
        delayed_option: "timezone",
        delivery_time_of_day: toClock(slot),
      });
      return { slot, ...out };
    })
  );

  // a slot with nobody tagged comes back as an "All included players are not
  // subscribed" error — that is a normal empty audience, not a failure
  const ok = results.some((r) => r.ok);
  return NextResponse.json({ ok, day, post: latest.id, results }, { status: ok ? 200 : 502 });
}
