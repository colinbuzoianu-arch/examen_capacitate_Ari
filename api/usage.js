// api/usage.js — Citire și resetare contor interacțiuni per user
// GET  /api/usage?userId=xxx  → returnează usage curent
// POST /api/usage             → { userId, type? } resetează contorul (admin only)

import { getSession } from "./lib/auth.js";
import { redisCmd } from "./lib/redis.js";

const ADMIN_SECRET = () => process.env.ADMIN_SECRET;

async function getUsage(userId) {
  const val = await redisCmd("GET", `usage:${userId}`);
  if (!val) return { lesson: 0, quiz: 0, chat: 0 };
  return typeof val === "string" ? JSON.parse(val) : val;
}

export default async function handler(req, res) {
  // ── GET: citire usage (user propriu sau admin) ────────────────────────────
  if (req.method === "GET") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const session = token ? await getSession(token).catch(() => null) : null;
    if (!session) return res.status(401).json({ error: "Neautorizat" });

    const userId = req.query.userId || session.userId;

    // Non-admin pot vedea doar propriul usage
    const isAdmin = req.headers["x-admin-secret"] === ADMIN_SECRET();
    if (userId !== session.userId && !isAdmin) {
      return res.status(403).json({ error: "Acces interzis" });
    }

    const usage = await getUsage(userId);
    return res.status(200).json({ userId, usage });
  }

  // ── POST: resetare usage (admin only) ────────────────────────────────────
  if (req.method === "POST") {
    const isAdmin = req.headers["x-admin-secret"] === ADMIN_SECRET();
    if (!isAdmin) return res.status(403).json({ error: "Admin only" });

    const { userId, type } = req.body;
    if (!userId) return res.status(400).json({ error: "userId lipsă" });

    if (type) {
      // Resetează doar un tip specific
      const usage = await getUsage(userId);
      usage[type] = 0;
      await redisCmd("SET", `usage:${userId}`, JSON.stringify(usage));
      return res.status(200).json({ ok: true, userId, reset: type, usage });
    } else {
      // Resetează tot
      const clean = { lesson: 0, quiz: 0, chat: 0 };
      await redisCmd("SET", `usage:${userId}`, JSON.stringify(clean));
      return res.status(200).json({ ok: true, userId, reset: "all", usage: clean });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
