// api/cron-reminder.js — Vercel Cron Job (runs every Friday at 18:00 UTC)
// Schedule defined in vercel.json: "0 18 * * 5"
// Requires env vars: RESEND_API_KEY, CRON_SECRET

export default async function handler(req, res) {
  // Verify this is called by Vercel Cron (not a random request)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: "RESEND_API_KEY not configured" });
  }

  // Note: Cron jobs can't read localStorage (server-side).
  // We send a general weekly reminder. The app tracks actual progress client-side.
  // For full server-side progress tracking, a database (e.g. Vercel KV) would be needed.

  const appUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://studiu-en2026.vercel.app";

  // Calculate which week we're in
  const now = new Date();
  const start = new Date("2026-04-23");
  const weekNum = Math.max(1, Math.ceil((now - start) / (7 * 86400000)));

  const html = `
<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"/></head>
<body style="background:#111;font-family:Georgia,serif;color:#eee;padding:32px 24px;max-width:520px;margin:0 auto;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="font-size:40px;">🎓</div>
    <h1 style="color:#F1C40F;font-size:22px;margin:8px 0 4px;">Reminder automat – Săptămâna ${weekNum}</h1>
    <p style="color:#888;font-size:13px;">Este vineri! Verifică dacă ai bifat capitolele din această săptămână.</p>
  </div>

  <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:20px;border-left:4px solid #F1C40F;">
    <p style="font-size:14px;color:#ccc;line-height:1.6;margin:0;">
      Hai Ari, mai ai câteva ore în weekend să recuperezi dacă n-ai terminat!
      Deschide aplicația și bifează ce ai studiat în săptămâna aceasta. 💪
    </p>
  </div>

  <div style="text-align:center;margin:24px 0;">
    <a href="${appUrl}" style="background:#F1C40F;color:#111;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px;font-size:15px;display:inline-block;">
      Deschide planul meu →
    </a>
  </div>

  <div style="background:#1a1a1a;border-radius:10px;padding:14px;font-size:12px;color:#666;text-align:center;">
    Examen Română: <strong style="color:#FF6B6B;">22 iunie 2026</strong> &nbsp;·&nbsp;
    Examen Matematică: <strong style="color:#3498DB;">24 iunie 2026</strong>
  </div>
</body>
</html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EN 2026 <onboarding@resend.dev>",
        to: ["ari.buzoianu@scoalababel.ro"],
        cc: ["colinbuzoianu@gmail.com"],
        subject: `📚 Reminder studiu – Săptămâna ${weekNum} · EN 2026`,
        html,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message);

    console.log("Cron reminder sent:", data.id);
    return res.status(200).json({ ok: true, week: weekNum, emailId: data.id });
  } catch (err) {
    console.error("Cron error:", err);
    return res.status(500).json({ error: err.message });
  }
}
