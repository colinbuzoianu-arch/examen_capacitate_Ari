// cloudStorage.js — Per-user storage via Redis (replaces localStorage)
// Falls back to localStorage for offline/unauth scenarios

// localStorage fallback — defined FIRST to avoid temporal dead zone
const P = "en2026_";
const ls = {
  get: (k) => { try { const v = localStorage.getItem(P + k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch {} },
};

let _token = null;
export function setAuthToken(token) { _token = token; }

// Write-through cache to avoid excessive API calls
const cache = {};

export async function cloudGet(key) {
  if (cache[key] !== undefined) return cache[key];
  if (!_token) return ls.get(key);

  try {
    const res = await fetch(`/api/progress?key=${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${_token}` },
    });
    const data = await res.json();
    const val = data.value ?? null;
    cache[key] = val;
    return val;
  } catch {
    return ls.get(key);
  }
}

export async function cloudSet(key, value) {
  cache[key] = value;
  ls.set(key, value); // always keep local copy for instant reads

  if (!_token) return;
  try {
    await fetch("/api/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${_token}`,
      },
      body: JSON.stringify({ key, value }),
    });
  } catch (err) {
    console.warn("cloudSet failed:", err.message);
  }
}

export function invalidateCache(key) { delete cache[key]; }
export function clearCache() { Object.keys(cache).forEach(k => delete cache[k]); }
