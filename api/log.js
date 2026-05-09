// api/log.js — Vercel Serverless Function
// Receives activity events from Ari's app and stores them in Upstash Redis

import { pushLog, setChapterStat, getChapterStat } from "./lib/redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type, payload } = req.body;

  if (!type || !payload) {
    return res.status(400).json({ error: "Missing type or payload" });
  }

  const VALID_TYPES = [
    "chapter_opened",
    "content_generated",
    "chat_message",
    "quiz_started",
    "quiz_submitted",   // includes failed attempts
    "screenshot_uploaded",
    "chapter_unlocked",
  ];

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: "Invalid event type" });
  }

  // Check Redis is configured — fail loudly so we know
  if (!process.env.ari_KV_REST_API_URL || !process.env.ari_KV_REST_API_TOKEN) {
    console.error("LOG ERROR: Upstash Redis env vars missing (ari_KV_REST_API_URL / ari_KV_REST_API_TOKEN)");
    return res.status(500).json({
      ok: false,
      error: "Redis not configured — add ari_KV_REST_API_URL and ari_KV_REST_API_TOKEN in Vercel env vars",
    });
  }

  try {
    // Push to daily log — ALL events including failed quiz attempts
    await pushLog({ type, ...payload });

    // For quiz results — accumulate ALL attempts, not just overwrite
    if (type === "quiz_submitted" && payload.chapterId) {
      let existing = null;
      try { existing = await getChapterStat(payload.chapterId); } catch {}

      const allAttempts = [
        ...(existing?.attempts_history || []),
        {
          score: payload.score,
          passed: payload.passed,
          ts: new Date().toISOString(),
          answers: payload.answers || [],
        },
      ];

      await setChapterStat(payload.chapterId, {
        chapterId:    payload.chapterId,
        chapterTitle: payload.chapterTitle,
        subject:      payload.subject,
        // Latest result
        score:        payload.score,
        passed:       payload.passed,
        // Best score ever
        bestScore:    Math.max(payload.score, existing?.bestScore || 0),
        // Total attempts counter
        totalAttempts: allAttempts.length,
        lastAttempt:  new Date().toISOString(),
        // Full history of every attempt
        attempts_history: allAttempts.slice(-10), // keep last 10
        // Latest answer breakdown
        answers: payload.answers || [],
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Log error:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
