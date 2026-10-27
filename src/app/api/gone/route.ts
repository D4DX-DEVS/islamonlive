/* Endpoint for HTTP 410 Gone responses.

   Used when MongoDB mode is active and a request tries to access a
   WordPress-only endpoint that is no longer available (/xmlrpc.php, /wp-json).
   410 signals permanent removal, unlike 404 (not found) which may be temporary. */

export function GET(): Response {
  return new Response("Gone", { status: 410 });
}

export function POST(): Response {
  return new Response("Gone", { status: 410 });
}
