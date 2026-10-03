This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Headless content admin

The public site continues to read and render the existing WordPress content. A
separate admin workspace is available at `/admin/` for users who can sign in to
the WordPress CMS. It uses the same WordPress username and password, validates
them server-side, and keeps the WordPress session in an HTTP-only cookie scoped
to `/admin`. The browser never receives the CMS cookie or a CMS REST token.

The workspace includes:

- an overview with live publishing status (published, drafts, pending review and
  scheduled articles, articles published per day, the latest articles, and the
  top categories and authors) taken straight from WordPress, plus reader
  analytics (views, unique readers, reading time, completion and most-read
  articles);
- article browsing with status, author, category and date filters, search,
  duplicate and move-to-trash;
- article creation and editing with draft, pending, publish, private and
  scheduled status, tags, a featured image with alt text, and Visual/HTML
  editors for article content and author bios;
- author creation and existing author listing.

Copy `.env.example` to `.env.local` and set at least `WORDPRESS_API_URL`,
`NEXT_PUBLIC_WORDPRESS_URL`, `NEXT_PUBLIC_SITE_URL`, `REVALIDATION_SECRET` and
`ADMIN_SESSION_SECRET`. Optional `GA_MEASUREMENT_ID` and `GA_API_SECRET` forward
the same reader events to GA4 Measurement Protocol while the local dashboard
remains available.

When Cloudflare caches the public HTML, also set `CLOUDFLARE_ZONE_ID` and a
`CLOUDFLARE_API_TOKEN` with only **Zone → Cache Purge → Purge** permission. The
admin save API and the WordPress revalidation webhook then clear the changed
Next.js routes and their Cloudflare copies immediately. Without these two
variables, Next.js still invalidates its own cache, but Cloudflare can serve its
cached HTML until the CDN TTL expires.

### Where reader events are stored

- **Local development / a server with a disk:** events are appended to
  `.data/analytics.ndjson` (override with `ANALYTICS_STORE_PATH`). Nothing to set up.
- **Vercel (or any serverless host):** the filesystem is read-only, so that file
  cannot be written and the dashboard would stay at zero. Add an Upstash Redis
  database (Vercel → Storage → Marketplace → Upstash Redis) and set
  `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The Vercel
  integration sets the equivalent `KV_REST_API_URL` / `KV_REST_API_TOKEN` pair,
  which is also accepted. When these are present events go to Redis instead of
  the file.

Redis keeps one small record per reader, article and day (opens, longest time
spent, furthest scroll, finished) rather than every 15-second heartbeat, and each
record expires after 200 days. Each beacon costs one Redis command, roughly 14
per article read, so a busy site will outgrow Upstash's free daily allowance; the
paid tier is pay-per-command. The Overview shows a "Tracking on" or "Tracking not
saving" badge so a missing or broken connection is visible.

The analytics implementation stores an anonymous browser session id, article
id/path, reading seconds and scroll progress. It does not store names, email
addresses or IP addresses. Existing WordPress posts, users, categories and
permalinks are not migrated or rewritten.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
