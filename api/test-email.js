// api/test-email.js — Test email endpoint
// GET /api/test-email?secret=CRON_SECRET&to=your@email.com

export default async function handler(req, res) {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized — add ?secret=CRON_SECRET" });
  }
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "BREVO_API_KEY missing" });

  const toEmail = req.query.to;
  if (!toEmail) return res.status(400).json({ error: "Add ?to=your@email.com" });

  const senderEmail = process.env.SENDER_EMAIL || "noreply@en2026.app";

  try {
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "EN 2026 Test", email: senderEmail },
        to: [{ email: toEmail }],
        subject: "✅ Test email EN 2026",
        htmlContent: `<div style="background:#F0EDE6;padding:32px;font-family:Georgia,serif;max-width:400px;margin:0 auto;"><div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #E0DBD0;text-align:center;"><div style="font-size:40px;margin-bottom:12px;">✅</div><h1 style="color:#1A1A1A;font-size:18px;margin:0 0 10px;">Email funcționează!</h1><p style="color:#555;font-size:13px;">Brevo e configurat corect pentru EN 2026.</p><p style="color:#999;font-size:11px;margin-top:12px;">Timestamp: ${new Date().toISOString()}</p></div></div>`,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ ok: false, error: data.message });
    return res.status(200).json({ ok: true, messageId: data.messageId, message: `Email trimis la ${toEmail}` });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
