// api/lib/redis.js — Upstash Redis REST API wrapper
// Exported redisCmd for use by auth.js

const url   = () => process.env.ari_KV_REST_API_URL;
const token = () => process.env.ari_KV_REST_API_TOKEN;

export async function redisCmd(...args) {
  const res = await fetch(url(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Redis ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.result;
}

export async function pushLog(entry) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `logs:${day}`;
  await redisCmd("LPUSH", key, JSON.stringify({ ...entry, ts: new Date().toISOString() }));
  await redisCmd("LTRIM", key, 0, 499);
  await redisCmd("EXPIRE", key, 60 * 60 * 24 * 90);
}

export async function getLogsForDay(day) {
  const key = `logs:${day}`;
  const raw = await redisCmd("LRANGE", key, 0, 499);
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
}

export async function getLogDays() {
  const result = await redisCmd("KEYS", "logs:*");
  if (!result || !Array.isArray(result)) return [];
  return result.map(k => k.replace("logs:", "")).sort().reverse().slice(0, 30);
}

export async function setChapterStat(userId, chapterId, data) {
  await redisCmd("SET", `chapterstat:${userId}:${chapterId}`, JSON.stringify(data));
}

export async function getChapterStat(userId, chapterId) {
  const val = await redisCmd("GET", `chapterstat:${userId}:${chapterId}`);
  if (!val) return null;
  return typeof val === "string" ? JSON.parse(val) : val;
}

export async function getAllChapterStats(userId) {
  const keys = await redisCmd("KEYS", `chapterstat:${userId}:*`);
  if (!keys || !Array.isArray(keys) || keys.length === 0) return {};
  const result = {};
  for (const key of keys) {
    const val = await redisCmd("GET", key);
    if (val) {
      try {
        const chId = key.replace(`chapterstat:${userId}:`, "");
        result[chId] = typeof val === "string" ? JSON.parse(val) : val;
      } catch {}
    }
  }
  return result;
}
