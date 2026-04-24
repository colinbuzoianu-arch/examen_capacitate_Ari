// api/get-logs.js — Vercel Serverless Function
// Returns activity logs for the Admin panel
// Protected: requires admin token header

import { getLogsForDay, getLogDays, getAllChapterStats } from "./lib/redis.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Simple protection — admin must send the CRON_SECRET as bearer token
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { day, mode } = req.query;

    if (mode === "days") {
      // Return list of days that have logs
      const days = await getLogDays();
      return res.status(200).json({ days });
    }

    if (mode === "stats") {
      // Return per-chapter quiz stats summary
      const stats = await getAllChapterStats();
      return res.status(200).json({ stats });
    }

    // Default: return logs for a specific day (or today)
    const targetDay = day || new Date().toISOString().slice(0, 10);
    const logs = await getLogsForDay(targetDay);
    return res.status(200).json({ day: targetDay, logs });

  } catch (err) {
    console.error("get-logs error:", err);
    return res.status(500).json({ error: err.message });
  }
}
