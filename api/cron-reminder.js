// api/cron-reminder.js — Vercel Cron Job (every Friday 18:00 UTC)
// Uses Brevo API — no domain verification needed

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "BREVO_API_KEY not configured" });

  const now    = new Date();
  const start  = new Date("2026-04-23");
  const weekNum = Math.max(1, Math.ceil((now - start) / (7 * 86400000)));
  const daysToRo = Math.max(0, Math.ceil((new Date("2026-06-22") - now) / 86400000));
  const daysToMa = Math.max(0, Math.ceil((new Date("2026-06-24") - now) / 86400000));
  const appUrl   = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://examen-capacitate-ari.vercel.app";

  const html = `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0EDE6;font-family:Georgia,serif;">
<div style="max-width:540px;margin:0 auto;padding:24px 16px;">
  <div style="background:#1A1A1A;border-radius:20px;overflow:hidden;">
    <div style="padding:28px 24px 20px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">🎓</div>
      <h1 style="color:#C8A84B;font-size:22px;margin:0 0 4px;font-family:Georgia,serif;">Reminder studiu EN 2026</h1>
      <p style="color:#888;font-size:13px;margin:0;">Săptămâna ${weekNum} · Este vineri!</p>
    </div>
    <div style="background:#fff;margin:0 16px;border-radius:12px;padding:20px 18px;">
      <p style="font-size:14px;color:#333;line-height:1.7;margin:0 0 16px;">
        Hai Ari! 💪 Nu uita că pentru a bifa un capitol trebuie să faci <strong>quiz-ul (minim 8/10)</strong> ȘI să încarci un <strong>screenshot</strong> cu ce ai studiat.
      </p>
      <div style="display:flex;gap:10px;margin-bottom:16px;">
        <div style="flex:1;background:#FFF5F5;border-radius:10px;padding:12px;text-align:center;border:1px solid #FFCDD2;">
          <div style="font-size:26px;font-weight:bold;color:#C8392B;">${daysToRo}</div>
          <div style="font-size:11px;color:#C8392B;font-weight:bold;">zile Română</div>
          <div style="font-size:10px;color:#999;margin-top:2px;">22 Iunie 2026</div>
        </div>
        <div style="flex:1;background:#EEF4FF;border-radius:10px;padding:12px;text-align:center;border:1px solid #BBDEFB;">
          <div style="font-size:26px;font-weight:bold;color:#1A5276;">${daysToMa}</div>
          <div style="font-size:11px;color:#1A5276;font-weight:bold;">zile Matematică</div>
          <div style="font-size:10px;color:#999;margin-top:2px;">24 Iunie 2026</div>
        </div>
      </div>
      <div style="text-align:center;">
        <a href="${appUrl}" style="display:inline-block;background:#1A1A1A;color:#fff;text-decoration:none;font-weight:bold;padding:13px 30px;border-radius:10px;font-size:15px;">
          📚 Deschide planul meu →
        </a>
      </div>
    </div>
    <div style="padding:14px 24px;text-align:center;">
      <p style="color:#666;font-size:11px;margin:0;">EN 2026 · Planul lui Ari · Școala Babel Timișoara</p>
    </div>
  </div>
</div>
</body>
</html>`;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "EN 2026 · Planul lui Ari", email: "colinbuzoianu@gmail.com" },
        to: [{ email: "ari.buzoianu@scoalababel.ro" }],
        cc: [
          { email: "colinbuzoianu@gmail.com" },
          { email: "anamunteanucontact@gmail.com" },
        ],
        subject: `📚 Reminder studiu – Săptămâna ${weekNum} · EN 2026`,
        htmlContent: html,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Brevo error");

    console.log("Cron reminder sent:", data.messageId);
    return res.status(200).json({ ok: true, week: weekNum, messageId: data.messageId });
  } catch (err) {
    console.error("Cron error:", err);
    return res.status(500).json({ error: err.message });
  }
}
