import { useState, useEffect, useRef } from "react";
import { ls } from "../utils/storage.js";
import { sendEmail } from "../utils/api.js";
import { logger } from "../utils/logger.js";
import { SUBJECTS, WEEKS, WEEKLY_PLAN, EXAM_ROMANA, EXAM_MATH, fmt, daysLeft, getWeekStatus, CONFIG } from "../constants.js";
import ChapterPage from "./ChapterPage.jsx";

// ── Motivational quips based on progress ─────────────────────────────────────
function getQuip(done, total) {
  if (done === 0)           return "Hai că abia ai început! Examenul nu se dă singur. 📖";
  if (done <= 2)            return "O scânteie! Primul capitol bifat e dovada că poți. ⚡";
  if (done <= 4)            return "Mergi bine! Cam ca un elev la simulare – dai din coate. 💪";
  if (done < total / 2)    return "Ești pe drumul cel bun! Mai mult de jumătate din capitole te așteaptă. 🔥";
  if (done === Math.floor(total / 2)) return "Jumătate bifate! Știi ce înseamnă asta? Că e mai ușor de-acum. 🔥";
  if (done <= total - 3)   return "Ești în top la disciplina 'bifat'. Dacă poți asta, poți și examenul! 🚀";
  if (done === total - 2)  return "Aproape gata! Ultimele capitole sunt ca ultimele 5 minute dintr-un film. 🎬";
  if (done === total - 1)  return "Un singur capitol! Ari, ești un monstru. Serios. 👑";
  return "PERFECT! 15/15. Examenul e deja în buzunar. Mult succes! 🏆";
}

