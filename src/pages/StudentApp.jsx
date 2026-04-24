import { useState, useEffect, useRef } from "react";
import { ls } from "../utils/storage.js";
import { sendEmail } from "../utils/api.js";
import { SUBJECTS, WEEKS, WEEKLY_PLAN, EXAM_ROMANA, EXAM_MATH, fmt, daysLeft, getWeekStatus, CONFIG } from "../constants.js";
import { logger } from "../utils/logger.js";
import ChapterPage from "./ChapterPage.jsx";

// ── Motivational quips ────────────────────────────────────────────────────────
function getQuip(done, total) {
  if (done === 0)          return "Hai că abia ai început! Examenul nu se dă singur. 📖";
  if (done <= 2)           return "O scânteie! Primul capitol bifat e dovada că poți. ⚡";
  if (done <= 4)           return "Mergi bine! Cam ca un elev la simulare – dai din coate. 💪";
  if (done < total / 2)   return "Pe drumul cel bun! Fiecare capitol bifat contează. 🔥";
  if (done === Math.floor(total / 2)) return "Jumătate gata! Știi ce înseamnă asta? Că e mai ușor de-acum. 🔥";
  if (done <= total - 3)  return "Ești în top la disciplina 'bifat'. Dacă poți asta, poți și examenul! 🚀";
  if (done === total - 2)  return "Aproape! Ultimele capitole sunt ca ultimele 5 min dintr-un film. 🎬";
  if (done === total - 1)  return "Un singur capitol! Ari, ești un monstru. Serios. 👑";
  return "PERFECT! 15/15. Examenul e deja în buzunar. Mult succes! 🏆";
}

export default function StudentApp() {
  const [view, setView]             = useState("dashboard");
  const [openChapter, setOpen]      = useState(null);
  const [unlockedChapters, setUL]   = useState(() => ls.get("unlocked") || {});
  const [activeWeek, setActiveWeek] = useState(() => {
    const cur = WEEKS.find(w => getWeekStatus(w) === "current") || WEEKS[0];
    return cur.id;
  });
  const [toast, setToast] = useState(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3200); }

  function handleUnlock(chapterId) {
    const updated = { ...unlockedChapters, [chapterId]: true };
    setUL(updated);
    ls.set("unlocked", updated);
    logger.chapterUnlocked({ id: chapterId, title: chapterId }, "unknown");
    showToast("🎉 Capitol bifat! Bravo Ari!");
    const ch = [...SUBJECTS.romana.chapters, ...SUBJECTS.matematica.chapters].find(c => c.id === chapterId);
    sendEmail({
      to: [CONFIG.parentEmail, CONFIG.motherEmail],
      subject: `✅ Ari a finalizat: ${ch?.title}`,
      html: emailTpl(`🏆 Capitol bifat!`, `Ari a trecut quiz-ul și a încărcat dovada pentru <strong>${ch?.title}</strong>.`, "Vezi progresul →"),
    });
  }

  function doneOf(s) { return SUBJECTS[s].chapters.filter(c => unlockedChapters[c.id]).length; }
  function totalOf(s) { return SUBJECTS[s].chapters.length; }
  function doneAll() { return doneOf("romana") + doneOf("matematica"); }
  function totalAll() { return totalOf("romana") + totalOf("matematica"); }

  if (openChapter) {
    return (
      <>
        <ChapterPage chapterId={openChapter.chapterId} subject={openChapter.subject}
          onBack={() => setOpen(null)} onUnlock={handleUnlock} />
        {toast && <Toast msg={toast} />}
      </>
    );
  }

  const pct = Math.round((doneAll() / totalAll()) * 100);

  return (
    <div style={S.shell}>
      <Header doneAll={doneAll} totalAll={totalAll} />
      <BottomNav view={view} setView={setView} />

      <main style={S.main}>
        {view === "dashboard" && <Dashboard pct={pct} doneAll={doneAll} totalAll={totalAll} doneOf={doneOf} totalOf={totalOf} setView={setView} unlockedChapters={unlockedChapters} setOpen={setOpen} />}
        {view === "plan"      && <Plan activeWeek={activeWeek} setActiveWeek={setActiveWeek} unlockedChapters={unlockedChapters} setOpen={setOpen} />}
        {view === "progress"  && <Progress doneOf={doneOf} totalOf={totalOf} unlockedChapters={unlockedChapters} setOpen={setOpen} />}
      </main>

      {toast && <Toast msg={toast} />}
      <style>{CSS}</style>
    </div>
  );
}

