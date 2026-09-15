/* next/image's loader — Jetpack Photon instead of Vercel's optimizer.

   Vercel bills image optimization per source image, and the archive is 22k+
   posts deep: the transformation allowance ran out and /_next/image started
   answering 402 Payment Required, which is a broken <img> in every card whose
   size had not already been cached. Photon (i0.wp.com) is the CDN Jetpack
   already runs in front of these very uploads — same resizing, same WebP
   negotiation, no per-image cost — so the optimizer is taken out of the path
   entirely rather than paid for.

   Deliberately dependency-free. A loader runs on the server *and* in the
   browser, and lib/env.ts resolves WP_URL from WORDPRESS_API_URL, which only
   exists server-side; importing it here would let the two render passes
   disagree about a host and hydration would tear. Everything below is decided
   from the src string alone, so both passes produce the same URL.

   Article-body <img> tags are untouched by this: they keep the indexed
   islamonlive.in/wp-content URLs that rewriteUrl() gives them. Only next/image
   components route through Photon. */

const PHOTON = "https://i0.wp.com";

/* Photon fetches the origin over plain http unless told otherwise, and
   WordPress answers those with a 301 to https — a redirect hop on a cold cache
   for every upload. ssl=1 makes it fetch https directly. */
const SSL = "ssl=1";

type LoaderArgs = { src: string; width: number; quality?: number };

export default function photonLoader({ src, width, quality }: LoaderArgs): string {
  const q = quality ?? 75;
  const params = `w=${width}&quality=${q}&${SSL}`;

  // /public assets and anything else site-relative: no Photon, no rewriting
  if (!/^https?:\/\//i.test(src)) return src;

  let u: URL;
  try {
    u = new URL(src);
  } catch {
    return src;
  }

  /* Already a Photon URL — some older posts' featured images come back from WP
     that way. Re-point the size rather than nesting one proxy in another; the
     existing query is dropped because it carries the *old* w/resize. */
  if (u.host.endsWith(".wp.com")) return `${PHOTON}${u.pathname}?${params}`;

  /* WordPress uploads, on either host. The pathname is kept byte for byte:
     the oldest posts have percent-encoded Malayalam filenames and re-encoding
     them would change the URL Photon caches under. */
  if (u.pathname.includes("/wp-content/uploads/")) return `${PHOTON}/${u.host}${u.pathname}?${params}`;

  /* Everything else — i.ytimg.com thumbnails above all — stays as it is.
     Photon answers those with a 302 back to the origin, so proxying them buys
     a redirect and nothing else. They are already thumbnail-sized. */
  return src;
}
