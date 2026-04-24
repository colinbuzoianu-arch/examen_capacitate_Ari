// api/test-email.js — trimite un email de test direct la Colin
// Apelează: GET https://your-app.vercel.app/api/test-email?secret=CRON_SECRET

export default async function handler(req, res) {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized — adaugă ?secret=CRON_SECRET în URL" });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "BREVO_API_KEY lipsă în Vercel env vars" });

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "EN 2026 · Test", email: "colinbuzoianu@gmail.com" },
        to: [{ email: "colinbuzoianu@gmail.com" }],
        subject: "✅ Test email EN 2026 — funcționează!",
        htmlContent: `
          <div style="background:#F0EDE6;padding:32px;font-family:Georgia,serif;max-width:400px;margin:0 auto;">
            <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #E0DBD0;">
              <div style="font-size:40px;text-align:center;margin-bottom:12px;">✅</div>
              <h1 style="color:#1A1A1A;font-size:20px;text-align:center;margin:0 0 12px;">Emailul funcționează!</h1>
              <p style="color:#555;font-size:14px;line-height:1.7;margin:0;">
                Brevo e configurat corect. Emailurile de la aplicația EN 2026 vor ajunge la destinație.
              </p>
              <hr style="border:none;border-top:1px solid #E0DBD0;margin:16px 0;">
              <p style="color:#999;font-size:12px;margin:0;">
                BREVO_API_KEY: ✓ prezent<br>
                Sender: colinbuzoianu@gmail.com<br>
                Timestamp: ${new Date().toISOString()}
              </p>
            </div>
          </div>
        `,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data.message,
        brevoResponse: data,
        hint: "Verifică BREVO_API_KEY în Vercel — poate e expirat sau incorect",
      });
    }

    return res.status(200).json({
      ok: true,
      messageId: data.messageId,
      message: "Email trimis la colinbuzoianu@gmail.com — verifică inbox-ul!",
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
