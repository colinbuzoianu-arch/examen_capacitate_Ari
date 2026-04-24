// api/send-email.js — Brevo API
// SENDER_EMAIL env var: your verified sender email (default: uses BREVO default)

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { to, subject, html } = req.body;
  if (!to || !subject || !html) return res.status(400).json({ error: "Missing fields" });
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "BREVO_API_KEY not configured" });

  const senderEmail = process.env.SENDER_EMAIL || "noreply@en2026.app";
  const senderName  = process.env.SENDER_NAME  || "EN 2026";

  const recipients = (Array.isArray(to) ? to : [to])
    .filter(Boolean)
    .map(addr => typeof addr === "string" ? { email: addr } : addr);

  if (recipients.length === 0) return res.status(400).json({ error: "No valid recipients" });

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ sender: { name: senderName, email: senderEmail }, to: recipients, subject, htmlContent: html }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data.message || "Brevo error", details: data });
    return res.status(200).json({ ok: true, messageId: data.messageId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
