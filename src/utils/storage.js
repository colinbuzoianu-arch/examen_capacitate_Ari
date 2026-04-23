const P = "en2026_";
export const ls = {
  get: (k)    => { try { const v = localStorage.getItem(P+k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(P+k, JSON.stringify(v)); } catch {} },
  del: (k)    => { try { localStorage.removeItem(P+k); } catch {} },
};
