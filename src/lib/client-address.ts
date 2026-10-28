/* The address the edge saw, for rate limits. Cloudflare and DigitalOcean each
   set their own header, which a client cannot forge past them; X-Forwarded-For's
   left end is whatever the client sent, so only its right end (the last proxy's
   view) counts. */
export function clientAddress(request: Request): string {
  const forwarded = (request.headers.get("x-forwarded-for") ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  return (request.headers.get("cf-connecting-ip") || request.headers.get("do-connecting-ip") || forwarded.at(-1) || request.headers.get("x-real-ip") || "unknown").slice(0, 96);
}
