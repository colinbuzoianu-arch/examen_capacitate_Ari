// api/admin-users.js — Admin endpoint: list all users + their progress
// Protected by ADMIN_SECRET env var

import { getAllUsers } from "./lib/auth.js";
import { redisCmd, getAllChapterStats } from "./lib/redis.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  // Admin auth
  const auth = req.headers.authorization?.replace("Bearer ", "");
  if (auth !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const users = await getAllUsers();

    // For each user, get their progress summary
    const usersWithProgress = await Promise.all(users.map(async u => {
      try {
        const progressVal = await redisCmd("GET", `data:${u.userId}:unlocked`).catch(() => null);
        const progress = progressVal ? JSON.parse(progressVal) : {};
        const unlockedCount = Object.keys(progress).length;

        const gamVal = await redisCmd("GET", `data:${u.userId}:gamification`).catch(() => null);
        const gam = gamVal ? JSON.parse(gamVal) : {};

        const chapterStats = await getAllChapterStats(u.userId).catch(() => ({}));
        const quizzesPassed = Object.values(chapterStats).filter(s => s.passed).length;
        const avgScore = Object.values(chapterStats).length > 0
          ? Math.round(Object.values(chapterStats).reduce((a, s) => a + (s.score || 0), 0) / Object.values(chapterStats).length * 10) / 10
          : null;

        return {
          ...u,
          stats: {
            unlockedChapters: unlockedCount,
            totalXP: gam.totalXP || 0,
            currentStreak: gam.currentStreak || 0,
            quizzesPassed,
            avgQuizScore: avgScore,
            lastSeen: gam.lastStudyDate || null,
          },
        };
      } catch {
        return { ...u, stats: {} };
      }
    }));

    // Sort by progress descending
    usersWithProgress.sort((a, b) => (b.stats.unlockedChapters || 0) - (a.stats.unlockedChapters || 0));

    return res.status(200).json({ ok: true, users: usersWithProgress });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
