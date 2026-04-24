// api/send-email.js — Brevo (ex-Sendinblue) API
// Requires env var: BREVO_API_KEY
// Free plan: 300 emails/day, no domain verification needed

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res.status(400).json({ error: "Missing fields: to, subject, html" });
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "BREVO_API_KEY not configured in Vercel" });
  }

  // Brevo expects recipients as array of { email, name? }
  const recipients = (Array.isArray(to) ? to : [to]).map(addr =>
    typeof addr === "string" ? { email: addr } : addr
  );

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "EN 2026 · Planul lui Ari",
          email: "colinbuzoianu@gmail.com",  // sender verified via Brevo
        },
        to: recipients,
        subject,
        htmlContent: html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Brevo error:", JSON.stringify(data));
      return res.status(response.status).json({
        error: data.message || "Brevo API error",
        details: data,
      });
    }

    return res.status(200).json({ ok: true, messageId: data.messageId });
  } catch (err) {
    console.error("send-email handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