// ── EMAIL TEMPLATE ────────────────────────────────────────────────────────────
function emailTpl(title, body, btnLabel) {
  const url = window.location.origin;
  return `<div style="background:#F0EDE6;font-family:Georgia,serif;padding:32px;max-width:500px;margin:0 auto;"><div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #E8E4DC;"><h1 style="color:#1A1A1A;font-size:20px;margin:0 0 10px;">${title}</h1><p style="color:#333;font-size:14px;line-height:1.7;margin:0 0 20px;">${body}</p><a href="${url}" style="display:inline-block;background:#1A1A1A;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;">${btnLabel}</a></div></div>`;
}

// ── HEADER ────────────────────────────────────────────────────────────────────
function Header({ doneAll, totalAll }) {
  return (
    <header style={S.header}>
      <div>
        <div style={S.logo}>EN<span style={{ color: "#C8A84B" }}>'26</span></div>
        <div style={S.logoSub}>Planul lui Ari · Babel</div>
      </div>
      <div style={S.cds}>
        <Cd label="Română" days={daysLeft(EXAM_ROMANA)} color="#C8392B" />
        <Cd label="Mate"   days={daysLeft(EXAM_MATH)}   color="#1A5276" />
      </div>
    </header>
  );
}

function Cd({ label, days, color }) {
  return (
    <div style={{ textAlign: "center", minWidth: 46 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1, fontFamily: "'Syne',sans-serif" }}>{days}</div>
      <div style={{ fontSize: 11, color: "#555", fontFamily: "'Inter',sans-serif", marginTop: 2 }}>zile {label}</div>
    </div>
  );
}

