import { handleMedia } from "@/lib/admin-rest/media";
import { handlePlugins } from "@/lib/admin-rest/plugins";
import { handlePosts } from "@/lib/admin-rest/posts";
import { handleTerms } from "@/lib/admin-rest/terms";
import { handleUsers } from "@/lib/admin-rest/users";
import { wpError, type AdminHandler, type AdminRequest, type AdminUser } from "@/lib/admin-rest/http";

/* The admin panel's backend once WordPress is gone.

   Every admin route talks to WordPress through wpAdminFetch / wpAdminRoute
   (lib/wp-admin.ts) and reads WordPress-shaped JSON. With DATA_SOURCE=mongo
   those two calls land here instead: the same slice of the REST API, answered
   from MongoDB (content) and DigitalOcean Spaces (uploads). Keeping the
   contract means the admin UI and its routes do not change, and each endpoint
   can be tested against what WordPress returned.

   Covered (what the admin actually calls):
     /wp/v2/posts[/:id]        list, count, read, create, update, trash
     /wp/v2/media[/:id]        upload, alt text, delete
     /wp/v2/tags, /categories  search, list, create
     /wp/v2/users              list, create
     /rsfv/v1/posts[...]       Really Simple Featured Video (read, update)
     /mpp/v2/profile-image/... Metronet profile photo
   Anything else answers 404 rest_no_route, as WordPress would. */

const HANDLERS: AdminHandler[] = [handlePosts, handleMedia, handleTerms, handleUsers, handlePlugins];

/**
 * Answer one admin REST call. `path` is what wpAdminRoute receives: relative to
 * /wp-json, query string included ("/wp/v2/posts?status=draft").
 */
export async function adminRest(path: string, init: RequestInit, user: AdminUser): Promise<Response> {
  const url = new URL(path, "http://admin.local/");
  const route = url.pathname.replace(/\/+$/, "") || "/";
  const req: AdminRequest = {
    method: (init.method ?? "GET").toUpperCase(),
    route,
    segments: route.split("/").filter(Boolean),
    query: url.searchParams,
    headers: new Headers(init.headers),
    body: init.body,
    user,
  };
  // wp-admin.ts only lets administrators and editors through; this keeps every handler behind the same line
  if (user.role !== "administrator" && user.role !== "editor") return wpError("rest_forbidden", "Sorry, you are not allowed to do that.", 403);
  for (const handle of HANDLERS) {
    const response = await handle(req);
    if (response) return response;
  }
  return wpError("rest_no_route", "No route was found matching the URL and request method.", 404);
}
