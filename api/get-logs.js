// api/get-logs.js — Returns logs to Admin panel
// No auth needed — app is private, data not sensitive enough to warrant it
// (Admin access is already protected by password in the React app)

import { getLogsForDay, getLogDays, getAllChapterStats } from "./lib/redis.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check Redis configured
  if (!process.env.ari_KV_REST_API_URL || !process.env.ari_KV_REST_API_TOKEN) {
    return res.status(500).json({
      error: "Redis not configured",
      hint: "Add ari_KV_REST_API_URL and ari_KV_REST_API_TOKEN in Vercel env vars",
    });
  }

  try {
    const { day, mode } = req.query;

    if (mode === "days") {
      const days = await getLogDays();
      return res.status(200).json({ days: days || [] });
    }

    if (mode === "stats") {
      const stats = await getAllChapterStats();
      return res.status(200).json({ stats: stats || {} });
    }

    // Default: logs for a day
    const targetDay = day || new Date().toISOString().slice(0, 10);
    const logs = await getLogsForDay(targetDay);
    return res.status(200).json({ day: targetDay, logs: logs || [] });

  } catch (err) {
    console.error("get-logs error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