// ── BOTTOM NAV ────────────────────────────────────────────────────────────────
function BottomNav({ view, setView }) {
  const items = [
    { id: "dashboard", icon: "⌂",  label: "Acasă" },
    { id: "plan",      icon: "☷",  label: "Plan săptămânal" },
    { id: "progress",  icon: "◎",  label: "Progresul meu" },
  ];
  return (
    <nav style={S.nav}>
      {items.map(i => (
        <button key={i.id} style={{ ...S.navBtn, ...(view === i.id ? S.navOn : {}) }}
          onClick={() => setView(i.id)}>
          <span style={S.navIcon}>{i.icon}</span>
          <span style={S.navLabel}>{i.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({ pct, doneAll, totalAll, doneOf, totalOf, setView, unlockedChapters, setOpen }) {
  const curWeek = WEEKS.find(w => getWeekStatus(w) === "current");
  const quip = getQuip(doneAll(), totalAll());

  return (
    <div style={S.page}>
      {/* Hero */}
      <div style={S.heroCard}>
        <div style={S.heroTop}>
          <Ring pct={pct} size={124} />
          <div style={S.heroInfo}>
            <div style={S.heroGreet}>Bună, Ari! 👋</div>
            <div style={S.heroQuip}>{quip}</div>
            <div style={S.heroStats}>{doneAll()} din {totalAll()} capitole bifate</div>
          </div>
        </div>
        <div style={S.heroDates}>
          <ExamPill label="Română" date="22 Iunie" color="#C8392B" />
          <ExamPill label="Matematică" date="24 Iunie" color="#1A5276" />
        </div>
      </div>

      {/* Subject bars */}
      <div style={S.row}>
        {["romana", "matematica"].map(s => {
          const sub = SUBJECTS[s];
          const done = doneOf(s); const total = totalOf(s);
          const p = Math.round((done / total) * 100);
          const color = s === "romana" ? "#C8392B" : "#1A5276";
          return (
            <div key={s} style={S.subCard}>
              <div style={S.subIcon}>{sub.icon}</div>
              <div style={{ ...S.subName, color }}>{sub.short}</div>
              <div style={S.subStat}>{done} / {total}</div>
              <div style={S.barBg}>
                <div style={{ ...S.barFill, width: `${p}%`, background: color }} />
              </div>
              <div style={{ ...S.subPct, color }}>{p}%</div>
            </div>
          );
        })}
      </div>

      {/* Current week */}
      {curWeek && (
        <div style={S.card}>
          <div style={S.cardHead}>
            <div style={S.cardTitle}>📅 Săptămâna curentă</div>
            <span style={S.badge}>Curentă</span>
          </div>
          <div style={S.cardSub}>{fmt(curWeek.start)} – {fmt(curWeek.end)}</div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {(WEEKLY_PLAN[curWeek.id] || []).map(ch => {
              const sub = SUBJECTS[ch.subject];
              const done = !!unlockedChapters[ch.id];
              const chapData = ls.get(`chapter_${ch.id}`) || {};
              const color = ch.subject === "romana" ? "#C8392B" : "#1A5276";
              return (
                <div key={ch.id} style={S.chapPill} onClick={() => setOpen({ chapterId: ch.id, subject: ch.subject })}>
                  <div style={{ ...S.chapPillDot, background: done ? "#2E7D32" : color }} />
                  <div style={{ flex: 1, fontSize: 13, color: done ? "#2E7D32" : "#1A1A1A", fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>{ch.title}</div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <MiniTag done={!!chapData.quizResult?.passed} label="Quiz" />
                    <MiniTag done={!!chapData.screenshot} label="📸" />
                  </div>
                  <span style={{ color: "#CCC", fontSize: 16, marginLeft: 4 }}>›</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* How it works */}
      <div style={S.card}>
        <div style={S.cardTitle}>🔓 Cum bifezi un capitol</div>
        {[
          ["📚", "Citești lecția generată de AI"],
          ["💬", "Întrebi tutorele ce nu înțelegi"],
          ["🧠", "Treci quiz-ul cu minim 8 din 10"],
          ["📸", "Încarci o poză cu temele"],
        ].map(([icon, text], i) => (
          <div key={i} style={S.howStep}>
            <div style={S.howNum}>{i + 1}</div>
            <div style={S.howText}>{icon} {text}</div>
          </div>
        ))}
        <div style={S.howNote}>→ Ai nevoie de AMBELE: quiz trecut + screenshot!</div>
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
      <div style={S.sectionTitle}>Plan de studiu săptămânal</div>

      <div style={S.weekScroll}>
        {WEEKS.map(w => {
          const st = getWeekStatus(w); const isAct = w.id === activeWeek;
          const chs = WEEKLY_PLAN[w.id] || []; const done = chs.filter(c => unlockedChapters[c.id]).length;
          return (
            <button key={w.id} onClick={() => setActiveWeek(w.id)} style={{
              ...S.weekPill,
              background: isAct ? "#1A1A1A" : "#fff",
              color: isAct ? "#fff" : "#333",
              borderColor: st === "current" && !isAct ? "#C8A84B" : isAct ? "#1A1A1A" : "#D5D0C8",
            }}>
              <div style={{ fontWeight: 800, fontSize: 13, fontFamily: "'Syne',sans-serif" }}>S{w.num}</div>
              <div style={{ fontSize: 10, opacity: 0.65, marginTop: 1 }}>{fmt(w.start)}</div>
              {chs.length > 0 && <div style={{ fontSize: 10, color: isAct ? "#C8A84B" : done === chs.length ? "#2E7D32" : "#AAA", marginTop: 2, fontWeight: 600 }}>{done}/{chs.length}✓</div>}
            </button>
          );
        })}
      </div>

      <div style={{ ...S.weekHeader, borderLeftColor: status === "current" ? "#C8A84B" : status === "past" ? "#2E7D32" : "#D5D0C8" }}>
        <div>
          <div style={S.weekHeaderTitle}>{week.label}</div>
          <div style={S.weekHeaderSub}>{fmt(week.start)} – {fmt(week.end)}</div>
        </div>
        {status === "current" && <span style={S.badge}>Curentă</span>}
        {status === "past"    && <span style={{ ...S.badge, background: "#E8F5E9", color: "#2E7D32", borderColor: "#A5D6A7" }}>✓ Finalizată</span>}
      </div>

      {chapters.length === 0
        ? <div style={S.emptyState}>Săptămână liberă 🎉</div>
        : chapters.map(ch => {
            const sub = SUBJECTS[ch.subject];
            const done = !!unlockedChapters[ch.id];
            const chapData = ls.get(`chapter_${ch.id}`) || {};
            const color = ch.subject === "romana" ? "#C8392B" : "#1A5276";
            const bgLight = ch.subject === "romana" ? "#FFF5F5" : "#EEF4FF";
            return (
              <div key={ch.id} style={S.chapCard} onClick={() => setOpen({ chapterId: ch.id, subject: ch.subject })}>
                <div style={{ ...S.chapDot, background: done ? "#2E7D32" : color }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.chapTitle, color: done ? "#2E7D32" : "#1A1A1A" }}>{sub.icon} {ch.title}</div>
                  <div style={S.chapTopics}>{ch.topics.slice(0, 3).join(" · ")}</div>
                  <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
                    <MiniTag done={!!chapData.content} label="Lecție" />
                    <MiniTag done={!!chapData.quizResult?.passed} label={`Quiz${chapData.quizResult?.passed ? " ✓" : ""}`} activeColor="#C8A84B" />
                    <MiniTag done={!!chapData.screenshot} label="📸" activeColor="#2E7D32" />
                    <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: bgLight, color, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
                      {sub.short}
                    </span>
                  </div>
                </div>
                <div style={S.chapArrow}>›</div>
              </div>
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
      <div style={S.sectionTitle}>Progresul meu la EN 2026</div>

      {["romana", "matematica"].map(s => {
        const sub = SUBJECTS[s]; const done = doneOf(s); const total = totalOf(s);
        const pct = Math.round((done / total) * 100);
        const color = s === "romana" ? "#C8392B" : "#1A5276";
        return (
          <div key={s} style={{ marginBottom: 28 }}>
            <div style={S.progHead}>
              <span style={S.progLabel}>{sub.icon} {sub.label}</span>
              <span style={{ fontWeight: 800, fontSize: 16, color, fontFamily: "'Syne',sans-serif" }}>{pct}%</span>
            </div>
            <div style={S.bigBarBg}>
              <div style={{ ...S.bigBarFill, width: `${pct}%`, background: color }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
              {sub.chapters.map(ch => {
                const isDone = !!unlockedChapters[ch.id];
                const chapData = ls.get(`chapter_${ch.id}`) || {};
                return (
                  <div key={ch.id} onClick={() => setOpen({ chapterId: ch.id, subject: ch.subject })}
                    style={{ ...S.progRow, background: isDone ? "#E8F5E9" : "#fff", borderColor: isDone ? "#A5D6A7" : "#E0DBD0" }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{isDone ? "✅" : "⬜"}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: isDone ? "#2E7D32" : "#1A1A1A", fontFamily: "'Inter',sans-serif" }}>{ch.title}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <MiniTag done={!!chapData.quizResult?.passed} label="Q" />
                      <MiniTag done={!!chapData.screenshot} label="📸" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={S.sectionTitle}>📍 Timeline spre examene</div>
      <div style={{ paddingLeft: 18, marginTop: 8 }}>
        {WEEKS.filter((_, i) => i % 2 === 0 || i === WEEKS.length - 1).map(w => {
          const chs = WEEKLY_PLAN[w.id] || []; const done = chs.filter(c => unlockedChapters[c.id]).length;
          const complete = chs.length > 0 && done === chs.length; const st = getWeekStatus(w);
          return (
            <div key={w.id} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, marginTop: 3, background: complete ? "#2E7D32" : st === "current" ? "#C8A84B" : "#D5D0C8" }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A", fontFamily: "'Inter',sans-serif" }}>{w.label} · {fmt(w.start)}</div>
                <div style={{ fontSize: 11, color: "#777", fontFamily: "'Inter',sans-serif" }}>{done}/{chs.length} capitole bifate</div>
              </div>
            </div>
          );
        })}
        {[
          { label: "🏁 Examen Română · 22 Iunie 2026", color: "#C8392B" },
          { label: "🏁 Examen Matematică · 24 Iunie 2026", color: "#1A5276" },
        ].map(e => (
          <div key={e.label} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, marginTop: 1, background: e.color }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: e.color, fontFamily: "'Syne',sans-serif" }}>{e.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
function ExamPill({ label, date, color }) {
  return (
    <div style={{ flex: 1, background: "#252525", borderRadius: 10, padding: "8px 12px", borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 10, color: "#888", fontFamily: "'Inter',sans-serif", textTransform: "uppercase", letterSpacing: "0.4px" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color, fontFamily: "'Syne',sans-serif", marginTop: 2 }}>{date}</div>
    </div>
  );
}

function MiniTag({ done, label, activeColor = "#2E7D32" }) {
  return (
    <span style={{
      fontSize: 10, padding: "3px 8px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontWeight: 600,
      background: done ? "#E8F5E9" : "#F0EDE6",
      color: done ? activeColor : "#AAA",
      border: `1px solid ${done ? "#A5D6A7" : "#D5D0C8"}`,
    }}>{label}</span>
  );
}

function Ring({ pct, size = 124 }) {
  const stroke = 11, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#2A2A2A" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#C8A84B" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.185, fontWeight: 800, color: "#C8A84B", fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 10, color: "#999", marginTop: 3, fontFamily: "'Inter',sans-serif" }}>completat</span>
      </div>
    </div>
  );
}

function Toast({ msg }) {
  return <div style={S.toast}>{msg}</div>;
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  shell: { background: "#F0EDE6", minHeight: "100vh", fontFamily: "'Inter',sans-serif", color: "#1A1A1A", paddingBottom: 80 },

  // Header — larger, more visible
  header: { background: "#fff", borderBottom: "2px solid #E0DBD0", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(0,0,0,.05)" },
  logo: { fontSize: 22, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif", letterSpacing: "-0.5px", lineHeight: 1 },
  logoSub: { fontSize: 12, color: "#555", fontFamily: "'Inter',sans-serif", marginTop: 3, fontWeight: 500 },
  cds: { display: "flex", gap: 18 },

  // Nav — bigger for mobile
  nav: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "2px solid #E0DBD0", display: "flex", zIndex: 100, boxShadow: "0 -2px 8px rgba(0,0,0,.05)" },
  navBtn: { flex: 1, background: "none", border: "none", color: "#999", padding: "10px 4px 13px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "color .2s", WebkitTapHighlightColor: "transparent" },
  navOn: { color: "#C8A84B" },
  navIcon: { fontSize: 24, lineHeight: 1 },
  navLabel: { fontSize: 12, fontFamily: "'Inter',sans-serif", fontWeight: 600 },

  main: { padding: "16px 14px 0" },
  page: { maxWidth: 560, margin: "0 auto" },
  sectionTitle: { fontSize: 16, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif", marginBottom: 14, paddingBottom: 8, borderBottom: "2px solid #E0DBD0" },

  // Hero card — dark, prominent
  heroCard: { background: "#1A1A1A", borderRadius: 20, padding: "20px 18px 16px", marginBottom: 14, boxShadow: "0 4px 20px rgba(0,0,0,.12)" },
  heroTop: { display: "flex", gap: 18, alignItems: "center", marginBottom: 14 },
  heroInfo: { flex: 1 },
  heroGreet: { fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'Syne',sans-serif", lineHeight: 1.2, marginBottom: 6 },
  heroQuip: { fontSize: 13, color: "#AAA", lineHeight: 1.6, fontStyle: "italic" },
  heroStats: { fontSize: 12, color: "#666", marginTop: 6, fontWeight: 500 },
  heroDates: { display: "flex", gap: 8 },

  // Subject cards
  row: { display: "flex", gap: 10, marginBottom: 14 },
  subCard: { flex: 1, background: "#fff", borderRadius: 14, padding: "14px 12px", border: "1px solid #E0DBD0", boxShadow: "0 1px 4px rgba(0,0,0,.04)" },
  subIcon: { fontSize: 24, marginBottom: 6 },
  subName: { fontSize: 13, fontWeight: 800, fontFamily: "'Syne',sans-serif" },
  subStat: { fontSize: 12, color: "#555", margin: "3px 0 7px", fontWeight: 500 },
  subPct: { fontSize: 11, fontWeight: 700, marginTop: 4, fontFamily: "'Syne',sans-serif" },
  barBg: { height: 6, background: "#F0EDE6", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, transition: "width .8s cubic-bezier(.4,0,.2,1)" },

  // Cards
  card: { background: "#fff", borderRadius: 16, padding: "16px 14px", marginBottom: 14, border: "1px solid #E0DBD0", boxShadow: "0 1px 4px rgba(0,0,0,.04)" },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },
  cardSub: { fontSize: 12, color: "#777", marginBottom: 4, fontFamily: "'Inter',sans-serif" },
  badge: { fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "#FFF8E7", color: "#C8A84B", border: "1px solid #F0D98A", fontFamily: "'Inter',sans-serif", letterSpacing: "0.3px", textTransform: "uppercase" },

  chapPill: { display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 10, background: "#F8F6F2", cursor: "pointer", WebkitTapHighlightColor: "transparent", border: "1px solid #EAE6DF" },
  chapPillDot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },

  howStep: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 9 },
  howNum: { width: 22, height: 22, borderRadius: "50%", background: "#F0EDE6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#C8A84B", flexShrink: 0, marginTop: 1, border: "1px solid #D5D0C8" },
  howText: { fontSize: 13, color: "#333", fontFamily: "'Inter',sans-serif", lineHeight: 1.5, paddingTop: 2 },
  howNote: { fontSize: 12, color: "#C8A84B", fontWeight: 700, marginTop: 10, fontFamily: "'Inter',sans-serif" },

  // Week plan
  weekScroll: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, scrollbarWidth: "none", marginBottom: 12, WebkitOverflowScrolling: "touch" },
  weekPill: { flexShrink: 0, borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontFamily: "'Inter',sans-serif", minWidth: 58, textAlign: "center", border: "1px solid", transition: "all .15s", WebkitTapHighlightColor: "transparent" },
  weekHeader: { background: "#fff", borderRadius: 12, padding: "13px 15px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #E0DBD0", borderLeft: "4px solid", boxShadow: "0 1px 4px rgba(0,0,0,.04)" },
  weekHeaderTitle: { fontWeight: 800, fontSize: 15, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },
  weekHeaderSub: { fontSize: 12, color: "#777", marginTop: 2, fontFamily: "'Inter',sans-serif" },

  chapCard: { background: "#fff", borderRadius: 12, padding: "13px 14px", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", border: "1px solid #E0DBD0", WebkitTapHighlightColor: "transparent", boxShadow: "0 1px 3px rgba(0,0,0,.04)" },
  chapDot: { width: 11, height: 11, borderRadius: "50%", flexShrink: 0, marginTop: 3 },
  chapTitle: { fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif" },
  chapTopics: { fontSize: 12, color: "#777", marginTop: 3, fontFamily: "'Inter',sans-serif" },
  chapArrow: { fontSize: 20, color: "#CCC", marginTop: 1, flexShrink: 0 },

  emptyState: { textAlign: "center", color: "#999", padding: 48, fontStyle: "italic", fontSize: 15 },

  // Progress
  progHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  progLabel: { fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: "#1A1A1A" },
  bigBarBg: { height: 10, background: "#E0DBD0", borderRadius: 5, overflow: "hidden", marginBottom: 12 },
  bigBarFill: { height: "100%", borderRadius: 5, transition: "width .9s cubic-bezier(.4,0,.2,1)" },
  progRow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, cursor: "pointer", border: "1px solid", WebkitTapHighlightColor: "transparent" },

  toast: { position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#1A1A1A", color: "#fff", fontWeight: 700, padding: "11px 24px", borderRadius: 20, zIndex: 400, fontSize: 14, boxShadow: "0 4px 24px rgba(0,0,0,.2)", whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif" },
};

const CSS = `
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { display: none; }
  body { background: #F0EDE6; -webkit-tap-highlight-color: transparent; }
  @media (max-width: 400px) {
    .hero-name { font-size: 18px !important; }
  }
`;
