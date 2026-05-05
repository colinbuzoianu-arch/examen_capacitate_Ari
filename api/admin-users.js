// api/admin-users.js — Admin endpoints for user management
// GET /api/admin-users?mode=list          → all users with summary stats
// GET /api/admin-users?mode=user&uid=X    → full detail for one user
// GET /api/admin-users?mode=logs&uid=X&day=YYYY-MM-DD → logs for one user
// POST /api/admin-users?mode=override     → manually set chapter as unlocked

import { getAllUsers, getSession } from "./lib/auth.js";
import { redisCmd } from "./lib/redis.js";

const CHAPTER_IDS = ["r1","r2","r3","r4","r5","r6","r7","m1","m2","m3","m4","m5","m6","m7","m8"];
const TOTAL_CHAPTERS = CHAPTER_IDS.length;

function adminAuth(req) {
  const auth = req.headers.authorization?.replace("Bearer ", "");
  const secret = process.env.ADMIN_SECRET;
  // Frontend sends btoa(password), so compare against both raw and b64
  return secret && (auth === secret || auth === btoa(secret) || auth === secret.trim());
}

// Read userId from a log entry, supporting both flat (new) and nested (legacy) shapes
function logUserId(l) {
  return l?.userId || l?.payload?.userId || null;
}


function asTime(v) {
  if (!v) return 0;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function latestIso(...values) {
  const best = values.map(asTime).filter(Boolean).sort((a, b) => b - a)[0];
  return best ? new Date(best).toISOString() : null;
}

function latestArea(gamification, featureUsage) {
  const candidates = [
    { area: "Lecții / quiz", ts: gamification?.lastStudyDate ? `${gamification.lastStudyDate}T12:00:00Z` : null },
    { area: "Compunere", ts: featureUsage?.essay?.lastUsed || null },
    { area: "Probleme", ts: featureUsage?.math?.lastUsed || null },
  ].filter(c => asTime(c.ts));
  candidates.sort((a, b) => asTime(b.ts) - asTime(a.ts));
  return candidates[0]?.area || null;
}

function emptyFeatureUsage() {
  return {
    essay: {
      tabOpened: 0,
      promptsGenerated: 0,
      draftsStarted: 0,
      evaluationsSubmitted: 0,
      evaluationsCompleted: 0,
      wordsTotal: 0,
      bestScore: null,
      lastUsed: null,
      chapters: {},
    },
    math: {
      tabOpened: 0,
      setsGenerated: 0,
      solutionsRevealed: 0,
      solutionsSubmitted: 0,
      evaluationsCompleted: 0,
      scoreTotal: 0,
      bestScore: null,
      lastUsed: null,
      chapters: {},
    },
  };
}

function ensureFeatureUsage(u) {
  const base = emptyFeatureUsage();
  return {
    essay: { ...base.essay, ...(u?.essay || {}), chapters: { ...(u?.essay?.chapters || {}) } },
    math: { ...base.math, ...(u?.math || {}), chapters: { ...(u?.math?.chapters || {}) } },
  };
}

function incChapter(usage, feature, chapterId, field) {
  if (!chapterId) return;
  usage[feature].chapters[chapterId] = usage[feature].chapters[chapterId] || {};
  usage[feature].chapters[chapterId][field] = (usage[feature].chapters[chapterId][field] || 0) + 1;
  usage[feature].chapters[chapterId].lastUsed = new Date().toISOString();
}

function applyFeatureEvent(usage, eventType, payload = {}) {
  const now = new Date().toISOString();
  const chapterId = payload.chapterId || "unknown";
  const wordCount = Number(payload.wordCount || 0);
  const score = payload.score === undefined || payload.score === null ? null : Number(payload.score);

  if (eventType.startsWith("essay_")) usage.essay.lastUsed = now;
  if (eventType.startsWith("math_")) usage.math.lastUsed = now;

  switch (eventType) {
    case "essay_tab_opened":
      usage.essay.tabOpened += 1; incChapter(usage, "essay", chapterId, "tabOpened"); break;
    case "essay_prompt_generated":
      usage.essay.promptsGenerated += 1; incChapter(usage, "essay", chapterId, "promptsGenerated"); break;
    case "essay_draft_started":
      usage.essay.draftsStarted += 1; incChapter(usage, "essay", chapterId, "draftsStarted"); break;
    case "essay_evaluation_submitted":
      usage.essay.evaluationsSubmitted += 1; usage.essay.wordsTotal += wordCount; incChapter(usage, "essay", chapterId, "evaluationsSubmitted"); break;
    case "essay_evaluation_completed":
      usage.essay.evaluationsCompleted += 1; usage.essay.wordsTotal += wordCount; usage.essay.bestScore = usage.essay.bestScore === null ? score : Math.max(usage.essay.bestScore, score || 0); incChapter(usage, "essay", chapterId, "evaluationsCompleted"); break;
    case "math_tab_opened":
      usage.math.tabOpened += 1; incChapter(usage, "math", chapterId, "tabOpened"); break;
    case "math_set_generated":
      usage.math.setsGenerated += 1; incChapter(usage, "math", chapterId, "setsGenerated"); break;
    case "math_solution_revealed":
      usage.math.solutionsRevealed += 1; incChapter(usage, "math", chapterId, "solutionsRevealed"); break;
    case "math_solution_submitted":
      usage.math.solutionsSubmitted += 1; incChapter(usage, "math", chapterId, "solutionsSubmitted"); break;
    case "math_solution_evaluated":
      usage.math.evaluationsCompleted += 1; usage.math.scoreTotal += score || 0; usage.math.bestScore = usage.math.bestScore === null ? score : Math.max(usage.math.bestScore, score || 0); incChapter(usage, "math", chapterId, "evaluationsCompleted"); break;
    default:
      break;
  }
  return usage;
}

async function getUserData(userId) {
  const get = async (key) => {
    try {
      const val = await redisCmd("GET", `data:${userId}:${key}`);
      if (!val) return null;
      return typeof val === "string" ? JSON.parse(val) : val;
    } catch { return null; }
  };

  const [unlocked, gamification] = await Promise.all([
    get("unlocked"),
    get("gamification"),
  ]);

  // Load all chapter data
  const chapters = {};
  await Promise.all(CHAPTER_IDS.map(async id => {
    const data = await get(`chapter_${id}`);
    if (data) chapters[id] = data;
  }));

  return { unlocked: unlocked || {}, gamification: gamification || {}, chapters };
}

export default async function handler(req, res) {
  const { mode, uid, day } = req.query;

  // ── WRITE a log entry (called by the student app, NOT an admin route) ───────
  // Auth: validates the student's own session token (Authorization: Bearer <token>)
  // We flatten userId/userName to the top level so the existing read paths
  // (mode=logs filter and LogsView field access) work without further changes.
  if (req.method === "POST" && mode === "log") {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const session = await getSession(token).catch(() => null);
      if (!session?.userId) return res.status(401).json({ error: "Unauthorized" });

      const { type, payload } = req.body || {};
      if (!type) return res.status(400).json({ error: "Missing type" });

      const safePayload = (payload && typeof payload === "object") ? payload : {};
      // Server is the source of truth for userId — never trust the client's claim
      const entry = {
        ...safePayload,
        type,
        userId: session.userId,
        userName: safePayload.userName || "",
        ts: new Date().toISOString(),
      };

      const today = new Date().toISOString().slice(0, 10);
      const key = `logs:${today}`;
      await redisCmd("LPUSH", key, JSON.stringify(entry));
      await redisCmd("LTRIM", key, 0, 499);
      await redisCmd("EXPIRE", key, 60 * 60 * 24 * 90);

      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── WRITE feature usage aggregate (called by the student app) ─────────────
  if (req.method === "POST" && mode === "track-feature") {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");
      const session = await getSession(token).catch(() => null);
      if (!session?.userId) return res.status(401).json({ error: "Unauthorized" });

      const { eventType, payload } = req.body || {};
      if (!eventType) return res.status(400).json({ error: "Missing eventType" });

      const key = `featureUsage:${session.userId}`;
      const currentRaw = await redisCmd("GET", key).catch(() => null);
      const current = currentRaw ? (typeof currentRaw === "string" ? JSON.parse(currentRaw) : currentRaw) : null;
      const usage = applyFeatureEvent(ensureFeatureUsage(current), eventType, payload || {});
      usage.updatedAt = new Date().toISOString();

      await redisCmd("SET", key, JSON.stringify(usage));
      await redisCmd("EXPIRE", key, 365 * 24 * 3600);

      // Also keep a compact event log for later debugging.
      const today = new Date().toISOString().slice(0, 10);
      await redisCmd("LPUSH", `featureEvents:${today}`, JSON.stringify({
        eventType,
        payload: payload || {},
        userId: session.userId,
        userName: session.email,
        ts: new Date().toISOString(),
      }));
      await redisCmd("LTRIM", `featureEvents:${today}`, 0, 999);
      await redisCmd("EXPIRE", `featureEvents:${today}`, 90 * 24 * 3600);

      return res.status(200).json({ ok: true, usage });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // All routes below are admin-only
  if (!adminAuth(req)) return res.status(401).json({ error: "Unauthorized" });

  // ── LIST all users ──────────────────────────────────────────────────────────
  if (req.method === "GET" && mode === "list") {
    try {
      const users = await getAllUsers();
      const withStats = await Promise.all(users.map(async u => {
        try {
          const { unlocked, gamification } = await getUserData(u.userId);
          const featureRaw = await redisCmd("GET", `featureUsage:${u.userId}`).catch(() => null);
          const featureUsage = ensureFeatureUsage(featureRaw ? (typeof featureRaw === "string" ? JSON.parse(featureRaw) : featureRaw) : null);
          const unlockedCount = Object.keys(unlocked).length;
          const essayEvaluations = featureUsage.essay.evaluationsCompleted || 0;
          const essayPrompts = featureUsage.essay.promptsGenerated || 0;
          const mathEvaluations = featureUsage.math.evaluationsCompleted || 0;
          const mathSets = featureUsage.math.setsGenerated || 0;
          const mathSubmitted = featureUsage.math.solutionsSubmitted || 0;
          const lastStudyAt = gamification.lastStudyDate ? `${gamification.lastStudyDate}T12:00:00Z` : null;
          const featureLastUsed = latestIso(featureUsage.updatedAt, featureUsage.essay.lastUsed, featureUsage.math.lastUsed);
          const lastActiveAt = latestIso(lastStudyAt, featureLastUsed, u.createdAt);
          const engagementScore =
            unlockedCount * 3 +
            (gamification.quizzesPassed || 0) * 3 +
            mathSets +
            mathEvaluations * 2 +
            essayEvaluations * 3;

          return {
            userId:   u.userId,
            name:     u.name,
            email:    u.email,
            createdAt: u.createdAt,
            blocked:  !!u.blocked,
            premium:  !!u.premium,
            stats: {
              unlockedChapters: unlockedCount,
              progressPercent:  Math.round((unlockedCount / TOTAL_CHAPTERS) * 100),
              totalXP:          gamification.totalXP || 0,
              currentStreak:    gamification.currentStreak || 0,
              maxStreak:        gamification.maxStreak || 0,
              quizzesPassed:    gamification.quizzesPassed || 0,
              perfectQuizzes:   gamification.perfectQuizzes || 0,
              lastStudyDate:    gamification.lastStudyDate || null,
              badges:           (gamification.unlockedBadges || []).length,
              essayPrompts,
              essayEvaluations,
              mathEvaluations,
              mathSets,
              mathSubmitted,
              featureLastUsed,
              lastActiveAt,
              lastArea:         latestArea(gamification, featureUsage),
              engagementScore,
            },
          };
        } catch {
          return { userId: u.userId, name: u.name, email: u.email, stats: {} };
        }
      }));
      withStats.sort((a, b) => asTime(b.stats?.lastActiveAt) - asTime(a.stats?.lastActiveAt));
      return res.status(200).json({ ok: true, users: withStats });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── USER detail ─────────────────────────────────────────────────────────────
  if (req.method === "GET" && mode === "user" && uid) {
    try {
      const { unlocked, gamification, chapters } = await getUserData(uid);
      const featureRaw = await redisCmd("GET", `featureUsage:${uid}`).catch(() => null);
      const featureUsage = ensureFeatureUsage(featureRaw ? (typeof featureRaw === "string" ? JSON.parse(featureRaw) : featureRaw) : null);

      // Build chapter summary
      const chapterSummary = CHAPTER_IDS.map(id => {
        const data = chapters[id] || {};
        return {
          id,
          subject: id.startsWith("r") ? "romana" : "matematica",
          unlocked: !!unlocked[id],
          hasContent: !!data.content,
          quizResult: data.quizResult || null,
          quizAttempts: data.quizAttempts || 0,
          chatMessages: (data.chatHistory || []).filter(m => m.role === "user").length,
        };
      });

      return res.status(200).json({
        ok: true,
        unlocked,
        gamification,
        chapters: chapterSummary,
        featureUsage,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── USER logs ───────────────────────────────────────────────────────────────
  if (req.method === "GET" && mode === "logs" && uid) {
    try {
      const targetDay = day || new Date().toISOString().slice(0, 10);
      const raw = await redisCmd("LRANGE", `logs:${targetDay}`, 0, 499);
      const logs = (raw || [])
        .map(r => { try { return JSON.parse(r); } catch { return null; } })
        .filter(Boolean)
        .filter(l => logUserId(l) === uid) // accepts flat or nested payload shape
        .map(l => {
          // Normalize legacy nested shape so the UI sees flat fields
          if (l.payload && typeof l.payload === "object") {
            const { payload, ...rest } = l;
            return { ...payload, ...rest };
          }
          return l;
        });
      return res.status(200).json({ ok: true, logs, day: targetDay });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── LOG DAYS for a user ─────────────────────────────────────────────────────
  if (req.method === "GET" && mode === "logdays" && uid) {
    try {
      const keys = await redisCmd("KEYS", "logs:*");
      const days = (keys || []).map(k => k.replace("logs:", "")).sort().reverse().slice(0, 30);
      return res.status(200).json({ ok: true, days });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── OVERRIDE chapter ────────────────────────────────────────────────────────
  if (req.method === "POST" && mode === "override") {
    const { userId, chapterId, value } = req.body || {};
    if (!userId || !chapterId) return res.status(400).json({ error: "Missing userId or chapterId" });
    try {
      const key = `data:${userId}:unlocked`;
      const current = await redisCmd("GET", key).catch(() => null);
      const unlocked = current ? JSON.parse(current) : {};
      if (value === false) {
        delete unlocked[chapterId];
      } else {
        unlocked[chapterId] = true;
      }
      await redisCmd("SET", key, JSON.stringify(unlocked));
      return res.status(200).json({ ok: true, unlocked });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── DEBUG (replaces admin-debug.js) ───────────────────────────────────────
  if (req.method === "GET" && mode === "debug") {
    try {
      let usersList = null;
      try { usersList = await redisCmd("SMEMBERS", "users:list"); } catch {}
      const userKeys = await redisCmd("KEYS", "user:*").catch(() => []);
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

  // ── LOGS (replaces get-logs.js) ────────────────────────────────────────────
  if (req.method === "GET" && mode === "all-logs") {
    try {
      const { day } = req.query;
      const targetDay = day || new Date().toISOString().slice(0, 10);
      const raw = await redisCmd("LRANGE", `logs:${targetDay}`, 0, 499);
      const logs = (raw || [])
        .map(r => { try { return JSON.parse(r); } catch { return null; } })
        .filter(Boolean)
        .map(l => {
          if (l.payload && typeof l.payload === "object") {
            const { payload, ...rest } = l;
            return { ...payload, ...rest };
          }
          return l;
        });
      return res.status(200).json({ ok: true, logs, day: targetDay });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "GET" && mode === "log-days") {
    try {
      const keys = await redisCmd("KEYS", "logs:*").catch(() => []);
      const days = (keys || []).map(k => k.replace("logs:", "")).sort().reverse().slice(0, 30);
      return res.status(200).json({ ok: true, days });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }


  // ── BLOCK / UNBLOCK user ────────────────────────────────────────────────────
  if (req.method === "POST" && mode === "block") {
    const { userId, blocked } = req.body || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    try {
      const emailKey = await redisCmd("GET", `userid:${userId}`);
      if (!emailKey) return res.status(404).json({ error: "User not found" });
      const userRaw = await redisCmd("GET", `user:${emailKey}`);
      if (!userRaw) return res.status(404).json({ error: "User data not found" });
      const user = typeof userRaw === "string" ? JSON.parse(userRaw) : userRaw;
      user.blocked = !!blocked;
      user.blockedAt = blocked ? new Date().toISOString() : null;
      await redisCmd("SET", `user:${emailKey}`, JSON.stringify(user));
      return res.status(200).json({ ok: true, userId, blocked: !!blocked });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET usage for a user ─────────────────────────────────────────────────────
  // Replaces the missing /api/usage endpoint that AdminApp calls
  if (req.method === "GET" && mode === "usage" && uid) {
    try {
      const usageRaw = await redisCmd("GET", `usage:${uid}`).catch(() => null);
      const usage = usageRaw
        ? (typeof usageRaw === "string" ? JSON.parse(usageRaw) : usageRaw)
        : { lesson: 0, quiz: 0, chat: 0 };
      return res.status(200).json({ ok: true, usage });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GET serious feature usage for a user ───────────────────────────────────
  if (req.method === "GET" && mode === "feature-usage" && uid) {
    try {
      const raw = await redisCmd("GET", `featureUsage:${uid}`).catch(() => null);
      const usage = ensureFeatureUsage(raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null);
      return res.status(200).json({ ok: true, usage });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── RESET usage counters ─────────────────────────────────────────────────────
  if (req.method === "POST" && mode === "reset-usage") {
    const { userId, type } = req.body || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    try {
      const usageRaw = await redisCmd("GET", `usage:${userId}`);
      const usage = usageRaw ? (typeof usageRaw === "string" ? JSON.parse(usageRaw) : usageRaw) : { lesson: 0, quiz: 0, chat: 0 };
      if (type) {
        usage[type] = 0;
      } else {
        usage.lesson = 0; usage.quiz = 0; usage.chat = 0;
      }
      await redisCmd("SET", `usage:${userId}`, JSON.stringify(usage));
      return res.status(200).json({ ok: true, userId, usage });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── GRANT premium access ──────────────────────────────────────────────────────
  if (req.method === "POST" && mode === "grant-premium") {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    try {
      const emailKey = await redisCmd("GET", `userid:${userId}`);
      if (!emailKey) return res.status(404).json({ error: "User not found" });
      const userRaw = await redisCmd("GET", `user:${emailKey}`);
      const user = typeof userRaw === "string" ? JSON.parse(userRaw) : userRaw;
      user.premium = true;
      user.premiumGrantedAt = new Date().toISOString();
      user.premiumSource = "admin";
      await redisCmd("SET", `user:${emailKey}`, JSON.stringify(user));
      // Reset usage so they start fresh
      await redisCmd("SET", `usage:${userId}`, JSON.stringify({ lesson: 0, quiz: 0, chat: 0 }));
      return res.status(200).json({ ok: true, userId, premium: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: "Unknown mode" });
}

// NOTE: Block/unblock and usage reset are appended below
// These modes are handled before the final return above in production —
// we patch them in via the stripe.js and a separate check in admin-users
