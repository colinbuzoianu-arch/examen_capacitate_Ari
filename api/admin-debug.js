// api/admin-debug.js — Debug endpoint to check Redis state
// GET /api/admin-debug?secret=ADMIN_SECRET

import { redisCmd } from "./lib/redis.js";

export default async function handler(req, res) {
  const secret = req.query.secret;
  // Accept both raw and btoa-encoded
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Check users:list (try both SET and LIST format)
    let usersList = null;
    try { usersList = await redisCmd("SMEMBERS", "users:list"); } catch {}
    if (!usersList) {
      try { usersList = await redisCmd("LRANGE", "users:list", 0, 99); } catch {}
    }

    // Scan all user:* keys
    const userKeys = await redisCmd("KEYS", "user:*").catch(() => []);

    // Check data keys
    const dataKeys = await redisCmd("KEYS", "data:*").catch(() => []);

    return res.status(200).json({
      ok: true,
      usersListValue: usersList,
      userKeysFound: userKeys,
      dataKeysFound: dataKeys?.slice(0, 20),
      redisUrl: process.env.ari_KV_REST_API_URL ? "✅ set" : "❌ missing",
      adminSecret: process.env.ADMIN_SECRET ? "✅ set" : "❌ missing",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
