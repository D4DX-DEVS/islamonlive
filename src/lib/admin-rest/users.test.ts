import { describe, it, expect, beforeEach } from "vitest";
import { collection } from "@/lib/db/client";
import { seedFixtures, loadFixture } from "@/test/fixtures";
import { handleUsers } from "./users";
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

describe("users handler", () => {
  beforeEach(async () => {
    await seedFixtures();
  });

  describe("GET /wp/v2/users (list)", () => {
    it("returns all users with pagination", async () => {
      const req = await makeRequest("GET", "/wp/v2/users?per_page=10&page=1");
      const res = await handleUsers(req);
      expect(res?.status).toBe(200);
      const data = (await res?.json()) as unknown[];
      expect(Array.isArray(data)).toBe(true);
      const total = res?.headers.get("X-WP-Total");
      expect(total).toBeDefined();
    });

    it("filters users by search term (name/email)", async () => {
      const users = loadFixture("users");
      const user = users[0];
      const req = await makeRequest("GET", `/wp/v2/users?search=${encodeURIComponent(user.name.substring(0, 3))}`);
      const res = await handleUsers(req);
      const data = (await res?.json()) as Array<{ name: string }>;
      expect(data.some((u) => u.name === user.name)).toBe(true);
    });

    it("respects per_page and page parameters", async () => {
      const req = await makeRequest("GET", "/wp/v2/users?per_page=5&page=1");
      const res = await handleUsers(req);
      const data = (await res?.json()) as unknown[];
      expect(data.length).toBeLessThanOrEqual(5);
    });

    it("hides email when context=view (default)", async () => {
      const req = await makeRequest("GET", "/wp/v2/users?per_page=1");
      const res = await handleUsers(req);
      const data = (await res?.json()) as Array<Record<string, unknown>>;
      expect(data[0].email).toBeUndefined();
    });

    it("shows email when context=edit", async () => {
      const req = await makeRequest("GET", "/wp/v2/users?per_page=1&context=edit");
      const res = await handleUsers(req);
      const data = (await res?.json()) as Array<Record<string, unknown>>;
      expect(data[0].email).toBeDefined();
    });

    it("filters by roles when provided", async () => {
      const req = await makeRequest("GET", "/wp/v2/users?roles=author");
      const res = await handleUsers(req);
      const data = (await res?.json()) as Array<Record<string, unknown>>;
      expect(data.every((u) => (u.roles as string[])?.includes("author") || (u.roles as string[])?.includes("editor"))).toBe(true);
    });

    it("respects _fields parameter", async () => {
      const req = await makeRequest("GET", "/wp/v2/users?per_page=1&_fields=id,name");
      const res = await handleUsers(req);
      const data = (await res?.json()) as Array<Record<string, unknown>>;
      expect(Object.keys(data[0]).sort()).toEqual(["id", "name"].sort());
    });

    it("returns 400 for invalid pagination", async () => {
      const req = await makeRequest("GET", "/wp/v2/users?per_page=200");
      const res = await handleUsers(req);
      expect(res?.status).toBe(400);
    });
  });

  describe("POST /wp/v2/users (create)", () => {
    it("creates a new user with required fields", async () => {
      const req = await makeRequest("POST", "/wp/v2/users", {
        username: "newuser123",
        name: "New User",
        email: "new@example.com",
        roles: ["author"],
      });
      const res = await handleUsers(req);
      expect(res?.status).toBe(201);
      const data = (await res?.json()) as Record<string, unknown>;
      expect(data.username).toBe("newuser123");
      expect(data.name).toBe("New User");
      expect(data.email).toBe("new@example.com");
      expect(data.id).toBeDefined();

      const doc = await (await collection("users")).findOne({ _id: data.id as number });
      expect(doc?.username).toBe("newuser123");
    });

    it("returns 400 when username is missing", async () => {
      const req = await makeRequest("POST", "/wp/v2/users", {
        name: "No Username",
        email: "test@example.com",
      });
      const res = await handleUsers(req);
      expect(res?.status).toBe(400);
    });

    it("returns 400 existing_user_login when username exists", async () => {
      const col = await collection("users");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await col.insertOne({ _id: 9999, username: "testuser999", email: "test999@example.com", name: "Test User" } as any);

      const req = await makeRequest("POST", "/wp/v2/users", {
        username: "testuser999",
        name: "Different Name",
        email: "different@example.com",
      });
      const res = await handleUsers(req);
      expect(res?.status).toBe(400);
      const data = (await res?.json()) as Record<string, unknown>;
      expect(data.code).toBe("existing_user_login");
    });

    it("returns 400 existing_user_email when email exists", async () => {
      const col = await collection("users");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await col.insertOne({ _id: 9998, username: "testuser998", email: "existing@example.com", name: "Existing User" } as any);

      const req = await makeRequest("POST", "/wp/v2/users", {
        username: "newuser456",
        name: "New Name",
        email: "existing@example.com",
      });
      const res = await handleUsers(req);
      expect(res?.status).toBe(400);
      const data = (await res?.json()) as Record<string, unknown>;
      expect(data.code).toBe("existing_user_email");
    });

    it("generates unique slug from username", async () => {
      const req = await makeRequest("POST", "/wp/v2/users", {
        username: "unique_user_789",
        name: "Test User",
        email: "unique@example.com",
      });
      const res = await handleUsers(req);
      const data = (await res?.json()) as Record<string, unknown>;
      expect(data.slug).toMatch(/unique.*user/);
    });
  });

  describe("POST /wp/v2/users/:id (update)", () => {
    it("updates user fields", async () => {
      const user = loadFixture("users")[0];
      const req = await makeRequest("POST", `/wp/v2/users/${user._id}`, {
        description: "Updated description",
      });
      const res = await handleUsers(req);
      expect(res?.status).toBe(200);
      const updated = await (await collection("users")).findOne({ _id: user._id });
      expect(updated?.description).toBe("Updated description");
    });

    it("returns 404 for nonexistent user", async () => {
      const req = await makeRequest("POST", "/wp/v2/users/999999", { description: "test" });
      const res = await handleUsers(req);
      expect(res?.status).toBe(404);
    });
  });

  describe("GET /wp/v2/users/:id", () => {
    it("returns user details", async () => {
      const user = loadFixture("users")[0];
      const req = await makeRequest("GET", `/wp/v2/users/${user._id}`);
      const res = await handleUsers(req);
      expect(res?.status).toBe(200);
      const data = (await res?.json()) as Record<string, unknown>;
      expect(data.id).toBe(user._id);
    });

    it("returns 404 for nonexistent user", async () => {
      const req = await makeRequest("GET", "/wp/v2/users/999999");
      const res = await handleUsers(req);
      expect(res?.status).toBe(404);
    });
  });

  it("returns null for non-user routes", async () => {
    const req = await makeRequest("GET", "/wp/v2/posts");
    const res = await handleUsers(req);
    expect(res).toBeNull();
  });

  it("returns 403 for non-administrators on write", async () => {
    const req = await makeRequest("POST", "/wp/v2/users", { username: "test" });
    req.user = { id: 1, username: "author", role: "author" };
    const res = await handleUsers(req);
    expect(res?.status).toBe(403);
  });
});
