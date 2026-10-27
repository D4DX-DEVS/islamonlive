import { collection } from "@/lib/db/client";
import { json, wpError, list, readJson, paging, pastTheEnd, forbidden, escapeRegex } from "@/lib/admin-rest/http";
import type { PostDoc } from "@/lib/db/types";
import type { AdminRequest } from "@/lib/admin-rest/http";

/* /rsfv/v1/* (featured video) and /mpp/v2/* (profile photo) — see admin-rest/index.ts. Returns null for requests it does not own. */

export async function handlePlugins(req: AdminRequest): Promise<Response | null> {
  // Featured video (Really Simple Featured Video)
  if (req.route.startsWith("/rsfv/v1/posts")) {
    return handleFeaturedVideo(req);
  }

  // Profile photo (Metronet Profile Picture)
  if (req.route.startsWith("/mpp/v2/profile-image")) {
    return handleProfileImage(req);
  }

  return null;
}

/* WordPress limited the plugin's routes to administrators; here editors, who
   write the articles, may set their videos too (adminRest admits no one lower). */
async function handleFeaturedVideo(req: AdminRequest): Promise<Response | null> {

  // GET /rsfv/v1/posts (search by title)
  if (req.method === "GET") {
    const pagingResult = paging(req.query, 20);
    if (pagingResult instanceof Response) return pagingResult;
    const { page, perPage } = pagingResult;

    const search = req.query.get("search") || "";

    const col = await collection("posts");
    // any post the admin can open, drafts included, so a draft's video loads back into the editor
    const filter: Record<string, unknown> = { status: { $ne: "trash" } };
    const include = (req.query.get("include") || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (include.length) filter._id = { $in: include };
    else if (search) {
      const escapedSearch = escapeRegex(search);
      filter.title = { $regex: escapedSearch, $options: "i" };
    }

    const total = await col.countDocuments(filter);
    const err = pastTheEnd(page, total, perPage);
    if (err) return err;

    const docs = await col
      .find(filter)
      .sort({ date_gmt: -1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .toArray();

    const items = docs.map((post) => ({
      id: post._id,
      title: post.title,
      video_source: post.featured_video?.source || "",
      video_id: post.featured_video?.media_id || 0,
      video_url: post.featured_video?.url || "",
      embed_url: post.featured_video?.embed_url || "",
      poster_id: post.featured_video?.poster_id || 0,
      poster_url: post.featured_video?.poster_url || "",
    }));

    return list(items, total, perPage);
  }

  // POST /rsfv/v1/posts/update-video
  if (req.method === "POST" && req.route.includes("update-video")) {
    const body = await readJson(req);
    if (body instanceof Response) return body;

    const postId = Number(body.post_id);
    const col = await collection("posts");
    const post = await col.findOne({ _id: postId });
    if (!post) return wpError("rest_post_invalid_id", "Invalid post ID.", 404);

    /* lib/featured-video.ts sends {video_source: "embed", embed_url} or
       {video_source: "self", video_id}; a self video with no file clears it,
       as the plugin does. */
    const source = String(body.video_source || "").trim();
    let featured: PostDoc["featured_video"] = null;
    if (source === "embed" && typeof body.embed_url === "string" && body.embed_url.trim()) {
      featured = { source: "embed", embed_url: body.embed_url.trim(), media_id: null, url: null, poster_id: null, poster_url: null };
    } else if (source === "self" && Number(body.video_id) > 0) {
      const media = await (await collection("media")).findOne({ _id: Number(body.video_id) });
      if (!media || !media.mime_type?.startsWith("video/")) return wpError("rest_invalid_param", "Invalid parameter(s): video_id", 400);
      featured = { source: "self", embed_url: null, media_id: media._id, url: media.source_url, poster_id: null, poster_url: null };
    } else if (source !== "self" && source !== "none" && source !== "") {
      return wpError("rest_invalid_param", "Invalid parameter(s): video_source", 400);
    }

    await col.updateOne({ _id: postId }, { $set: { featured_video: featured } });

    const updated = await col.findOne({ _id: postId });
    return json({
      id: postId,
      video_source: (updated?.featured_video?.source || "").trim(),
      embed_url: updated?.featured_video?.embed_url || "",
      video_id: updated?.featured_video?.media_id || 0,
      video_url: updated?.featured_video?.url || "",
    });
  }

  return null;
}

async function handleProfileImage(req: AdminRequest): Promise<Response | null> {

  // POST /mpp/v2/profile-image/change
  if (req.method === "POST" && req.route.includes("change")) {
    const body = await readJson(req);
    if (body instanceof Response) return body;

    // the authors screen sets other people's photos; WordPress lets only administrators edit another user
    const userId = body.user_id === undefined ? req.user.id : Number(body.user_id);
    if (userId !== req.user.id && req.user.role !== "administrator") return forbidden();
    const userColl = await collection("users");
    if (!Number.isInteger(userId) || !(await userColl.findOne({ _id: userId }, { projection: { _id: 1 } }))) return wpError("rest_user_invalid_id", "Invalid user ID.", 404);

    const mediaId = Number(body.media_id);
    const mediaColl = await collection("media");
    const media = await mediaColl.findOne({ _id: mediaId });
    if (!media) return wpError("rest_media_invalid_id", "Invalid media ID.", 404);

    const avatars: Record<string, string> = {
      24: media.source_url,
      48: media.source_url,
      96: media.source_url,
      150: media.source_url,
      300: media.source_url,
      full: media.source_url,
    };

    await userColl.updateOne({ _id: userId }, { $set: { avatars, avatar_url: media.source_url } });

    return json({
      success: true,
      data: {
        avatar_urls: avatars,
        mpp_avatar: avatars,
      },
    });
  }

  return null;
}
