// api/send-email.js — Vercel Serverless Function
// Requires env var: RESEND_API_KEY

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: "Missing fields: to, subject, html" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RESEND_API_KEY not configured" });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EN 2026 <onboarding@resend.dev>",  // replace with your verified domain later
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", data);
      return res.status(response.status).json({ error: data.message || "Resend error" });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: err.message });
  }
}