export default function StudentApp() {
  const [view, setView]           = useState("dashboard");
  const [openChapter, setOpen]    = useState(null);
  const [unlockedChapters, setUL] = useState(() => ls.get("unlocked") || {});
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
    logger.chapterUnlocked({ id: chapterId, title: ch?.title || chapterId }, "unknown");
    showToast("🎉 Capitol bifat! Bravo Ari!");
    const ch = [...SUBJECTS.romana.chapters, ...SUBJECTS.matematica.chapters].find(c => c.id === chapterId);
    sendEmail({
      to: CONFIG.parentEmail,
      subject: `✅ Ari a finalizat: ${ch?.title}`,
      html: `<div style="background:#F0EDE6;font-family:Georgia,serif;padding:32px;max-width:500px;margin:0 auto;">
<div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #E8E4DC;">
<h1 style="color:#1A1A1A;font-size:20px;margin:0 0 8px;">🏆 Capitol bifat!</h1>
<p style="color:#555;font-size:14px;line-height:1.6;">Ari a trecut quiz-ul și a încărcat dovada pentru <strong>${ch?.title}</strong>.</p>
<a href="${window.location.origin}" style="display:inline-block;margin-top:16px;background:#1A1A1A;color:#fff;padding:11px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;">Vezi progresul →</a>
</div></div>`,
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
        {toast && <div style={S.toast}>{toast}</div>}
        <style>{CSS}</style>
      </>
    );
  }

  const pct = Math.round((doneAll() / totalAll()) * 100);

  return (
    <div style={S.shell}>
      <header style={S.header}>
        <div style={S.logo}>EN<span style={{ color: "#C8A84B" }}>'26</span> · Ari</div>
        <div style={S.cds}>
          <Cd label="Română" days={daysLeft(EXAM_ROMANA)} color="#FF8A65" />
          <Cd label="Mate"   days={daysLeft(EXAM_MATH)}   color="#64B5F6" />
        </div>
      </header>

      <nav style={S.nav}>
        {[
          { id: "dashboard", icon: "⌂", label: "Acasă" },
          { id: "plan",      icon: "☷", label: "Plan" },
          { id: "progress",  icon: "◎", label: "Progres" },
        ].map(i => (
          <button key={i.id} style={{ ...S.navBtn, ...(view === i.id ? S.navOn : {}) }}
            onClick={() => setView(i.id)}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{i.icon}</span>
            <span>{i.label}</span>
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
  const quip = getQuip(doneAll(), totalAll());

  return (
    <div style={S.page}>
      {/* Hero card */}
      <div style={S.heroCard}>
        <div style={S.heroTop}>
          <Ring pct={pct} size={118} />
          <div style={S.heroInfo}>
            <div style={S.heroName}>Bună,<br />Ari! 👋</div>
            <div style={S.heroQuip}>{quip}</div>
          </div>
        </div>
        <div style={S.heroDates}>
          <div style={{ ...S.examPill, borderLeft: "3px solid #FF8A65" }}>
            <div style={S.examLabel}>Română</div>
            <div style={{ ...S.examDate, color: "#FF8A65" }}>22 Iunie</div>
          </div>
          <div style={{ ...S.examPill, borderLeft: "3px solid #64B5F6" }}>
            <div style={S.examLabel}>Matematică</div>
            <div style={{ ...S.examDate, color: "#64B5F6" }}>24 Iunie</div>
          </div>
        </div>
      </div>

      {/* Subject bars */}
      <div style={S.row}>
        {["romana", "matematica"].map(s => {
          const sub = SUBJECTS[s];
          const done = doneOf(s); const total = totalOf(s);
          const p = Math.round((done / total) * 100);
          const accent = s === "romana" ? "#FF8A65" : "#64B5F6";
          return (
            <div key={s} style={S.subCard}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{sub.icon}</div>
              <div style={S.subName}>{sub.short}</div>
              <div style={S.subStat}>{done}/{total} · {p}%</div>
              <div style={S.barBg}><div style={{ ...S.barFill, width: `${p}%`, background: accent }} /></div>
            </div>
          );
        })}
      </div>

      {/* Current week */}
      {curWeek && (
        <div style={S.card}>
          <div style={S.cardHead}>
            <div style={S.cardTitle}>📅 Săptămâna curentă</div>
            <span style={S.badgeCur}>Curentă</span>
          </div>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 12, fontFamily: "'Inter',sans-serif" }}>
            {fmt(curWeek.start)} – {fmt(curWeek.end)}
          </div>
          {(WEEKLY_PLAN[curWeek.id] || []).map(ch => {
            const sub = SUBJECTS[ch.subject];
            const done = !!unlockedChapters[ch.id];
            const chapData = ls.get(`chapter_${ch.id}`) || {};
            return (
              <div key={ch.id} style={S.chapPill} onClick={() => setOpen({ chapterId: ch.id, subject: ch.subject })}>
                <div style={{ ...S.chapPillDot, background: done ? "#52A852" : (ch.subject === "romana" ? "#FF8A65" : "#64B5F6") }} />
                <div style={{ flex: 1, fontSize: 12, color: done ? "#52A852" : "#333", fontWeight: 500, fontFamily: "'Inter',sans-serif" }}>{ch.title}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <MiniTag done={!!chapData.quizResult?.passed} label={chapData.quizResult?.passed ? "✓ Quiz" : "Quiz"} />
                  <MiniTag done={!!chapData.screenshot} label={chapData.screenshot ? "✓ 📸" : "📸"} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* How it works */}
      <div style={S.card}>
        <div style={S.cardTitle}>🔓 Cum bifezi un capitol</div>
        {[
          ["📚", "Citești lecția generată de AI"],
          ["💬", "Întrebi tutorele ce nu înțelegi"],
          ["🧠", "Treci quiz-ul cu minim 8 din 10"],
          ["📸", "Încarci o poză cu ce ai lucrat"],
        ].map(([icon, text], i) => (
          <div key={i} style={S.howStep}>
            <div style={S.howNum}>{i + 1}</div>
            <div style={{ fontSize: 12, color: "#666", fontFamily: "'Inter',sans-serif" }}>{icon} {text}</div>
          </div>
        ))}
        <div style={{ fontSize: 11, color: "#C8A84B", fontWeight: 600, marginTop: 10, fontFamily: "'Inter',sans-serif" }}>
          → Ambele (quiz + screenshot) sunt necesare pentru bifă!
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
          const chs = WEEKLY_PLAN[w.id] || []; const done = chs.filter(c => unlockedChapters[c.id]).length;
          return (
            <button key={w.id} onClick={() => setActiveWeek(w.id)} style={{
              ...S.weekPill,
              background: isAct ? "#1A1A1A" : "#fff",
              color: isAct ? "#fff" : "#333",
              borderColor: st === "current" && !isAct ? "#C8A84B" : "#E8E4DC",
            }}>
              <div style={{ fontWeight: 700, fontSize: 11, fontFamily: "'Syne',sans-serif" }}>S{w.num}</div>
              <div style={{ fontSize: 9, opacity: 0.6, marginTop: 1 }}>{fmt(w.start)}</div>
              {chs.length > 0 && <div style={{ fontSize: 9, color: isAct ? "#C8A84B" : "#AAA", marginTop: 2 }}>{done}/{chs.length}✓</div>}
            </button>
          );
        })}
      </div>

      <div style={{ ...S.weekHeader, borderLeftColor: status === "current" ? "#C8A84B" : "#E0DBD0" }}>
        <div>
          <div style={S.weekHeaderTitle}>{week.label}</div>
          <div style={{ fontSize: 11, color: "#AAA", fontFamily: "'Inter',sans-serif" }}>{fmt(week.start)} – {fmt(week.end)}</div>
        </div>
        {status === "current" && <span style={S.badgeCur}>Curentă</span>}
        {status === "past"    && <span style={{ ...S.badgeCur, background: "#EAF5EA", color: "#52A852", borderColor: "#B8DDB8" }}>Finalizată</span>}
      </div>

      {chapters.length === 0
        ? <div style={S.emptyState}>Săptămână liberă 🎉</div>
        : chapters.map(ch => {
            const sub = SUBJECTS[ch.subject];
            const done = !!unlockedChapters[ch.id];
            const chapData = ls.get(`chapter_${ch.id}`) || {};
            const accent = ch.subject === "romana" ? "#FF8A65" : "#64B5F6";
            const accentBg = ch.subject === "romana" ? "#FFF3EF" : "#EEF6FF";
            return (
              <div key={ch.id} style={S.chapCard} onClick={() => setOpen({ chapterId: ch.id, subject: ch.subject })}>
                <div style={{ ...S.chapDot, background: done ? "#52A852" : accent }} />
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.chapTitle, color: done ? "#52A852" : "#1A1A1A" }}>{sub.icon} {ch.title}</div>
                  <div style={S.chapTopics}>{ch.topics.slice(0, 3).join(" · ")}</div>
                  <div style={{ display: "flex", gap: 4, marginTop: 7 }}>
                    <MiniTag done={!!chapData.content} label="Lecție" />
                    <MiniTag done={!!chapData.quizResult?.passed} label={`Quiz${chapData.quizResult?.passed ? " ✓" : ""}`} color="#C8A84B" />
                    <MiniTag done={!!chapData.screenshot} label="📸" />
                    <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 6, background: accentBg, color: accent, fontFamily: "'Inter',sans-serif", fontWeight: 500 }}>
                      {sub.short}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 18, color: "#DDD" }}>›</div>
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
      {["romana", "matematica"].map(s => {
        const sub = SUBJECTS[s]; const done = doneOf(s); const total = totalOf(s);
        const pct = Math.round((done / total) * 100);
        const accent = s === "romana" ? "#FF8A65" : "#64B5F6";
        const accentDark = s === "romana" ? "#B8512E" : "#2271A8";
        return (
          <div key={s} style={{ marginBottom: 24 }}>
            <div style={S.progHead}>
              <span style={S.progLabel}>{sub.icon} {sub.label}</span>
              <span style={{ fontWeight: 700, fontSize: 15, color: accent, fontFamily: "'Syne',sans-serif" }}>{pct}%</span>
            </div>
            <div style={S.bigBarBg}>
              <div style={{ ...S.bigBarFill, width: `${pct}%`, background: `linear-gradient(90deg, ${accent}, ${accentDark}20), ${accent}` }} />
            </div>
            {sub.chapters.map(ch => {
              const isDone = !!unlockedChapters[ch.id];
              const chapData = ls.get(`chapter_${ch.id}`) || {};
              return (
                <div key={ch.id} onClick={() => setOpen({ chapterId: ch.id, subject: ch.subject })}
                  style={{ ...S.progRow, background: isDone ? "#EAF5EA" : "#fff" }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{isDone ? "✅" : "⬜"}</span>
                  <span style={{ flex: 1, fontSize: 12, color: isDone ? "#52A852" : "#555", fontFamily: "'Inter',sans-serif" }}>{ch.title}</span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <MiniTag done={!!chapData.quizResult?.passed} label="Q" />
                    <MiniTag done={!!chapData.screenshot} label="📸" />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      <div style={{ ...S.cardTitle, marginBottom: 12 }}>📍 Timeline spre examene</div>
      <div style={{ paddingLeft: 20 }}>
        {WEEKS.filter((_, i) => i % 2 === 0 || i === WEEKS.length - 1).map(w => {
          const chs = WEEKLY_PLAN[w.id] || []; const done = chs.filter(c => unlockedChapters[c.id]).length;
          const complete = chs.length > 0 && done === chs.length; const st = getWeekStatus(w);
          return (
            <div key={w.id} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, marginTop: 3, background: complete ? "#52A852" : st === "current" ? "#C8A84B" : "#E0DBD0", transition: "background .3s" }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#555", fontFamily: "'Inter',sans-serif" }}>{w.label} · {fmt(w.start)}</div>
                <div style={{ fontSize: 10, color: "#AAA", fontFamily: "'Inter',sans-serif" }}>{done}/{chs.length} capitole bifate</div>
              </div>
            </div>
          );
        })}
        {[
          { label: "🏁 Examen Română · 22 Iunie", color: "#FF8A65" },
          { label: "🏁 Examen Matematică · 24 Iunie", color: "#64B5F6" },
        ].map(e => (
          <div key={e.label} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", flexShrink: 0, marginTop: 1, background: e.color }} />
            <div style={{ fontSize: 12, fontWeight: 700, color: e.color, fontFamily: "'Syne',sans-serif" }}>{e.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SMALL COMPONENTS ──────────────────────────────────────────────────────────
function MiniTag({ done, label, color = "#52A852" }) {
  return (
    <span style={{
      fontSize: 9, padding: "2px 7px", borderRadius: 6, fontFamily: "'Inter',sans-serif", fontWeight: 500,
      background: done ? "#EAF5EA" : "#F0EDE6",
      color: done ? color : "#BBB",
      border: `1px solid ${done ? "#C8E6C9" : "#E8E4DC"}`,
    }}>{label}</span>
  );
}

function Ring({ pct, size = 120 }) {
  const stroke = 10, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F0EDE6" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#C8A84B" strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.18, fontWeight: 800, color: "#C8A84B", fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 9, color: "#BBB", marginTop: 2, fontFamily: "'Inter',sans-serif" }}>completat</span>
      </div>
    </div>
  );
}

function Cd({ label, days, color }) {
  return (
    <div style={{ textAlign: "center", minWidth: 42 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1, fontFamily: "'Syne',sans-serif" }}>{days}</div>
      <div style={{ fontSize: 9, color: "#AAA", fontFamily: "'Inter',sans-serif" }}>zile {label}</div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  shell: { background: "#F0EDE6", minHeight: "100vh", fontFamily: "'Inter',sans-serif", color: "#1A1A1A", paddingBottom: 70 },

  header: { background: "#fff", borderBottom: "1px solid #E8E4DC", padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { fontSize: 17, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif", letterSpacing: "-0.5px" },
  cds: { display: "flex", gap: 16 },

  nav: { position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E8E4DC", display: "flex", zIndex: 100 },
  navBtn: { flex: 1, background: "none", border: "none", color: "#BBB", padding: "9px 4px 11px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 10, fontFamily: "'Inter',sans-serif", transition: "color .2s" },
  navOn: { color: "#C8A84B" },

  main: { padding: "14px 14px 0" },
  page: { maxWidth: 540, margin: "0 auto" },

  // Hero
  heroCard: { background: "#1A1A1A", borderRadius: 20, padding: "20px 18px 16px", marginBottom: 14 },
  heroTop: { display: "flex", gap: 16, alignItems: "center", marginBottom: 14 },
  heroInfo: { flex: 1 },
  heroName: { fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'Syne',sans-serif", lineHeight: 1.15, marginBottom: 8 },
  heroQuip: { fontSize: 12, color: "#888", lineHeight: 1.6, fontStyle: "italic" },
  heroDates: { display: "flex", gap: 8 },
  examPill: { flex: 1, background: "#252525", borderRadius: 10, padding: "8px 12px" },
  examLabel: { fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", fontFamily: "'Inter',sans-serif" },
  examDate: { fontSize: 13, fontWeight: 700, marginTop: 2, fontFamily: "'Syne',sans-serif" },

  // Subject cards
  row: { display: "flex", gap: 10, marginBottom: 14 },
  subCard: { flex: 1, background: "#fff", borderRadius: 14, padding: "14px 12px", border: "1px solid #EAE6DF" },
  subName: { fontSize: 12, fontWeight: 700, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },
  subStat: { fontSize: 11, color: "#AAA", margin: "3px 0 7px" },
  barBg: { height: 5, background: "#F0EDE6", borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3, transition: "width .8s cubic-bezier(.4,0,.2,1)" },

  // Cards
  card: { background: "#fff", borderRadius: 16, padding: 16, marginBottom: 14, border: "1px solid #EAE6DF" },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },

  badgeCur: { fontSize: 9, fontWeight: 600, padding: "3px 9px", borderRadius: 20, letterSpacing: "0.3px", textTransform: "uppercase", background: "#FFF8E7", color: "#C8A84B", border: "1px solid #F0D98A" },

  chapPill: { display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: "#F8F6F2", marginBottom: 6, cursor: "pointer" },
  chapPillDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },

  howStep: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  howNum: { width: 20, height: 20, borderRadius: "50%", background: "#F0EDE6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, color: "#C8A84B", flexShrink: 0, marginTop: 1 },

  // Week plan
  weekScroll: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none", marginBottom: 12 },
  weekPill: { flexShrink: 0, borderRadius: 10, padding: "7px 11px", cursor: "pointer", fontFamily: "'Inter',sans-serif", minWidth: 52, textAlign: "center", border: "1px solid", transition: "all .15s" },
  weekHeader: { background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #EAE6DF", borderLeft: "3px solid #C8A84B" },
  weekHeaderTitle: { fontWeight: 700, fontSize: 14, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },

  chapCard: { background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", border: "1px solid #EAE6DF" },
  chapDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0, marginTop: 3 },
  chapTitle: { fontSize: 13, fontWeight: 700, fontFamily: "'Syne',sans-serif" },
  chapTopics: { fontSize: 11, color: "#AAA", marginTop: 3 },

  emptyState: { textAlign: "center", color: "#AAA", padding: 48, fontStyle: "italic", fontSize: 14 },

  // Progress
  progHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  progLabel: { fontSize: 13, fontWeight: 700, fontFamily: "'Syne',sans-serif" },
  bigBarBg: { height: 8, background: "#EAE6DF", borderRadius: 4, overflow: "hidden", marginBottom: 10 },
  bigBarFill: { height: "100%", borderRadius: 4, transition: "width .9s cubic-bezier(.4,0,.2,1)" },
  progRow: { display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, marginBottom: 3, cursor: "pointer", border: "1px solid #EAE6DF" },

  toast: { position: "fixed", bottom: 84, left: "50%", transform: "translateX(-50%)", background: "#1A1A1A", color: "#fff", fontWeight: 600, padding: "10px 22px", borderRadius: 20, zIndex: 400, fontSize: 13, boxShadow: "0 4px 24px rgba(0,0,0,.18)", whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif" },
};

const CSS = `
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { display: none; }
  body { background: #F0EDE6; }
`;
