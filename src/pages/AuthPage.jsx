import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode]       = useState("login"); // login | register | forgot | reset
  const [email, setEmail]     = useState("");
  const [password, setPw]     = useState("");
  const [password2, setPw2]   = useState("");
  const [name, setName]       = useState("");
  const [resetToken, setToken]= useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [success, setSuccess] = useState(null);

  // Check for reset token in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset");
    if (token) {
      setToken(token);
      setMode("reset");
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function clearMessages() { setError(null); setSuccess(null); }

  async function handleSubmit() {
    clearMessages();
    if (!email.trim() && mode !== "reset") { setError("Completează emailul"); return; }
    if (!password.trim() && mode !== "forgot") { setError("Completează parola"); return; }
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email.trim(), password);

      } else if (mode === "register") {
        if (password.length < 6) { setError("Parola trebuie să aibă minim 6 caractere"); setLoading(false); return; }
        await register(email.trim(), password, name.trim());

      } else if (mode === "forgot") {
        const res = await fetch("/api/reset-password?action=request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        setSuccess("Email trimis! Verifică inbox-ul și urmează linkul din email.");

      } else if (mode === "reset") {
        if (password !== password2) { setError("Parolele nu coincid"); setLoading(false); return; }
        if (password.length < 6) { setError("Parola trebuie să aibă minim 6 caractere"); setLoading(false); return; }
        const res = await fetch("/api/reset-password?action=confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, newPassword: password }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        setSuccess("Parola a fost schimbată! Te poți autentifica acum.");
        setTimeout(() => { setMode("login"); setSuccess(null); setPw(""); setPw2(""); }, 2500);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  const titles = {
    login:    "Intră în cont",
    register: "Cont nou",
    forgot:   "Recuperare parolă",
    reset:    "Parolă nouă",
  };

  const btnLabels = {
    login:    loading ? "Se conectează..." : "Intră în cont →",
    register: loading ? "Se creează contul..." : "Creează cont →",
    forgot:   loading ? "Se trimite..." : "Trimite link de resetare →",
    reset:    loading ? "Se salvează..." : "Salvează parola nouă →",
  };

  return (
    <div style={S.shell}>
      <div style={S.card}>
        {/* Logo */}
        <div style={S.logoWrap}>
          <div style={S.logoIcon}>🎓</div>
          <div style={S.logoText}>EN<span style={{ color: "#C8A84B" }}>'26</span></div>
          <div style={S.logoSub}>Evaluarea Națională 2026</div>
        </div>

        {/* Tabs — only for login/register */}
        {(mode === "login" || mode === "register") && (
          <div style={S.tabs}>
            <button style={{ ...S.tab, ...(mode === "login" ? S.tabOn : {}) }}
              onClick={() => { setMode("login"); clearMessages(); }}>
              Intră în cont
            </button>
            <button style={{ ...S.tab, ...(mode === "register" ? S.tabOn : {}) }}
              onClick={() => { setMode("register"); clearMessages(); }}>
              Cont nou
            </button>
          </div>
        )}

        {/* Forgot/Reset header */}
        {(mode === "forgot" || mode === "reset") && (
          <div style={S.backRow}>
            <button style={S.backBtn} onClick={() => { setMode("login"); clearMessages(); }}>
              ← Înapoi la login
            </button>
            <div style={S.modeTitle}>{titles[mode]}</div>
          </div>
        )}

        {/* Form */}
        <div style={S.form}>
          {mode === "register" && (
            <div style={S.field}>
              <label style={S.label}>Numele tău</label>
              <input style={S.input} type="text" placeholder="ex: Popescu Ion"
                value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()} />
            </div>
          )}

          {mode !== "reset" && (
            <div style={S.field}>
              <label style={S.label}>Email</label>
              <input style={S.input} type="email" placeholder="email@exemplu.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                autoComplete="email" />
            </div>
          )}

          {mode !== "forgot" && (
            <div style={S.field}>
              <label style={S.label}>
                {mode === "reset" ? "Parolă nouă" : "Parolă"}
                {(mode === "register" || mode === "reset") ? " (minim 6 caractere)" : ""}
              </label>
              <input style={S.input} type="password" placeholder="••••••••"
                value={password} onChange={e => setPw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </div>
          )}

          {mode === "reset" && (
            <div style={S.field}>
              <label style={S.label}>Confirmă parola nouă</label>
              <input style={S.input} type="password" placeholder="••••••••"
                value={password2} onChange={e => setPw2(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                autoComplete="new-password" />
            </div>
          )}

          {error   && <div style={S.error}>❌ {error}</div>}
          {success && <div style={S.successBox}>✅ {success}</div>}

          {!success && (
            <button style={{ ...S.btnSubmit, opacity: loading ? 0.6 : 1 }}
              onClick={handleSubmit} disabled={loading}>
              {btnLabels[mode]}
            </button>
          )}
        </div>

        {/* Footer links */}
        <div style={S.info}>
          {mode === "login" && (
            <span>
              <button style={S.link} onClick={() => { setMode("forgot"); clearMessages(); }}>
                Ai uitat parola?
              </button>
              {" · "}
              <button style={S.link} onClick={() => { setMode("register"); clearMessages(); }}>
                Cont nou
              </button>
            </span>
          )}
          {mode === "register" && (
            <span>Ai deja cont? <button style={S.link} onClick={() => { setMode("login"); clearMessages(); }}>Intră</button></span>
          )}
          {mode === "forgot" && (
            <span style={{ color: "#AAA", fontSize: 12 }}>
              Vei primi un email cu un link de resetare valabil 1 oră.
            </span>
          )}
        </div>

        <div style={S.footer}>
          Aplicație de studiu pentru EN 2026
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
  logoSub: { fontSize: 12, color: "#AAA", marginTop: 5 },

  tabs: { display: "flex", background: "#F0EDE6", borderRadius: 10, padding: 3, marginBottom: 22, gap: 3 },
  tab: { flex: 1, background: "none", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 600, color: "#888", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all .15s" },
  tabOn: { background: "#fff", color: "#1A1A1A", boxShadow: "0 1px 4px rgba(0,0,0,.08)" },

  backRow: { marginBottom: 18 },
  backBtn: { background: "none", border: "none", color: "#AAA", cursor: "pointer", fontSize: 12, fontFamily: "'Inter',sans-serif", padding: 0, marginBottom: 8, display: "block" },
  modeTitle: { fontSize: 18, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },

  form: { display: "flex", flexDirection: "column", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 12, fontWeight: 600, color: "#555" },
  input: { background: "#F8F6F2", border: "1px solid #E0DBD0", borderRadius: 10, padding: "11px 14px", fontSize: 14, color: "#1A1A1A", outline: "none", fontFamily: "'Inter',sans-serif", transition: "border-color .15s" },

  error:      { background: "#FFF0EE", border: "1px solid #FFCDD2", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#C62828" },
  successBox: { background: "#E8F5E9", border: "1px solid #A5D6A7", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#2E7D32" },

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
