import { useState, useEffect, useRef } from "react";
import { lsGet, lsSet } from "../utils/storage.js";
import { sendEmail, checkInNotifyTemplate } from "../utils/email.js";
import {
  SUBJECTS, WEEKS, WEEKLY_PLAN, EXAM_ROMANA, EXAM_MATH,
  fmt, daysLeft, getWeekStatus, CONFIG,
} from "../constants.js";

export default function StudentApp() {
  const [view, setView] = useState("dashboard");
  const [progress, setProgress] = useState({});
  const [checkpoints, setCheckpoints] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeWeek, setActiveWeek] = useState(null);
  const [uploadModal, setUploadModal] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const p = lsGet("progress") || {};
    const c = lsGet("checkpoints") || {};
    setProgress(p);
    setCheckpoints(c);
    setLoading(false);
    const cur = WEEKS.find(w => getWeekStatus(w) === "current") || WEEKS[0];
    setActiveWeek(cur.id);
  }, []);

  useEffect(() => { if (!loading) lsSet("progress", progress); }, [progress, loading]);
  useEffect(() => { if (!loading) lsSet("checkpoints", checkpoints); }, [checkpoints, loading]);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  function toggleChapter(id) {
    setProgress(p => ({ ...p, [id]: { ...p[id], done: !p[id]?.done } }));
  }

  function doneOf(subject) {
    return SUBJECTS[subject].chapters.filter(c => progress[c.id]?.done).length;
  }
  function totalOf(subject) { return SUBJECTS[subject].chapters.length; }
  function doneAll() { return doneOf("romana") + doneOf("matematica"); }
  function totalAll() { return totalOf("romana") + totalOf("matematica"); }

  async function handleCheckpointSave(weekId, entry) {
    setCheckpoints(prev => {
      const updated = { ...prev, [weekId]: [...(prev[weekId] || []), entry] };
      lsSet("checkpoints", updated);
      return updated;
    });
    // Notify parent
    const week = WEEKS.find(w => w.id === weekId);
    const appUrl = window.location.origin;
    await sendEmail({
      to: CONFIG.parentEmail,
      subject: `📸 ${CONFIG.studentName} a urcat un check-in – ${week?.label}`,
      html: checkInNotifyTemplate({
        studentName: CONFIG.studentName,
        parentName: CONFIG.parentName,
        weekLabel: week?.label || weekId,
        comment: entry.comment,
        appUrl,
      }),
    });
    showToast("✅ Check-in salvat! Tata a fost notificat.");
  }

  if (loading) return <Loader />;

  return (
    <div style={S.shell}>
      <Header daysLeft={daysLeft} />
      <Nav view={view} setView={setView} />
      <main style={S.main}>
        {view === "dashboard" && (
          <Dashboard
            progress={progress} doneAll={doneAll} totalAll={totalAll}
            doneOf={doneOf} totalOf={totalOf} checkpoints={checkpoints}
            setView={setView}
          />
        )}
        {view === "plan" && (
          <Plan
            progress={progress} toggleChapter={toggleChapter}
            activeWeek={activeWeek} setActiveWeek={setActiveWeek}
            setUploadModal={setUploadModal} checkpoints={checkpoints}
          />
        )}
        {view === "progress" && (
          <Progress progress={progress} doneOf={doneOf} totalOf={totalOf} toggleChapter={toggleChapter} />
        )}
        {view === "upload" && (
          <CheckinPage checkpoints={checkpoints} onSave={handleCheckpointSave} showToast={showToast} />
        )}
      </main>

      {uploadModal && (
        <UploadModal weekId={uploadModal} onClose={() => setUploadModal(null)}
          onSave={handleCheckpointSave} showToast={showToast} />
      )}

      {toast && <div style={S.toast}>{toast}</div>}
      <style>{CSS}</style>
    </div>
  );
}

// ── HEADER ────────────────────────────────────────────────────────────────────
function Header({ daysLeft }) {
  return (
    <header style={S.header}>
      <div>
        <div style={S.logo}>🎓 Planul lui Ari</div>
        <div style={S.logoSub}>Evaluarea Națională 2026</div>
      </div>
      <div style={S.countdowns}>
        <Cd label="Română" days={daysLeft(EXAM_ROMANA)} color="#FF6B6B" />
        <Cd label="Mate" days={daysLeft(EXAM_MATH)} color="#3498DB" />
      </div>
    </header>
  );
}

