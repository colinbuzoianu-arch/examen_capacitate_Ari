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
    function load() { setUL(ls.get("unlocked") || {}); }
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  function doneOf(s) { return SUBJECTS[s].chapters.filter(c => unlockedChapters[c.id]).length; }
  function totalOf(s) { return SUBJECTS[s].chapters.length; }
  function doneAll() { return doneOf("romana") + doneOf("matematica"); }
  function totalAll() { return totalOf("romana") + totalOf("matematica"); }

  const allScreenshots = [];
  [...SUBJECTS.romana.chapters, ...SUBJECTS.matematica.chapters].forEach(ch => {
    const data = ls.get(`chapter_${ch.id}`);
    if (data?.screenshot) allScreenshots.push({ ...ch, screenshot: data.screenshot, quizResult: data.quizResult });
  });

  async function sendReminder() {
    setSending(true);
    const curWeek = WEEKS.find(w => getWeekStatus(w) === "current") || WEEKS[0];
    const chs = WEEKLY_PLAN[curWeek.id] || [];
    const done = chs.filter(c => unlockedChapters[c.id]).length;
    const pct = chs.length ? Math.round((done / chs.length) * 100) : 0;
    const res = await sendEmail({
      to: CONFIG.studentEmail,
      subject: `📚 Reminder studiu – ${curWeek.label} · EN 2026`,
      html: `<div style="background:#F0EDE6;font-family:Georgia,serif;padding:32px;max-width:500px;margin:0 auto;">
<div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #E8E4DC;">
<h1 style="font-size:20px;color:#1A1A1A;margin:0 0 8px;">📚 Reminder – ${curWeek.label}</h1>
<p style="font-size:13px;color:#666;line-height:1.6;">Hai Ari! ${done}/${chs.length} capitole bifate (${pct}%). Nu uita: quiz 8/10 + screenshot pentru fiecare capitol! 💪</p>
<a href="${window.location.origin}" style="display:inline-block;margin-top:16px;background:#1A1A1A;color:#fff;padding:11px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;">Deschide planul →</a>
</div></div>`,
    });
    setSending(false);
    if (res.ok) showToast("✅ Reminder trimis!"); else showToast("❌ Eroare. Verifică RESEND_API_KEY.");
  }

  async function sendManualMessage() {
    if (!manualMsg.trim()) return;
    setSending(true);
    const res = await sendEmail({
      to: CONFIG.studentEmail,
      subject: "✉️ Mesaj de la Tata – EN 2026",
      html: `<div style="background:#F0EDE6;font-family:Georgia,serif;padding:32px;max-width:500px;margin:0 auto;">
<div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #E8E4DC;">
<h1 style="font-size:20px;color:#1A1A1A;margin:0 0 16px;">✉️ Mesaj de la Tata</h1>
<div style="background:#F8F6F2;border-radius:10px;padding:16px;border-left:3px solid #C8A84B;margin-bottom:20px;">
<p style="font-size:14px;color:#333;line-height:1.7;margin:0;">${manualMsg.replace(/\n/g, "<br/>")}</p>
</div>
<a href="${window.location.origin}" style="display:inline-block;background:#1A1A1A;color:#fff;padding:11px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;">Deschide planul →</a>
</div></div>`,
    });
    setSending(false);
    if (res.ok) { showToast("✅ Mesaj trimis!"); setManualMsg(""); }
    else showToast("❌ Eroare. Verifică RESEND_API_KEY.");
  }

  const overallPct = Math.round((doneAll() / totalAll()) * 100);

  return (
    <div style={S.shell}>
      <header style={S.header}>
        <div>
          <div style={S.logo}>Panou Tata 👨‍💼</div>
          <div style={S.logoSub}>Progresul lui {CONFIG.studentName} · EN 2026</div>
        </div>
        <button style={S.logoutBtn} onClick={onLogout}>← Ieșire</button>
      </header>

      <nav style={S.nav}>
        {[
          { id: "overview",    icon: "📊", label: "Overview" },
          { id: "screenshots", icon: "📸", label: "Dovezi" },
          { id: "email",       icon: "✉️",  label: "Email" },
          { id: "detail",      icon: "📋", label: "Detaliu" },
        ].map(i => (
          <button key={i.id} style={{ ...S.navBtn, ...(view === i.id ? S.navOn : {}) }} onClick={() => setView(i.id)}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{i.icon}</span><span>{i.label}</span>
          </button>
        ))}
      </nav>

      <main style={S.main}>
        <div style={S.page}>

          {view === "overview" && (
            <>
              <div style={S.kpiGrid}>
                <Kpi label="Progres total" value={`${overallPct}%`} sub={`${doneAll()}/${totalAll()} capitole`} color="#C8A84B" />
                <Kpi label="Zile Română"   value={daysLeft(EXAM_ROMANA)} sub="22 Iunie 2026" color="#FF8A65" />
                <Kpi label="Zile Mate"     value={daysLeft(EXAM_MATH)}   sub="24 Iunie 2026" color="#64B5F6" />
                <Kpi label="Dovezi"        value={allScreenshots.length}  sub="screenshots"   color="#52A852" />
              </div>

              {["romana", "matematica"].map(s => {
                const sub = SUBJECTS[s]; const done = doneOf(s); const total = totalOf(s);
                const pct = Math.round((done / total) * 100);
                const accent = s === "romana" ? "#FF8A65" : "#64B5F6";
                return (
                  <div key={s} style={S.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <span style={S.cardTitle}>{sub.icon} {sub.label}</span>
                      <span style={{ fontWeight: 700, fontSize: 16, color: accent, fontFamily: "'Syne',sans-serif" }}>{pct}%</span>
                    </div>
                    <div style={S.bigBarBg}>
                      <div style={{ ...S.bigBarFill, width: `${pct}%`, background: accent }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#AAA" }}>{done}/{total} capitole bifate</div>
                  </div>
                );
              })}

              <div style={S.card}>
                <div style={S.cardTitle}>Progres pe săptămâni</div>
                <div style={{ marginTop: 10 }}>
                  {WEEKS.map(w => {
                    const chs = WEEKLY_PLAN[w.id] || []; const done = chs.filter(c => unlockedChapters[c.id]).length;
                    const pct = chs.length ? Math.round((done / chs.length) * 100) : 0; const st = getWeekStatus(w);
                    return (
                      <div key={w.id} style={{ ...S.wkRow, borderLeftColor: st === "current" ? "#C8A84B" : st === "past" ? "#52A852" : "#E0DBD0" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#333", fontFamily: "'Inter',sans-serif" }}>{w.label} · {fmt(w.start)}</div>
                          <div style={{ fontSize: 10, color: "#AAA" }}>{done}/{chs.length} bifate</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 72, height: 5, background: "#EAE6DF", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#52A852" : "#C8A84B", borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, color: "#AAA", minWidth: 28, fontFamily: "'Inter',sans-serif" }}>{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {view === "screenshots" && (
            <>
              <div style={S.cardTitle}>Dovezile lui {CONFIG.studentName}</div>
              <div style={{ marginTop: 12 }}>
                {allScreenshots.length === 0
                  ? <p style={{ color: "#AAA", fontStyle: "italic", fontSize: 13 }}>Nicio dovadă încă.</p>
                  : <div style={S.cpGrid}>
                      {allScreenshots.map((ch, i) => (
                        <div key={i} style={S.cpCard} onClick={() => setSelectedImg(ch.screenshot)}>
                          <img src={ch.screenshot} alt="" style={S.cpImg} />
                          <div style={{ padding: "8px 10px" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: ch.subject === "romana" ? "#FF8A65" : "#64B5F6", fontFamily: "'Syne',sans-serif" }}>{ch.title}</div>
                            <div style={{ fontSize: 10, color: "#AAA", marginTop: 2 }}>Quiz: {ch.quizResult?.score || "—"}/10 {ch.quizResult?.passed ? "✅" : "❌"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                }
              </div>
              {selectedImg && (
                <div style={S.lightbox} onClick={() => setSelectedImg(null)}>
                  <img src={selectedImg} alt="" style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 16 }} />
                  <div style={{ color: "#fff", fontSize: 12, marginTop: 12, opacity: 0.6 }}>Apasă oriunde pentru a închide</div>
                </div>
              )}
            </>
          )}

          {view === "email" && (
            <>
              <div style={S.card}>
                <div style={S.cardTitle}>🤖 Reminder automat</div>
                <p style={{ fontSize: 12, color: "#888", margin: "8px 0 14px", lineHeight: 1.6 }}>
                  Trimite un email cu progresul săptămânii curente. Include bara de progres și link la aplicație.
                </p>
                <div style={{ fontSize: 11, color: "#AAA", marginBottom: 12 }}>Către: {CONFIG.studentEmail}</div>
                <button style={{ ...S.btnDark, opacity: sending ? 0.5 : 1 }} onClick={sendReminder} disabled={sending}>
                  {sending ? "Se trimite..." : "📨 Trimite reminder acum"}
                </button>
              </div>

              <div style={S.card}>
                <div style={S.cardTitle}>✉️ Mesaj personal de la Tata</div>
                <p style={{ fontSize: 12, color: "#888", margin: "8px 0 12px", lineHeight: 1.6 }}>
                  Scrie un mesaj personalizat pentru Ari.
                </p>
                <textarea value={manualMsg} onChange={e => setManualMsg(e.target.value)}
                  placeholder="Ex: Ari, am văzut că ai bifat primul capitol! Continuă așa! 💪"
                  style={S.textarea} rows={5} />
                <div style={{ fontSize: 11, color: "#AAA", margin: "6px 0 12px" }}>Către: {CONFIG.studentEmail}</div>
                <button style={{ ...S.btnDark, opacity: (manualMsg.trim() && !sending) ? 1 : 0.4 }}
                  onClick={sendManualMessage} disabled={!manualMsg.trim() || sending}>
                  {sending ? "Se trimite..." : "📨 Trimite mesajul"}
                </button>
              </div>

              <div style={{ ...S.card, background: "#F0FAF0", borderColor: "#C8E6C9" }}>
                <div style={{ fontSize: 12, color: "#52A852", fontWeight: 700, marginBottom: 4, fontFamily: "'Syne',sans-serif" }}>⏰ Cron automat vineri 18:00</div>
                <p style={{ fontSize: 12, color: "#888", lineHeight: 1.6, margin: 0 }}>
                  Vercel trimite automat un reminder în fiecare vineri. Necesită <code style={{ background: "#E8E4DC", padding: "1px 5px", borderRadius: 4 }}>RESEND_API_KEY</code> și <code style={{ background: "#E8E4DC", padding: "1px 5px", borderRadius: 4 }}>CRON_SECRET</code> în Vercel Dashboard.
                </p>
              </div>
            </>
          )}

          {view === "detail" && (
            <>
              <div style={S.cardTitle}>Toate capitolele</div>
              <div style={{ marginTop: 12 }}>
                {["romana", "matematica"].map(s => {
                  const sub = SUBJECTS[s]; const accent = s === "romana" ? "#FF8A65" : "#64B5F6";
                  return (
                    <div key={s} style={{ marginBottom: 22 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: accent, marginBottom: 8, fontFamily: "'Syne',sans-serif" }}>{sub.icon} {sub.label}</div>
                      {sub.chapters.map(ch => {
                        const isDone = !!unlockedChapters[ch.id];
                        const data = ls.get(`chapter_${ch.id}`) || {};
                        const wk = WEEKS.find(w => (WEEKLY_PLAN[w.id] || []).some(c => c.id === ch.id));
                        return (
                          <div key={ch.id} style={{ ...S.detailRow, background: isDone ? "#EAF5EA" : "#fff" }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: isDone ? "#52A852" : "#E0DBD0", flexShrink: 0, marginTop: 4 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: isDone ? "#52A852" : "#333", fontFamily: "'Inter',sans-serif" }}>{ch.title}</div>
                              <div style={{ fontSize: 10, color: "#AAA" }}>{wk?.label}</div>
                            </div>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {[["Lecție", !!data.content], [`Quiz ${data.quizResult?.score || "—"}/10`, data.quizResult?.passed], ["📸", !!data.screenshot]].map(([label, done]) => (
                                <span key={label} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 6, background: done ? "#EAF5EA" : "#F0EDE6", color: done ? "#52A852" : "#BBB", border: `1px solid ${done ? "#C8E6C9" : "#E8E4DC"}`, fontFamily: "'Inter',sans-serif" }}>{label}</span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}

        </div>
      </main>

      {toast && <div style={S.toast}>{toast}</div>}
      <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar { display: none; } body { background: #F0EDE6; }`}</style>
    </div>
  );
}

function Kpi({ label, value, sub, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "14px 12px", border: "1px solid #EAE6DF" }}>
      <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: "'Syne',sans-serif" }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#333", marginTop: 2, fontFamily: "'Inter',sans-serif" }}>{label}</div>
      <div style={{ fontSize: 10, color: "#AAA" }}>{sub}</div>
    </div>
  );
}

const S = {
  shell: { background: "#F0EDE6", minHeight: "100vh", fontFamily: "'Inter',sans-serif", color: "#1A1A1A", paddingBottom: 80 },
  header: { background: "#fff", borderBottom: "1px solid #E8E4DC", padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { fontSize: 16, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },
  logoSub: { fontSize: 11, color: "#AAA", marginTop: 2 },
  logoutBtn: { background: "none", border: "1px solid #E0DBD0", color: "#888", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12 },
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E8E4DC", display: "flex", zIndex: 100 },
  navBtn: { flex: 1, background: "none", border: "none", color: "#BBB", padding: "9px 4px 11px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 10, fontFamily: "'Inter',sans-serif" },
  navOn: { color: "#52A852" },
  main: { padding: "14px 14px 0" },
  page: { maxWidth: 560, margin: "0 auto" },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },
  kpiGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 },
  card: { background: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, border: "1px solid #EAE6DF" },
  bigBarBg: { height: 8, background: "#EAE6DF", borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  bigBarFill: { height: "100%", borderRadius: 4, transition: "width .8s ease" },
  wkRow: { display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, marginBottom: 4, background: "#F8F6F2", borderLeft: "3px solid" },
  cpGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px,1fr))", gap: 10 },
  cpCard: { background: "#fff", borderRadius: 12, overflow: "hidden", cursor: "pointer", border: "1px solid #EAE6DF" },
  cpImg: { width: "100%", height: 110, objectFit: "cover" },
  lightbox: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "zoom-out" },
  textarea: { width: "100%", background: "#F8F6F2", color: "#1A1A1A", border: "1px solid #E0DBD0", borderRadius: 10, padding: "10px 12px", fontSize: 12, resize: "vertical", fontFamily: "'Inter',sans-serif", outline: "none" },
  btnDark: { background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "'Syne',sans-serif", width: "100%" },
  detailRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "9px 12px", borderRadius: 8, marginBottom: 4, border: "1px solid #EAE6DF" },
  toast: { position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#1A1A1A", color: "#fff", fontWeight: 600, padding: "10px 22px", borderRadius: 20, zIndex: 400, fontSize: 13, boxShadow: "0 4px 24px rgba(0,0,0,.15)", whiteSpace: "nowrap" },
};
