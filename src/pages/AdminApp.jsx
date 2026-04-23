import { useState, useEffect } from "react";
import { ls } from "../utils/storage.js";
import { sendEmail } from "../utils/api.js";
import { SUBJECTS, WEEKS, WEEKLY_PLAN, EXAM_ROMANA, EXAM_MATH, fmt, daysLeft, getWeekStatus, CONFIG } from "../constants.js";

export default function AdminApp({ onLogout }) {
  const [view, setView]           = useState("overview");
  const [unlockedChapters, setUL] = useState({});
  const [manualMsg, setManualMsg] = useState("");
  const [sending, setSending]     = useState(false);
  const [toast, setToast]         = useState(null);
  const [selectedImg, setSelectedImg] = useState(null);

  useEffect(() => {
    function load() {
      setUL(ls.get("unlocked") || {});
    }
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  function doneOf(s) { return SUBJECTS[s].chapters.filter(c => unlockedChapters[c.id]).length; }
  function totalOf(s) { return SUBJECTS[s].chapters.length; }
  function doneAll() { return doneOf("romana") + doneOf("matematica"); }
  function totalAll() { return totalOf("romana") + totalOf("matematica"); }

  // Collect all screenshots
  const allScreenshots = [];
  [...SUBJECTS.romana.chapters, ...SUBJECTS.matematica.chapters].forEach(ch => {
    const data = ls.get(`chapter_${ch.id}`);
    if (data?.screenshot) allScreenshots.push({ ...ch, screenshot: data.screenshot, quizResult: data.quizResult });
  });

  async function sendManualReminder() {
    if (!manualMsg.trim()) return;
    setSending(true);
    const res = await sendEmail({
      to: CONFIG.studentEmail,
      subject: "✉️ Mesaj de la Tata – EN 2026",
      html: `<div style="background:#111;color:#eee;font-family:Georgia,serif;padding:32px;max-width:500px;margin:0 auto;">
<h1 style="color:#F1C40F;font-size:20px;">✉️ Mesaj de la Tata</h1>
<div style="background:#1a1a1a;border-radius:10px;padding:18px;margin:16px 0;border-left:4px solid #F1C40F;">
<p style="font-size:15px;color:#eee;line-height:1.6;margin:0;">${manualMsg.replace(/\n/g,"<br/>")}</p>
</div>
<a href="${window.location.origin}" style="background:#F1C40F;color:#111;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;">Deschide planul →</a>
</div>`,
    });
    setSending(false);
    if (res.ok) { showToast("✅ Mesaj trimis lui Ari!"); setManualMsg(""); }
    else showToast("❌ Eroare. Verifică RESEND_API_KEY.");
  }

  async function sendReminder() {
    setSending(true);
    const curWeek = WEEKS.find(w => getWeekStatus(w) === "current") || WEEKS[0];
    const chs = WEEKLY_PLAN[curWeek.id] || [];
    const done = chs.filter(c => unlockedChapters[c.id]).length;
    const pct = chs.length ? Math.round((done/chs.length)*100) : 0;
    const bar = "█".repeat(Math.round(pct/10)) + "░".repeat(10-Math.round(pct/10));
    const res = await sendEmail({
      to: CONFIG.studentEmail,
      subject: `📚 Reminder studiu – ${curWeek.label} · EN 2026`,
      html: `<div style="background:#111;color:#eee;font-family:Georgia,serif;padding:32px;max-width:500px;margin:0 auto;">
<div style="text-align:center;margin-bottom:20px;"><div style="font-size:40px;">🎓</div>
<h1 style="color:#F1C40F;font-size:20px;">Reminder studiu – ${curWeek.label}</h1></div>
<div style="background:#1a1a1a;border-radius:12px;padding:18px;margin-bottom:16px;border-left:4px solid #F1C40F;">
<p style="font-size:14px;color:#ccc;margin:0 0 10px;">Hai Ari! Nu uita că trebuie să treci <strong>quiz-ul (8/10)</strong> ȘI să încarci un <strong>screenshot</strong> pentru fiecare capitol. 💪</p>
<div style="font-family:monospace;color:#F1C40F;font-size:16px;letter-spacing:2px;">${bar} ${pct}%</div>
<div style="font-size:12px;color:#888;margin-top:4px;">${done}/${chs.length} capitole bifate această săptămână</div>
</div>
<div style="text-align:center;">
<a href="${window.location.origin}" style="background:#F1C40F;color:#111;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">Deschide planul →</a>
</div></div>`,
    });
    setSending(false);
    if (res.ok) showToast("✅ Reminder trimis!"); else showToast("❌ Eroare trimitere.");
  }

  const overallPct = Math.round((doneAll()/totalAll())*100);

  return (
    <div style={S.shell}>
      <header style={S.header}>
        <div><div style={S.logo}>👨‍💼 Panou Tata</div><div style={S.logoSub}>Progresul lui {CONFIG.studentName} · EN 2026</div></div>
        <button style={S.logoutBtn} onClick={onLogout}>← Ieșire</button>
      </header>

      <nav style={S.nav}>
        {[{id:"overview",icon:"📊",label:"Overview"},{id:"screenshots",icon:"📸",label:"Dovezi"},{id:"email",icon:"✉️",label:"Email"},{id:"detail",icon:"📋",label:"Detaliu"}].map(i => (
          <button key={i.id} style={{ ...S.navBtn, ...(view===i.id?S.navOn:{}) }} onClick={() => setView(i.id)}>
            <span style={{ fontSize:18 }}>{i.icon}</span><span>{i.label}</span>
          </button>
        ))}
      </nav>

      <main style={S.main}>
        <div style={S.page}>

          {view === "overview" && (
            <>
              <div style={S.kpiGrid}>
                <Kpi label="Progres total" value={`${overallPct}%`} sub={`${doneAll()}/${totalAll()} capitole`} color="#F1C40F" />
                <Kpi label="Zile Română" value={daysLeft(EXAM_ROMANA)} sub="22 iunie 2026" color="#FF6B6B" />
                <Kpi label="Zile Mate" value={daysLeft(EXAM_MATH)} sub="24 iunie 2026" color="#3498DB" />
                <Kpi label="Dovezi" value={allScreenshots.length} sub="screenshots" color="#6BCB77" />
              </div>

              {["romana","matematica"].map(s => {
                const sub=SUBJECTS[s]; const done=doneOf(s); const total=totalOf(s);
                const pct=Math.round((done/total)*100);
                return (
                  <div key={s} style={S.card}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10, fontSize:13 }}>
                      <span>{sub.icon} <strong style={{ color:"#fff" }}>{sub.label}</strong></span>
                      <span style={{ color:sub.accent, fontWeight:700 }}>{pct}%</span>
                    </div>
                    <div style={S.bigBarBg}>
                      <div style={{ ...S.bigBarFill, width:`${pct}%`, background:`linear-gradient(90deg,${sub.color},${sub.accent})` }}>
                        <span style={{ fontSize:11, fontWeight:700, color:"#fff", paddingLeft:8 }}>{done}/{total}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div style={S.card}>
                <div style={S.cardTitle}>Progres pe săptămâni</div>
                {WEEKS.map(w => {
                  const chs=WEEKLY_PLAN[w.id]||[]; const done=chs.filter(c=>unlockedChapters[c.id]).length;
                  const pct=chs.length?Math.round((done/chs.length)*100):0; const st=getWeekStatus(w);
                  return (
                    <div key={w.id} style={{ ...S.wkRow, borderLeft:`3px solid ${st==="current"?"#F1C40F":st==="past"?"#2a4a2a":"#2a2a2a"}` }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#ccc" }}>{w.label} · {fmt(w.start)}</div>
                        <div style={{ fontSize:11, color:"#666" }}>{done}/{chs.length} bifate{(WEEKLY_PLAN[w.id]||[]).length===0?" (liber)":""}</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ width:70, height:5, background:"#2a2a2a", borderRadius:3, overflow:"hidden" }}>
                          <div style={{ width:`${pct}%`, height:"100%", background:pct===100?"#6BCB77":"#F1C40F" }} />
                        </div>
                        <span style={{ fontSize:11, color:"#777", minWidth:28 }}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {view === "screenshots" && (
            <>
              <h2 style={S.h2}>Dovezile lui {CONFIG.studentName}</h2>
              {allScreenshots.length===0
                ? <p style={{ color:"#555", fontStyle:"italic" }}>Nicio dovadă încă.</p>
                : <div style={S.cpGrid}>
                    {allScreenshots.map((ch,i) => (
                      <div key={i} style={S.cpCard} onClick={() => setSelectedImg(ch.screenshot)}>
                        <img src={ch.screenshot} alt="" style={S.cpImg} />
                        <div style={{ padding:"8px 10px" }}>
                          <div style={{ fontSize:11, fontWeight:700, color:SUBJECTS[ch.subject].accent }}>{ch.title}</div>
                          <div style={{ fontSize:10, color:"#666", marginTop:2 }}>Quiz: {ch.quizResult?.score||"—"}/10 {ch.quizResult?.passed?"✅":"❌"}</div>
                        </div>
                      </div>
                    ))}
                  </div>
              }
              {selectedImg && (
                <div style={S.lightbox} onClick={() => setSelectedImg(null)}>
                  <img src={selectedImg} alt="" style={{ maxWidth:"90vw", maxHeight:"85vh", borderRadius:12 }} />
                  <div style={{ color:"#888", fontSize:12, marginTop:8 }}>Apasă oriunde pentru a închide</div>
                </div>
              )}
            </>
          )}

          {view === "email" && (
            <>
              <h2 style={S.h2}>Trimite email lui {CONFIG.studentName}</h2>
              <div style={S.card}>
                <div style={S.cardTitle}>🤖 Reminder automat (săptămâna curentă)</div>
                <p style={{ fontSize:12, color:"#777", marginBottom:12, lineHeight:1.6 }}>
                  Trimite un reminder cu progresul curent. Include bara de progres și link-ul la aplicație.
                </p>
                <button style={{ ...S.btnY, opacity:sending?0.5:1 }} onClick={sendReminder} disabled={sending}>
                  {sending?"Se trimite...":"📨 Trimite reminder acum"}
                </button>
              </div>
              <div style={S.card}>
                <div style={S.cardTitle}>✉️ Mesaj personal</div>
                <textarea value={manualMsg} onChange={e=>setManualMsg(e.target.value)}
                  placeholder="Scrie un mesaj personalizat pentru Ari..." style={S.textarea} rows={5} />
                <div style={{ fontSize:11, color:"#555", margin:"4px 0 10px" }}>→ {CONFIG.studentEmail}</div>
                <button style={{ ...S.btnY, opacity:(manualMsg.trim()&&!sending)?1:0.4 }} onClick={sendManualReminder} disabled={!manualMsg.trim()||sending}>
                  {sending?"Se trimite...":"📨 Trimite mesajul"}
                </button>
              </div>
              <div style={{ ...S.card, background:"#141f14", border:"1px solid #1f3a1f" }}>
                <div style={{ fontSize:12, color:"#6BCB77", fontWeight:700, marginBottom:4 }}>⏰ Cron automat vineri 18:00</div>
                <p style={{ fontSize:12, color:"#777", margin:0, lineHeight:1.6 }}>
                  Vercel trimite automat un reminder în fiecare vineri. Necesită <code style={{ color:"#aaa" }}>RESEND_API_KEY</code> și <code style={{ color:"#aaa" }}>CRON_SECRET</code> în Vercel Dashboard.
                </p>
              </div>
            </>
          )}

          {view === "detail" && (
            <>
              <h2 style={S.h2}>Toate capitolele</h2>
              {["romana","matematica"].map(s => {
                const sub=SUBJECTS[s];
                return (
                  <div key={s} style={{ marginBottom:20 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:sub.accent, marginBottom:8 }}>{sub.icon} {sub.label}</div>
                    {sub.chapters.map(ch => {
                      const isDone=!!unlockedChapters[ch.id];
                      const data=ls.get(`chapter_${ch.id}`)||{};
                      const wk=WEEKS.find(w=>(WEEKLY_PLAN[w.id]||[]).some(c=>c.id===ch.id));
                      return (
                        <div key={ch.id} style={{ ...S.detailRow, background:isDone?"#162116":"#1a1a1a" }}>
                          <div style={{ width:10, height:10, borderRadius:"50%", background:isDone?"#6BCB77":"#333", flexShrink:0, marginTop:3 }} />
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, color:isDone?"#6BCB77":"#ddd", fontWeight:600 }}>{ch.title}</div>
                            <div style={{ fontSize:11, color:"#555" }}>{wk?.label}</div>
                          </div>
                          <div style={{ display:"flex", gap:4, flexWrap:"wrap", justifyContent:"flex-end" }}>
                            <MiniTag label="Lecție" done={!!data.content} />
                            <MiniTag label={`Quiz ${data.quizResult?.score||"—"}/10`} done={data.quizResult?.passed} />
                            <MiniTag label="Screenshot" done={!!data.screenshot} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

        </div>
      </main>

      {toast && <div style={S.toast}>{toast}</div>}
      <style>{CSS}</style>
    </div>
  );
}

function Kpi({ label, value, sub, color }) {
  return (
    <div style={S.kpi}>
      <div style={{ fontSize:24, fontWeight:800, color }}>{value}</div>
      <div style={{ fontSize:11, fontWeight:700, color:"#ccc", marginTop:2 }}>{label}</div>
      <div style={{ fontSize:10, color:"#555" }}>{sub}</div>
    </div>
  );
}

function MiniTag({ label, done }) {
  return <span style={{ fontSize:10, padding:"2px 6px", borderRadius:10, background:done?"#1a2e1a":"#222", color:done?"#6BCB77":"#555", border:`1px solid ${done?"#2a4a2a":"#2a2a2a"}` }}>{label}</span>;
}

const S = {
  shell: { background:"#0e0e0e", minHeight:"100vh", fontFamily:"Georgia,'Times New Roman',serif", color:"#eee", paddingBottom:80 },
  header: { background:"#141414", borderBottom:"1px solid #222", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" },
  logo: { fontSize:16, fontWeight:700, color:"#6BCB77" },
  logoSub: { fontSize:11, color:"#555", marginTop:2 },
  logoutBtn: { background:"none", border:"1px solid #333", color:"#888", borderRadius:6, padding:"5px 12px", cursor:"pointer", fontSize:12, fontFamily:"Georgia,serif" },
  nav: { position:"fixed", bottom:0, left:0, right:0, background:"#141414", borderTop:"1px solid #222", display:"flex", zIndex:100 },
  navBtn: { flex:1, background:"none", border:"none", color:"#555", padding:"9px 4px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, fontSize:11, fontFamily:"Georgia,serif" },
  navOn: { color:"#6BCB77" },
  main: { padding:"14px 14px 0" },
  page: { maxWidth:600, margin:"0 auto" },
  h2: { fontSize:15, fontWeight:700, color:"#eee", margin:"0 0 14px", borderBottom:"1px solid #222", paddingBottom:8 },
  kpiGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 },
  kpi: { background:"#1a1a1a", borderRadius:10, padding:"14px 12px" },
  card: { background:"#1a1a1a", borderRadius:12, padding:16, marginBottom:14 },
  cardTitle: { fontWeight:700, fontSize:13, color:"#bbb", marginBottom:8 },
  bigBarBg: { height:20, background:"#222", borderRadius:10, overflow:"hidden", marginBottom:8 },
  bigBarFill: { height:"100%", borderRadius:10, display:"flex", alignItems:"center", transition:"width 0.8s ease", minWidth:24 },
  wkRow: { display:"flex", alignItems:"center", gap:10, padding:"7px 10px", borderRadius:6, marginBottom:4, background:"#161616" },
  cpGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))", gap:10 },
  cpCard: { background:"#1a1a1a", borderRadius:10, overflow:"hidden", cursor:"pointer" },
  cpImg: { width:"100%", height:120, objectFit:"cover" },
  lightbox: { position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", zIndex:500, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"zoom-out" },
  textarea: { width:"100%", background:"#191919", color:"#eee", border:"1px solid #2a2a2a", borderRadius:8, padding:"9px 12px", fontSize:12, resize:"vertical", fontFamily:"Georgia,serif", outline:"none" },
  btnY: { background:"#F1C40F", color:"#111", border:"none", borderRadius:8, padding:"10px 18px", fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"Georgia,serif", width:"100%", display:"block" },
  detailRow: { display:"flex", alignItems:"flex-start", gap:10, padding:"9px 12px", borderRadius:8, marginBottom:4 },
  toast: { position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)", background:"#6BCB77", color:"#111", fontWeight:700, padding:"9px 20px", borderRadius:20, zIndex:400, fontSize:13, boxShadow:"0 4px 20px rgba(0,0,0,0.5)", whiteSpace:"nowrap" },
};

const CSS = `*{box-sizing:border-box;} ::-webkit-scrollbar{display:none;}`;
