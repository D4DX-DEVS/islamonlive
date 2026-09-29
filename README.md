This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Headless content admin

The public site continues to read and render the existing WordPress content. A
separate admin workspace is available at `/admin/` for users who can sign in to
the WordPress CMS. It uses the same WordPress username and password, validates
them server-side, and keeps the WordPress session in an HTTP-only cookie scoped
to `/admin`. The browser never receives the CMS cookie or a CMS REST token.

The workspace includes:

- paginated article browsing and search;
- article creation with draft, pending, publish and private status;
- author creation and existing author listing;
- searchable author/category selectors, category creation, a bordered featured-image upload with alt text, and Visual/HTML editors for article content and author bios;
- anonymous reader views, unique readers, average reading time, completion rate
  and top-article analytics.

Copy `.env.example` to `.env.local` and set at least `WORDPRESS_API_URL`,
`NEXT_PUBLIC_WORDPRESS_URL`, `NEXT_PUBLIC_SITE_URL`, `REVALIDATION_SECRET` and
`ADMIN_SESSION_SECRET`. `ANALYTICS_STORE_PATH` defaults to
`.data/analytics.ndjson`; production deployments need a persistent volume for
that file. Optional `GA_MEASUREMENT_ID` and `GA_API_SECRET` forward the same
events to GA4 Measurement Protocol while the local dashboard remains available.

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
