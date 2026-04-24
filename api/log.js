// api/log.js — Vercel Serverless Function
// Receives activity events from Ari's app and stores them in Upstash Redis
// Called automatically when Ari: opens a chapter, chats, takes a quiz, uploads screenshot

import { pushLog, setChapterStat } from "./lib/redis.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { type, payload } = req.body;

  if (!type || !payload) {
    return res.status(400).json({ error: "Missing type or payload" });
  }

  // Validate event types
  const VALID_TYPES = [
    "chapter_opened",
    "content_generated",
    "chat_message",
    "quiz_started",
    "quiz_submitted",
    "screenshot_uploaded",
    "chapter_unlocked",
  ];

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: "Invalid event type" });
  }

  try {
    // Push to daily log
    await pushLog({ type, ...payload });

    // For quiz results, also update the chapter stats summary
    if (type === "quiz_submitted" && payload.chapterId) {
      await setChapterStat(payload.chapterId, {
        chapterId: payload.chapterId,
        chapterTitle: payload.chapterTitle,
        subject: payload.subject,
        score: payload.score,
        passed: payload.passed,
        attempts: payload.attempts || 1,
        lastAttempt: new Date().toISOString(),
        answers: payload.answers || [],
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Log error:", err);
    // Don't crash the app if logging fails — just return ok
    return res.status(200).json({ ok: true, warning: "Log stored locally only" });
  }
}
