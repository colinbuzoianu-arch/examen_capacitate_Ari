// cloudStorage.js — Per-user storage via Redis
// ls defined FIRST to avoid temporal dead zone

const P = "en2026_";
const ls = {
  get: (k) => { try { const v = localStorage.getItem(P + k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch {} },
};

// Token set immediately — not async
let _token = localStorage.getItem("en2026_token") || null;
export function setAuthToken(token) { _token = token; }

const cache = {};

export async function cloudGet(key) {
  if (cache[key] !== undefined) return cache[key];
  const local = ls.get(key);
  if (!_token) return local;
  try {
    const fetchPromise = fetch(`/api/progress?key=${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${_token}` },
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 3000)
    );
    const res = await Promise.race([fetchPromise, timeoutPromise]);
    if (!res.ok) return local;
    const data = await res.json();
    const val = data.value ?? null;
    cache[key] = val;
    // Populate localStorage so sync reads (ls.get) work immediately after
    if (val !== null) ls.set(key, val);
    return val;
  } catch {
    return local;
  }
}

// Preload all user data from cloud into localStorage + cache before app renders.
// Called once after login/session restore. Ensures ls.get() works on new devices.
export async function preloadFromCloud(token) {
  if (!token) return;
  _token = token;
  const chapterIds = ["r1","r2","r3","r4","r5","r6","r7","m1","m2","m3","m4","m5","m6","m7","m8"];
  const keys = ["unlocked", "gamification", ...chapterIds.map(k => `chapter_${k}`)];
  await Promise.allSettled(keys.map(key => cloudGet(key)));
}

export async function cloudSet(key, value) {
  cache[key] = value;
  ls.set(key, value);
  if (!_token) return;
  try {
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${_token}` },
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) console.warn("[cloudSet] failed:", res.status);
  } catch (err) {
    console.warn("[cloudSet] error:", err.message);
  }
}

export function invalidateCache(key) { delete cache[key]; }
export function clearCache() { Object.keys(cache).forEach(k => delete cache[k]); }
