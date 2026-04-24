import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode]     = useState("login"); // login | register
  const [email, setEmail]   = useState("");
  const [password, setPw]   = useState("");
  const [name, setName]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setError("Completează toate câmpurile");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        if (password.length < 6) { setError("Parola trebuie să aibă minim 6 caractere"); setLoading(false); return; }
        await register(email.trim(), password, name.trim());
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div style={S.shell}>
      <div style={S.card}>
        {/* Logo */}
        <div style={S.logoWrap}>
          <div style={S.logoIcon}>🎓</div>
          <div style={S.logoText}>EN<span style={{ color: "#C8A84B" }}>'26</span></div>
          <div style={S.logoSub}>Evaluarea Națională 2026</div>
        </div>

        {/* Tab */}
        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(mode === "login" ? S.tabOn : {}) }} onClick={() => { setMode("login"); setError(null); }}>
            Intră în cont
          </button>
          <button style={{ ...S.tab, ...(mode === "register" ? S.tabOn : {}) }} onClick={() => { setMode("register"); setError(null); }}>
            Cont nou
          </button>
        </div>

        {/* Form */}
        <div style={S.form}>
          {mode === "register" && (
            <div style={S.field}>
              <label style={S.label}>Numele tău</label>
              <input style={S.input} type="text" placeholder="ex: Ari Buzoianu"
                value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
          )}

          <div style={S.field}>
            <label style={S.label}>Email</label>
            <input style={S.input} type="email" placeholder="email@exemplu.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              autoComplete="email" />
          </div>

          <div style={S.field}>
            <label style={S.label}>Parolă{mode === "register" ? " (minim 6 caractere)" : ""}</label>
            <input style={S.input} type="password" placeholder="••••••••"
              value={password} onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </div>

          {error && (
            <div style={S.error}>❌ {error}</div>
          )}

          <button style={{ ...S.btnSubmit, opacity: loading ? 0.6 : 1 }}
            onClick={handleSubmit} disabled={loading}>
            {loading
              ? (mode === "login" ? "Se conectează..." : "Se creează contul...")
              : (mode === "login" ? "Intră în cont →" : "Creează cont →")
            }
          </button>
        </div>

        {/* Info */}
        <div style={S.info}>
          {mode === "login"
            ? <span>Nu ai cont? <button style={S.link} onClick={() => { setMode("register"); setError(null); }}>Înregistrează-te</button></span>
            : <span>Ai deja cont? <button style={S.link} onClick={() => { setMode("login"); setError(null); }}>Intră</button></span>
          }
        </div>

        <div style={S.footer}>
          Aplicație de studiu pentru EN 2026 · Școala Babel Timișoara
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const S = {
  shell: { minHeight: "100vh", background: "#F0EDE6", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 16px", fontFamily: "'Inter',sans-serif" },
  card: { background: "#fff", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 380, border: "1px solid #E0DBD0", boxShadow: "0 4px 24px rgba(0,0,0,.07)" },

  logoWrap: { textAlign: "center", marginBottom: 24 },
  logoIcon: { fontSize: 44, marginBottom: 6 },
  logoText: { fontSize: 28, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif", letterSpacing: "-1px", lineHeight: 1 },
  logoSub: { fontSize: 12, color: "#AAA", marginTop: 5, fontFamily: "'Inter',sans-serif" },

  tabs: { display: "flex", background: "#F0EDE6", borderRadius: 10, padding: 3, marginBottom: 22, gap: 3 },
  tab: { flex: 1, background: "none", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 600, color: "#888", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all .15s" },
  tabOn: { background: "#fff", color: "#1A1A1A", boxShadow: "0 1px 4px rgba(0,0,0,.08)" },

  form: { display: "flex", flexDirection: "column", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: "#555" },
  input: { background: "#F8F6F2", border: "1px solid #E0DBD0", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "#1A1A1A", outline: "none", fontFamily: "'Inter',sans-serif", transition: "border-color .15s" },

  error: { background: "#FFF0EE", border: "1px solid #FFCDD2", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#C62828" },

  btnSubmit: { background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Syne',sans-serif", marginTop: 4, transition: "opacity .15s" },

  info: { textAlign: "center", marginTop: 18, fontSize: 13, color: "#888" },
  link: { background: "none", border: "none", color: "#C8A84B", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "'Inter',sans-serif", padding: 0 },
  footer: { textAlign: "center", marginTop: 20, fontSize: 11, color: "#CCC", paddingTop: 16, borderTop: "1px solid #F0EDE6" },
};

const CSS = `
  * { box-sizing: border-box; }
  input:focus { border-color: #C8A84B !important; }
  body { background: #F0EDE6; }
`;
