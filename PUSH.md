# Web push (OneSignal)

## Keys

| Var | Where | Public? |
|---|---|---|
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | `.env.local` + `vercel.json` | yes, ships in the bundle |
| `ONESIGNAL_REST_API_KEY` | `.env.local` + **Vercel dashboard** | no — never commit |
| `NOTIFY_SECRET` | `.env.local` + **Vercel dashboard** | no — the WP plugin's shared secret |

`.env*` is gitignored, so production needs `ONESIGNAL_REST_API_KEY` and `NOTIFY_SECRET`
added under Vercel → Settings → Environment Variables.

The browser SDK loads from `PwaSetup.tsx`; `public/OneSignalSDKWorker.js` is its
service worker, scoped to `/push/onesignal/` so it doesn't fight `/sw.js` for `/`.

## Firing a notification

`POST /api/notify` — auth by `X-Notify-Secret` header or `?secret=`.

```
curl -X POST https://islamonlive.in/api/notify \
  -H 'content-type: application/json' \
  -H "X-Notify-Secret: $NOTIFY_SECRET" \
  -d '{"id":12345,"title":"Post title","url":"/culture/some-post/","excerpt":"…","image":"https://…jpg"}'
```

Only `title` and `url` are required. `id` becomes the OneSignal `external_id`, so
re-posting the same id is a no-op instead of a second buzz.

`GET /api/notify?secret=…` pushes the newest WP post — a cron fallback if the
plugin can't reach the site. Same idempotency, so a 5-minute schedule won't spam.

## WordPress side

Drop this in the theme's `functions.php` (or point the Novmira plugin's outgoing
webhook at the same URL and payload):

```php
add_action('transition_post_status', function ($new, $old, $post) {
    if ($new !== 'publish' || $old === 'publish' || $post->post_type !== 'post') return;
    wp_remote_post('https://islamonlive.in/api/notify', [
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
