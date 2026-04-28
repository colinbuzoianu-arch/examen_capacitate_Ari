import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { CONFIG } from "./constants.js";
import { setAuthToken } from "./utils/cloudStorage.js";
import { setLoggerUser } from "./utils/logger.js";
import AuthPage from "./pages/AuthPage.jsx";
import StudentApp from "./pages/StudentApp.jsx";
import AdminApp from "./pages/AdminApp.jsx";

function AppInner() {
  const { user, token, loading, logout } = useAuth();
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [pw, setPw]     = useState("");
  const [pwErr, setPwErr] = useState(false);
  const [mode, setMode] = useState("student");

  // Sync token to cloudStorage + set logger user
  useEffect(() => { setAuthToken(token); }, [token]);
  useEffect(() => { if (user?.name) setLoggerUser(user.name, user.userId); }, [user]);

  // Check admin session
  useEffect(() => {
    if (sessionStorage.getItem("en2026_admin") === "1") setAdminUnlocked(true);
  }, []);

  async function loginAdmin() {
    // Verify password server-side — never compare passwords in the browser
    try {
      const token = btoa(pw);
      const res = await fetch("/api/admin-users?mode=list", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.ok) {
        sessionStorage.setItem("en2026_admin", "1");
        sessionStorage.setItem("en2026_admin_token", token);
        setAdminUnlocked(true);
        setMode("admin");
        setShowAdminLogin(false);
        setPw(""); setPwErr(false);
      } else {
        setPwErr(true); setPw("");
      }
    } catch { setPwErr(true); setPw(""); }
  }

  if (loading) return <Loader />;
  if (!user)   return <AuthPage />;

  return (
    <>
      {/* Mode switcher — bottom right, above nav */}
      <div style={S.toggle}>
        <div style={S.toggleUser}>👤 {user.name}</div>
        <button style={S.tBtn} onClick={() => {
          if (adminUnlocked) { setMode(mode === "admin" ? "student" : "admin"); }
          else { setShowAdminLogin(true); }
        }}>
          {mode === "admin" && adminUnlocked ? "🎒 Elev" : "👨‍💼 Admin"}
        </button>
        <button style={S.tBtnLogout} onClick={logout} title="Ieșire din cont">⏏</button>
      </div>

      {/* Admin login modal */}
      {showAdminLogin && (
        <div style={S.overlay} onClick={() => { setShowAdminLogin(false); setPw(""); setPwErr(false); }}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>🔒 Acces Admin</div>
            <p style={S.modalSub}>Introdu parola de administrator</p>
            <input type="password" placeholder="Parolă..." value={pw}
              onChange={e => { setPw(e.target.value); setPwErr(false); }}
              onKeyDown={e => e.key === "Enter" && loginAdmin()}
              style={{ ...S.pwInput, borderColor: pwErr ? "#E8654A" : "#E0DBD0" }}
              autoFocus />
            {pwErr && <p style={S.pwErr}>Parolă incorectă.</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button style={S.btnCancel} onClick={() => { setShowAdminLogin(false); setPw(""); setPwErr(false); }}>Anulează</button>
              <button style={S.btnLogin} onClick={loginAdmin}>Intră</button>
            </div>
          </div>
        </div>
      )}

      {mode === "admin" && adminUnlocked
        ? <AdminApp onLogout={() => { sessionStorage.removeItem("en2026_admin"); setAdminUnlocked(false); setMode("student"); }} />
        : <StudentApp />
      }
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function Loader() {
  return (
    <div style={{ minHeight: "100vh", background: "#F0EDE6", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14 }}>
      <div style={{ width: 36, height: 36, border: "3px solid #E0DBD0", borderTop: "3px solid #C8A84B", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 14, color: "#888", fontFamily: "'Inter',sans-serif" }}>Se încarcă...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const S = {
  toggle: { position: "fixed", bottom: 70, right: 12, zIndex: 500, display: "flex", alignItems: "center", background: "#fff", borderRadius: 20, overflow: "hidden", border: "1px solid #E0DBD0", boxShadow: "0 2px 12px rgba(0,0,0,.10)", fontFamily: "'Inter',sans-serif" },
  toggleUser: { fontSize: 11, color: "#888", padding: "7px 10px", borderRight: "1px solid #E0DBD0", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  tBtn: { background: "none", border: "none", color: "#C8A84B", padding: "7px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, borderRight: "1px solid #E0DBD0" },
  tBtnLogout: { background: "none", border: "none", color: "#AAA", padding: "7px 10px", cursor: "pointer", fontSize: 14 },
  overlay: { position: "fixed", inset: 0, background: "rgba(20,18,14,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 340, border: "1px solid #E8E4DC" },
  modalTitle: { fontSize: 20, fontWeight: 800, color: "#1A1A1A", marginBottom: 6, fontFamily: "'Syne',sans-serif" },
  modalSub: { fontSize: 13, color: "#888", marginBottom: 18, fontFamily: "'Inter',sans-serif" },
  pwInput: { width: "100%", background: "#F8F6F2", color: "#1A1A1A", border: "1px solid", borderRadius: 10, padding: "11px 14px", fontSize: 15, outline: "none", fontFamily: "'Inter',sans-serif" },
  pwErr: { fontSize: 12, color: "#E8654A", margin: "6px 0 0", fontFamily: "'Inter',sans-serif" },
  btnCancel: { flex: 1, background: "#F0EDE6", color: "#888", border: "none", borderRadius: 10, padding: "11px", cursor: "pointer", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 500 },
  btnLogin: { flex: 1, background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "'Syne',sans-serif", fontSize: 13 },
};
