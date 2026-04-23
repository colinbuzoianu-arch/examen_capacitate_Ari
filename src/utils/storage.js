const PREFIX = "en2026_";

export function lsGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function lsSet(key, val) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(val));
    return true;
  } catch {
    return false;
  }
}

export function lsDel(key) {
  try {
    localStorage.removeItem(PREFIX + key);
    return true;
  } catch {
    return false;
  }
}
