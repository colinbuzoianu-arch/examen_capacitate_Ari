// src/pages/UpgradeModal.jsx — Modal plată când userul atinge limita AI

import { useState } from "react";

const S = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 9999, padding: "20px",
  },
  modal: {
    background: "#fff", borderRadius: 20, maxWidth: 420, width: "100%",
    padding: "32px 28px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    fontFamily: "'Inter', sans-serif", position: "relative",
  },
  closeBtn: {
    position: "absolute", top: 16, right: 16, background: "none",
    border: "none", fontSize: 20, cursor: "pointer", color: "#999",
    lineHeight: 1, padding: 4,
  },
  icon: { fontSize: 48, textAlign: "center", marginBottom: 12 },
  title: {
    fontSize: 22, fontWeight: 700, color: "#1A1A1A",
    textAlign: "center", marginBottom: 8,
    fontFamily: "'Syne', sans-serif",
  },
  subtitle: {
    fontSize: 14, color: "#666", textAlign: "center",
    lineHeight: 1.6, marginBottom: 24,
  },
  divider: { border: "none", borderTop: "1px solid #F0EDE6", margin: "20px 0" },
  planBox: {
    background: "linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)",
    borderRadius: 16, padding: "20px 24px", marginBottom: 20,
    color: "#fff", position: "relative", overflow: "hidden",
  },
  planBadge: {
    position: "absolute", top: 12, right: 12,
    background: "#C8A84B", color: "#fff", fontSize: 10,
    fontWeight: 700, padding: "3px 8px", borderRadius: 20,
    letterSpacing: "0.05em", textTransform: "uppercase",
  },
  planName: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  planPrice: {
    fontSize: 36, fontWeight: 800, color: "#C8A84B",
    lineHeight: 1, marginBottom: 4,
  },
  planPriceNote: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 16 },
  planFeatures: { listStyle: "none", padding: 0, margin: 0 },
  planFeature: {
    fontSize: 13, color: "rgba(255,255,255,0.85)",
    marginBottom: 6, display: "flex", alignItems: "center", gap: 8,
  },
  ctaBtn: {
    width: "100%", padding: "14px 20px",
    background: "linear-gradient(135deg, #C8A84B, #E8C56B)",
    color: "#1A1A1A", border: "none", borderRadius: 12,
    fontSize: 16, fontWeight: 700, cursor: "pointer",
    transition: "transform 0.1s", marginBottom: 12,
  },
  freeNote: {
    fontSize: 12, color: "#999", textAlign: "center", lineHeight: 1.5,
  },
  loading: { opacity: 0.6, cursor: "not-allowed" },
  successBox: {
    background: "#F0FFF4", border: "1px solid #C6F6D5",
    borderRadius: 12, padding: "16px", textAlign: "center",
    color: "#276749", fontSize: 14, fontWeight: 600,
  },
};

export default function UpgradeModal({ onClose, limitType, token }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const typeLabels = {
    lesson: "lecții generate",
    quiz: "quiz-uri",
    chat: "mesaje cu tutorele AI",
  };

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Eroare la plată");
      // Redirect spre Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <button style={S.closeBtn} onClick={onClose}>✕</button>

        <div style={S.icon}>🚀</div>
        <div style={S.title}>Ai atins limita gratuită</div>
        <div style={S.subtitle}>
          Ai folosit toate {typeLabels[limitType] || "interacțiunile"} disponibile în planul gratuit.<br />
          Continuă pregătirea cu acces complet.
        </div>

        <div style={S.planBox}>
          <div style={S.planBadge}>Recomandat</div>
          <div style={S.planName}>Acces Complet EN'26</div>
          <div style={S.planPrice}>29 <span style={{ fontSize: 18 }}>RON</span></div>
          <div style={S.planPriceNote}>plată unică · valabil până pe 22 iunie 2026</div>
          <ul style={S.planFeatures}>
            {[
              "✓ Lecții AI nelimitate pentru toate capitolele",
              "✓ Quiz-uri regenerabile oricând",
              "✓ Tutor AI disponibil oricând, fără limită",
              "✓ Acces imediat după plată",
              "✓ Fără abonament, fără surprize",
            ].map((f, i) => (
              <li key={i} style={S.planFeature}>{f}</li>
            ))}
          </ul>
        </div>

        {error && (
          <div style={{ background: "#FFF5F5", border: "1px solid #FED7D7", borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, color: "#C53030" }}>
            ⚠️ {error}
          </div>
        )}

        <button
          style={{ ...S.ctaBtn, ...(loading ? S.loading : {}) }}
          onClick={handleUpgrade}
          disabled={loading}
        >
          {loading ? "Se redirecționează..." : "🔓 Deblochează acces complet · 29 RON"}
        </button>

        <div style={S.freeNote}>
          Plată securizată prin Stripe · Card bancar sau Google Pay<br />
          Nu stocăm datele cardului tău
        </div>
      </div>
    </div>
  );
}
