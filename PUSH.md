# Web push (OneSignal)

## Keys

| Var | Where | Public? |
|---|---|---|
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | `.env.local` + `vercel.json` | yes, ships in the bundle |
| `ONESIGNAL_REST_API_KEY` | `.env.local` + **Vercel dashboard** | no — never commit |
| `NOTIFY_SECRET` | `.env.local` + **Vercel dashboard** | no — the WP plugin's shared secret |
| `CRON_SECRET` | **Vercel dashboard** only | no — Vercel signs scheduled hits with it |

`.env*` is gitignored, so production needs `ONESIGNAL_REST_API_KEY` and `NOTIFY_SECRET`
added under Vercel → Settings → Environment Variables.

The browser SDK loads from `PwaSetup.tsx`; `public/OneSignalSDKWorker.js` is its
service worker, scoped to `/push/onesignal/` so it doesn't fight `/sw.js` for `/`.

## Which host

**The API lives with the Next.js frontend, not with WordPress.** Today that is
`https://islamonlive.vercel.app` — `https://islamonlive.in/api/notify` is WordPress
and answers 404, so anything posting there silently does nothing. Every URL below
must point at the frontend deployment; update them the day the frontend takes over
the islamonlive.in domain (and change OneSignal → Web Configuration → Site URL at
the same time, or the existing subscribers stop matching the origin).

## Firing a notification

`POST /api/notify` — auth by `X-Notify-Secret` header or `?secret=`.

```
curl -X POST https://islamonlive.vercel.app/api/notify \
  -H 'content-type: application/json' \
  -H "X-Notify-Secret: $NOTIFY_SECRET" \
  -d '{"id":12345,"title":"Post title","url":"/culture/some-post/","excerpt":"…","image":"https://…jpg"}'
```

Only `title` and `url` are required. `id` becomes the OneSignal `external_id`, so
re-posting the same id is a no-op instead of a second buzz.

`GET /api/notify?secret=…` pushes the newest WP post — a cron fallback if the
plugin can't reach the site. Same idempotency, so a 5-minute schedule won't spam.

## Scheduled fallback (Vercel Cron)

`vercel.json` schedules `GET /api/notify` once a day (`0 4 * * *`, 09:30 IST), so a
new post still goes out if WordPress never calls us. Vercel signs those requests with
`Authorization: Bearer $CRON_SECRET`, which `authed()` accepts alongside the
`X-Notify-Secret` header — that keeps `NOTIFY_SECRET` out of the committed
`vercel.json`. **Set `CRON_SECRET` in Vercel → Settings → Environment Variables**;
without it the scheduled hit gets a 401 and nothing is sent.

The `external_id` is derived from the post id, so a given post pushes exactly once no
matter how often the schedule fires.

**Plan limit:** Hobby allows at most 2 cron jobs, running **once per day**. Anything
more frequent (`*/15 * * * *`) makes the deployment itself fail with
"Deployment failed" on Vercel — that is why the schedule here is daily. On Pro you can
tighten it to `*/15 * * * *`. Either way the WordPress hook is the real trigger; cron
is only the safety net.

## WordPress side

Drop this in the theme's `functions.php` (or point the Novmira plugin's outgoing
webhook at the same URL and payload):

```php
add_action('transition_post_status', function ($new, $old, $post) {
    if ($new !== 'publish' || $old === 'publish' || $post->post_type !== 'post') return;
    // MUST be the frontend deployment — islamonlive.in is WordPress itself and 404s
    wp_remote_post('https://islamonlive.vercel.app/api/notify', [
        'timeout'  => 10,
        'blocking' => false,
        'headers'  => [
            'Content-Type'    => 'application/json',
            'X-Notify-Secret' => 'PASTE_NOTIFY_SECRET',
        ],
        'body' => wp_json_encode([
            'id'      => $post->ID,
            'title'   => get_the_title($post),
            'url'     => get_permalink($post),
            'excerpt' => wp_strip_all_tags(get_the_excerpt($post)),
            'image'   => get_the_post_thumbnail_url($post, 'large') ?: null,
        ]),
    ]);
}, 10, 3);
```

`transition_post_status` with the `$old !== 'publish'` guard fires once per
publish — editing a live post won't re-notify.

## Checking it works

Three layers — test in order, because each only works if the previous did.

### 0. Origin must match

OneSignal only subscribes browsers on the origin set in **Settings → Web Configuration
→ Site URL**. As of the last check it is `https://islamonlive.vercel.app`. Serving the
PWA from `https://islamonlive.in` with that value means no browser ever subscribes and
nothing looks broken — the prompt just never appears. Fix the Site URL first.

iOS only supports web push when the site is **installed to the Home Screen** (16.4+).
Desktop Chrome and Android Chrome work in the normal browser.

### 1. Does a browser subscribe?

Open the deployed site in Chrome, allow notifications, then in DevTools console:

```js
await OneSignal.User.PushSubscription.id      // a UUID = subscribed
OneSignal.User.PushSubscription.optedIn       // true
```

Then confirm the server sees it — `players` should no longer be 0:

```
curl -s "https://api.onesignal.com/apps/$NEXT_PUBLIC_ONESIGNAL_APP_ID" \
  -H "Authorization: Key $ONESIGNAL_REST_API_KEY" | grep -o '"players":[0-9]*'
```

### 2. Does OneSignal deliver?

Dashboard → Messages → New Push → send to Subscribed Users. If this arrives, the
browser/SDK/OneSignal chain is fine and anything still broken is on our side.

### 3. Does our endpoint work?

```
curl -X POST https://islamonlive.vercel.app/api/notify \
  -H 'content-type: application/json' \
  -H "X-Notify-Secret: $NOTIFY_SECRET" \
  -d '{"id":999999,"title":"Test push","url":"/","excerpt":"ignore me"}'
```

- `{"ok":true,"id":"…"}` — sent.
- `401` — `NOTIFY_SECRET` doesn't match, or isn't set on the server at all.
- `502` with `All included players are not subscribed` — endpoint is fine, nobody is
  subscribed yet. Go back to step 1.
- Re-running with the same `id` returns the *first* notification's id and sends nothing,
  by design. Change the `id` to send again.

### 4. Does WordPress fire it?

Publish a real post. Nothing arriving means the `functions.php` hook isn't running or
the secret differs — `wp_remote_post` is `'blocking' => false`, so WP logs no error
either way. Temporarily flip it to `true` and `error_log(print_r($response, true))`
to see the response.
