// featureTracking.js — server-side usage tracking for admin analytics
// Uses authenticated API route; silently falls back without blocking UI.

function getAuthToken() {
  return localStorage.getItem("en2026_token") || "";
}

export async function trackFeature(eventType, payload = {}) {
  try {
    const token = getAuthToken();
    if (!token || !eventType) return;
    fetch("/api/admin-users?mode=track-feature", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ eventType, payload }),
    }).catch(() => {});
  } catch {}
}
