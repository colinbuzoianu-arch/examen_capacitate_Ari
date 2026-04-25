// gamification.js — XP, streak, badges
import { ls } from "./storage.js";

// ── XP VALUES ─────────────────────────────────────────────────────────────────
export const XP = {
  CONTENT_READ:     10,   // opened & read a lesson
  CHAT_MESSAGE:     5,    // asked tutor a question
  QUIZ_ATTEMPT:     15,   // took a quiz (any score)
  QUIZ_PASS:        50,   // passed quiz 8/10+
  QUIZ_PERFECT:     100,  // got 10/10
  SCREENSHOT:       20,   // uploaded proof
  CHAPTER_UNLOCK:   75,   // full chapter completed
  DAILY_STREAK_3:   30,   // 3-day streak bonus
  DAILY_STREAK_7:   100,  // 7-day streak bonus
};

// ── BADGES ────────────────────────────────────────────────────────────────────
export const BADGES = [
  {
    id: "first_step",
    icon: "🚀",
    name: "Prima Rachetă",
    desc: "Ai deschis prima lecție",
    condition: (s) => s.totalXP >= XP.CONTENT_READ,
    xpReward: 0,
  },
  {
    id: "quiz_warrior",
    icon: "⚔️",
    name: "Quiz Warrior",
    desc: "Ai trecut primul quiz cu 8/10+",
    condition: (s) => s.quizzesPassed >= 1,
    xpReward: 25,
  },
  {
    id: "perfect_score",
    icon: "💎",
    name: "Diamant",
    desc: "10/10 la un quiz — impecabil!",
    condition: (s) => s.perfectQuizzes >= 1,
    xpReward: 50,
  },
  {
    id: "streak_3",
    icon: "🔥",
    name: "On Fire",
    desc: "3 zile consecutive de studiu",
    condition: (s) => s.maxStreak >= 3,
    xpReward: 30,
  },
  {
    id: "streak_7",
    icon: "⚡",
    name: "Fulger",
    desc: "7 zile consecutive — ești legendă!",
    condition: (s) => s.maxStreak >= 7,
    xpReward: 100,
  },
  {
    id: "halfway",
    icon: "🏃",
    name: "La Jumătate",
    desc: "Ai bifat 50% din capitole",
    condition: (s) => s.chaptersUnlocked >= 8,
    xpReward: 50,
  },
  {
    id: "romana_master",
    icon: "📖",
    name: "Maestru Română",
    desc: "Toate capitolele de Română bifate",
    condition: (s) => s.romanaComplete,
    xpReward: 150,
  },
  {
    id: "mate_master",
    icon: "📐",
    name: "Maestru Matematică",
    desc: "Toate capitolele de Matematică bifate",
    condition: (s) => s.mateComplete,
    xpReward: 150,
  },
  {
    id: "screenshot_pro",
    icon: "📸",
    name: "Screenshot Pro",
    desc: "5 dovezi încărcate — organizat!",
    condition: (s) => s.screenshots >= 5,
    xpReward: 30,
  },
  {
    id: "curious_mind",
    icon: "🧠",
    name: "Mintea Curioasă",
    desc: "10 întrebări puse tutorelui",
    condition: (s) => s.chatMessages >= 10,
    xpReward: 40,
  },
  {
    id: "en_ready",
    icon: "🏆",
    name: "EN Ready",
    desc: "Toate capitolele bifate — ești gata!",
    condition: (s) => s.chaptersUnlocked >= 15,
    xpReward: 500,
  },
];

// ── LEVEL THRESHOLDS ──────────────────────────────────────────────────────────
export const LEVELS = [
  { level: 1, name: "Începător",    minXP: 0,    icon: "🌱" },
  { level: 2, name: "Elev Serios",  minXP: 100,  icon: "📚" },
  { level: 3, name: "Studiosul",    minXP: 250,  icon: "🎯" },
  { level: 4, name: "Cercetașul",   minXP: 500,  icon: "🔍" },
  { level: 5, name: "Campionul",    minXP: 900,  icon: "🏅" },
  { level: 6, name: "Maestrul EN",  minXP: 1400, icon: "🏆" },
];

// ── STATE HELPERS ─────────────────────────────────────────────────────────────
export function getGamState() {
  return ls.get("gamification") || {
    totalXP: 0,
    quizzesPassed: 0,
    perfectQuizzes: 0,
    screenshots: 0,
    chatMessages: 0,
    chaptersUnlocked: 0,
    romanaComplete: false,
    mateComplete: false,
    currentStreak: 0,
    maxStreak: 0,
    lastStudyDate: null,
    unlockedBadges: [],
    xpLog: [],       // last 20 XP events for feed
    newBadges: [],   // badges unlocked since last view (for notification)
  };
}

export function saveGamState(state) {
  ls.set("gamification", state);
}

// ── STREAK ────────────────────────────────────────────────────────────────────
export function updateStreak(state) {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (state.lastStudyDate === today) return state; // already counted today

  const newStreak = state.lastStudyDate === yesterday
    ? state.currentStreak + 1
    : 1; // reset

  const maxStreak = Math.max(newStreak, state.maxStreak || 0);
  return { ...state, currentStreak: newStreak, maxStreak, lastStudyDate: today };
}

