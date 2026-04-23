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
      sessionStorage.setItem("en2026_admin","1");
      setAdmin(true); setMode("admin");
      setShowLogin(false); setPw(""); setPwErr(false);
    } else { setPwErr(true); setPw(""); }
  }

  return (
    <>
      {/* Mode toggle */}
      <div style={S.toggle}>
        <button style={{ ...S.tBtn, ...(mode==="student"?S.tBtnOnY:{}) }} onClick={() => setMode("student")}>🎒 Ari</button>
        <button style={{ ...S.tBtn, ...(mode==="admin"&&adminUnlocked?S.tBtnOnG:{}) }}
          onClick={() => { if(adminUnlocked){setMode(mode==="admin"?"student":"admin");}else{setShowLogin(true);} }}>
          👨‍💼 Tata
        </button>
      </div>

      {/* Login modal */}
      {showLogin && (
        <div style={S.overlay} onClick={() => { setShowLogin(false); setPw(""); setPwErr(false); }}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={S.modalTitle}>🔒 Acces Tata</div>
            <p style={{ fontSize:13, color:"#888", marginBottom:16 }}>Introdu parola pentru panoul de administrare</p>
            <input type="password" placeholder="Parolă..." value={pw}
              onChange={e=>{setPw(e.target.value);setPwErr(false);}}
              onKeyDown={e=>e.key==="Enter"&&login()}
              style={{ ...S.pwInput, border:pwErr?"1px solid #FF6B6B":"1px solid #333" }}
              autoFocus />
            {pwErr && <p style={{ fontSize:12, color:"#FF6B6B", margin:"4px 0 0" }}>Parolă incorectă.</p>}
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button style={S.btnCancel} onClick={()=>{setShowLogin(false);setPw("");setPwErr(false);}}>Anulează</button>
              <button style={S.btnLogin} onClick={login}>Intră</button>
            </div>
          </div>
        </div>
      )}

      {mode==="admin"&&adminUnlocked
        ? <AdminApp onLogout={()=>{sessionStorage.removeItem("en2026_admin");setAdmin(false);setMode("student");}} />
        : <StudentApp />
      }
    </>
  );
}

const S = {
  toggle: { position:"fixed", top:0, right:0, zIndex:500, display:"flex", background:"#181818", borderBottomLeftRadius:10, border:"1px solid #2a2a2a", borderTop:"none", borderRight:"none", overflow:"hidden" },
  tBtn: { background:"none", border:"none", color:"#555", padding:"6px 13px", cursor:"pointer", fontSize:12, fontFamily:"Georgia,serif" },
  tBtnOnY: { color:"#F1C40F", borderBottom:"2px solid #F1C40F" },
  tBtnOnG: { color:"#6BCB77", borderBottom:"2px solid #6BCB77" },
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" },
  modal: { background:"#1a1a1a", borderRadius:16, padding:28, width:"100%", maxWidth:340, border:"1px solid #2a2a2a" },
  modalTitle: { fontSize:20, fontWeight:700, color:"#F1C40F", marginBottom:6, fontFamily:"Georgia,serif" },
  pwInput: { width:"100%", background:"#222", color:"#eee", borderRadius:8, padding:"10px 14px", fontSize:15, outline:"none", fontFamily:"Georgia,serif" },
  btnCancel: { flex:1, background:"#2a2a2a", color:"#ccc", border:"none", borderRadius:8, padding:"10px", cursor:"pointer", fontFamily:"Georgia,serif" },
  btnLogin: { flex:1, background:"#F1C40F", color:"#111", border:"none", borderRadius:8, padding:"10px", fontWeight:700, cursor:"pointer", fontFamily:"Georgia,serif" },
};
