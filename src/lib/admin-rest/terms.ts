import { collection } from "@/lib/db/client";
import { nextId } from "@/lib/admin-rest/ids";
import { SITE_URL } from "@/lib/env";
import { sanitizeTitle, uniqueSlug } from "@/lib/admin-rest/slug";
import { json, wpError, list, readJson, pickFields, paging, pastTheEnd, escapeRegex } from "@/lib/admin-rest/http";
import type { CategoryDoc, TermDoc } from "@/lib/db/types";
import type { AdminRequest } from "@/lib/admin-rest/http";

/* /wp/v2/tags and /wp/v2/categories — see admin-rest/index.ts. Returns null for requests it does not own. */

export async function handleTerms(req: AdminRequest): Promise<Response | null> {
  const isTag = req.route.startsWith("/wp/v2/tags");
  const isCategory = req.route.startsWith("/wp/v2/categories");
  if (!isTag && !isCategory) return null;

  const collection_name = isTag ? "tags" : "categories";
  const segments = req.segments;
  const termId = segments[3];

  // GET list with search
  if (req.method === "GET" && !termId) {
    return handleList(req, collection_name, isCategory);
  }

  // POST create
  // editors hold manage_categories in WordPress, and the post form creates tags as it saves
  if (req.method === "POST" && !termId) {
    return handleCreate(req, collection_name, isCategory);
  }

  return null;
}

async function handleList(req: AdminRequest, collectionName: "tags" | "categories", isCategory: boolean): Promise<Response> {
  const pagingResult = paging(req.query, 10);
  if (pagingResult instanceof Response) return pagingResult;
  const { page, perPage } = pagingResult;

  const col = await collection(collectionName);
  const search = req.query.get("search");
  const hideEmpty = req.query.get("hide_empty") === "true";
  const parent = req.query.get("parent");
  const orderby = req.query.get("orderby") || "name";
  const order = (req.query.get("order") || "asc").toLowerCase() === "desc" ? -1 : 1;

  const filter: Record<string, unknown> = {};
  if (search) {
    const escapedSearch = escapeRegex(search);
    filter.name = { $regex: escapedSearch, $options: "i" };
  }
  if (hideEmpty) {
    filter.count = { $gt: 0 };
  }
  if (isCategory && parent) {
    filter.parent_id = Number(parent);
  }

  const total = await col.countDocuments(filter);
  const err = pastTheEnd(page, total, perPage);
  if (err) return err;

  let sortSpec: [string, "asc" | "desc"][] = [["name", order > 0 ? "asc" : "desc"]];
  if (orderby === "id") sortSpec = [["_id", order > 0 ? "asc" : "desc"]];
  else if (orderby === "count") sortSpec = [["count", order > 0 ? "asc" : "desc"]];

  const docs = await col
    .find(filter)
    .sort(sortSpec)
    .skip((page - 1) * perPage)
    .limit(perPage)
    .toArray();

  const fields = req.query.get("_fields");
  const items = docs.map((doc) => {
    const term = formatTerm(doc as TermDoc, isCategory);
    return pickFields(term, fields);
  });

  return list(items, total, perPage);
}

async function handleCreate(req: AdminRequest, collectionName: "tags" | "categories", isCategory: boolean): Promise<Response> {
  const body = await readJson(req);
  if (body instanceof Response) return body;

  const name = String(body.name || "").trim();
  if (!name) return wpError("rest_missing_callback_param", "Missing parameter(s): name", 400);

  const col = await collection(collectionName);

  // Check for duplicate (same name, same parent for categories)
  let parent_id = 0;
  if (isCategory && typeof body.parent === "number") {
    parent_id = body.parent;
  }

  const filter: Record<string, unknown> = { name };
  if (isCategory) filter.parent_id = parent_id;

  const existing = await col.findOne(filter);
  if (existing) {
    return wpError("term_exists", "A term with the name provided already exists with this parent.", 400, {
      term_id: existing._id,
    });
  }

  // Slug
  // a typed slug is sanitised like a name: it becomes part of the term's URL
  let slug = sanitizeTitle(String(body.slug || "").trim()) || sanitizeTitle(name);

  const taken = async (candidate: string) => {
    return (
      (await col.findOne({
        slug: candidate,
        ...(isCategory && { parent_id }),
      })) !== null
    );
  };

  slug = await uniqueSlug(slug, taken);

  // Build link
  let link: string;
  let path: string;
  if (isCategory) {
    // Category: /category/<ancestry>/<slug>/
    const parent = parent_id ? await col.findOne({ _id: parent_id }) : null;
    const ancestry = parent ? `${(parent as CategoryDoc).slug}/` : "";
    path = `/category/${ancestry}${slug}/`;
    link = `${SITE_URL}${path}`;
  } else {
    // Tag: /tag/<slug>/
    path = `/tag/${slug}/`;
    link = `${SITE_URL}${path}`;
  }

  // Create doc
  const id = await nextId("term");
  const newDoc: CategoryDoc | TermDoc = isCategory
    ? {
        _id: id,
        name,
        slug,
        description: String(body.description || "").trim(),
        link,
        path,
        count: 0,
        seo: null,
        parent_id: parent_id,
      }
    : {
        _id: id,
        name,
        slug,
        description: String(body.description || "").trim(),
        link,
        path,
        count: 0,
        seo: null,
      };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await col.insertOne(newDoc as any);

  return json(formatTerm(newDoc, isCategory), 201);
}

function formatTerm(doc: TermDoc, isCategory: boolean): Record<string, unknown> {
  const base = {
    id: doc._id,
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    link: doc.link,
    path: doc.path,
    count: doc.count,
    taxonomy: isCategory ? "category" : "post_tag",
  };

  if (isCategory) {
    return { ...base, parent: (doc as CategoryDoc).parent_id };
  }

  return base;
}
