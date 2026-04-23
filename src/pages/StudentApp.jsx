import { useState, useEffect, useRef } from "react";
import { ls } from "../utils/storage.js";
import { sendEmail } from "../utils/api.js";
import { SUBJECTS, WEEKS, WEEKLY_PLAN, EXAM_ROMANA, EXAM_MATH, fmt, daysLeft, getWeekStatus, CONFIG } from "../constants.js";
import ChapterPage from "./ChapterPage.jsx";

export default function StudentApp() {
  const [view, setView]           = useState("dashboard"); // dashboard|plan|progress
  const [openChapter, setOpen]    = useState(null);        // { chapterId, subject }
  const [unlockedChapters, setUL] = useState(() => ls.get("unlocked") || {});
  const [activeWeek, setActiveWeek] = useState(() => {
    const cur = WEEKS.find(w => getWeekStatus(w) === "current") || WEEKS[0];
    return cur.id;
  });
  const [toast, setToast] = useState(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  function handleUnlock(chapterId) {
    const updated = { ...unlockedChapters, [chapterId]: true };
    setUL(updated);
    ls.set("unlocked", updated);
    showToast("🎉 Capitol bifat! Bravo Ari!");
    // Notify parent
    const ch = [...SUBJECTS.romana.chapters, ...SUBJECTS.matematica.chapters].find(c => c.id === chapterId);
    sendEmail({
      to: CONFIG.parentEmail,
      subject: `✅ Ari a finalizat: ${ch?.title}`,
      html: `<div style="background:#111;color:#eee;font-family:Georgia,serif;padding:32px;max-width:500px;margin:0 auto;">
<h1 style="color:#6BCB77;font-size:20px;">🏆 Capitol bifat!</h1>
<p style="color:#ccc;font-size:14px;">Ari a trecut quiz-ul și a încărcat dovada pentru <strong style="color:#fff;">${ch?.title}</strong>.</p>
<a href="${window.location.origin}" style="background:#F1C40F;color:#111;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block;margin-top:16px;">Vezi progresul →</a>
</div>`,
    });
  }

  function doneOf(s) { return SUBJECTS[s].chapters.filter(c => unlockedChapters[c.id]).length; }
  function totalOf(s) { return SUBJECTS[s].chapters.length; }
  function doneAll() { return doneOf("romana") + doneOf("matematica"); }
  function totalAll() { return totalOf("romana") + totalOf("matematica"); }

  // Open chapter page
  if (openChapter) {
    return (
      <>
        <ChapterPage
          chapterId={openChapter.chapterId}
          subject={openChapter.subject}
          onBack={() => setOpen(null)}
          onUnlock={handleUnlock}
        />
        {toast && <div style={S.toast}>{toast}</div>}
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </>
    );
  }

  const pct = Math.round((doneAll() / totalAll()) * 100);

  return (
    <div style={S.shell}>
      <header style={S.header}>
        <div>
          <div style={S.logo}>🎓 Planul lui Ari</div>
          <div style={S.logoSub}>Evaluarea Națională 2026</div>
        </div>
        <div style={S.cds}>
          <Cd label="Română" days={daysLeft(EXAM_ROMANA)} color="#FF6B6B" />
          <Cd label="Mate"   days={daysLeft(EXAM_MATH)}   color="#3498DB" />
        </div>
      </header>

      <nav style={S.nav}>
        {[{ id:"dashboard",icon:"🏠",label:"Acasă"},{id:"plan",icon:"📅",label:"Plan"},{id:"progress",icon:"📊",label:"Progres"}].map(i => (
          <button key={i.id} style={{ ...S.navBtn, ...(view === i.id ? S.navOn : {}) }} onClick={() => setView(i.id)}>
            <span style={{ fontSize: 20 }}>{i.icon}</span><span>{i.label}</span>
          </button>
        ))}
      </nav>

      <main style={S.main}>
        {view === "dashboard" && <Dashboard pct={pct} doneAll={doneAll} totalAll={totalAll} doneOf={doneOf} totalOf={totalOf} setView={setView} unlockedChapters={unlockedChapters} setOpen={setOpen} />}
        {view === "plan"      && <Plan activeWeek={activeWeek} setActiveWeek={setActiveWeek} unlockedChapters={unlockedChapters} setOpen={setOpen} />}
        {view === "progress"  && <Progress doneOf={doneOf} totalOf={totalOf} unlockedChapters={unlockedChapters} setOpen={setOpen} />}
      </main>

      {toast && <div style={S.toast}>{toast}</div>}
      <style>{CSS}</style>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ pct, doneAll, totalAll, doneOf, totalOf, setView, unlockedChapters, setOpen }) {
  const curWeek = WEEKS.find(w => getWeekStatus(w) === "current");
  return (
    <div style={S.page}>
      <div style={S.heroCard}>
        <Ring pct={pct} />
        <div style={S.heroText}>
          <div style={S.heroTitle}>Progres total</div>
          <div style={S.heroSub}>{doneAll()} / {totalAll()} capitole bifate</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            <span style={{ color: "#FF6B6B" }}>📖 22 iun</span> · <span style={{ color: "#3498DB" }}>📐 24 iun</span>
          </div>
        </div>
      </div>

      <div style={S.row}>
        {["romana","matematica"].map(s => {
          const sub = SUBJECTS[s]; const done = doneOf(s); const total = totalOf(s);
          const p = Math.round((done/total)*100);
          return (
            <div key={s} style={{ ...S.subCard, borderLeft:`4px solid ${sub.accent}` }}>
              <div style={{ fontSize: 24 }}>{sub.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#eee" }}>{sub.short}</div>
                <div style={{ fontSize:11, color:"#777", margin:"3px 0 5px" }}>{done}/{total} · {p}%</div>
                <div style={S.barBg}><div style={{ ...S.barFill, width:`${p}%`, background:sub.accent }} /></div>
              </div>
            </div>
          );
        })}
      </div>

      {curWeek && (
        <div style={S.card}>
          <div style={S.cardTitle}>📅 Această săptămână</div>
          <div style={{ fontSize:13, color:"#eee", marginBottom:8 }}><strong>{curWeek.label}</strong> · {fmt(curWeek.start)} – {fmt(curWeek.end)}</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {(WEEKLY_PLAN[curWeek.id]||[]).map(ch => {
              const sub = SUBJECTS[ch.subject];
              const done = !!unlockedChapters[ch.id];
              return (
                <button key={ch.id} onClick={() => setOpen({ chapterId:ch.id, subject:ch.subject })}
                  style={{ ...S.chapPill, background: done ? "#1a2e1a" : "#1e1e1e", borderColor: done ? "#4a8a4a" : sub.accent, color: done ? "#6BCB77" : "#eee" }}>
                  {done ? "✅" : sub.icon} {ch.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={S.card}>
        <div style={S.cardTitle}>🔓 Cum bifezi un capitol</div>
        <div style={{ fontSize:12, color:"#888", lineHeight:1.8 }}>
          <div>📚 <strong style={{ color:"#ccc" }}>1. Lecție</strong> — citești materialul generat de Claude</div>
          <div>💬 <strong style={{ color:"#ccc" }}>2. Tutore</strong> — întrebi orice nu ai înțeles</div>
          <div>🧠 <strong style={{ color:"#ccc" }}>3. Quiz</strong> — răspunzi corect la minim 8 din 10 întrebări</div>
          <div>📸 <strong style={{ color:"#ccc" }}>4. Screenshot</strong> — încarci o poză cu ce ai lucrat</div>
          <div style={{ marginTop:6, color:"#F1C40F" }}>→ Abia după AMBELE (quiz + screenshot) capitolul e bifat!</div>
        </div>
      </div>
    </div>
  );
}

// ── PLAN ──────────────────────────────────────────────────────────────────────
function Plan({ activeWeek, setActiveWeek, unlockedChapters, setOpen }) {
  const week = WEEKS.find(w => w.id === activeWeek) || WEEKS[0];
  const chapters = WEEKLY_PLAN[week.id] || [];
  const status = getWeekStatus(week);

  return (
    <div style={S.page}>
      <div style={S.weekScroll}>
        {WEEKS.map(w => {
          const st = getWeekStatus(w); const isAct = w.id === activeWeek;
          const chs = WEEKLY_PLAN[w.id]||[]; const done = chs.filter(c => unlockedChapters[c.id]).length;
          return (
            <button key={w.id} onClick={() => setActiveWeek(w.id)} style={{
              ...S.weekPill, background: isAct ? "#F1C40F" : st==="current" ? "#252525" : "#1a1a1a",
              color: isAct ? "#111" : "#eee", border: st==="current"&&!isAct ? "1px solid #F1C40F55" : "1px solid #2a2a2a",
            }}>
              <div style={{ fontWeight:700, fontSize:11 }}>S{w.num}</div>
              <div style={{ fontSize:10, opacity:0.7 }}>{fmt(w.start)}</div>
              {chs.length>0 && <div style={{ fontSize:10 }}>{done}/{chs.length}✓</div>}
            </button>
          );
        })}
      </div>

      <div style={{ ...S.weekHeader, borderLeft:`4px solid ${status==="current"?"#F1C40F":"#444"}` }}>
        <div>
          <div style={{ fontWeight:700, fontSize:15, color:"#fff" }}>{week.label}</div>
          <div style={{ fontSize:12, color:"#777" }}>{fmt(week.start)} – {fmt(week.end)}</div>
        </div>
        {status==="current" && <span style={S.badgeCur}>CURENTĂ</span>}
        {status==="past"    && <span style={S.badgePast}>FINALIZATĂ</span>}
      </div>

      {chapters.length === 0
        ? <div style={{ textAlign:"center", color:"#444", padding:40, fontStyle:"italic" }}>Niciun capitol alocat.</div>
        : chapters.map(ch => {
            const sub = SUBJECTS[ch.subject]; const done = !!unlockedChapters[ch.id];
            const chapData = ls.get(`chapter_${ch.id}`) || {};
            const quizPassed = chapData.quizResult?.passed;
            const hasScreenshot = !!chapData.screenshot;
            return (
              <button key={ch.id} onClick={() => setOpen({ chapterId:ch.id, subject:ch.subject })} style={S.chapCard}>
                <div style={S.chapCardLeft}>
                  <div style={{ ...S.chapDot, background: done ? "#6BCB77" : "#333" }} />
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color: done ? "#6BCB77" : "#eee" }}>
                      {sub.icon} {ch.title}
                    </div>
                    <div style={{ fontSize:11, color:"#666", marginTop:3 }}>
                      {ch.topics.slice(0,3).join(" · ")}{ch.topics.length>3?"...":""}
                    </div>
                    <div style={{ display:"flex", gap:6, marginTop:6 }}>
                      <MiniCheck done={!!chapData.content} label="Lecție" />
                      <MiniCheck done={quizPassed} label={`Quiz${quizPassed?" ✓":""}`} color="#F1C40F" />
                      <MiniCheck done={hasScreenshot} label="Screenshot" color="#3498DB" />
                    </div>
                  </div>
                </div>
                <div style={{ fontSize:20, color:"#444" }}>›</div>
              </button>
            );
          })
      }
    </div>
  );
}

// ── PROGRESS ──────────────────────────────────────────────────────────────────
function Progress({ doneOf, totalOf, unlockedChapters, setOpen }) {
  return (
    <div style={S.page}>
      <h2 style={S.h2}>Progres pe materie</h2>
      {["romana","matematica"].map(s => {
        const sub = SUBJECTS[s]; const done = doneOf(s); const total = totalOf(s);
        const pct = Math.round((done/total)*100);
        return (
          <div key={s} style={{ marginBottom:24 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ fontSize:13 }}>{sub.icon} <strong style={{ color:"#eee" }}>{sub.label}</strong></span>
              <span style={{ color:sub.accent, fontWeight:700 }}>{pct}%</span>
            </div>
            <div style={S.bigBarBg}>
              <div style={{ ...S.bigBarFill, width:`${pct}%`, background:`linear-gradient(90deg,${sub.color},${sub.accent})` }}>
                <span style={{ fontSize:11, fontWeight:700, color:"#fff", paddingLeft:8 }}>{done}/{total}</span>
              </div>
            </div>
            {sub.chapters.map(ch => {
              const isDone = !!unlockedChapters[ch.id];
              const chapData = ls.get(`chapter_${ch.id}`) || {};
              const quizPassed = chapData.quizResult?.passed;
              return (
                <button key={ch.id} onClick={() => setOpen({ chapterId:ch.id, subject:ch.subject })}
                  style={{ ...S.progRow, background: isDone?"#162116":"#1a1a1a", width:"100%", textAlign:"left", cursor:"pointer", border:"none" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, flex:1 }}>
                    <span style={{ color: isDone?"#6BCB77":"#555", fontSize:14 }}>{isDone?"✅":"⬜"}</span>
                    <span style={{ fontSize:13, color: isDone?"#6BCB77":"#ccc" }}>{ch.title}</span>
                  </div>
                  <div style={{ display:"flex", gap:4 }}>
                    <MiniCheck done={quizPassed} label="Q" />
                    <MiniCheck done={!!chapData.screenshot} label="📸" />
                  </div>
                </button>
              );
            })}
          </div>
        );
      })}

      <h2 style={S.h2}>Timeline</h2>
      <div style={{ paddingLeft:20 }}>
        {WEEKS.filter((_,i) => i%2===0||i===WEEKS.length-1).map(w => {
          const chs = WEEKLY_PLAN[w.id]||[]; const done = chs.filter(c => unlockedChapters[c.id]).length;
          const complete = chs.length>0 && done===chs.length; const st = getWeekStatus(w);
          return (
            <div key={w.id} style={{ display:"flex", gap:12, marginBottom:10 }}>
              <div style={{ width:12, height:12, borderRadius:"50%", flexShrink:0, marginTop:2, background: complete?"#6BCB77":st==="current"?"#F1C40F":"#333", transition:"background 0.3s" }} />
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"#bbb" }}>{w.label} · {fmt(w.start)}</div>
                <div style={{ fontSize:11, color:"#666" }}>{done}/{chs.length} capitole bifate</div>
              </div>
            </div>
          );
        })}
        {[{label:"🏁 Examen Română · 22 iunie",color:"#FF6B6B"},{label:"🏁 Examen Matematică · 24 iunie",color:"#3498DB"}].map(e => (
          <div key={e.label} style={{ display:"flex", gap:12, marginBottom:10 }}>
            <div style={{ width:14, height:14, borderRadius:"50%", flexShrink:0, marginTop:1, background:e.color }} />
            <div style={{ fontSize:13, fontWeight:700, color:e.color }}>{e.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
function MiniCheck({ done, label, color = "#6BCB77" }) {
  return (
    <span style={{ fontSize:10, padding:"1px 6px", borderRadius:10, background: done?"#1a2e1a":"#222", color: done?color:"#555", border:`1px solid ${done?"#2a4a2a":"#2a2a2a"}` }}>
      {label}
    </span>
  );
}

function Ring({ pct }) {
  const size=120; const stroke=10; const r=(size-stroke)/2;
  const circ=2*Math.PI*r; const offset=circ-(pct/100)*circ;
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#2a2a2a" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1C40F" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" style={{ transition:"stroke-dashoffset 1s ease" }} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:20, fontWeight:800, color:"#F1C40F" }}>{pct}%</span>
      </div>
    </div>
  );
}

function Cd({ label, days, color }) {
  return <div style={{ textAlign:"center", minWidth:40 }}><div style={{ fontSize:18, fontWeight:800, color, lineHeight:1 }}>{days}</div><div style={{ fontSize:10, color:"#666" }}>zile {label}</div></div>;
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  shell: { background:"#111", minHeight:"100vh", fontFamily:"Georgia,'Times New Roman',serif", color:"#eee", paddingBottom:70 },
  header: { background:"#181818", borderBottom:"1px solid #222", padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" },
  logo: { fontSize:16, fontWeight:700, color:"#F1C40F" },
  logoSub: { fontSize:11, color:"#555", marginTop:2 },
  cds: { display:"flex", gap:14 },
  nav: { position:"fixed", bottom:0, left:0, right:0, background:"#181818", borderTop:"1px solid #222", display:"flex", zIndex:100 },
  navBtn: { flex:1, background:"none", border:"none", color:"#555", padding:"9px 4px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, fontSize:11, fontFamily:"Georgia,serif" },
  navOn: { color:"#F1C40F" },
  main: { padding:"14px 14px 0" },
  page: { maxWidth:580, margin:"0 auto" },
  h2: { fontSize:15, fontWeight:700, color:"#eee", margin:"0 0 14px", borderBottom:"1px solid #222", paddingBottom:8 },
  heroCard: { background:"#1a1a1a", borderRadius:14, padding:16, display:"flex", alignItems:"center", gap:16, marginBottom:12 },
  heroText: { flex:1 },
  heroTitle: { fontSize:18, fontWeight:700, color:"#fff" },
  heroSub: { fontSize:13, color:"#888", margin:"4px 0" },
  row: { display:"flex", gap:10, marginBottom:12 },
  subCard: { flex:1, background:"#1a1a1a", borderRadius:10, padding:12, display:"flex", gap:10, alignItems:"flex-start" },
  barBg: { height:4, background:"#2a2a2a", borderRadius:2, overflow:"hidden" },
  barFill: { height:"100%", borderRadius:2, transition:"width 0.6s ease" },
  card: { background:"#1a1a1a", borderRadius:12, padding:14, marginBottom:12 },
  cardTitle: { fontWeight:700, fontSize:13, color:"#bbb", marginBottom:8 },
  chapPill: { border:"1px solid", borderRadius:8, padding:"7px 12px", cursor:"pointer", fontSize:12, fontFamily:"Georgia,serif", textAlign:"left" },
  weekScroll: { display:"flex", gap:6, overflowX:"auto", paddingBottom:10, scrollbarWidth:"none" },
  weekPill: { flexShrink:0, borderRadius:8, padding:"7px 10px", cursor:"pointer", fontFamily:"Georgia,serif", minWidth:52, textAlign:"center" },
  weekHeader: { background:"#1a1a1a", borderRadius:10, padding:"12px 14px", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center" },
  badgeCur: { background:"#F1C40F", color:"#111", fontSize:9, fontWeight:800, padding:"2px 7px", borderRadius:20 },
  badgePast: { background:"#252525", color:"#555", fontSize:9, padding:"2px 7px", borderRadius:20 },
  chapCard: { background:"#1a1a1a", borderRadius:10, padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", border:"none", width:"100%", textAlign:"left", fontFamily:"Georgia,serif" },
  chapCardLeft: { display:"flex", alignItems:"flex-start", gap:10, flex:1 },
  chapDot: { width:10, height:10, borderRadius:"50%", flexShrink:0, marginTop:4 },
  bigBarBg: { height:20, background:"#222", borderRadius:10, overflow:"hidden", marginBottom:10 },
  bigBarFill: { height:"100%", borderRadius:10, display:"flex", alignItems:"center", transition:"width 0.8s ease", minWidth:24 },
  progRow: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 10px", borderRadius:6, marginBottom:3 },
  toast: { position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)", background:"#6BCB77", color:"#111", fontWeight:700, padding:"9px 20px", borderRadius:20, zIndex:400, fontSize:13, boxShadow:"0 4px 20px rgba(0,0,0,0.5)", whiteSpace:"nowrap" },
};

const CSS = `@keyframes spin{to{transform:rotate(360deg);}} *{box-sizing:border-box;} ::-webkit-scrollbar{display:none;}`;
