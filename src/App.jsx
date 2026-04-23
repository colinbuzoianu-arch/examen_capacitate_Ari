import { useState, useEffect } from "react";
import { lsGet, lsSet } from "./utils/storage.js";
import { CONFIG } from "./constants.js";
import StudentApp from "./pages/StudentApp.jsx";
import AdminApp from "./pages/AdminApp.jsx";

export default function App() {
  const [mode, setMode] = useState("student"); // "student" | "admin"
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  // Check if admin was already unlocked this session
  useEffect(() => {
    const session = sessionStorage.getItem("en2026_admin");
    if (session === "1") {
      setAdminUnlocked(true);
      const url = new URL(window.location.href);
      if (url.hash === "#admin") setMode("admin");
    }
  }, []);

  function handleAdminLogin() {
    if (btoa(pwInput) === CONFIG.adminPasswordB64) {
      sessionStorage.setItem("en2026_admin", "1");
      setAdminUnlocked(true);
      setMode("admin");
      setShowAdminLogin(false);
      setPwInput("");
      setPwError(false);
    } else {
      setPwError(true);
      setPwInput("");
    }
  }

  function handleAdminLogout() {
    sessionStorage.removeItem("en2026_admin");
    setAdminUnlocked(false);
    setMode("student");
  }

  return (
    <>
      {/* Mode switcher — small tab at top right */}
      <div style={styles.modeSwitcher}>
        <button
          style={{ ...styles.modeBtn, ...(mode === "student" ? styles.modeBtnActive : {}) }}
          onClick={() => setMode("student")}
        >🎒 Ari</button>
        <button
          style={{ ...styles.modeBtn, ...(mode === "admin" && adminUnlocked ? styles.modeBtnActiveAdmin : {}) }}
          onClick={() => {
            if (adminUnlocked) {
              setMode(mode === "admin" ? "student" : "admin");
            } else {
              setShowAdminLogin(true);
            }
          }}
        >👨‍💼 Tata</button>
      </div>

      {/* Admin login modal */}
      {showAdminLogin && (
        <div style={styles.overlay} onClick={() => { setShowAdminLogin(false); setPwError(false); setPwInput(""); }}>
          <div style={styles.loginModal} onClick={e => e.stopPropagation()}>
            <div style={styles.loginTitle}>🔒 Acces Admin</div>
            <p style={styles.loginSub}>Introdu parola pentru panoul de administrare</p>
            <input
              type="password"
              placeholder="Parolă..."
              value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(false); }}
              onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
              style={{ ...styles.pwInput, border: pwError ? "1px solid #FF6B6B" : "1px solid #333" }}
              autoFocus
            />
            {pwError && <p style={styles.pwError}>Parolă incorectă. Încearcă din nou.</p>}
            <div style={styles.loginBtns}>
              <button style={styles.btnCancel} onClick={() => { setShowAdminLogin(false); setPwInput(""); setPwError(false); }}>Anulează</button>
              <button style={styles.btnLogin} onClick={handleAdminLogin}>Intră</button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      {mode === "admin" && adminUnlocked
        ? <AdminApp onLogout={handleAdminLogout} />
        : <StudentApp />
      }
    </>
  );
}

const styles = {
  modeSwitcher: {
    position: "fixed", top: 0, right: 0, zIndex: 500,
    display: "flex", background: "#181818",
    borderBottomLeftRadius: 10, overflow: "hidden",
    border: "1px solid #2a2a2a", borderTop: "none", borderRight: "none",
  },
  modeBtn: {
    background: "none", border: "none", color: "#666",
    padding: "6px 14px", cursor: "pointer", fontSize: 12,
    fontFamily: "Georgia, serif",
  },
  modeBtnActive: { color: "#F1C40F", borderBottom: "2px solid #F1C40F" },
  modeBtnActiveAdmin: { color: "#6BCB77", borderBottom: "2px solid #6BCB77" },

  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
    zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
  },
  loginModal: {
    background: "#1a1a1a", borderRadius: 16, padding: 28, width: "100%", maxWidth: 340,
    border: "1px solid #2a2a2a",
  },
  loginTitle: { fontSize: 20, fontWeight: 700, color: "#F1C40F", marginBottom: 6, fontFamily: "Georgia, serif" },
  loginSub: { fontSize: 13, color: "#888", marginBottom: 18 },
  pwInput: {
    width: "100%", background: "#222", color: "#eee",
    borderRadius: 8, padding: "10px 14px", fontSize: 15,
    outline: "none", fontFamily: "Georgia, serif", marginBottom: 6,
  },
  pwError: { fontSize: 12, color: "#FF6B6B", margin: "4px 0 10px" },
  loginBtns: { display: "flex", gap: 10, marginTop: 16 },
  btnCancel: {
    flex: 1, background: "#2a2a2a", color: "#ccc", border: "none",
    borderRadius: 8, padding: "10px", cursor: "pointer", fontFamily: "Georgia, serif",
  },
  btnLogin: {
    flex: 1, background: "#F1C40F", color: "#111", border: "none",
    borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer", fontFamily: "Georgia, serif",
  },
};
