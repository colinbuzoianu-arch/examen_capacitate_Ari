// api/reset-password.js
// POST /api/reset-password?action=request  → send reset email with token
// POST /api/reset-password?action=confirm  → set new password using token

import { getUserByEmail, hashPassword } from "./lib/auth.js";
import { redisCmd } from "./lib/redis.js";

const TOKEN_TTL = 60 * 60; // 1 hour

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action } = req.query;

  // ── REQUEST RESET ──────────────────────────────────────────────────────────
  if (action === "request") {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "Email obligatoriu" });

    const user = await getUserByEmail(email).catch(() => null);
    // Always return ok — don't reveal if email exists
    if (!user) return res.status(200).json({ ok: true });

    // Generate token
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, "0")).join("");

    // Store token in Redis for 1 hour
    await redisCmd("SET", `reset:${token}`, email.toLowerCase());
    await redisCmd("EXPIRE", `reset:${token}`, TOKEN_TTL);

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Email not configured" });

    const senderEmail = process.env.SENDER_EMAIL || "noreply@en2026.app";
    const appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://examen-capacitate-ari.vercel.app";

    const resetLink = `${appUrl}?reset=${token}`;

    const html = `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"></head>
<body style="margin:0;background:#F0EDE6;font-family:Georgia,serif;padding:32px 16px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #E0DBD0;">
  <div style="text-align:center;margin-bottom:20px;">
    <div style="font-size:36px;">🔑</div>
    <h1 style="font-size:20px;color:#1A1A1A;margin:8px 0 4px;font-family:Georgia,serif;">Resetare parolă</h1>
    <p style="color:#888;font-size:13px;margin:0;">EN 2026 · Evaluarea Națională</p>
  </div>
  <p style="font-size:14px;color:#333;line-height:1.7;">
    Ai solicitat resetarea parolei pentru contul asociat adresei <strong>${email}</strong>.
  </p>
  <div style="text-align:center;margin:24px 0;">
    <a href="${resetLink}" style="display:inline-block;background:#1A1A1A;color:#fff;text-decoration:none;font-weight:700;padding:13px 30px;border-radius:10px;font-size:15px;">
      Setează parola nouă →
    </a>
  </div>
  <p style="font-size:12px;color:#AAA;text-align:center;">
    Link-ul este valabil <strong>1 oră</strong>. Dacă nu ai solicitat tu resetarea, ignoră acest email.
  </p>
</div>
</body>
</html>`;

    try {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: "EN 2026", email: senderEmail },
          to: [{ email: email.toLowerCase() }],
          subject: "🔑 Resetare parolă EN 2026",
          htmlContent: html,
        }),
      });
    } catch {}

    return res.status(200).json({ ok: true });
  }

  // ── CONFIRM RESET ──────────────────────────────────────────────────────────
  if (action === "confirm") {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ error: "Token și parolă obligatorii" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Parola trebuie să aibă minim 6 caractere" });

    // Get email from token
    const email = await redisCmd("GET", `reset:${token}`).catch(() => null);
    if (!email) return res.status(400).json({ error: "Link expirat sau invalid. Solicită un nou link." });

    // Get user and update password
    const user = await getUserByEmail(email).catch(() => null);
    if (!user) return res.status(400).json({ error: "Cont negăsit" });

    const { hash, salt } = await hashPassword(newPassword);
    const updatedUser = { ...user, passwordHash: hash, passwordSalt: salt };
    await redisCmd("SET", `user:${email}`, JSON.stringify(updatedUser));

    // Delete token so it can't be reused
    await redisCmd("DEL", `reset:${token}`);

    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Acțiune necunoscută" });
}