function Cd({ label, days, color }) {
  return (
    <div style={S.cd}>
      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{days}</div>
      <div style={{ fontSize: 10, color: "#777" }}>zile {label}</div>
    </div>
  );
}

// ── NAV ───────────────────────────────────────────────────────────────────────
function Nav({ view, setView }) {
  const items = [
    { id: "dashboard", icon: "🏠", label: "Acasă" },
    { id: "plan",      icon: "📅", label: "Plan" },
    { id: "progress",  icon: "📊", label: "Progres" },
    { id: "upload",    icon: "📸", label: "Check-in" },
  ];
  return (
    <nav style={S.nav}>
      {items.map(i => (
        <button key={i.id} style={{ ...S.navBtn, ...(view === i.id ? S.navBtnOn : {}) }}
          onClick={() => setView(i.id)}>
          <span style={{ fontSize: 20 }}>{i.icon}</span>
          <span>{i.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ progress, doneAll, totalAll, doneOf, totalOf, checkpoints, setView }) {
  const pct = Math.round((doneAll() / totalAll()) * 100);
  const curWeek = WEEKS.find(w => getWeekStatus(w) === "current");
  return (
    <div style={S.page}>
      <div style={S.heroCard}>
        <Ring pct={pct} size={130} />
        <div style={S.heroText}>
          <div style={S.heroTitle}>Progres total</div>
          <div style={S.heroSub}>{doneAll()} / {totalAll()} capitole</div>
          <div style={S.heroDates}>
            <span style={{ color: "#FF6B6B" }}>📖 22 iun</span>
            <span style={{ color: "#3498DB", marginLeft: 12 }}>📐 24 iun</span>
          </div>
        </div>
      </div>

      <div style={S.row}>
        {["romana", "matematica"].map(s => {
          const sub = SUBJECTS[s];
          const done = doneOf(s); const total = totalOf(s);
          const p = Math.round((done / total) * 100);
          return (
            <div key={s} style={{ ...S.subCard, borderLeft: `4px solid ${sub.accent}` }}>
              <div style={{ fontSize: 26 }}>{sub.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={S.subName}>{sub.short}</div>
                <div style={S.subStats}>{done}/{total} · {p}%</div>
                <div style={S.barBg}><div style={{ ...S.barFill, width: `${p}%`, background: sub.accent }} /></div>
              </div>
            </div>
          );
        })}
      </div>

      {curWeek && (
        <div style={S.card}>
          <div style={S.cardTitle}>📅 Această săptămână</div>
          <div style={S.cardBody}><strong>{curWeek.label}</strong> · {fmt(curWeek.start)} – {fmt(curWeek.end)}</div>
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {(WEEKLY_PLAN[curWeek.id] || []).map(ch => (
              <span key={ch.id} style={{ ...S.tag, background: SUBJECTS[ch.subject].color }}>{SUBJECTS[ch.subject].icon} {ch.title}</span>
            ))}
          </div>
          <button style={S.btnY} onClick={() => setView("plan")}>Vezi planul →</button>
        </div>
      )}

      <div style={S.card}>
        <div style={S.cardTitle}>📸 Check-in-uri recente</div>
        {Object.values(checkpoints).flat().length === 0
          ? <p style={S.empty}>Niciun check-in. Urcă prima poză!</p>
          : <div style={S.thumbRow}>
              {Object.values(checkpoints).flat().slice(-4).reverse().map((cp, i) => (
                <div key={i} style={S.thumb}><img src={cp.img} alt="" style={S.thumbImg} /></div>
              ))}
            </div>
        }
        <button style={S.btnG} onClick={() => setView("upload")}>+ Adaugă check-in</button>
      </div>
    </div>
  );
}

// ── PLAN ──────────────────────────────────────────────────────────────────────
function Plan({ progress, toggleChapter, activeWeek, setActiveWeek, setUploadModal, checkpoints }) {
  const week = WEEKS.find(w => w.id === activeWeek) || WEEKS[0];
  const chapters = WEEKLY_PLAN[week.id] || [];
  const status = getWeekStatus(week);

  return (
    <div style={S.page}>
      <div style={S.weekScroll}>
        {WEEKS.map(w => {
          const st = getWeekStatus(w);
          const isActive = w.id === activeWeek;
          const chs = WEEKLY_PLAN[w.id] || [];
          const done = chs.filter(c => progress[c.id]?.done).length;
          return (
            <button key={w.id} onClick={() => setActiveWeek(w.id)} style={{
              ...S.weekPill,
              background: isActive ? "#F1C40F" : st === "current" ? "#252525" : "#1a1a1a",
              color: isActive ? "#111" : "#eee",
              border: st === "current" && !isActive ? "1px solid #F1C40F55" : "1px solid #2a2a2a",
            }}>
              <div style={{ fontWeight: 700, fontSize: 11 }}>S{w.num}</div>
              <div style={{ fontSize: 10, opacity: 0.7 }}>{fmt(w.start)}</div>
              {chs.length > 0 && <div style={{ fontSize: 10 }}>{done}/{chs.length}✓</div>}
            </button>
          );
        })}
      </div>

      <div style={{ ...S.weekHeader, borderLeft: `4px solid ${status === "current" ? "#F1C40F" : "#444"}` }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{week.label}</div>
          <div style={{ fontSize: 12, color: "#777" }}>{fmt(week.start)} – {fmt(week.end)}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {status === "current" && <span style={S.badgeCur}>CURENTĂ</span>}
          {status === "past"    && <span style={S.badgePast}>FINALIZATĂ</span>}
          <button style={S.btnSm} onClick={() => setUploadModal(week.id)}>📸 Check-in</button>
        </div>
      </div>

      {chapters.length === 0
        ? <div style={S.emptyState}>Niciun capitol alocat pentru această săptămână.</div>
        : chapters.map(ch => {
            const sub = SUBJECTS[ch.subject];
            const done = !!progress[ch.id]?.done;
            return (
              <div key={ch.id} style={{ ...S.chapCard, borderLeft: `4px solid ${sub.accent}`, opacity: done ? 0.65 : 1 }}>
                <div style={S.chapRow}>
                  <label style={S.chapLabel}>
                    <input type="checkbox" checked={done} onChange={() => toggleChapter(ch.id)}
                      style={{ marginRight: 10, accentColor: sub.accent, width: 16, height: 16, cursor: "pointer" }} />
                    <span style={{ ...S.chapTitle, textDecoration: done ? "line-through" : "none" }}>
                      {sub.icon} {ch.title}
                    </span>
                  </label>
                  <span style={{ ...S.tag, background: sub.color, flexShrink: 0 }}>{sub.short}</span>
                </div>
                <div style={S.topics}>
                  {ch.topics.map((t, i) => <span key={i} style={S.topic}>• {t}</span>)}
                </div>
              </div>
            );
          })
      }

      {(checkpoints[week.id] || []).length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>📸 Check-in-uri ale săptămânii</div>
          <div style={S.thumbRow}>
            {(checkpoints[week.id] || []).map((cp, i) => (
              <div key={i} style={S.thumb}>
                <img src={cp.img} alt="" style={S.thumbImg} />
                {cp.comment && <div style={{ fontSize: 10, color: "#777", padding: "3px 4px" }}>{cp.comment}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PROGRESS ──────────────────────────────────────────────────────────────────
function Progress({ progress, doneOf, totalOf, toggleChapter }) {
  return (
    <div style={S.page}>
      <h2 style={S.h2}>Progres pe materie</h2>
      {["romana", "matematica"].map(s => {
        const sub = SUBJECTS[s];
        const done = doneOf(s); const total = totalOf(s);
        const pct = Math.round((done / total) * 100);
        return (
          <div key={s} style={{ marginBottom: 28 }}>
            <div style={S.progHead}>
              <span>{sub.icon} <strong style={{ color: "#eee" }}>{sub.label}</strong></span>
              <span style={{ color: sub.accent, fontWeight: 700 }}>{pct}%</span>
            </div>
            <div style={S.bigBarBg}>
              <div style={{ ...S.bigBarFill, width: `${pct}%`, background: `linear-gradient(90deg, ${sub.color}, ${sub.accent})` }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", paddingLeft: 8 }}>{done}/{total}</span>
              </div>
            </div>
            {sub.chapters.map(ch => {
              const isDone = !!progress[ch.id]?.done;
              return (
                <div key={ch.id} style={{ ...S.progRow, background: isDone ? "#1a2e1a" : "#1a1a1a" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }}>
                    <input type="checkbox" checked={isDone} onChange={() => toggleChapter(ch.id)}
                      style={{ accentColor: sub.accent, width: 15, height: 15 }} />
                    <span style={{ fontSize: 13, color: isDone ? "#6BCB77" : "#ccc" }}>{ch.title}</span>
                  </label>
                  {isDone && <span style={{ color: "#6BCB77" }}>✓</span>}
                </div>
              );
            })}
          </div>
        );
      })}

      <h2 style={S.h2}>Timeline până la examene</h2>
      <div style={S.timeline}>
        {WEEKS.filter((_, i) => i % 2 === 0 || i === WEEKS.length - 1).map(w => {
          const chs = WEEKLY_PLAN[w.id] || [];
          const done = chs.filter(c => progress[c.id]?.done).length;
          const complete = chs.length > 0 && done === chs.length;
          const st = getWeekStatus(w);
          return (
            <div key={w.id} style={S.tlItem}>
              <div style={{ ...S.tlDot, background: complete ? "#6BCB77" : st === "current" ? "#F1C40F" : "#333" }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#bbb" }}>{w.label} · {fmt(w.start)}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{done}/{chs.length} capitole</div>
              </div>
            </div>
          );
        })}
        <div style={S.tlItem}>
          <div style={{ ...S.tlDot, background: "#FF6B6B", width: 16, height: 16 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: "#FF6B6B" }}>🏁 Examen Română · 22 iunie</div>
        </div>
        <div style={S.tlItem}>
          <div style={{ ...S.tlDot, background: "#3498DB", width: 16, height: 16 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: "#3498DB" }}>🏁 Examen Matematică · 24 iunie</div>
        </div>
      </div>
    </div>
  );
}

// ── CHECK-IN PAGE ─────────────────────────────────────────────────────────────
function CheckinPage({ checkpoints, onSave, showToast }) {
  const [selWeek, setSelWeek] = useState(
    WEEKS.find(w => getWeekStatus(w) === "current")?.id || WEEKS[0].id
  );
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!preview || sending) return;
    setSending(true);
    await onSave(selWeek, { img: preview, comment, ts: new Date().toISOString() });
    setPreview(null); setComment(""); setSending(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const allCps = WEEKS.flatMap(w => (checkpoints[w.id] || []).map(cp => ({ ...cp, wLabel: w.label })));

  return (
    <div style={S.page}>
      <h2 style={S.h2}>📸 Check-in săptămânal</h2>
      <p style={{ color: "#777", fontSize: 13, marginBottom: 18 }}>
        Fă o poză cu temele sau notițele și urc-o aici. Tata va fi notificat automat pe email.
      </p>

      <div style={S.uploadCard}>
        <select value={selWeek} onChange={e => setSelWeek(e.target.value)} style={S.select}>
          {WEEKS.map(w => <option key={w.id} value={w.id}>{w.label} ({fmt(w.start)} – {fmt(w.end)})</option>)}
        </select>

        <div style={S.dropZone} onClick={() => fileRef.current?.click()}>
          {preview
            ? <img src={preview} alt="preview" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8 }} />
            : <div style={{ textAlign: "center", color: "#555" }}>
                <div style={{ fontSize: 36 }}>📷</div>
                <div style={{ fontSize: 13 }}>Apasă să alegi o poză sau screenshot</div>
              </div>
          }
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />

        <textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Comentariu opțional (ex: am rezolvat exercițiile 1–20 din Mate...)"
          style={S.textarea} rows={3} />

        <button style={{ ...S.btnY, opacity: (preview && !sending) ? 1 : 0.4, cursor: preview ? "pointer" : "not-allowed" }}
          onClick={handleSave} disabled={!preview || sending}>
          {sending ? "Se trimite..." : "✅ Salvează și notifică Tata"}
        </button>
      </div>

      {allCps.length > 0 && (
        <>
          <h2 style={{ ...S.h2, marginTop: 28 }}>Toate check-in-urile mele</h2>
          <div style={S.cpGrid}>
            {allCps.slice().reverse().map((cp, i) => (
              <div key={i} style={S.cpCard}>
                <img src={cp.img} alt="" style={S.cpImg} />
                <div style={{ padding: "6px 10px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#F1C40F" }}>{cp.wLabel}</div>
                  <div style={{ fontSize: 10, color: "#666" }}>{new Date(cp.ts).toLocaleDateString("ro-RO")}</div>
                  {cp.comment && <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>{cp.comment}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── UPLOAD MODAL ──────────────────────────────────────────────────────────────
function UploadModal({ weekId, onClose, onSave, showToast }) {
  const fileRef = useRef();
  const [preview, setPreview] = useState(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const week = WEEKS.find(w => w.id === weekId);

  async function handleSave() {
    if (!preview || sending) return;
    setSending(true);
    await onSave(weekId, { img: preview, comment, ts: new Date().toISOString() });
    setSending(false);
    onClose();
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalTitle}>📸 Check-in · {week?.label}</div>
        <div style={S.dropZone} onClick={() => fileRef.current?.click()}>
          {preview
            ? <img src={preview} alt="preview" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 8 }} />
            : <div style={{ textAlign: "center", color: "#555" }}>
                <div style={{ fontSize: 32 }}>📷</div>
                <div style={{ fontSize: 12 }}>Alege o poză cu temele</div>
              </div>
          }
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setPreview(ev.target.result); r.readAsDataURL(f); }} />
        <textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Comentariu opțional..." style={{ ...S.textarea, marginTop: 10 }} rows={2} />
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button style={{ ...S.btnGray, flex: 1 }} onClick={onClose}>Anulează</button>
          <button style={{ ...S.btnY, flex: 1, marginTop: 0, opacity: (preview && !sending) ? 1 : 0.4 }}
            onClick={handleSave} disabled={!preview || sending}>
            {sending ? "..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PROGRESS RING ─────────────────────────────────────────────────────────────
function Ring({ pct, size }) {
  const stroke = 11; const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#2a2a2a" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1C40F" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.17, fontWeight: 800, color: "#F1C40F" }}>{pct}%</span>
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ background: "#111", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #222", borderTop: "3px solid #F1C40F", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  shell: { background: "#111", minHeight: "100vh", fontFamily: "Georgia,'Times New Roman',serif", color: "#eee", paddingBottom: 80 },
  header: { background: "#181818", borderBottom: "1px solid #222", padding: "10px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { fontSize: 17, fontWeight: 700, color: "#F1C40F" },
  logoSub: { fontSize: 11, color: "#555", marginTop: 2 },
  countdowns: { display: "flex", gap: 14 },
  cd: { textAlign: "center", minWidth: 42 },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#181818", borderTop: "1px solid #222", display: "flex", zIndex: 100 },
  navBtn: { flex: 1, background: "none", border: "none", color: "#555", padding: "9px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 11, fontFamily: "Georgia,serif" },
  navBtnOn: { color: "#F1C40F" },
  main: { padding: "14px 14px 0" },
  page: { maxWidth: 580, margin: "0 auto" },
  h2: { fontSize: 15, fontWeight: 700, color: "#eee", margin: "0 0 14px", borderBottom: "1px solid #222", paddingBottom: 8 },

  heroCard: { background: "#1a1a1a", borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 18, marginBottom: 14 },
  heroText: { flex: 1 },
  heroTitle: { fontSize: 19, fontWeight: 700, color: "#fff" },
  heroSub: { fontSize: 13, color: "#888", margin: "4px 0" },
  heroDates: { fontSize: 13, marginTop: 6 },

  row: { display: "flex", gap: 10, marginBottom: 14 },
  subCard: { flex: 1, background: "#1a1a1a", borderRadius: 10, padding: 12, display: "flex", gap: 10, alignItems: "flex-start" },
  subName: { fontSize: 12, fontWeight: 700, color: "#eee" },
  subStats: { fontSize: 11, color: "#777", margin: "3px 0 5px" },
  barBg: { height: 4, background: "#2a2a2a", borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2, transition: "width 0.6s ease" },

  card: { background: "#1a1a1a", borderRadius: 12, padding: 16, marginBottom: 14 },
  cardTitle: { fontWeight: 700, fontSize: 13, color: "#bbb", marginBottom: 10 },
  cardBody: { fontSize: 13, color: "#eee", marginBottom: 6 },
  tag: { display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 10, color: "#fff", margin: "2px 3px 2px 0" },
  empty: { color: "#555", fontSize: 13 },
  thumbRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  thumb: { width: 66, height: 66, borderRadius: 8, overflow: "hidden", background: "#2a2a2a" },
  thumbImg: { width: "100%", height: "100%", objectFit: "cover" },

  btnY: { background: "#F1C40F", color: "#111", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13, marginTop: 12, fontFamily: "Georgia,serif", width: "100%" },
  btnG: { background: "#1e3a1e", color: "#6BCB77", border: "1px solid #2a4a2a", borderRadius: 8, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13, marginTop: 10, fontFamily: "Georgia,serif" },
  btnGray: { background: "#2a2a2a", color: "#ccc", border: "none", borderRadius: 8, padding: "10px", cursor: "pointer", fontFamily: "Georgia,serif" },
  btnSm: { background: "#2a2a2a", color: "#eee", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "Georgia,serif" },

  weekScroll: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" },
  weekPill: { flexShrink: 0, borderRadius: 8, padding: "7px 10px", cursor: "pointer", fontFamily: "Georgia,serif", minWidth: 52, textAlign: "center" },
  weekHeader: { background: "#1a1a1a", borderRadius: 10, padding: "12px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
  badgeCur: { background: "#F1C40F", color: "#111", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 20 },
  badgePast: { background: "#252525", color: "#555", fontSize: 9, padding: "2px 7px", borderRadius: 20 },

  chapCard: { background: "#1a1a1a", borderRadius: 10, padding: 13, marginBottom: 8 },
  chapRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  chapLabel: { display: "flex", alignItems: "center", cursor: "pointer", flex: 1 },
  chapTitle: { fontWeight: 700, fontSize: 13, color: "#eee" },
  topics: { marginTop: 7, display: "flex", flexWrap: "wrap", gap: 4 },
  topic: { fontSize: 11, color: "#777" },
  emptyState: { textAlign: "center", color: "#444", padding: 40, fontStyle: "italic", fontSize: 14 },

  progHead: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, fontSize: 13 },
  bigBarBg: { height: 22, background: "#222", borderRadius: 11, overflow: "hidden", marginBottom: 10 },
  bigBarFill: { height: "100%", borderRadius: 11, display: "flex", alignItems: "center", transition: "width 0.8s ease", minWidth: 28 },
  progRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 6, marginBottom: 3 },

  timeline: { paddingLeft: 20 },
  tlItem: { display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  tlDot: { width: 12, height: 12, borderRadius: "50%", flexShrink: 0, marginTop: 2, transition: "background 0.3s" },

  uploadCard: { background: "#1a1a1a", borderRadius: 14, padding: 18, marginBottom: 18 },
  select: { width: "100%", background: "#222", color: "#eee", border: "1px solid #2a2a2a", borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 12, fontFamily: "Georgia,serif", outline: "none" },
  dropZone: { background: "#191919", border: "2px dashed #2a2a2a", borderRadius: 10, padding: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 110, marginBottom: 10 },
  textarea: { width: "100%", background: "#191919", color: "#eee", border: "1px solid #2a2a2a", borderRadius: 8, padding: "9px 12px", fontSize: 12, resize: "vertical", fontFamily: "Georgia,serif", outline: "none" },

  cpGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 10 },
  cpCard: { background: "#1a1a1a", borderRadius: 10, overflow: "hidden" },
  cpImg: { width: "100%", height: 110, objectFit: "cover" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "#1a1a1a", borderRadius: 16, padding: 20, width: "100%", maxWidth: 360, border: "1px solid #2a2a2a" },
  modalTitle: { fontWeight: 700, fontSize: 16, color: "#F1C40F", marginBottom: 14 },
  toast: { position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#F1C40F", color: "#111", fontWeight: 700, padding: "9px 20px", borderRadius: 20, zIndex: 400, fontSize: 13, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", whiteSpace: "nowrap" },
};

const CSS = `@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; } ::-webkit-scrollbar { display: none; } select option { background: #222; }`;
