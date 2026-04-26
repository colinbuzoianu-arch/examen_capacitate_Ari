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
  if (!_token) return ls.get(key);
  try {
    const res = await fetch(`/api/progress?key=${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${_token}` },
    });
    if (!res.ok) return ls.get(key);
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
  ls.set(key, value);
  if (!_token) return;
  try {
    // Compress screenshots before sending to avoid 4.5MB Vercel body limit
    let sendValue = value;
    if (key.startsWith("chapter_") && value?.screenshots?.length) {
      const compressed = await compressScreenshots(value.screenshots);
      sendValue = { ...value, screenshots: compressed, screenshot: compressed[0] || null };
      // Also update localStorage with compressed version
      ls.set(key, sendValue);
      cache[key] = sendValue;
    }
    const body = JSON.stringify({ key, value: sendValue });
    // Check size — skip if over 3MB
    if (body.length > 3 * 1024 * 1024) {
      console.warn(`[cloudSet] ${key} too large (${Math.round(body.length/1024)}KB), skipping screenshots`);
      const small = { ...sendValue, screenshots: [], screenshot: null };
      await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${_token}` },
        body: JSON.stringify({ key, value: small }),
      });
      return;
    }
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${_token}` },
      body,
    });
    if (!res.ok) console.warn("[cloudSet] failed:", res.status);
  } catch (err) {
    console.warn("[cloudSet] error:", err.message);
  }
}

// Compress image to max ~200KB
async function compressImage(base64) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 800;
      let { width: w, height: h } = img;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

async function compressScreenshots(screenshots) {
  return Promise.all(screenshots.map(compressImage));
}

export function invalidateCache(key) { delete cache[key]; }
export function clearCache() { Object.keys(cache).forEach(k => delete cache[k]); }
