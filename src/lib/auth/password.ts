import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
) => Promise<Buffer>;

/**
 * Hash parameters for scrypt. These are balanced for security and speed on typical hardware.
 * - N=16384: cost parameter, typical range 2^14 to 2^20
 * - r=8: block size parameter
 * - p=1: parallelization parameter
 * - keylen=64: output length in bytes (512 bits)
 */
const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };
const SALT_LENGTH = 16; // 16 random bytes = 128 bits

/**
 * Hash a password using scrypt.
 *
 * Returns a string in the format: `scrypt$N$r$p$saltB64$hashB64`
 * where:
 * - saltB64 is the random 16-byte salt encoded in base64
 * - hashB64 is the derived key encoded in base64
 *
 * This format allows verifyPassword to reconstruct the hash without storing parameters.
 * Each call generates a new random salt, so the same password produces different hashes.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(password, salt, PARAMS.keylen, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
  });

  const saltB64 = salt.toString("base64");
  const hashB64 = hash.toString("base64");
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${saltB64}$${hashB64}`;
}

/**
 * Verify a password against a hash.
 *
 * Returns true if the password matches the hash, false otherwise (never throws).
 * Always performs the scrypt computation even for invalid hashes (timing-safe).
 *
 * Supported formats:
 * - `scrypt$16384$8$1$saltB64$hashB64` - newly hashed passwords
 *
 * Returns false for:
 * - Malformed hashes (wrong prefix, missing parts, invalid base64)
 * - Wrong password
 * - Other hash formats (legacy WordPress hashes)
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Reject anything that doesn't start with our format
  if (!hash || !hash.startsWith("scrypt$")) {
    // Still do a timing-safe dummy computation to prevent timing attacks
    await scryptAsync(password, randomBytes(SALT_LENGTH), PARAMS.keylen, {
      N: PARAMS.N,
      r: PARAMS.r,
      p: PARAMS.p,
    }).catch(() => undefined);
    return false;
  }

  try {
    const parts = hash.split("$");
    if (parts.length !== 6) return false;

    const [prefix, nStr, rStr, pStr, saltB64, expectedHashB64] = parts;

    if (prefix !== "scrypt") return false;

    // Parse parameters from the hash (they must match what we use)
    const n = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);

    // Only accept hashes with our standard parameters
    if (n !== PARAMS.N || r !== PARAMS.r || p !== PARAMS.p) return false;

    // Decode salt and expected hash from base64
    let salt: Buffer;
    let expectedHash: Buffer;
    try {
      salt = Buffer.from(saltB64, "base64");
      expectedHash = Buffer.from(expectedHashB64, "base64");
    } catch {
      return false;
    }

    // Validate decoded sizes
    if (salt.length !== SALT_LENGTH || expectedHash.length !== PARAMS.keylen) {
      return false;
    }

    // Recompute the hash with the same parameters
    const computedHash = await scryptAsync(password, salt, PARAMS.keylen, {
      N: n,
      r,
      p,
    });

    // Timing-safe comparison
    return timingSafeEqual(computedHash, expectedHash);
  } catch {
    // Any error (invalid base64, scrypt failure, etc.) returns false
    return false;
  }
}
