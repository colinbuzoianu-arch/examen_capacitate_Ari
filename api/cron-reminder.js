// api/cron-reminder.js — runs every Friday 18:00 UTC
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "No RESEND_API_KEY" });

  const now = new Date();
  const start = new Date("2026-04-23");
  const weekNum = Math.max(1, Math.ceil((now - start) / (7 * 86400000)));
  const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://studiu-en2026.vercel.app";

  const html = `<!DOCTYPE html><html lang="ro"><body style="background:#111;font-family:Georgia,serif;color:#eee;padding:32px 24px;max-width:520px;margin:0 auto;">
<div style="text-align:center;margin-bottom:24px;"><div style="font-size:40px;">🎓</div>
<h1 style="color:#F1C40F;font-size:22px;">Reminder studiu – Săptămâna ${weekNum}</h1>
<p style="color:#888;font-size:13px;">Este vineri! Ai terminat capitolele săptămânii?</p></div>
<div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:20px;border-left:4px solid #F1C40F;">
<p style="font-size:14px;color:#ccc;line-height:1.6;margin:0;">
Hai Ari 💪 Nu uita că pentru a bifa un capitol trebuie să faci și quiz-ul (minim 8/10) ȘI să încarci un screenshot cu ce ai lucrat.<br><br>
Mai ai câteva ore de weekend să recuperezi!
</p></div>
<div style="text-align:center;margin:24px 0;">
<a href="${appUrl}" style="background:#F1C40F;color:#111;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px;font-size:15px;display:inline-block;">Deschide planul →</a>
</div>
<div style="background:#1a1a1a;border-radius:10px;padding:14px;font-size:12px;color:#666;text-align:center;">
Română: <strong style="color:#FF6B6B;">22 iunie 2026</strong> · Matematică: <strong style="color:#3498DB;">24 iunie 2026</strong>
</div></body></html>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "EN 2026 <onboarding@resend.dev>",
        to: ["ari.buzoianu@scoalababel.ro"],
        cc: ["colinbuzoianu@gmail.com"],
        subject: `📚 Reminder studiu – Săptămâna ${weekNum} · EN 2026`,
        html,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message);
    return res.status(200).json({ ok: true, week: weekNum });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
