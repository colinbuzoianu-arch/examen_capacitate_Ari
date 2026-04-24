import { useState, useEffect } from "react";
import { CONFIG } from "./constants.js";
import StudentApp from "./pages/StudentApp.jsx";
import AdminApp from "./pages/AdminApp.jsx";

export default function App() {
  const [mode, setMode]           = useState("student");
  const [adminUnlocked, setAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [pw, setPw]               = useState("");
  const [pwErr, setPwErr]         = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("en2026_admin") === "1") setAdmin(true);
  }, []);

  function login() {
    if (btoa(pw) === CONFIG.adminPasswordB64) {
      sessionStorage.setItem("en2026_admin", "1");
      setAdmin(true); setMode("admin");
      setShowLogin(false); setPw(""); setPwErr(false);
    } else { setPwErr(true); setPw(""); }
  }

  return (
    <>
      <div style={S.toggle}>
        <button style={{ ...S.tBtn, ...(mode === "student" ? S.tBtnOnY : {}) }}
          onClick={() => setMode("student")}>🎒 Ari</button>
        <button style={{ ...S.tBtn, ...(mode === "admin" && adminUnlocked ? S.tBtnOnG : {}) }}
          onClick={() => { if (adminUnlocked) { setMode(mode === "admin" ? "student" : "admin"); } else { setShowLogin(true); } }}>
          👨‍💼 Tata
        </button>
      </div>

      {showLogin && (
        <div style={S.overlay} onClick={() => { setShowLogin(false); setPw(""); setPwErr(false); }}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>🔒 Acces Tata</div>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 18, fontFamily: "'Inter',sans-serif" }}>Introdu parola pentru panoul de administrare</p>
            <input type="password" placeholder="Parolă..." value={pw}
              onChange={e => { setPw(e.target.value); setPwErr(false); }}
              onKeyDown={e => e.key === "Enter" && login()}
              style={{ ...S.pwInput, borderColor: pwErr ? "#E8654A" : "#E0DBD0" }}
              autoFocus />
            {pwErr && <p style={S.pwErr}>Parolă incorectă.</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button style={S.btnCancel} onClick={() => { setShowLogin(false); setPw(""); setPwErr(false); }}>Anulează</button>
              <button style={S.btnLogin} onClick={login}>Intră</button>
            </div>
          </div>
        </div>
      )}

      {mode === "admin" && adminUnlocked
        ? <AdminApp onLogout={() => { sessionStorage.removeItem("en2026_admin"); setAdmin(false); setMode("student"); }} />
        : <StudentApp />
      }
    </>
  );
}

const S = {
  toggle: { position:"fixed",bottom:70,right:12,zIndex:500,display:"flex",background:"#fff",borderRadius:20,overflow:"hidden",border:"1px solid #E0DBD0",boxShadow:"0 2px 12px rgba(0,0,0,.10)" },
  tBtn: { background:"none",border:"none",color:"#AAA",padding:"7px 14px",cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif",fontWeight:600,whiteSpace:"nowrap" },
  tBtnOnY: { color:"#C8A84B",background:"#FFF8E7" },
  tBtnOnG: { color:"#2E7D32",background:"#E8F5E9" },
  overlay: { position:"fixed",inset:0,background:"rgba(20,18,14,0.65)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20 },
  modal: { background:"#fff",borderRadius:20,padding:28,width:"100%",maxWidth:340,border:"1px solid #E8E4DC" },
  modalTitle: { fontSize:20,fontWeight:800,color:"#1A1A1A",marginBottom:6,fontFamily:"'Syne',sans-serif" },
  pwInput: { width:"100%",background:"#F8F6F2",color:"#1A1A1A",border:"1px solid",borderRadius:10,padding:"11px 14px",fontSize:15,outline:"none",fontFamily:"'Inter',sans-serif" },
  pwErr: { fontSize:12,color:"#E8654A",margin:"6px 0 0",fontFamily:"'Inter',sans-serif" },
  btnCancel: { flex:1,background:"#F0EDE6",color:"#888",border:"none",borderRadius:10,padding:"11px",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:500 },
  btnLogin: { flex:1,background:"#1A1A1A",color:"#fff",border:"none",borderRadius:10,padding:"11px",fontWeight:700,cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:13 },
};
