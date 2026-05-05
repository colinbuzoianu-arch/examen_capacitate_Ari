// api/lib/auth.js — User auth helpers using Upstash Redis

import { redisCmd } from "./redis.js";

// ── Password hashing (SHA-256 + salt, no native deps needed) ─────────────────
export async function hashPassword(password, salt) {
  const s = salt || crypto.randomUUID().replace(/-/g, "");
  const encoder = new TextEncoder();
  const data = encoder.encode(password + s);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return { hash, salt: s };
}

export async function verifyPassword(password, storedHash, salt) {
  const { hash } = await hashPassword(password, salt);
  return hash === storedHash;
}

// ── Session token ─────────────────────────────────────────────────────────────
export function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── User CRUD ─────────────────────────────────────────────────────────────────
export async function getUserByEmail(email) {
  const key = `user:${email.toLowerCase()}`;
  const val = await redisCmd("GET", key);
  if (!val) return null;
  return typeof val === "string" ? JSON.parse(val) : val;
}

export async function createUser({ email, password, name }) {
  const existing = await getUserByEmail(email);
  if (existing) throw new Error("Email deja înregistrat");

  const userId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { hash, salt } = await hashPassword(password);

  const user = {
    userId,
    email: email.toLowerCase(),
    name: name || email.split("@")[0],
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
    role: "student", // or "admin"
  };

  await redisCmd("SET", `user:${email.toLowerCase()}`, JSON.stringify(user));
  // Also index by userId for quick lookup
  await redisCmd("SET", `userid:${userId}`, email.toLowerCase());
  // Add to users list
  // Handle migration: users:list might be LIST type (old) or SET type (new)
  // Try SADD first, if it fails (WRONGTYPE), migrate the key
  try {
    await redisCmd("SADD", "users:list", email.toLowerCase());
  } catch (err) {
    if (err.message?.includes("WRONGTYPE")) {
      // Migrate: get old list values, delete key, recreate as SET
      const oldValues = await redisCmd("LRANGE", "users:list", 0, 199).catch(() => []);
      await redisCmd("DEL", "users:list");
      const allEmails = [...new Set([...( oldValues || []), email.toLowerCase()])];
      for (const e of allEmails) {
        await redisCmd("SADD", "users:list", e);
      }
    }
  }

  return user;
}

export async function getAllUsers() {
  let emails = [];

  // Try SMEMBERS first (new format - Set)
  try {
    const members = await redisCmd("SMEMBERS", "users:list");
    if (Array.isArray(members) && members.length > 0) {
      emails = members;
    }
  } catch {}

  // Fallback: scan all user:* keys directly
  if (emails.length === 0) {
    try {
      const keys = await redisCmd("KEYS", "user:*");
      if (Array.isArray(keys)) {
        emails = keys.map(k => k.replace("user:", "")).filter(e => e.includes("@"));
      }
    } catch {}
  }

  if (emails.length === 0) return [];

  const users = [];
  for (const email of [...new Set(emails)]) { // deduplicate
    try {
      const u = await getUserByEmail(email);
      if (u) users.push({ ...u, passwordHash: undefined, passwordSalt: undefined });
    } catch {}
  }
  return users;
}

// ── Sessions ──────────────────────────────────────────────────────────────────
export async function createSession(userId, email) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const session = { userId, email: email.toLowerCase(), expiresAt };
  // Store session for 7 days
  await redisCmd("SET", `session:${token}`, JSON.stringify(session));
  await redisCmd("EXPIRE", `session:${token}`, 7 * 24 * 60 * 60);
  return token;
}

export async function getSession(token) {
  if (!token) return null;
  const val = await redisCmd("GET", `session:${token}`);
  if (!val) return null;
  const session = typeof val === "string" ? JSON.parse(val) : val;
  if (new Date(session.expiresAt) < new Date()) {
    await redisCmd("DEL", `session:${token}`);
    return null;
  }
  return session;
}

export async function deleteSession(token) {
  await redisCmd("DEL", `session:${token}`);
}

// ── Per-user progress in Redis ────────────────────────────────────────────────
export async function getUserProgress(userId) {
  const val = await redisCmd("GET", `progress:${userId}`);
  if (!val) return {};
  return typeof val === "string" ? JSON.parse(val) : val;
}

export async function setUserProgress(userId, progress) {
  await redisCmd("SET", `progress:${userId}`, JSON.stringify(progress));
}

export async function getUserChapterData(userId, chapterId) {
  const val = await redisCmd("GET", `chapter:${userId}:${chapterId}`);
  if (!val) return null;
  return typeof val === "string" ? JSON.parse(val) : val;
}

export async function setUserChapterData(userId, chapterId, data) {
  await redisCmd("SET", `chapter:${userId}:${chapterId}`, JSON.stringify(data));
  await redisCmd("EXPIRE", `chapter:${userId}:${chapterId}`, 180 * 24 * 3600); // 180 days
}

export async function getUserGamification(userId) {
  const val = await redisCmd("GET", `gam:${userId}`);
  if (!val) return null;
  return typeof val === "string" ? JSON.parse(val) : val;
}

export async function setUserGamification(userId, data) {
  await redisCmd("SET", `gam:${userId}`, JSON.stringify(data));
}
