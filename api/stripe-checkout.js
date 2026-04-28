// api/stripe-checkout.js — Creează o sesiune de plată Stripe
// POST /api/stripe-checkout  { userId, email }
// Returnează { url } — redirect URL spre Stripe Checkout

import { getSession } from "./lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: "Stripe nu este configurat" });

  // Autentificare utilizator
  const token = req.headers.authorization?.replace("Bearer ", "");
  const session = token ? await getSession(token).catch(() => null) : null;
  if (!session) return res.status(401).json({ error: "Neautorizat" });

  const origin = req.headers.origin || process.env.APP_URL || "https://examen-capacitate-ari.vercel.app";

  try {
    const body = {
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "ron",
            unit_amount: 2900, // 29 RON în bani (2900 = 29.00 RON)
            product_data: {
              name: "Acces complet EN'26",
              description: "Acces nelimitat la toate lecțiile, quiz-urile și tutorele AI până pe 22 iunie 2026",
              images: [`${origin}/en26-og-image.png`],
            },
          },
          quantity: 1,
        },
      ],
      customer_email: session.email,
      metadata: {
        userId: session.userId,
        email: session.email,
      },
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

    if (!response.ok) {
      console.error("Stripe error:", data);
      return res.status(400).json({ error: data.error?.message || "Eroare Stripe" });
    }

    return res.status(200).json({ url: data.url, sessionId: data.id });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// Stripe API acceptă form-encoded, nu JSON — trebuie să aplatizăm obiectul
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
