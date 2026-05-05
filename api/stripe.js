// api/stripe.js — Stripe checkout + webhook in one serverless function
// POST /api/stripe?action=checkout  → creeaza sesiune plata
// POST /api/stripe?action=webhook   → primeste confirmare Stripe

import { getSession } from "./lib/auth.js";
import { redisCmd } from "./lib/redis.js";

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

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
  const userRaw = await redisCmd("GET", `user:${email.toLowerCase()}`).catch(() => null);
  if (userRaw) {
    const user = typeof userRaw === "string" ? JSON.parse(userRaw) : userRaw;
    user.premium = true;
    user.premiumGrantedAt = new Date().toISOString();
    user.premiumSource = "stripe";
    user.stripePaymentId = paymentData.payment_intent;
    await redisCmd("SET", `user:${email.toLowerCase()}`, JSON.stringify(user));
  }
  await redisCmd("SET", `usage:${userId}`, JSON.stringify({ lesson: 0, quiz: 0, chat: 0 }));
  await redisCmd("LPUSH", "payments:log", JSON.stringify({
    userId, email,
    amount: paymentData.amount_total,
    currency: paymentData.currency,
    paymentIntent: paymentData.payment_intent,
    paidAt: new Date().toISOString(),
  }));
  await redisCmd("LTRIM", "payments:log", 0, 999);
  console.log(`Premium granted to ${email} (${userId})`);
}

function flattenStripeBody(obj, prefix = "") {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flattenStripeBody(value, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === "object") {
          Object.assign(result, flattenStripeBody(item, `${fullKey}[${i}]`));
        } else {
          result[`${fullKey}[${i}]`] = item;
        }
      });
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: "Stripe neconfigurat" });

  const rawBody = await getRawBody(req);
  const payload = rawBody.toString("utf8");
  const action = req.query.action;

  // ── WEBHOOK ───────────────────────────────────────────────────────────────
  if (action === "webhook") {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(500).json({ error: "STRIPE_WEBHOOK_SECRET lipsă" });
    const sigHeader = req.headers["stripe-signature"];
    if (!sigHeader) return res.status(400).json({ error: "Semnătură lipsă" });
    const valid = await verifyStripeSignature(payload, sigHeader, webhookSecret);
    if (!valid) return res.status(400).json({ error: "Semnătură invalidă" });
    let event;
    try { event = JSON.parse(payload); } catch { return res.status(400).json({ error: "JSON invalid" }); }
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        const { userId, email } = session.metadata || {};
        if (userId && email) await grantPremium(userId, email, session);
      }
    }
    return res.status(200).json({ received: true });
  }

  // ── CHECKOUT ──────────────────────────────────────────────────────────────
  if (action === "checkout") {
    const token = req.headers.authorization?.replace("Bearer ", "");
    const session = token ? await getSession(token).catch(() => null) : null;
    if (!session) return res.status(401).json({ error: "Neautorizat" });
    const origin = req.headers.origin || process.env.APP_URL || "https://en26.verumsell.com";
    try {
      const body = {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: "ron",
            unit_amount: 2900,
            product_data: {
              name: "Acces complet EN'26",
              description: "Acces nelimitat la toate lecțiile, quiz-urile și tutorele AI până pe 22 iunie 2026",
            },
          },
          quantity: 1,
        }],
        customer_email: session.email,
        metadata: { userId: session.userId, email: session.email },
        success_url: `${origin}/?payment=success`,
        cancel_url: `${origin}/?payment=cancelled`,
        locale: "ro",
      };
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(flattenStripeBody(body)).toString(),
      });
      const data = await response.json();
      if (!response.ok) return res.status(400).json({ error: data.error?.message || "Eroare Stripe" });
      return res.status(200).json({ url: data.url, sessionId: data.id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: "Action necunoscut" });
}
