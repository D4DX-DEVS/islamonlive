import { describe, it, expect, beforeEach } from "vitest";
import { collection } from "@/lib/db/client";
import { seedFixtures, loadFixture } from "@/test/fixtures";
import { adminRest } from "./index";
import { handleTerms } from "./terms";
import type { AdminRequest } from "./http";

const mockAdminUser = { id: 1, username: "testuser", role: "administrator" };

async function makeRequest(
  method: string,
  route: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<AdminRequest> {
  const url = new URL(route, "http://admin.local/");
  return {
    method,
    route,
    segments: route.split("/").filter(Boolean),
    query: url.searchParams,
    headers: new Headers(headers ?? {}),
    body: body ? JSON.stringify(body) : undefined,
    user: mockAdminUser,
  };
}

describe("terms handler", () => {
  beforeEach(async () => {
    await seedFixtures();
  });

  describe("GET /wp/v2/tags (search)", () => {
    it("returns all tags with pagination", async () => {
      const req = await makeRequest("GET", "/wp/v2/tags?per_page=10&page=1");
      const res = await handleTerms(req);
      expect(res?.status).toBe(200);
      const data = (await res?.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
      const total = res?.headers.get("X-WP-Total");
      expect(total).toBeDefined();
    });

    it("filters tags by search term (case-insensitive)", async () => {
      const tags = loadFixture("tags");
      const searchTerm = tags[0].name.substring(0, 3);
      const req = await makeRequest("GET", `/wp/v2/tags?search=${encodeURIComponent(searchTerm)}`);
      const res = await handleTerms(req);
      const data = (await res?.json()) as Array<{ name: string }>;
      expect(data.every((t) => t.name.toLowerCase().includes(searchTerm.toLowerCase()))).toBe(true);
    });

    it("respects per_page and page parameters", async () => {
      const req = await makeRequest("GET", "/wp/v2/tags?per_page=5&page=1");
      const res = await handleTerms(req);
      const data = (await res?.json()) as unknown[];
      expect(data.length).toBeLessThanOrEqual(5);
    });

    it("returns 400 for invalid per_page", async () => {
      const req = await makeRequest("GET", "/wp/v2/tags?per_page=200");
      const res = await handleTerms(req);
      expect(res?.status).toBe(400);
    });

    it("returns 400 when page is too high", async () => {
      const req = await makeRequest("GET", "/wp/v2/tags?page=999999");
      const res = await handleTerms(req);
      expect(res?.status).toBe(400);
    });

    it("returns specific fields when _fields is set", async () => {
      const req = await makeRequest("GET", "/wp/v2/tags?per_page=1&_fields=id,name");
      const res = await handleTerms(req);
      const data = (await res?.json()) as Array<Record<string, unknown>>;
      expect(Object.keys(data[0]).sort()).toEqual(["id", "name"].sort());
    });
  });

  describe("GET /wp/v2/categories (search)", () => {
    it("returns all categories with pagination", async () => {
      const req = await makeRequest("GET", "/wp/v2/categories?per_page=10&page=1");
      const res = await handleTerms(req);
      expect(res?.status).toBe(200);
      const data = (await res?.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
    });

    it("builds category links with ancestry path", async () => {
      const categories = loadFixture("categories");
      const catWithParent = categories.find((c) => c.parent_id !== 0);
      if (catWithParent) {
        const req = await makeRequest("GET", `/wp/v2/categories?search=${encodeURIComponent(catWithParent.name)}`);
        const res = await handleTerms(req);
        const data = (await res?.json()) as Array<{ link: string }>;
        const found = data.find((c) => c.link.includes(catWithParent.slug));
        expect(found?.link).toMatch(/\/category\//);
      }
    });

    it("filters by parent_id when provided", async () => {
      const categories = loadFixture("categories");
      const parentId = Math.max(...categories.map((c) => c.parent_id));
      if (parentId > 0) {
        const req = await makeRequest("GET", `/wp/v2/categories?parent=${parentId}`);
        const res = await handleTerms(req);
        const data = (await res?.json()) as Array<{ parent: number }>;
        expect(data.every((c) => c.parent === parentId || !c.parent)).toBe(true);
      }
    });
  });

  describe("POST /wp/v2/tags (create)", () => {
    it("creates a new tag with name and optional slug", async () => {
      const req = await makeRequest("POST", "/wp/v2/tags", { name: "New Test Tag", slug: "new-test-tag" });
      const res = await handleTerms(req);
      expect(res?.status).toBe(201);
      const data = (await res?.json()) as Record<string, unknown>;
      expect(data.name).toBe("New Test Tag");
      expect(data.slug).toBe("new-test-tag");
      expect(data.id).toBeDefined();

      const doc = await (await collection("tags")).findOne({ _id: data.id as number });
      expect(doc?.name).toBe("New Test Tag");
    });

    it("sanitizes slug from title if not provided", async () => {
      const req = await makeRequest("POST", "/wp/v2/tags", { name: "Test Title & Stuff" });
      const res = await handleTerms(req);
      const data = (await res?.json()) as Record<string, unknown>;
      expect(data.slug).toMatch(/test.*title/);
    });

    it("returns 400 term_exists when tag name already exists", async () => {
      const tag = loadFixture("tags")[0];
      const req = await makeRequest("POST", "/wp/v2/tags", { name: tag.name });
      const res = await handleTerms(req);
      expect(res?.status).toBe(400);
      const data = (await res?.json()) as Record<string, unknown>;
      expect(data.code).toBe("term_exists");
      expect((data.data as Record<string, unknown>).term_id).toBe(tag._id);
    });

    it("returns 400 when name is missing", async () => {
      const req = await makeRequest("POST", "/wp/v2/tags", { slug: "test" });
      const res = await handleTerms(req);
      expect(res?.status).toBe(400);
    });

    it("handles Malayalam names correctly", async () => {
      const req = await makeRequest("POST", "/wp/v2/tags", { name: "മലയാളം" });
      const res = await handleTerms(req);
      expect(res?.status).toBe(201);
      const data = (await res?.json()) as Record<string, unknown>;
      expect(data.name).toBe("മലയാളം");
      expect(typeof data.slug).toBe("string");
    });
  });

  describe("POST /wp/v2/categories (create)", () => {
    it("creates a new category with name and parent", async () => {
      const req = await makeRequest("POST", "/wp/v2/categories", {
        name: "New Category",
        slug: "new-category",
        parent: 0,
      });
      const res = await handleTerms(req);
      expect(res?.status).toBe(201);
      const data = (await res?.json()) as Record<string, unknown>;
      expect(data.name).toBe("New Category");
      expect(data.parent).toBe(0);
    });

    it("returns 400 term_exists when category name exists with same parent", async () => {
      const cat = loadFixture("categories")[0];
      const req = await makeRequest("POST", "/wp/v2/categories", { name: cat.name, parent: cat.parent_id });
      const res = await handleTerms(req);
      expect(res?.status).toBe(400);
      const data = (await res?.json()) as Record<string, unknown>;
      expect(data.code).toBe("term_exists");
    });

    it("allows duplicate name with different parent", async () => {
      const categories = loadFixture("categories");
      const cat = categories[0];
      const otherParent = categories.find((c) => c.parent_id !== cat.parent_id)?.parent_id ?? 0;
      if (otherParent !== cat.parent_id) {
        const req = await makeRequest("POST", "/wp/v2/categories", { name: cat.name, parent: otherParent });
        const res = await handleTerms(req);
        expect(res?.status).toBe(201);
      }
    });
  });

  it("returns null for non-term routes", async () => {
    const req = await makeRequest("GET", "/wp/v2/posts");
    const res = await handleTerms(req);
    expect(res).toBeNull();
  });

  it("lets editors create tags (manage_categories) but nobody below them", async () => {
    const body = (name: string) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    expect((await adminRest("/wp/v2/tags", body("Editor tag"), { id: 1, username: "e", role: "editor" })).status).toBe(201);
    expect((await adminRest("/wp/v2/tags", body("Nope"), { id: 1, username: "s", role: "subscriber" })).status).toBe(403);
  });
});
