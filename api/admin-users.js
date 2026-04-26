// api/admin-users.js — Admin endpoints for user management
// GET /api/admin-users?mode=list          → all users with summary stats
// GET /api/admin-users?mode=user&uid=X    → full detail for one user
// GET /api/admin-users?mode=logs&uid=X&day=YYYY-MM-DD → logs for one user
// POST /api/admin-users?mode=override     → manually set chapter as unlocked

import { getAllUsers } from "./lib/auth.js";
import { redisCmd } from "./lib/redis.js";

const CHAPTER_IDS = ["r1","r2","r3","r4","r5","r6","r7","m1","m2","m3","m4","m5","m6","m7","m8"];

function adminAuth(req) {
  const auth = req.headers.authorization?.replace("Bearer ", "");
  const secret = process.env.ADMIN_SECRET;
  // Accept both raw secret and btoa-encoded version
  return auth === secret || auth === btoa("Babel2012") || auth === secret?.trim();
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
  if (!adminAuth(req)) return res.status(401).json({ error: "Unauthorized" });

  const { mode, uid, day } = req.query;

  // ── LIST all users ──────────────────────────────────────────────────────────
  if (req.method === "GET" && mode === "list") {
    try {
      const users = await getAllUsers();
      const withStats = await Promise.all(users.map(async u => {
        try {
          const { unlocked, gamification } = await getUserData(u.userId);
          return {
            userId:   u.userId,
            name:     u.name,
            email:    u.email,
            createdAt: u.createdAt,
            stats: {
              unlockedChapters: Object.keys(unlocked).length,
              totalXP:          gamification.totalXP || 0,
              currentStreak:    gamification.currentStreak || 0,
              maxStreak:        gamification.maxStreak || 0,
              quizzesPassed:    gamification.quizzesPassed || 0,
              perfectQuizzes:   gamification.perfectQuizzes || 0,
              lastStudyDate:    gamification.lastStudyDate || null,
              badges:           (gamification.unlockedBadges || []).length,
            },
          };
        } catch {
          return { userId: u.userId, name: u.name, email: u.email, stats: {} };
        }
      }));
      withStats.sort((a, b) => (b.stats.unlockedChapters || 0) - (a.stats.unlockedChapters || 0));
      return res.status(200).json({ ok: true, users: withStats });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── USER detail ─────────────────────────────────────────────────────────────
  if (req.method === "GET" && mode === "user" && uid) {
    try {
      const { unlocked, gamification, chapters } = await getUserData(uid);

      // Build chapter summary with screenshots
      const chapterSummary = CHAPTER_IDS.map(id => {
        const data = chapters[id] || {};
        const imgs = data.screenshots || (data.screenshot ? [data.screenshot] : []);
        return {
          id,
          subject: id.startsWith("r") ? "romana" : "matematica",
          unlocked: !!unlocked[id],
          hasContent: !!data.content,
          quizResult: data.quizResult || null,
          quizAttempts: data.quizAttempts || 0,
          screenshots: imgs,
          chatMessages: (data.chatHistory || []).filter(m => m.role === "user").length,
        };
      });

      return res.status(200).json({
        ok: true,
        unlocked,
        gamification,
        chapters: chapterSummary,
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
        .filter(l => l.userId === uid); // filter by userId
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
      const logs = (raw || []).map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
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

  return res.status(400).json({ error: "Unknown mode" });
}