// ── ADD XP ────────────────────────────────────────────────────────────────────
export function addXP(amount, reason) {
  let state = getGamState();
  state = updateStreak(state);
  state.totalXP = (state.totalXP || 0) + amount;

  // XP log
  state.xpLog = [{ amount, reason, ts: new Date().toISOString() }, ...(state.xpLog || [])].slice(0, 20);

  // Streak bonuses
  if (state.currentStreak === 3 && !state.unlockedBadges.includes("streak_3_xp")) {
    state.totalXP += XP.DAILY_STREAK_3;
    state.xpLog = [{ amount: XP.DAILY_STREAK_3, reason: "Bonus streak 3 zile! 🔥", ts: new Date().toISOString() }, ...state.xpLog].slice(0, 20);
    state.unlockedBadges = [...(state.unlockedBadges || []), "streak_3_xp"];
  }
  if (state.currentStreak === 7 && !state.unlockedBadges.includes("streak_7_xp")) {
    state.totalXP += XP.DAILY_STREAK_7;
    state.xpLog = [{ amount: XP.DAILY_STREAK_7, reason: "Bonus streak 7 zile! ⚡", ts: new Date().toISOString() }, ...state.xpLog].slice(0, 20);
    state.unlockedBadges = [...(state.unlockedBadges || []), "streak_7_xp"];
  }

  // Check new badges
  const newlyUnlocked = BADGES.filter(b =>
    !state.unlockedBadges.includes(b.id) && b.condition(state)
  );
  for (const badge of newlyUnlocked) {
    state.unlockedBadges = [...state.unlockedBadges, badge.id];
    state.newBadges = [...(state.newBadges || []), badge.id];
    if (badge.xpReward > 0) {
      state.totalXP += badge.xpReward;
      state.xpLog = [{ amount: badge.xpReward, reason: `Badge: ${badge.icon} ${badge.name}`, ts: new Date().toISOString() }, ...state.xpLog].slice(0, 20);
    }
  }

  saveGamState(state);
  return { state, newBadges: newlyUnlocked };
}

// ── RECORD EVENTS ─────────────────────────────────────────────────────────────
export function recordContentRead() {
  let state = getGamState();
  return addXP(XP.CONTENT_READ, "Lecție citită 📚");
}

export function recordChatMessage() {
  let state = getGamState();
  state.chatMessages = (state.chatMessages || 0) + 1;
  saveGamState(state);
  return addXP(XP.CHAT_MESSAGE, "Întrebare adresată tutorelui 💬");
}

export function recordQuizAttempt(score, passed) {
  let state = getGamState();
  if (passed) state.quizzesPassed = (state.quizzesPassed || 0) + 1;
  if (score === 10) state.perfectQuizzes = (state.perfectQuizzes || 0) + 1;
  saveGamState(state);
  if (score === 10) return addXP(XP.QUIZ_PERFECT, `Quiz PERFECT 10/10! 💎`);
  if (passed)       return addXP(XP.QUIZ_PASS,    `Quiz trecut ${score}/10 🧠`);
  return addXP(XP.QUIZ_ATTEMPT, `Quiz încercat ${score}/10`);
}

// Re-sync badges from actual chapter data in localStorage
export function resyncBadges() {
  const P = "en2026_";
  const ls = (k) => { try { const v = localStorage.getItem(P+k); return v ? JSON.parse(v) : null; } catch { return null; } };

  let state = getGamState();
  let changed = false;

  const allIds = ["r1","r2","r3","r4","r5","r6","r7","m1","m2","m3","m4","m5","m6","m7","m8"];
  let quizzesPassed = 0, perfectQuizzes = 0, screenshots = 0;

  allIds.forEach(id => {
    const ch = ls(`chapter_${id}`);
    if (!ch) return;
    if (ch.quizResult?.passed) quizzesPassed++;
    if (ch.quizResult?.score === 10) perfectQuizzes++;
    if (ch.screenshot) screenshots++;
  });

  if (quizzesPassed > (state.quizzesPassed || 0)) { state.quizzesPassed = quizzesPassed; changed = true; }
  if (perfectQuizzes > (state.perfectQuizzes || 0)) { state.perfectQuizzes = perfectQuizzes; changed = true; }
  if (screenshots > (state.screenshots || 0)) { state.screenshots = screenshots; changed = true; }

  if (!changed) return state;

  const newlyUnlocked = BADGES.filter(b =>
    !state.unlockedBadges.includes(b.id) && b.condition(state)
  );
  for (const badge of newlyUnlocked) {
    state.unlockedBadges = [...(state.unlockedBadges || []), badge.id];
    state.newBadges = [...(state.newBadges || []), badge.id];
    if (badge.xpReward > 0) state.totalXP = (state.totalXP || 0) + badge.xpReward;
  }

  saveGamState(state);
  return state;
}

export function recordScreenshot() {
  let state = getGamState();
  state.screenshots = (state.screenshots || 0) + 1;
  saveGamState(state);
  return addXP(XP.SCREENSHOT, "Screenshot urcat 📸");
}

export function recordChapterUnlock(chaptersUnlocked, romanaComplete, mateComplete) {
  let state = getGamState();
  state.chaptersUnlocked = chaptersUnlocked;
  state.romanaComplete = romanaComplete;
  state.mateComplete = mateComplete;
  saveGamState(state);
  return addXP(XP.CHAPTER_UNLOCK, "Capitol bifat! 🏆");
}

// ── COMPUTED ──────────────────────────────────────────────────────────────────
export function getLevel(totalXP) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVELS[i].minXP) return LEVELS[i];
  }
  return LEVELS[0];
}

export function getNextLevel(totalXP) {
  for (let i = 0; i < LEVELS.length; i++) {
    if (totalXP < LEVELS[i].minXP) return LEVELS[i];
  }
  return null; // max level
}

export function getLevelProgress(totalXP) {
  const cur = getLevel(totalXP);
  const next = getNextLevel(totalXP);
  if (!next) return 100;
  const range = next.minXP - cur.minXP;
  const progress = totalXP - cur.minXP;
  return Math.round((progress / range) * 100);
}

export function clearNewBadges() {
  const state = getGamState();
  state.newBadges = [];
  saveGamState(state);
}
