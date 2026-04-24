// api/auth.js — Authentication endpoints
// POST /api/auth?action=register  → create account
// POST /api/auth?action=login     → login, get token
// POST /api/auth?action=logout    → invalidate token
// GET  /api/auth?action=verify    → verify token, return user info

import {
  getUserByEmail, createUser, verifyPassword,
  createSession, getSession, deleteSession,
} from "./lib/auth.js";

export default async function handler(req, res) {
  const { action } = req.query;

  // ── VERIFY (GET) ───────────────────────────────────────────────────────────
  if (req.method === "GET" && action === "verify") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const session = await getSession(token).catch(() => null);
    if (!session) return res.status(401).json({ ok: false, error: "Session invalid sau expirată" });
    const user = await getUserByEmail(session.email).catch(() => null);
    if (!user) return res.status(401).json({ ok: false, error: "User negăsit" });
    return res.status(200).json({
      ok: true,
      user: { userId: user.userId, email: user.email, name: user.name, role: user.role },
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // ── REGISTER ──────────────────────────────────────────────────────────────
  if (action === "register") {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email și parolă obligatorii" });
    if (password.length < 6) return res.status(400).json({ error: "Parola trebuie să aibă minim 6 caractere" });
    if (!email.includes("@")) return res.status(400).json({ error: "Email invalid" });

    try {
      const user = await createUser({ email, password, name: name || email.split("@")[0] });
      const token = await createSession(user.userId, user.email);
      return res.status(200).json({
        ok: true,
        token,
        user: { userId: user.userId, email: user.email, name: user.name, role: user.role },
      });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  }

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  if (action === "login") {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email și parolă obligatorii" });

    const user = await getUserByEmail(email).catch(() => null);
    if (!user) return res.status(401).json({ ok: false, error: "Email sau parolă incorecte" });

    const valid = await verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!valid) return res.status(401).json({ ok: false, error: "Email sau parolă incorecte" });

    const token = await createSession(user.userId, user.email);
    return res.status(200).json({
      ok: true,
      token,
      user: { userId: user.userId, email: user.email, name: user.name, role: user.role },
    });
  }

  // ── LOGOUT ────────────────────────────────────────────────────────────────
  if (action === "logout") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) await deleteSession(token).catch(() => {});
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Action necunoscută" });
}
