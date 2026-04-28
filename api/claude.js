// api/claude.js — Vercel Serverless Function
// Proxies to Anthropic API with per-user interaction limits
// Uses claude-haiku for fast/structured tasks (quiz), sonnet for content

import { getSession } from "./lib/auth.js";
import { redisCmd } from "./lib/redis.js";

// ── Limite per cont ───────────────────────────────────────────────────────────
// 15 capitole total (7 Română + 8 Matematică)
// Per capitol: 1 lecție + 1-2 quiz-uri + până la 10 întrebări chat
const LIMITS = {
  lesson: 15,   // 1 lecție per capitol * 15 capitole
  quiz:   30,   // pot reîncerca dacă nu trec (2 încercări per capitol)
  chat:   150,  // ~10 întrebări per capitol * 15 capitole
};

// Conturi fără limite (admin + Ari)
const UNLIMITED_EMAILS = (process.env.UNLIMITED_EMAILS || "colinbuzoianu@gmail.com")
  .split(",").map(e => e.trim().toLowerCase());

// ── Helpers Redis ─────────────────────────────────────────────────────────────
async function getUsage(userId) {
  const val = await redisCmd("GET", `usage:${userId}`);
  if (!val) return { lesson: 0, quiz: 0, chat: 0 };
  return typeof val === "string" ? JSON.parse(val) : val;
}

async function incrementUsage(userId, type) {
  const usage = await getUsage(userId);
  usage[type] = (usage[type] || 0) + 1;
  await redisCmd("SET", `usage:${userId}`, JSON.stringify(usage));
  return usage;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  const { messages, system, max_tokens, fast, interactionType } = req.body;
  if (!messages?.length) return res.status(400).json({ error: "Missing messages" });

  // ── Autentificare utilizator ──────────────────────────────────────────────
  const token =
    req.headers.authorization?.replace("Bearer ", "") ||
    req.cookies?.session;

  const session = token ? await getSession(token).catch(() => null) : null;

  // ── Verificare user blocat ───────────────────────────────────────────────────
  if (session) {
    try {
      const { getUserByEmail } = await import("./lib/auth.js");
      const user = await getUserByEmail(session.email);
      if (user?.blocked) {
        return res.status(403).json({ error: "blocked", message: "Contul tău a fost suspendat. Contactează administratorul." });
      }
      // Attach premium status to session for limit checks
      session._premium = !!user?.premium;
    } catch {}
  }

  // ── Verificare limite ─────────────────────────────────────────────────────
  if (session && !UNLIMITED_EMAILS.includes(session.email?.toLowerCase())) {
    const type = interactionType || "chat"; // lesson | quiz | chat
    // Userii premium au limite de 3x
    const baseLimits = session._premium
      ? { lesson: 45, quiz: 90, chat: 500 }
      : LIMITS;
    const limit = baseLimits[type] ?? baseLimits.chat;
    const usage = await getUsage(session.userId);
    const current = usage[type] || 0;

    if (current >= limit) {
      return res.status(429).json({
        error: "limit_reached",
        type,
        used: current,
        limit,
        message: `Ai folosit toate cele ${limit} interacțiuni disponibile pentru ${type}. Scrie-ne la contact@en26.ro dacă ai nevoie de mai mult acces.`,
      });
    }

    await incrementUsage(session.userId, type);
  }

  // ── Haiku pentru quiz, Sonnet pentru lecții și chat ────────────────────────
  const model = fast ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-5";

  try {
    const body = { model, max_tokens: max_tokens || 2000, messages };
    if (system) body.system = system;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Anthropic error:", data);
      return res.status(response.status).json({ error: data.error?.message || "Anthropic error" });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Claude proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
}
