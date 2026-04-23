import { useState, useEffect } from "react";
import { lsGet } from "../utils/storage.js";
import { sendEmail, reminderTemplate, manualReminderTemplate } from "../utils/email.js";
import {
  SUBJECTS, WEEKS, WEEKLY_PLAN, EXAM_ROMANA, EXAM_MATH,
  fmt, daysLeft, getWeekStatus, CONFIG,
} from "../constants.js";

export default function AdminApp({ onLogout }) {
  const [view, setView] = useState("overview");
  const [progress, setProgress] = useState({});
  const [checkpoints, setCheckpoints] = useState({});
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(null);
  const [manualMsg, setManualMsg] = useState("");
  const [selectedImg, setSelectedImg] = useState(null);

  // Read live from localStorage (student's data)
  useEffect(() => {
    function load() {
      setProgress(lsGet("progress") || {});
      setCheckpoints(lsGet("checkpoints") || {});
    }
    load();
    const interval = setInterval(load, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  function doneOf(subject) {
    return SUBJECTS[subject].chapters.filter(c => progress[c.id]?.done).length;
  }
  function totalOf(s) { return SUBJECTS[s].chapters.length; }
  function doneAll() { return doneOf("romana") + doneOf("matematica"); }
  function totalAll() { return totalOf("romana") + totalOf("matematica"); }

  async function sendAutoReminder() {
    setSending(true);
    const curWeek = WEEKS.find(w => getWeekStatus(w) === "current") || WEEKS[0];
    const chs = WEEKLY_PLAN[curWeek.id] || [];
    const done = chs.filter(c => progress[c.id]?.done).length;
    const appUrl = window.location.origin;
    const html = reminderTemplate({
      studentName: CONFIG.studentName,
      weekLabel: curWeek.label,
      weekStart: fmt(curWeek.start),
      weekEnd: fmt(curWeek.end),
      doneChapters: done,
      totalChapters: chs.length,
      appUrl,
    });
    const res = await sendEmail({
      to: CONFIG.studentEmail,
      subject: `📚 Reminder studiu – ${curWeek.label} · EN 2026`,
      html,
    });
    setSending(false);
    if (res.ok) showToast("✅ Reminder trimis lui Ari!");
    else showToast("❌ Eroare la trimitere. Verifică RESEND_API_KEY.");
  }

  async function sendManualMessage() {
    if (!manualMsg.trim()) return;
    setSending(true);
    const html = manualReminderTemplate({
      studentName: CONFIG.studentName,
      message: manualMsg,
      appUrl: window.location.origin,
    });
    const res = await sendEmail({
      to: CONFIG.studentEmail,
      subject: `✉️ Mesaj de la Tata – EN 2026`,
      html,
    });
    setSending(false);
    if (res.ok) { showToast("✅ Mesaj trimis!"); setManualMsg(""); }
    else showToast("❌ Eroare. Verifică configurația Resend.");
  }

  const allCps = WEEKS.flatMap(w =>
    (checkpoints[w.id] || []).map(cp => ({ ...cp, weekLabel: w.label, weekId: w.id }))
  ).reverse();

  const overallPct = Math.round((doneAll() / totalAll()) * 100);

  return (
    <div style={S.shell}>
      {/* Header */}
      <header style={S.header}>
        <div>
          <div style={S.logo}>👨‍💼 Panou Admin</div>
          <div style={S.logoSub}>Progresul lui {CONFIG.studentName} · EN 2026</div>
        </div>
        <button style={S.logoutBtn} onClick={onLogout}>← Ieșire</button>
      </header>

      {/* Nav */}
      <nav style={S.nav}>
        {[
          { id: "overview", icon: "📊", label: "Overview" },
          { id: "checkins", icon: "📸", label: "Check-in-uri" },
          { id: "email",    icon: "✉️",  label: "Email" },
          { id: "chapters", icon: "📋", label: "Capitole" },
        ].map(i => (
          <button key={i.id} style={{ ...S.navBtn, ...(view === i.id ? S.navBtnOn : {}) }}
            onClick={() => setView(i.id)}>
            <span style={{ fontSize: 18 }}>{i.icon}</span>
            <span>{i.label}</span>
          </button>
        ))}
      </nav>

      <main style={S.main}>
        <div style={S.page}>

          {/* ── OVERVIEW ── */}
          {view === "overview" && (
            <>
              {/* KPI row */}
              <div style={S.kpiRow}>
                <Kpi label="Progres total" value={`${overallPct}%`} sub={`${doneAll()}/${totalAll()} capitole`} color="#F1C40F" />
                <Kpi label="Zile până la Română" value={daysLeft(EXAM_ROMANA)} sub="22 iunie 2026" color="#FF6B6B" />
                <Kpi label="Zile până la Mate" value={daysLeft(EXAM_MATH)} sub="24 iunie 2026" color="#3498DB" />
                <Kpi label="Check-in-uri" value={allCps.length} sub="total încărcate" color="#6BCB77" />
              </div>

              {/* Per subject */}
              {["romana", "matematica"].map(s => {
                const sub = SUBJECTS[s]; const done = doneOf(s); const total = totalOf(s);
                const pct = Math.round((done / total) * 100);
                return (
                  <div key={s} style={S.card}>
                    <div style={S.cardHead}>
                      <span>{sub.icon} <strong style={{ color: "#fff" }}>{sub.label}</strong></span>
                      <span style={{ color: sub.accent, fontWeight: 700, fontSize: 18 }}>{pct}%</span>
                    </div>
                    <div style={S.bigBarBg}>
                      <div style={{ ...S.bigBarFill, width: `${pct}%`, background: `linear-gradient(90deg,${sub.color},${sub.accent})` }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", paddingLeft: 8 }}>{done}/{total}</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      Examen: <strong style={{ color: sub.accent }}>{sub.short === "Română" ? "22 iunie" : "24 iunie"}</strong>
                    </div>
                  </div>
                );
              })}

              {/* Weekly overview table */}
              <div style={S.card}>
                <div style={S.cardTitle}>Progres pe săptămâni</div>
                {WEEKS.map(w => {
                  const chs = WEEKLY_PLAN[w.id] || [];
                  const done = chs.filter(c => progress[c.id]?.done).length;
                  const pct = chs.length ? Math.round((done / chs.length) * 100) : 0;
                  const st = getWeekStatus(w);
                  const cpCount = (checkpoints[w.id] || []).length;
                  return (
                    <div key={w.id} style={{ ...S.wkRow, borderLeft: `3px solid ${st === "current" ? "#F1C40F" : st === "past" ? "#2a5a2a" : "#2a2a2a"}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#ccc" }}>{w.label}</span>
                          {st === "current" && <span style={S.badgeCur}>CURENTĂ</span>}
                          {st === "past"    && <span style={S.badgeDone}>✓</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "#666" }}>{fmt(w.start)} – {fmt(w.end)} · 📸 {cpCount}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 80, height: 6, background: "#2a2a2a", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#6BCB77" : "#F1C40F", borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 11, color: "#888", minWidth: 28 }}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── CHECK-INS ── */}
          {view === "checkins" && (
            <>
              <h2 style={S.h2}>Toate check-in-urile lui {CONFIG.studentName}</h2>
              {allCps.length === 0
                ? <p style={{ color: "#555", fontStyle: "italic" }}>Niciun check-in încă.</p>
                : (
                  <div style={S.cpGrid}>
                    {allCps.map((cp, i) => (
                      <div key={i} style={S.cpCard} onClick={() => setSelectedImg(cp.img)}>
                        <img src={cp.img} alt="" style={S.cpImg} />
                        <div style={{ padding: "8px 10px" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#F1C40F" }}>{cp.weekLabel}</div>
                          <div style={{ fontSize: 10, color: "#666" }}>{new Date(cp.ts).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" })}</div>
                          {cp.comment && <div style={{ fontSize: 11, color: "#999", marginTop: 3 }}>"{cp.comment}"</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
              {/* Lightbox */}
              {selectedImg && (
                <div style={S.lightbox} onClick={() => setSelectedImg(null)}>
                  <img src={selectedImg} alt="full" style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 12 }} />
                </div>
              )}
            </>
          )}

          {/* ── EMAIL ── */}
          {view === "email" && (
            <>
              <h2 style={S.h2}>Trimite email lui {CONFIG.studentName}</h2>

              {/* Auto reminder */}
              <div style={S.card}>
                <div style={S.cardTitle}>🤖 Reminder automat (săptămâna curentă)</div>
                <p style={S.cardDesc}>
                  Trimite un email de reminder lui Ari cu progresul din săptămâna curentă.
                  Emailul se trimite automat și vineri seara prin Vercel Cron.
                </p>
                <div style={S.emailPreview}>
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Către: {CONFIG.studentEmail}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>CC: {CONFIG.parentEmail}</div>
                </div>
                <button style={{ ...S.btnY, opacity: sending ? 0.5 : 1 }} onClick={sendAutoReminder} disabled={sending}>
                  {sending ? "Se trimite..." : "📨 Trimite reminder acum"}
                </button>
              </div>

              {/* Manual message */}
              <div style={S.card}>
                <div style={S.cardTitle}>✉️ Mesaj personal de la Tata</div>
                <p style={S.cardDesc}>Scrie un mesaj personalizat care va fi trimis pe emailul lui Ari.</p>
                <textarea
                  value={manualMsg}
                  onChange={e => setManualMsg(e.target.value)}
                  placeholder={`Ex: Ari, am văzut că nu ai bifat capitolele din săptămâna asta. Hai că poți! 💪`}
                  style={S.textarea} rows={5}
                />
                <div style={{ fontSize: 11, color: "#555", margin: "4px 0 8px" }}>
                  Către: {CONFIG.studentEmail}
                </div>
                <button style={{ ...S.btnY, opacity: (manualMsg.trim() && !sending) ? 1 : 0.4 }}
                  onClick={sendManualMessage} disabled={!manualMsg.trim() || sending}>
                  {sending ? "Se trimite..." : "📨 Trimite mesajul"}
                </button>
              </div>

              {/* Cron info */}
              <div style={{ ...S.card, background: "#141f14", border: "1px solid #1f3a1f" }}>
                <div style={{ fontSize: 12, color: "#6BCB77", fontWeight: 700, marginBottom: 6 }}>⏰ Reminder automat vineri</div>
                <p style={{ fontSize: 12, color: "#777", margin: 0, lineHeight: 1.6 }}>
                  Vercel Cron rulează automat în fiecare <strong style={{ color: "#ccc" }}>vineri la 18:00</strong> și trimite un reminder lui Ari dacă nu a bifat
                  capitolele. Nu trebuie să faci nimic — funcționează automat după deploy.
                  Configurarea e în <code style={{ color: "#aaa" }}>vercel.json</code> și necesită <code style={{ color: "#aaa" }}>RESEND_API_KEY</code> setat în Vercel Dashboard.
                </p>
              </div>
            </>
          )}

          {/* ── CHAPTERS ── */}
          {view === "chapters" && (
            <>
              <h2 style={S.h2}>Detaliu capitole</h2>
              {["romana", "matematica"].map(s => {
                const sub = SUBJECTS[s];
                return (
                  <div key={s} style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: sub.accent, marginBottom: 8 }}>
                      {sub.icon} {sub.label}
                    </div>
                    {sub.chapters.map(ch => {
                      const isDone = !!progress[ch.id]?.done;
                      // find which week
                      const wk = WEEKS.find(w => (WEEKLY_PLAN[w.id] || []).some(c => c.id === ch.id));
                      return (
                        <div key={ch.id} style={{ ...S.chapRow, background: isDone ? "#162116" : "#1a1a1a" }}>
                          <div style={{ ...S.chapDot, background: isDone ? "#6BCB77" : "#333" }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: isDone ? "#6BCB77" : "#ddd", fontWeight: 600 }}>{ch.title}</div>
                            <div style={{ fontSize: 11, color: "#555" }}>
                              {wk?.label} · {ch.topics.slice(0, 3).join(", ")}{ch.topics.length > 3 ? "..." : ""}
                            </div>
                          </div>
                          <span style={{ fontSize: isDone ? 14 : 11, color: isDone ? "#6BCB77" : "#444" }}>
                            {isDone ? "✓ Bifat" : "—"}
                          </span>
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

// ── KPI CARD ──────────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, color }) {
  return (
    <div style={S.kpi}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#ccc", marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 10, color: "#555" }}>{sub}</div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  shell: { background: "#0e0e0e", minHeight: "100vh", fontFamily: "Georgia,'Times New Roman',serif", color: "#eee", paddingBottom: 80 },
  header: { background: "#141414", borderBottom: "1px solid #222", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { fontSize: 16, fontWeight: 700, color: "#6BCB77" },
  logoSub: { fontSize: 11, color: "#555", marginTop: 2 },
  logoutBtn: { background: "none", border: "1px solid #333", color: "#888", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif" },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#141414", borderTop: "1px solid #222", display: "flex", zIndex: 100 },
  navBtn: { flex: 1, background: "none", border: "none", color: "#555", padding: "9px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 11, fontFamily: "Georgia,serif" },
  navBtnOn: { color: "#6BCB77" },
  main: { padding: "14px 14px 0" },
  page: { maxWidth: 600, margin: "0 auto" },
  h2: { fontSize: 15, fontWeight: 700, color: "#eee", margin: "0 0 14px", borderBottom: "1px solid #222", paddingBottom: 8 },

  kpiRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 },
  kpi: { background: "#1a1a1a", borderRadius: 10, padding: "14px 12px" },

  card: { background: "#1a1a1a", borderRadius: 12, padding: 16, marginBottom: 14 },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 13 },
  cardTitle: { fontWeight: 700, fontSize: 13, color: "#bbb", marginBottom: 8 },
  cardDesc: { fontSize: 12, color: "#777", marginBottom: 12, lineHeight: 1.6 },

  bigBarBg: { height: 20, background: "#222", borderRadius: 10, overflow: "hidden", marginBottom: 8 },
  bigBarFill: { height: "100%", borderRadius: 10, display: "flex", alignItems: "center", transition: "width 0.8s ease", minWidth: 24 },

  wkRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 6, marginBottom: 4, background: "#161616" },
  badgeCur: { background: "#F1C40F", color: "#111", fontSize: 8, fontWeight: 800, padding: "1px 5px", borderRadius: 10 },
  badgeDone: { color: "#6BCB77", fontSize: 11 },

  emailPreview: { background: "#161616", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12 },
  textarea: { width: "100%", background: "#191919", color: "#eee", border: "1px solid #2a2a2a", borderRadius: 8, padding: "9px 12px", fontSize: 12, resize: "vertical", fontFamily: "Georgia,serif", outline: "none" },
  btnY: { background: "#F1C40F", color: "#111", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13, marginTop: 0, fontFamily: "Georgia,serif", width: "100%" },

  cpGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 10 },
  cpCard: { background: "#1a1a1a", borderRadius: 10, overflow: "hidden", cursor: "pointer", transition: "transform 0.15s", ":hover": { transform: "scale(1.02)" } },
  cpImg: { width: "100%", height: 120, objectFit: "cover" },

  chapRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", borderRadius: 8, marginBottom: 4 },
  chapDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0, marginTop: 3 },

  lightbox: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.95)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" },
  toast: { position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#6BCB77", color: "#111", fontWeight: 700, padding: "9px 20px", borderRadius: 20, zIndex: 400, fontSize: 13, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", whiteSpace: "nowrap" },
};

const CSS = `* { box-sizing: border-box; } ::-webkit-scrollbar { display: none; } select option { background: #222; }`;
