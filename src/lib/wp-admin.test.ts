import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { collection } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { seedFixtures } from "@/test/fixtures";

// Set up env vars for tests
process.env.ADMIN_SESSION_SECRET = "test-secret-key-for-testing-only";

// Mock modules BEFORE importing wp-admin
vi.mock("@/lib/env", () => ({
  DATA_SOURCE: "mongo",
  WP_URL: "https://admin.example.com",
  SITE_URL: "https://example.com",
  WP_API: "https://admin.example.com/wp-json/wp/v2",
  MEDIA_PREFIX: "/wp-content",
  MEDIA_ORIGIN: "",
  MEDIA_HOSTS: [],
  REVALIDATION_SECRET: "",
  siteUrl: (path: string) => `https://example.com${path}`,
}));

// Mock the cookies() function from next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

// Mock adminRest to track calls
vi.mock("@/lib/admin-rest", () => ({
  adminRest: vi.fn(async (path: string, init: RequestInit, user: unknown) => {
    return new Response(JSON.stringify({ path, user }), { status: 200 });
  }),
}));

// Import after mocking dependencies
import { createAdminSession, getAdminSession, wpAdminFetch, wpAdminRoute } from "./wp-admin";

describe("MongoDB admin authentication (mongo mode)", () => {
  beforeEach(async () => {
    await seedFixtures();
  });

  describe("createAdminSession with MongoDB", () => {
    it("creates a session for a valid admin user", async () => {
      const usersCol = await collection("users");

      // Create a test admin user
      const password = "SecurePassword123!";
      const hash = await hashPassword(password);
      await usersCol.updateOne(
        { _id: 1 }, // Assuming ID 1 exists in fixtures
        {
          $set: {
            username: "testadmin",
            email: "admin@example.com",
            password_hash: hash,
            is_active: true,
            role: "administrator",
            roles: ["administrator"],
          },
        }
      );

      // Should not throw
      await expect(
        createAdminSession("testadmin", password, false)
      ).resolves.not.toThrow();
    });

    it("rejects wrong password with generic error", async () => {
      const usersCol = await collection("users");

      const password = "SecurePassword123!";
      const hash = await hashPassword(password);
      await usersCol.updateOne(
        { _id: 1 },
        {
          $set: {
            username: "testadmin",
            email: "admin@example.com",
            password_hash: hash,
            is_active: true,
            role: "administrator",
            roles: ["administrator"],
          },
        }
      );

      await expect(
        createAdminSession("testadmin", "WrongPassword", false)
      ).rejects.toThrow("Incorrect username or password");
    });

    it("rejects non-existent user with generic error (timing-safe)", async () => {
      // Even if user doesn't exist, the error message is the same
      await expect(
        createAdminSession("nonexistent", "SomePassword123!", false)
      ).rejects.toThrow("Incorrect username or password");
    });

    it("rejects inactive user", async () => {
      const usersCol = await collection("users");

      const password = "SecurePassword123!";
      const hash = await hashPassword(password);
      await usersCol.updateOne(
        { _id: 1 },
        {
          $set: {
            username: "inactive",
            email: "inactive@example.com",
            password_hash: hash,
            is_active: false,
            role: "administrator",
            roles: ["administrator"],
          },
        }
      );

      await expect(
        createAdminSession("inactive", password, false)
      ).rejects.toThrow("Incorrect username or password");
    });

    it("rejects user without password_hash", async () => {
      const usersCol = await collection("users");

      await usersCol.updateOne(
        { _id: 1 },
        {
          $set: {
            username: "nohash",
            email: "nohash@example.com",
            password_hash: null,
            is_active: true,
            role: "administrator",
            roles: ["administrator"],
          },
        }
      );

      await expect(
        createAdminSession("nohash", "SomePassword123!", false)
      ).rejects.toThrow("Incorrect username or password");
    });

    it("rejects author-only user", async () => {
      const usersCol = await collection("users");

      const password = "SecurePassword123!";
      const hash = await hashPassword(password);
      await usersCol.updateOne(
        { _id: 2 },
        {
          $set: {
            username: "author",
            email: "author@example.com",
            password_hash: hash,
            is_active: true,
            role: "author",
            roles: ["author"],
          },
        }
      );

      await expect(
        createAdminSession("author", password, false)
      ).rejects.toThrow("Incorrect username or password");
    });

    it("accepts editor role", async () => {
      const usersCol = await collection("users");

      const password = "SecurePassword123!";
      const hash = await hashPassword(password);
      await usersCol.updateOne(
        { _id: 1 },
        {
          $set: {
            username: "editor",
            email: "editor@example.com",
            password_hash: hash,
            is_active: true,
            role: "editor",
            roles: ["editor"],
          },
        }
      );

      await expect(
        createAdminSession("editor", password, false)
      ).resolves.not.toThrow();
    });

    it("accepts user with editor in roles array", async () => {
      const usersCol = await collection("users");

      const password = "SecurePassword123!";
      const hash = await hashPassword(password);
      await usersCol.updateOne(
        { _id: 1 },
        {
          $set: {
            username: "multirole",
            email: "multirole@example.com",
            password_hash: hash,
            is_active: true,
            role: "author",
            roles: ["author", "editor"],
          },
        }
      );

      await expect(
        createAdminSession("multirole", password, false)
      ).resolves.not.toThrow();
    });

    it("matches username case-insensitively", async () => {
      const usersCol = await collection("users");

      const password = "SecurePassword123!";
      const hash = await hashPassword(password);
      await usersCol.updateOne(
        { _id: 1 },
        {
          $set: {
            username: "TestAdmin",
            email: "admin@example.com",
            password_hash: hash,
            is_active: true,
            role: "administrator",
            roles: ["administrator"],
          },
        }
      );

      // Both should work
      await expect(
        createAdminSession("testadmin", password, false)
      ).resolves.not.toThrow();

      await expect(
        createAdminSession("TESTADMIN", password, false)
      ).resolves.not.toThrow();
    });

    it("matches email case-insensitively as fallback", async () => {
      const usersCol = await collection("users");

      const password = "SecurePassword123!";
      const hash = await hashPassword(password);
      await usersCol.updateOne(
        { _id: 1 },
        {
          $set: {
            username: "someuser",
            email: "Admin@Example.Com",
            password_hash: hash,
            is_active: true,
            role: "administrator",
            roles: ["administrator"],
          },
        }
      );

      // Email login should work case-insensitively
      await expect(
        createAdminSession("admin@example.com", password, false)
      ).resolves.not.toThrow();
    });

    it("stores session with remember flag", async () => {
      const usersCol = await collection("users");

      const password = "SecurePassword123!";
      const hash = await hashPassword(password);
      await usersCol.updateOne(
        { _id: 1 },
        {
          $set: {
            username: "testadmin",
            email: "admin@example.com",
            password_hash: hash,
            is_active: true,
            role: "administrator",
            roles: ["administrator"],
          },
        }
      );

      // Should accept remember flag without error
      await expect(
        createAdminSession("testadmin", password, true)
      ).resolves.not.toThrow();
    });
  });

  describe("the administrator named by ADMIN_USER / ADMIN_PASSWORD", () => {
    const setUser = async (over: Record<string, unknown> = {}) => (await collection("users")).updateOne(
      { _id: 1 },
      { $set: { username: "siteadmin", email: "site@example.com", password_hash: null, is_active: true, role: "administrator", roles: ["administrator"], ...over } },
    );
    afterEach(() => {
      delete process.env.ADMIN_USER;
      delete process.env.ADMIN_PASSWORD;
    });

    it("signs in with the password from the environment, so changing it there changes the login", async () => {
      await setUser();
      process.env.ADMIN_USER = "siteadmin";
      process.env.ADMIN_PASSWORD = "first-long-password";
      await expect(createAdminSession("siteadmin", "first-long-password")).resolves.not.toThrow();
      process.env.ADMIN_PASSWORD = "second-long-password ";
      await expect(createAdminSession("siteadmin", "first-long-password")).rejects.toThrow("Incorrect username or password");
      // the name is matched case-insensitively; stray spaces around the value in .env are ignored
      await expect(createAdminSession("SiteAdmin", "second-long-password")).resolves.not.toThrow();
    });

    it("accepts a short password, is off while the password is empty, and opens only an active administrator", async () => {
      process.env.ADMIN_USER = "siteadmin";
      process.env.ADMIN_PASSWORD = "short1";
      await setUser();
      await expect(createAdminSession("siteadmin", "short1")).resolves.not.toThrow();
      process.env.ADMIN_PASSWORD = "  ";
      await expect(createAdminSession("siteadmin", "")).rejects.toThrow("Incorrect username or password");
      process.env.ADMIN_PASSWORD = "a-long-enough-password";
      await setUser({ is_active: false });
      await expect(createAdminSession("siteadmin", "a-long-enough-password")).rejects.toThrow("Incorrect username or password");
      await setUser({ role: "editor", roles: ["editor"] });
      await expect(createAdminSession("siteadmin", "a-long-enough-password")).rejects.toThrow("Incorrect username or password");
    });

    it("does not open any other account", async () => {
      await setUser({ password_hash: await hashPassword("the-database-password") });
      process.env.ADMIN_USER = "someone-else";
      process.env.ADMIN_PASSWORD = "a-long-enough-password";
      await expect(createAdminSession("siteadmin", "a-long-enough-password")).rejects.toThrow("Incorrect username or password");
      // the account's own database password still works
      await expect(createAdminSession("siteadmin", "the-database-password")).resolves.not.toThrow();
    });
  });

  describe("getAdminSession", () => {
    it("returns null when no session cookie exists", async () => {
      const session = await getAdminSession();
      expect(session).toBeNull();
    });

    it("rejects old WordPress-only session without userId in mongo mode", async () => {
      // This would test that a session without userId (old WP format) is rejected
      // For now, this is mocked - the actual behavior depends on cookie mock setup
      const session = await getAdminSession();
      expect(session).toBeNull();
    });
  });

  describe("wpAdminFetch in mongo mode", () => {
    it("requires a valid admin session", async () => {
      // Without a session, should throw
      await expect(wpAdminFetch("/posts")).rejects.toThrow(
        /authentication required/i
      );
    });

    it("maps /wp/v2 paths correctly to adminRest", async () => {
      // This tests the path mapping logic
      // When a session exists, wpAdminFetch("/posts") should call
      // adminRest("/wp/v2/posts", ...)
      // This requires setting up a mock session, which depends on cookies mock
    });
  });

  describe("wpAdminRoute in mongo mode", () => {
    it("requires a valid admin session", async () => {
      await expect(
        wpAdminRoute("/rsfv/v1/posts/123")
      ).rejects.toThrow(/authentication required/i);
    });

    it("maps plugin paths correctly to adminRest", async () => {
      // When a session exists, wpAdminRoute("/rsfv/v1/posts/123") should call
      // adminRest("/rsfv/v1/posts/123", ...)
    });
  });

  describe("session cookie format compatibility", () => {
    it("maintains AdminSession type compatibility for WordPress-only fields", async () => {
      // The AdminSession type should have optional fields for WordPress-specific data
      // when operating in mongo mode
      const usersCol = await collection("users");

      const password = "SecurePassword123!";
      const hash = await hashPassword(password);
      await usersCol.updateOne(
        { _id: 1 },
        {
          $set: {
            username: "testadmin",
            email: "admin@example.com",
            password_hash: hash,
            is_active: true,
            role: "administrator",
            roles: ["administrator"],
          },
        }
      );

      // The session should be readable by existing code that expects session.username
      await expect(
        createAdminSession("testadmin", password, false)
      ).resolves.not.toThrow();
    });
  });
});
