// api/progress.js — Sync user progress to/from Redis
// GET  /api/progress         → load progress for authenticated user
// POST /api/progress         → save progress for authenticated user

import { getSession } from "./lib/auth.js";
import { redisCmd } from "./lib/redis.js";

async function getUser(req) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  return getSession(token);
}

export default async function handler(req, res) {
  const session = await getUser(req).catch(() => null);
  if (!session) return res.status(401).json({ error: "Non autentificat" });

  const { userId } = session;

  // ── GET progress ──────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { key } = req.query;
    if (!key) return res.status(400).json({ error: "Missing key" });

    const redisKey = `data:${userId}:${key}`;
    const val = await redisCmd("GET", redisKey).catch(() => null);
    return res.status(200).json({
      ok: true,
      value: val ? (typeof val === "string" ? JSON.parse(val) : val) : null,
    });
  }

  // ── SET progress ──────────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { key, value } = req.body || {};
    if (!key || value === undefined) return res.status(400).json({ error: "Missing key or value" });

    const redisKey = `data:${userId}:${key}`;
    await redisCmd("SET", redisKey, JSON.stringify(value));
    await redisCmd("EXPIRE", redisKey, 180 * 24 * 3600); // 180 days
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
