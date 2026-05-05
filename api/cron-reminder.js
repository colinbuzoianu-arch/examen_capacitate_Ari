// api/cron-reminder.js — Vercel Cron (every Friday 18:00 UTC)
// Sends reminder to all registered users

import { getAllUsers } from "./lib/auth.js";

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "BREVO_API_KEY not configured" });

  const senderEmail = process.env.SENDER_EMAIL || "noreply@en2026.app";
  const senderName  = process.env.SENDER_NAME  || "EN 2026";
  const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://en2026.vercel.app";

  const now = new Date();
  const daysToRo = Math.max(0, Math.ceil((new Date("2026-06-22") - now) / 86400000));
  const daysToMa = Math.max(0, Math.ceil((new Date("2026-06-24") - now) / 86400000));

  let users = [];
  try { users = await getAllUsers(); } catch {}

  const html = (name) => `<!DOCTYPE html>
<html lang="ro"><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#F0EDE6;font-family:Georgia,serif;">
<div style="max-width:520px;margin:0 auto;padding:24px 16px;">
  <div style="background:#1A1A1A;border-radius:20px;overflow:hidden;">
    <div style="padding:24px;text-align:center;">
      <div style="font-size:36px;margin-bottom:8px;">🎓</div>
      <h1 style="color:#C8A84B;font-size:20px;margin:0 0 4px;">Reminder studiu EN 2026</h1>
      <p style="color:#888;font-size:13px;margin:0;">Bună${name ? ` ${name}` : ""}! Este vineri — ai studiat săptămâna asta?</p>
    </div>
    <div style="background:#fff;margin:0 16px;border-radius:12px;padding:18px;">
      <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 14px;">
        Nu uita că pentru a bifa un capitol trebuie să treci <strong>quiz-ul cu minim 8/10</strong>.
      </p>
      <div style="display:flex;gap:10px;margin-bottom:16px;">
        <div style="flex:1;background:#FFF5F5;border-radius:10px;padding:10px;text-align:center;border:1px solid #FFCDD2;">
          <div style="font-size:22px;font-weight:bold;color:#C8392B;">${daysToRo}</div>
          <div style="font-size:11px;color:#C8392B;">zile Română</div>
        </div>
        <div style="flex:1;background:#EEF4FF;border-radius:10px;padding:10px;text-align:center;border:1px solid #BBDEFB;">
          <div style="font-size:22px;font-weight:bold;color:#1A5276;">${daysToMa}</div>
          <div style="font-size:11px;color:#1A5276;">zile Matematică</div>
        </div>
      </div>
      <div style="text-align:center;">
        <a href="${appUrl}" style="display:inline-block;background:#1A1A1A;color:#fff;text-decoration:none;font-weight:bold;padding:12px 28px;border-radius:10px;font-size:14px;">📚 Deschide planul →</a>
      </div>
    </div>
    <div style="padding:12px;text-align:center;"><p style="color:#666;font-size:11px;margin:0;">EN 2026 · Evaluarea Națională</p></div>
  </div>
</div>
</body></html>`;

  let sent = 0;
  for (const user of users) {
    try {
      await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email: user.email }],
          subject: "📚 Reminder studiu – EN 2026",
          htmlContent: html(user.name?.split(" ")[0]),
        }),
      });
      sent++;
    } catch {}
  }

  return res.status(200).json({ ok: true, sent, total: users.length });
}
