// api/stripe-webhook.js — Procesează evenimentele Stripe
// POST /api/stripe-webhook
// Stripe trimite events semnate cu STRIPE_WEBHOOK_SECRET

import { redisCmd } from "./lib/redis.js";

export const config = { api: { bodyParser: false } }; // Stripe needs raw body

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Verificare semnătură Stripe (HMAC-SHA256)
async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = sigHeader.split(",");
  const tPart = parts.find(p => p.startsWith("t="));
  const v1Part = parts.find(p => p.startsWith("v1="));
  if (!tPart || !v1Part) return false;

  const timestamp = tPart.slice(2);
  const signature = v1Part.slice(3);
  const signedPayload = `${timestamp}.${payload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  return expected === signature;
}

async function grantPremium(userId, email, paymentData) {
  // 1. Actualizează user cu status premium
  const userRaw = await redisCmd("GET", `user:${email.toLowerCase()}`).catch(() => null);
  if (userRaw) {
    const user = typeof userRaw === "string" ? JSON.parse(userRaw) : userRaw;
    user.premium = true;
    user.premiumGrantedAt = new Date().toISOString();
    user.premiumSource = "stripe";
    user.stripePaymentId = paymentData.payment_intent;
    await redisCmd("SET", `user:${email.toLowerCase()}`, JSON.stringify(user));
  }

  // 2. Resetează contoarele de usage (primesc slate curată)
  await redisCmd("SET", `usage:${userId}`, JSON.stringify({ lesson: 0, quiz: 0, chat: 0 }));

  // 3. Loghează plata
  await redisCmd("LPUSH", "payments:log", JSON.stringify({
    userId, email,
    amount: paymentData.amount_total,
    currency: paymentData.currency,
    paymentIntent: paymentData.payment_intent,
    paidAt: new Date().toISOString(),
  }));
  await redisCmd("LTRIM", "payments:log", 0, 999);

  console.log(`✅ Premium granted to ${email} (${userId})`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET lipsă" });

  const rawBody = await getRawBody(req);
  const payload = rawBody.toString("utf8");
  const sigHeader = req.headers["stripe-signature"];

  if (!sigHeader) return res.status(400).json({ error: "Semnătură lipsă" });

  const valid = await verifyStripeSignature(payload, sigHeader, webhookSecret);
  if (!valid) {
    console.error("Stripe signature invalid");
    return res.status(400).json({ error: "Semnătură invalidă" });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return res.status(400).json({ error: "JSON invalid" });
  }

  // Procesăm doar checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    if (session.payment_status === "paid") {
      const { userId, email } = session.metadata || {};
      if (userId && email) {
        await grantPremium(userId, email, session);
      } else {
        console.error("Metadata lipsă din sesiunea Stripe:", session.id);
      }
    }
  }

  return res.status(200).json({ received: true });
}
