import { useState, useEffect } from "react";

const EVENT_META = {
  chapter_opened:    { icon: "📂", label: "Capitol deschis",    color: "#64B5F6", bg: "#EEF6FF" },
  content_generated: { icon: "✨", label: "Lecție generată",    color: "#C8A84B", bg: "#FFF8E7" },
  chat_message:      { icon: "💬", label: "Întrebare tutore",   color: "#9C6FE4", bg: "#F3EEFF" },
  quiz_started:      { icon: "🧠", label: "Quiz început",       color: "#FF8A65", bg: "#FFF3EF" },
  quiz_submitted:    { icon: "📝", label: "Quiz trimis",        color: "#FF8A65", bg: "#FFF3EF" },
  screenshot_uploaded:{ icon:"📸", label: "Screenshot urcat",  color: "#52A852", bg: "#EAF5EA" },
  chapter_unlocked:  { icon: "🏆", label: "Capitol bifat!",     color: "#C8A84B", bg: "#FFF8E7" },
};

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long" });
}

export default function LogsView({ cronSecret }) {
  const [days, setDays]         = useState([]);
  const [selectedDay, setSelDay]= useState(null);
  const [logs, setLogs]         = useState([]);
  const [stats, setStats]       = useState({});
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState({});
  const [tab, setTab]           = useState("feed"); // feed | quiz | chat

  async function apiFetch(params) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/get-logs?${qs}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    if (!res.ok) throw new Error("Fetch failed");
    return res.json();
  }

  // Load available days on mount
  useEffect(() => {
    (async () => {
      try {
        const { days: d } = await apiFetch({ mode: "days" });
        setDays(d || []);
        if (d && d.length > 0) {
          setSelDay(d[0]);
        }
        const { stats: s } = await apiFetch({ mode: "stats" });
        setStats(s || {});
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Load logs when day changes
  useEffect(() => {
    if (!selectedDay) return;
    (async () => {
      setLoading(true);
      try {
        const { logs: l } = await apiFetch({ day: selectedDay });
        setLogs((l || []).reverse()); // chronological order
      } catch {}
      setLoading(false);
    })();
  }, [selectedDay]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const quizLogs  = logs.filter(l => l.type === "quiz_submitted");
  const chatLogs  = logs.filter(l => l.type === "chat_message");
  const allStats  = Object.values(stats);

  return (
    <div>
      {/* Tab switcher */}
      <div style={S.tabRow}>
        {[["feed","📋","Feed activitate"],["quiz","🧠","Quiz-uri"],["chat","💬","Conversații"]].map(([id,icon,label]) => (
          <button key={id} style={{ ...S.tabBtn, ...(tab===id?S.tabBtnOn:{}) }} onClick={() => setTab(id)}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Day selector */}
      <div style={S.dayRow}>
        <span style={S.dayLabel}>Zi:</span>
        {days.length === 0
          ? <span style={{ fontSize: 12, color: "#AAA", fontStyle: "italic" }}>Nicio activitate înregistrată încă</span>
          : days.map(d => (
            <button key={d} style={{ ...S.dayBtn, ...(d === selectedDay ? S.dayBtnOn : {}) }}
              onClick={() => setSelDay(d)}>
              {new Date(d).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}
            </button>
          ))
        }
      </div>

      {loading && <div style={S.loading}>⏳ Se încarcă...</div>}

      {/* ── FEED ── */}
      {tab === "feed" && !loading && (
        <div>
          {selectedDay && <div style={S.dayHeader}>{fmtDate(selectedDay)}</div>}
          {logs.length === 0 && !loading && (
            <div style={S.empty}>Nicio activitate în această zi.</div>
          )}
          {logs.map((log, i) => {
            const meta = EVENT_META[log.type] || { icon: "•", label: log.type, color: "#888", bg: "#F8F6F2" };
            const isExp = expanded[i];
            return (
              <div key={i} style={S.logItem}>
                <div style={{ ...S.logIconWrap, background: meta.bg }}>
                  <span style={{ fontSize: 16 }}>{meta.icon}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={S.logTop}>
                    <span style={{ ...S.logType, color: meta.color }}>{meta.label}</span>
                    <span style={S.logTime}>{fmtTime(log.ts)}</span>
                  </div>
                  {log.chapterTitle && (
                    <div style={S.logChapter}>{log.chapterTitle}
                      {log.subject && <span style={{ ...S.subPill, color: log.subject === "romana" ? "#FF8A65" : "#64B5F6" }}>{log.subject === "romana" ? "Română" : "Mate"}</span>}
                    </div>
                  )}

                  {/* Quiz result inline */}
                  {log.type === "quiz_submitted" && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ ...S.scorePill, background: log.passed ? "#EAF5EA" : "#FFF0EE", color: log.passed ? "#52A852" : "#E8654A", borderColor: log.passed ? "#C8E6C9" : "#FFCDD2" }}>
                          {log.score}/10 {log.passed ? "✅ Trecut" : "❌ Nepromovat"}
                        </div>
                        {log.attempts > 1 && <span style={{ fontSize: 10, color: "#AAA" }}>Încercarea #{log.attempts}</span>}
                      </div>
                      <button style={S.expandBtn} onClick={() => setExpanded(e => ({ ...e, [i]: !isExp }))}>
                        {isExp ? "▲ Ascunde detalii" : "▼ Vezi răspunsurile"}
                      </button>
                      {isExp && log.answers && (
                        <div style={S.answersWrap}>
                          {log.answers.map((a, qi) => (
                            <div key={qi} style={{ ...S.answerRow, background: a.isCorrect ? "#EAF5EA" : "#FFF0EE", borderColor: a.isCorrect ? "#C8E6C9" : "#FFCDD2" }}>
                              <div style={S.answerQ}>{qi + 1}. {a.question}</div>
                              <div style={S.answerA}>
                                <span style={{ color: a.isCorrect ? "#52A852" : "#E8654A" }}>
                                  {a.isCorrect ? "✓" : "✗"} Ari: <strong>{a.given || "—"}</strong>
                                </span>
                                {!a.isCorrect && (
                                  <span style={{ color: "#52A852", marginLeft: 8 }}>Corect: <strong>{a.correct}</strong></span>
                                )}
                              </div>
                              {!a.isCorrect && a.explanation && (
                                <div style={S.answerExp}>💡 {a.explanation}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Chat message preview */}
                  {log.type === "chat_message" && (
                    <div style={{ marginTop: 6 }}>
                      <div style={S.chatPreview}>
                        <span style={{ color: "#9C6FE4", fontWeight: 600 }}>Ari:</span> {log.userMessage}
                      </div>
                      <button style={S.expandBtn} onClick={() => setExpanded(e => ({ ...e, [i]: !isExp }))}>
                        {isExp ? "▲ Ascunde răspuns" : "▼ Vezi răspunsul AI"}
                      </button>
                      {isExp && (
                        <div style={{ ...S.chatPreview, background: "#F8F6F2", borderColor: "#E8E4DC", marginTop: 4 }}>
                          <span style={{ color: "#C8A84B", fontWeight: 600 }}>Claude:</span> {log.aiReply}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── QUIZ STATS ── */}
      {tab === "quiz" && (
        <div>
          <div style={S.sectionTitle}>Statistici quiz per capitol</div>
          {allStats.length === 0
            ? <div style={S.empty}>Niciun quiz trimis încă.</div>
            : allStats.map(st => (
              <div key={st.chapterId} style={S.statCard}>
                <div style={S.statTop}>
                  <div>
                    <div style={S.statTitle}>{st.chapterTitle}</div>
                    <div style={{ fontSize: 10, color: st.subject === "romana" ? "#C8392B" : "#1A5276", fontWeight: 600, marginTop: 2 }}>
                      {st.subject === "romana" ? "Română" : "Matematică"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ ...S.scoreBig, color: st.passed ? "#2E7D32" : "#C62828" }}>{st.score}/10</div>
                    {st.bestScore !== undefined && st.bestScore !== st.score && (
                      <div style={{ fontSize: 10, color: "#C8A84B", fontWeight: 600 }}>Best: {st.bestScore}/10</div>
                    )}
                    <div style={{ fontSize: 10, color: "#AAA" }}>{st.totalAttempts || st.attempts || 1} {(st.totalAttempts || 1) === 1 ? "încercare" : "încercări"}</div>
                  </div>
                </div>
                {/* Attempt history */}
                {st.attempts_history && st.attempts_history.length > 1 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: "#AAA", marginBottom: 5 }}>Istoricul încercărilor:</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {st.attempts_history.map((a, i) => (
                        <div key={i} style={{
                          fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 8,
                          background: a.passed ? "#E8F5E9" : "#FFF0EE",
                          color: a.passed ? "#2E7D32" : "#C62828",
                          border: `1px solid ${a.passed ? "#A5D6A7" : "#FFCDD2"}`,
                        }}>
                          #{i+1} {a.score}/10 {a.passed ? "✅" : "❌"}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={S.statBarBg}>
                  <div style={{ ...S.statBarFill, width: `${st.score * 10}%`, background: st.passed ? "#52A852" : "#E8654A" }} />
                </div>
                {st.answers && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 10, color: "#AAA", marginBottom: 6 }}>Răspunsuri greșite:</div>
                    {st.answers.filter(a => !a.isCorrect).length === 0
                      ? <div style={{ fontSize: 11, color: "#52A852" }}>✓ Toate corecte!</div>
                      : st.answers.filter(a => !a.isCorrect).map((a, i) => (
                        <div key={i} style={S.wrongAns}>
                          <div style={{ fontSize: 11, color: "#555" }}>{a.question}</div>
                          <div style={{ fontSize: 10, color: "#E8654A" }}>Ari: {a.given} → Corect: {a.correct}</div>
                          {a.explanation && <div style={{ fontSize: 10, color: "#888", fontStyle: "italic" }}>💡 {a.explanation}</div>}
                        </div>
                      ))
                    }
                  </div>
                )}
                <div style={{ fontSize: 10, color: "#CCC", marginTop: 8 }}>
                  Ultima încercare: {new Date(st.lastAttempt).toLocaleDateString("ro-RO")}
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ── CHAT LOGS ── */}
      {tab === "chat" && (
        <div>
          {selectedDay && <div style={S.dayHeader}>{fmtDate(selectedDay)}</div>}
          {chatLogs.length === 0
            ? <div style={S.empty}>Nicio conversație în această zi.</div>
            : chatLogs.map((log, i) => (
              <div key={i} style={S.chatCard}>
                <div style={S.chatCardHead}>
                  <span style={S.chatChapter}>{log.chapterTitle}</span>
                  <span style={S.logTime}>{fmtTime(log.ts)}</span>
                </div>
                <div style={S.chatBubbleUser}>
                  <span style={{ fontSize: 10, color: "#9C6FE4", fontWeight: 700, display: "block", marginBottom: 3 }}>Ari a întrebat:</span>
                  {log.userMessage}
                </div>
                <div style={S.chatBubbleAI}>
                  <span style={{ fontSize: 10, color: "#C8A84B", fontWeight: 700, display: "block", marginBottom: 3 }}>Claude a răspuns:</span>
                  {log.aiReply}
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

const S = {
  tabRow: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" },
  tabBtn: { background: "#F0EDE6", border: "1px solid #E0DBD0", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'Inter',sans-serif", color: "#888" },
  tabBtnOn: { background: "#1A1A1A", color: "#fff", borderColor: "#1A1A1A" },

  dayRow: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 14 },
  dayLabel: { fontSize: 11, color: "#AAA", fontFamily: "'Inter',sans-serif" },
  dayBtn: { background: "#fff", border: "1px solid #E8E4DC", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontFamily: "'Inter',sans-serif", color: "#666" },
  dayBtnOn: { background: "#1A1A1A", color: "#fff", borderColor: "#1A1A1A" },

  dayHeader: { fontSize: 12, fontWeight: 600, color: "#AAA", marginBottom: 10, textTransform: "capitalize", fontFamily: "'Inter',sans-serif" },
  loading: { fontSize: 13, color: "#AAA", padding: "20px 0", fontFamily: "'Inter',sans-serif" },
  empty: { fontSize: 13, color: "#BBB", fontStyle: "italic", padding: "24px 0", fontFamily: "'Inter',sans-serif" },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: "#1A1A1A", fontFamily: "'Syne',sans-serif", marginBottom: 12 },

  logItem: { display: "flex", gap: 12, marginBottom: 10, background: "#fff", borderRadius: 12, padding: "12px 14px", border: "1px solid #EAE6DF" },
  logIconWrap: { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  logTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 },
  logType: { fontSize: 12, fontWeight: 700, fontFamily: "'Syne',sans-serif" },
  logTime: { fontSize: 10, color: "#BBB", fontFamily: "'Inter',sans-serif" },
  logChapter: { fontSize: 11, color: "#888", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", gap: 6 },
  subPill: { fontSize: 9, fontWeight: 600, fontFamily: "'Inter',sans-serif" },

  scorePill: { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, border: "1px solid", fontFamily: "'Syne',sans-serif" },
  expandBtn: { background: "none", border: "none", color: "#C8A84B", fontSize: 10, cursor: "pointer", padding: "4px 0", fontFamily: "'Inter',sans-serif", fontWeight: 600, marginTop: 4, display: "block" },
  answersWrap: { marginTop: 8, display: "flex", flexDirection: "column", gap: 6 },
  answerRow: { padding: "8px 10px", borderRadius: 8, border: "1px solid" },
  answerQ: { fontSize: 11, color: "#555", fontFamily: "'Inter',sans-serif", marginBottom: 4, fontWeight: 500 },
  answerA: { fontSize: 11, fontFamily: "'Inter',sans-serif" },
  answerExp: { fontSize: 10, color: "#888", fontStyle: "italic", marginTop: 4, fontFamily: "'Inter',sans-serif" },

  chatPreview: { background: "#F3EEFF", border: "1px solid #E0D4FF", borderRadius: 8, padding: "7px 10px", fontSize: 11, color: "#444", fontFamily: "'Inter',sans-serif", lineHeight: 1.5 },

  statCard: { background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 10, border: "1px solid #EAE6DF" },
  statTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  statTitle: { fontSize: 13, fontWeight: 700, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },
  scoreBig: { fontSize: 20, fontWeight: 800, fontFamily: "'Syne',sans-serif", lineHeight: 1 },
  statBarBg: { height: 6, background: "#F0EDE6", borderRadius: 3, overflow: "hidden", marginBottom: 8 },
  statBarFill: { height: "100%", borderRadius: 3, transition: "width .6s ease" },
  wrongAns: { background: "#FFF0EE", borderRadius: 8, padding: "7px 10px", marginBottom: 5, border: "1px solid #FFCDD2" },

  chatCard: { background: "#fff", borderRadius: 12, padding: "12px 14px", marginBottom: 10, border: "1px solid #EAE6DF" },
  chatCardHead: { display: "flex", justifyContent: "space-between", marginBottom: 8 },
  chatChapter: { fontSize: 11, fontWeight: 700, color: "#9C6FE4", fontFamily: "'Syne',sans-serif" },
  chatBubbleUser: { background: "#F3EEFF", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#333", fontFamily: "'Inter',sans-serif", lineHeight: 1.5, marginBottom: 6, border: "1px solid #E0D4FF" },
  chatBubbleAI: { background: "#FFF8E7", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#333", fontFamily: "'Inter',sans-serif", lineHeight: 1.5, border: "1px solid #F0D98A" },
};
