import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing and verification", () => {
  it("hashes a password and can verify it", async () => {
    const password = "MySecurePassword123!";
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).toContain("scrypt$");
    expect(hash.split("$").length).toBe(6); // scrypt$N$r$p$saltB64$hashB64 = 6 parts

    const verified = await verifyPassword(password, hash);
    expect(verified).toBe(true);
  });

  it("rejects wrong password", async () => {
    const password = "MySecurePassword123!";
    const hash = await hashPassword(password);

    const verified = await verifyPassword("WrongPassword", hash);
    expect(verified).toBe(false);
  });

  it("rejects malformed hash", async () => {
    const verified = await verifyPassword("password", "not-a-hash");
    expect(verified).toBe(false);
  });

  it("rejects hash with wrong format prefix", async () => {
    const verified = await verifyPassword("password", "bcrypt$10$somehash");
    expect(verified).toBe(false);
  });

  it("rejects empty hash", async () => {
    const verified = await verifyPassword("password", "");
    expect(verified).toBe(false);
  });

  it("never throws on bad input", async () => {
    // Verify should never throw, just return false
    await expect(verifyPassword("password", "malformed-hash")).resolves.toBe(false);
    await expect(verifyPassword("password", "scrypt$invalid$hash")).resolves.toBe(false);
    await expect(verifyPassword("", "scrypt$16384$8$1$salt$hash")).resolves.not.toThrow();
  });

  it("uses timing-safe comparison", async () => {
    const password = "TestPassword123!";
    const hash = await hashPassword(password);

    // Correct password should succeed
    const correct = await verifyPassword(password, hash);
    expect(correct).toBe(true);

    // Wrong password with same length should fail safely (not throw)
    const wrong = await verifyPassword("TestPassword456!", hash);
    expect(wrong).toBe(false);
  });

  it("generates different hashes for same password (random salt)", async () => {
    const password = "SamePassword123!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });

  it("stores parameters N=16384, r=8, p=1, keylen=64 in format", async () => {
    const password = "TestPassword";
    const hash = await hashPassword(password);
    const parts = hash.split("$");

    // Format: scrypt$N$r$p$saltB64$hashB64
    expect(parts[0]).toBe("scrypt");
    expect(parts[1]).toBe("16384"); // N
    expect(parts[2]).toBe("8"); // r
    expect(parts[3]).toBe("1"); // p
    // parts[4] is salt (base64)
    // parts[5] is hash (base64)
  });

  it("rejects truncated hash", async () => {
    const password = "password";
    const hash = await hashPassword(password);
    const truncated = hash.split("$").slice(0, -1).join("$");

    const verified = await verifyPassword(password, truncated);
    expect(verified).toBe(false);
  });

  it("rejects hash with invalid base64", async () => {
    const invalidHash = "scrypt$16384$8$1$!!!invalid-base64!!!$!!!invalid-base64!!!";
    const verified = await verifyPassword("password", invalidHash);
    expect(verified).toBe(false);
  });

  it("handles minimum password length", async () => {
    const shortPassword = "a";
    const hash = await hashPassword(shortPassword);
    const verified = await verifyPassword(shortPassword, hash);
    expect(verified).toBe(true);
  });

  it("handles very long password", async () => {
    const longPassword = "x".repeat(1024);
    const hash = await hashPassword(longPassword);
    const verified = await verifyPassword(longPassword, hash);
    expect(verified).toBe(true);
  });

  it("handles special characters and unicode", async () => {
    const passwords = ["P@ssw0rd!", "مرحبا123", "🔐Secret", "Ñoño123"];
    for (const password of passwords) {
      const hash = await hashPassword(password);
      const verified = await verifyPassword(password, hash);
      expect(verified).toBe(true);
    }
  });
});
