// api/log.js — Activity logging with userId support
import { redisCmd } from "./lib/redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { type, payload } = req.body;
  if (!type || !payload) return res.status(400).json({ error: "Missing type or payload" });

  const VALID_TYPES = [
    "chapter_opened", "content_generated", "chat_message",
    "quiz_started", "quiz_submitted", "screenshot_uploaded", "chapter_unlocked",
  ];
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: "Invalid event type" });

  if (!process.env.ari_KV_REST_API_URL || !process.env.ari_KV_REST_API_TOKEN) {
    return res.status(500).json({ ok: false, error: "Redis not configured" });
  }

  try {
    const day = new Date().toISOString().slice(0, 10);
    const entry = JSON.stringify({ type, ...payload, ts: new Date().toISOString() });

    // Push to daily log (all users mixed — for activity feed)
    await redisCmd("LPUSH", `logs:${day}`, entry);
    await redisCmd("LTRIM", `logs:${day}`, 0, 999);
    await redisCmd("EXPIRE", `logs:${day}`, 60 * 60 * 24 * 90);

    // Also push to per-user log if userId present
    if (payload.userId) {
      await redisCmd("LPUSH", `ulogs:${payload.userId}:${day}`, entry);
      await redisCmd("LTRIM", `ulogs:${payload.userId}:${day}`, 0, 199);
      await redisCmd("EXPIRE", `ulogs:${payload.userId}:${day}`, 60 * 60 * 24 * 90);
    }

    // For quiz results — accumulate per user
    if (type === "quiz_submitted" && payload.chapterId && payload.userId) {
      const statKey = `chapterstat:${payload.userId}:${payload.chapterId}`;
      let existing = null;
      try {
        const v = await redisCmd("GET", statKey);
        existing = v ? JSON.parse(v) : null;
      } catch {}

      const allAttempts = [
        ...(existing?.attempts_history || []),
        { score: payload.score, passed: payload.passed, ts: new Date().toISOString() },
      ];

      await redisCmd("SET", statKey, JSON.stringify({
        chapterId:       payload.chapterId,
        chapterTitle:    payload.chapterTitle,
        subject:         payload.subject,
        userId:          payload.userId,
        score:           payload.score,
        passed:          payload.passed,
        bestScore:       Math.max(payload.score, existing?.bestScore || 0),
        totalAttempts:   allAttempts.length,
        lastAttempt:     new Date().toISOString(),
        attempts_history: allAttempts.slice(-10),
        answers:         payload.answers || [],
      }));
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Log error:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
