#!/usr/bin/env node

/**
 * Admin user management CLI for MongoDB-backed authentication.
 *
 * Usage:
 *   node --env-file=../.env scripts/admin-user.mjs list
 *   node --env-file=../.env scripts/admin-user.mjs set-password <username|email>
 *   node --env-file=../.env scripts/admin-user.mjs set-role <username> administrator|editor|author
 *   node --env-file=../.env scripts/admin-user.mjs disable <username>
 *   node --env-file=../.env scripts/admin-user.mjs enable <username>
 *
 * Note: MONGODB_URI is read from the environment. The database name is always "islamonlive"
 * (never the URI's default database). This is how the real staff passwords are set: run it
 * against the production cluster from a trusted machine. Passwords are typed, never passed
 * as arguments, and never echoed.
 */

import { MongoClient } from "mongodb";
import { scrypt, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

// Scrypt parameters (MUST match src/lib/auth/password.ts)
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };
const SALT_LENGTH = 16;

const DB_NAME = "islamonlive";

/** Hash a password using scrypt (duplicated from password.ts with a comment). */
async function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });

  const saltB64 = salt.toString("base64");
  const hashB64 = hash.toString("base64");
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${saltB64}$${hashB64}`;
}

/**
 * Read a password without echoing it. A TTY is switched to raw mode so no
 * keystroke reaches the screen or the scrollback; piped input is read once and
 * handed out a line per prompt.
 */
let pipedLines = null;
function promptPassword(prompt) {
  const { stdin, stdout } = process;
  stdout.write(prompt);
  if (!stdin.isTTY) {
    pipedLines ??= new Promise((resolve) => {
      let data = "";
      stdin.setEncoding("utf8");
      stdin.on("data", (chunk) => (data += chunk));
      stdin.on("end", () => resolve(data.split(/\r?\n/)));
    });
    return pipedLines.then((lines) => {
      stdout.write("\n");
      return lines.shift() ?? "";
    });
  }
  return new Promise((resolve, reject) => {
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const done = (fn) => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener("data", onData); stdout.write("\n"); fn(); };
    function onData(chunk) {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done(() => resolve(value));
        if (ch === "\u0003") return done(() => reject(new Error("cancelled")));
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    }
    stdin.on("data", onData);
  });
}

async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Error: MONGODB_URI not set in environment");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  return client;
}

async function listUsers() {
  const client = await connectMongo();
  try {
    const db = client.db(DB_NAME);
    const users = await db
      .collection("users")
      .find({ $or: [{ role: "administrator" }, { role: "editor" }] })
      .project({
        _id: 1,
        username: 1,
        name: 1,
        role: 1,
        is_active: 1,
        password_hash: 1,
      })
      .toArray();

    if (users.length === 0) {
      console.log("No staff users found.");
      return;
    }

    console.log("\nStaff Users:");
    console.log("ID\tUsername\tName\t\t\tRole\t\tActive\tPassword");
    console.log("─".repeat(100));

    for (const user of users) {
      const hasPassword = !!user.password_hash;
      const active = user.is_active ? "yes" : "no";
      const name = (user.name || "").slice(0, 24).padEnd(24);
      console.log(`${user._id}\t${user.username || ""}\t${name}\t${user.role}\t\t${active}\t${hasPassword ? "set" : "not set"}`);
    }
    console.log("");
  } finally {
    await client.close();
  }
}

async function setPassword() {
  const usernameOrEmail = process.argv[3];
  if (!usernameOrEmail) {
    console.error("Usage: set-password <username|email>");
    process.exit(1);
  }

  const client = await connectMongo();
  try {
    const db = client.db(DB_NAME);
    const user = await db.collection("users").findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
    });

    if (!user) {
      console.error(`User not found: ${usernameOrEmail}`);
      process.exit(1);
    }

    const password1 = await promptPassword("New password (not shown): ");

    if (password1.length < 12) {
      console.error("Error: Password must be at least 12 characters");
      process.exit(1);
    }

    const password2 = await promptPassword("Confirm password: ");

    if (password1 !== password2) {
      console.error("Error: Passwords do not match");
      process.exit(1);
    }

    const hash = await hashPassword(password1);
    await db.collection("users").updateOne({ _id: user._id }, { $set: { password_hash: hash } });

    console.log(`Password updated for ${user.username} (${user.email})`);
  } finally {
    await client.close();
  }
}

async function setRole() {
  const username = process.argv[3];
  const role = process.argv[4];

  if (!username || !role || !["administrator", "editor", "author"].includes(role)) {
    console.error("Usage: set-role <username> administrator|editor|author");
    process.exit(1);
  }

  const client = await connectMongo();
  try {
    const db = client.db(DB_NAME);
    const result = await db.collection("users").updateOne({ username }, { $set: { role } });

    if (result.matchedCount === 0) {
      console.error(`User not found: ${username}`);
      process.exit(1);
    }

    console.log(`Role updated to ${role} for ${username}`);
  } finally {
    await client.close();
  }
}

async function disableUser() {
  const username = process.argv[3];

  if (!username) {
    console.error("Usage: disable <username>");
    process.exit(1);
  }

  const client = await connectMongo();
  try {
    const db = client.db(DB_NAME);
    const result = await db.collection("users").updateOne({ username }, { $set: { is_active: false } });

    if (result.matchedCount === 0) {
      console.error(`User not found: ${username}`);
      process.exit(1);
    }

    console.log(`User disabled: ${username}`);
  } finally {
    await client.close();
  }
}

async function enableUser() {
  const username = process.argv[3];

  if (!username) {
    console.error("Usage: enable <username>");
    process.exit(1);
  }

  const client = await connectMongo();
  try {
    const db = client.db(DB_NAME);
    const result = await db.collection("users").updateOne({ username }, { $set: { is_active: true } });

    if (result.matchedCount === 0) {
      console.error(`User not found: ${username}`);
      process.exit(1);
    }

    console.log(`User enabled: ${username}`);
  } finally {
    await client.close();
  }
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "list":
      await listUsers();
      break;
    case "set-password":
      await setPassword();
      break;
    case "set-role":
      await setRole();
      break;
    case "disable":
      await disableUser();
      break;
    case "enable":
      await enableUser();
      break;
    default:
      console.error(
        `Unknown command: ${command}\n\nUsage:\n  list\n  set-password <username|email>\n  set-role <username> administrator|editor|author\n  disable <username>\n  enable <username>`
      );
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
