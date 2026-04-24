import React, { useState, useEffect, useRef } from "react";
import { ls } from "../utils/storage.js";
import { generateChapterContent, generateQuiz, evaluateQuiz, chatWithTutor } from "../utils/api.js";
import { SUBJECTS, CONFIG } from "../constants.js";
import { logger } from "../utils/logger.js";
import { recordContentRead, recordChatMessage, recordQuizAttempt, recordScreenshot } from "../utils/gamification.js";

// ── CHAPTER PAGE ─────────────────────────────────────────────────────────────
// Tab flow: Conținut → Chat → Quiz → Screenshot → (unlocks chapter)
export default function ChapterPage({ chapterId, subject, onBack, onUnlock }) {
  const sub     = SUBJECTS[subject];
  const chapter = sub.chapters.find(c => c.id === chapterId);
  const storageKey = `chapter_${chapterId}`;

  const [tab, setTab]           = useState("content");   // content|chat|quiz|screenshot

  // Log chapter opened
  useEffect(() => { logger.chapterOpened(chapter, subject); }, []);
  const [saved, setSaved]       = useState(() => ls.get(storageKey) || {});

  // content
  const [content, setContent]   = useState(saved.content || "");
  const [loadingContent, setLC] = useState(false);

  // chat
  const [chatHistory, setChatHistory] = useState(saved.chatHistory || []);
  const [chatInput, setChatInput]     = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const chatEndRef = useRef(null);

  // quiz
  const [quiz, setQuiz]             = useState(saved.quiz || null);
  const [loadingQuiz, setLQ]        = useState(false);
  const [quizError, setQuizError]   = useState(null);
  const [answers, setAnswers]       = useState(saved.quizAnswers || {});
  const [quizResult, setQuizResult] = useState(saved.quizResult || null);
  const [evaluating, setEvaluating] = useState(false);

  // screenshot
  const [screenshot, setScreenshot] = useState(saved.screenshot || null);
  const fileRef = useRef();

  // unlock status
  const quizPassed    = quizResult?.passed;
  const hasScreenshot = !!screenshot;
  const isUnlocked    = quizPassed && hasScreenshot;

  // Persist all state
  function persist(patch) {
    const updated = { ...saved, ...patch };
    setSaved(updated);
    ls.set(storageKey, updated);
  }

  // Scroll chat to bottom
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);

  // ── Load content ────────────────────────────────────────────────────────────
  async function loadContent() {
    setLC(true);
    try {
      const text = await generateChapterContent(chapter);
      setContent(text);
      persist({ content: text });
      logger.contentGenerated(chapter, subject);
      recordContentRead();
    } catch (e) {
      setContent("❌ Nu s-a putut genera lecția după 3 încercări. Verifică conexiunea la internet și încearcă din nou.");
    }
    setLC(false);
  }

  useEffect(() => {
    if (!content && tab === "content") loadContent();
  }, [tab]);

  // ── Chat ────────────────────────────────────────────────────────────────────
  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || loadingChat) return;
    const newHistory = [...chatHistory, { role: "user", content: msg }];
    setChatHistory(newHistory);
    setChatInput("");
    setLoadingChat(true);
    try {
      const reply = await chatWithTutor(chapter, newHistory, msg);
      const fullHistory = [...newHistory, { role: "assistant", content: reply }];
      setChatHistory(fullHistory);
      persist({ chatHistory: fullHistory });
      logger.chatMessage(chapter, subject, msg, reply);
      recordChatMessage();
    } catch {
      const err = [...newHistory, { role: "assistant", content: "❌ Eroare. Încearcă din nou." }];
      setChatHistory(err);
    }
    setLoadingChat(false);
  }

  // ── Quiz ────────────────────────────────────────────────────────────────────
  async function loadQuiz() {
    setLQ(true);
    setQuizError(null);
    logger.quizStarted(chapter, subject);
    try {
      const q = await generateQuiz(chapter);
      setQuiz(q);
      setAnswers({});
      setQuizResult(null);
      setQuizError(null);
      persist({ quiz: q, quizAnswers: {}, quizResult: null });
    } catch (e) {
      setQuizError(e.message || "Eroare la generarea quiz-ului.");
    }
    setLQ(false);
  }

  function selectAnswer(qIdx, letter) {
    if (quizResult) return; // locked after submission
    const upd = { ...answers, [qIdx]: letter };
    setAnswers(upd);
    persist({ quizAnswers: upd });
  }

  async function submitQuiz() {
    if (Object.keys(answers).length < quiz.questions.length) {
      alert("Răspunde la toate întrebările înainte de a trimite!");
      return;
    }
    setEvaluating(true);
    try {
      const result = await evaluateQuiz(chapter, quiz.questions, answers);
      setQuizResult(result);
      persist({ quizResult: result });
      const attemptNum = (saved.quizAttempts || 0) + 1;
      persist({ quizAttempts: attemptNum });
      logger.quizSubmitted(chapter, subject, result.score, result.passed, answers, quiz.questions, attemptNum);
      recordQuizAttempt(result.score, result.passed);
      if (result.passed) {
        // check if we can unlock
        if (hasScreenshot) { onUnlock(chapterId); }
      }
    } catch {
      alert("Eroare la evaluare. Încearcă din nou.");
    }
    setEvaluating(false);
  }

  function resetQuiz() {
    setQuiz(null); setAnswers({}); setQuizResult(null);
    persist({ quiz: null, quizAnswers: {}, quizResult: null });
  }

  // ── Screenshot ──────────────────────────────────────────────────────────────
  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = ev.target.result;
      setScreenshot(img);
      persist({ screenshot: img });
      logger.screenshotUploaded(chapter, subject);
      recordScreenshot();
      if (quizPassed) onUnlock(chapterId);
    };
    reader.readAsDataURL(file);
  }

  // ── TABS config ─────────────────────────────────────────────────────────────
  const tabs = [
    { id: "content",    icon: "📚", label: "Lecție" },
    { id: "chat",       icon: "💬", label: "Tutore" },
    { id: "quiz",       icon: "🧠", label: "Quiz" + (quizPassed ? " ✓" : "") },
    { id: "screenshot", icon: "📸", label: "Dovadă" + (hasScreenshot ? " ✓" : "") },
  ];

  return (
    <div style={S.shell}>
      {/* Back + title */}
      <div style={S.topBar}>
        <button style={S.backBtn} onClick={onBack}>← Înapoi</button>
        <div style={S.chapInfo}>
          <span style={{ fontSize: 16 }}>{sub.icon}</span>
          <span style={S.chapName}>{chapter.title}</span>
        </div>
        {isUnlocked && <span style={S.unlocked}>✅ Bifat</span>}
      </div>

      {/* Unlock progress bar */}
      <div style={S.unlockBar}>
        <div style={{ ...S.unlockStep,
          background: quizPassed ? "#E8F5E9" : "#F0EDE6",
          color: quizPassed ? "#2E7D32" : "#999",
          border: `1px solid ${quizPassed ? "#A5D6A7" : "#D5D0C8"}` }}>
          {quizPassed ? "✓" : "1"} Quiz 8/10
        </div>
        <div style={S.unlockLine} />
        <div style={{ ...S.unlockStep,
          background: hasScreenshot ? "#E8F5E9" : "#F0EDE6",
          color: hasScreenshot ? "#2E7D32" : "#999",
          border: `1px solid ${hasScreenshot ? "#A5D6A7" : "#D5D0C8"}` }}>
          {hasScreenshot ? "✓" : "2"} Screenshot
        </div>
        <div style={S.unlockLine} />
        <div style={{ ...S.unlockStep, background: isUnlocked ? "#C8A84B" : "#F0EDE6", color: isUnlocked ? "#fff" : "#888", border: isUnlocked ? "1px solid #C8A84B" : "1px solid #D5D0C8" }}>
          {isUnlocked ? "✓" : "🔒"} Bifat
        </div>
      </div>

      {/* Tab nav */}
      <div style={S.tabNav}>
        {tabs.map(t => (
          <button key={t.id} style={{ ...S.tabBtn, ...(tab === t.id ? { ...S.tabBtnOn, borderBottomColor: sub.accent } : {}) }}
            onClick={() => setTab(t.id)}>
            <span>{t.icon}</span> <span style={{ fontSize: 12, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={S.body}>

        {/* ── LECȚIE ── */}
        {tab === "content" && (
          <div>
            {loadingContent ? (
              <AnimatedLoading
                messages={CONTENT_MESSAGES}
                subtitle="Prima generare durează ~15 sec. Se salvează local, nu mai plătești a doua oară."
              />
) : content ? (
              <div style={S.mdContent} dangerouslySetInnerHTML={{ __html: renderMd(content) }} />
            ) : (
              <div style={S.emptyState}>
                <div style={{ fontSize: 40 }}>📚</div>
                <p>Lecția nu a fost încă generată.</p>
                <button style={{ ...S.btnY, width: "auto" }} onClick={loadContent}>Generează lecția</button>
              </div>
            )}
            {content && !loadingContent && (
              <button style={{ ...S.btnGray, marginTop: 16, fontSize: 12 }} onClick={loadContent}>🔄 Regenerează</button>
            )}
          </div>
        )}

        {/* ── TUTORE CHAT ── */}
        {tab === "chat" && (
          <div style={S.chatWrap}>
            <div style={S.chatMessages}>
              {chatHistory.length === 0 && (
                <div style={S.chatWelcome}>
                  <div style={{ fontSize: 32 }}>🤖</div>
                  <p style={{ color: "#444", fontSize: 13 }}>
                    Bună Ari! Sunt tutorele tău pentru <strong style={{ color: sub.accent }}>{chapter.title}</strong>.
                    <br />Întreabă-mă orice despre această temă!
                  </p>
                  <div style={S.suggestions}>
                    {["Explică-mi pe scurt capitolul", "Dă-mi un exemplu", "Ce e cel mai important pentru EN?"].map(s => (
                      <button key={s} style={S.suggBtn} onClick={() => { setChatInput(s); }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} style={{ ...S.bubble, ...(m.role === "user" ? S.bubbleUser : S.bubbleAI) }}>
                  {m.role === "assistant" && <div style={S.aiLabel}>🤖 Tutore</div>}
                  <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{m.content}</div>
                </div>
              ))}
              {loadingChat && (
                <div style={{ ...S.bubble, ...S.bubbleAI }}>
                  <div style={S.aiLabel}>🤖 Tutore</div>
                  <div style={S.typingDots}><span /><span /><span /></div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={S.chatInput}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Scrie întrebarea ta..."
                style={S.chatInputField}
                disabled={loadingChat}
              />
              <button style={{ ...S.btnY, width: "auto", marginTop: 0, padding: "10px 18px", opacity: loadingChat ? 0.5 : 1 }}
                onClick={sendChat} disabled={loadingChat}>
                ↑
              </button>
            </div>
          </div>
        )}

        {/* ── QUIZ ── */}
        {tab === "quiz" && (
          <div>
            {quizError && (
              <div style={{ background: "#FFF0EE", border: "1px solid #FFCDD2", borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "#C62828", fontWeight: 600, marginBottom: 6 }}>❌ {quizError}</div>
                <button style={{ ...S.btnY, width: "auto", marginTop: 0 }} onClick={() => { setQuizError(null); loadQuiz(); }}>🔄 Încearcă din nou</button>
              </div>
            )}
            {!quiz && !loadingQuiz && !quizError && (
              <div style={S.emptyState}>
                <div style={{ fontSize: 40 }}>🧠</div>
                <p style={{ color: "#888", fontSize: 14 }}>
                  Quiz de 10 întrebări din <strong>{chapter.title}</strong>.<br />
                  Trebuie să răspunzi corect la minim <strong style={{ color: "#C8A84B", fontFamily: "'Syne',sans-serif" }}>8 din 10</strong> pentru a bifa capitolul.
                </p>
                <button style={{ ...S.btnY, width: "auto" }} onClick={loadQuiz}>
                  🎯 Începe quiz-ul
                </button>
              </div>
            )}

            {loadingQuiz && (
              <AnimatedLoading
                messages={QUIZ_MESSAGES}
                subtitle="Se reîncearcă automat dacă e nevoie. Ai răbdare! 🧠"
              />
            )}

            {quiz && !loadingQuiz && (
              <div>
                {/* Score banner */}
                {quizResult && (
                  <div style={{ ...S.resultBanner, background: quizResult.passed ? "#E8F5E9" : "#FFF0EE", borderColor: quizResult.passed ? "#A5D6A7" : "#FFCDD2" }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{quizResult.passed ? "🎉" : "😔"}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: quizResult.passed ? "#2E7D32" : "#C62828", fontFamily: "'Syne',sans-serif" }}>
                      {quizResult.score}/10
                    </div>
                    <div style={{ fontSize: 13, color: "#444", margin: "6px 0" }}>
                      {quizResult.passed ? "Ai trecut! Acum încarcă și un screenshot." : "Nu ai trecut. Mai încearcă!"}
                    </div>
                    <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6, fontStyle: "italic" }}>{quizResult.feedback}</div>
                    {!quizResult.passed && (
                      <button style={{ ...S.btnY, width: "auto", marginTop: 12 }} onClick={resetQuiz}>🔄 Încearcă din nou</button>
                    )}
                  </div>
                )}

                {/* Questions */}
                {quiz.questions.map((q, qi) => {
                  const userAns = answers[qi];
                  const isCorrect = quizResult && userAns === q.correct;
                  const isWrong   = quizResult && userAns && userAns !== q.correct;
                  return (
                    <div key={q.id} style={{ ...S.qCard, borderLeft: `3px solid ${quizResult ? (isCorrect ? "#6BCB77" : isWrong ? "#FF6B6B" : "#555") : sub.accent}` }}>
                      <div style={S.qNum}>Întrebarea {qi + 1}</div>
                      <div style={S.qText}>{q.question}</div>
                      <div style={S.qOptions}>
                        {q.options.map(opt => {
                          const letter = opt[0];
                          const sel = userAns === letter;
                          const correct = quizResult && letter === q.correct;
                          const wrong   = quizResult && sel && letter !== q.correct;
                          return (
                            <button key={letter}
                              onClick={() => selectAnswer(qi, letter)}
                              style={{
                                ...S.optBtn,
                                background: correct ? "#E8F5E9" : wrong ? "#FFF0EE" : sel ? "#EEF4FF" : "#F8F6F2",
                                border: `1px solid ${correct ? "#A5D6A7" : wrong ? "#FFCDD2" : sel ? sub.accent : "#D5D0C8"}`,
                                color: correct ? "#2E7D32" : wrong ? "#C62828" : sel ? "#1A1A1A" : "#333",
                                fontWeight: sel || correct || wrong ? 600 : 400,
                              }}>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      {quizResult && q.explanation && (
                        <div style={S.explanation}>💡 {q.explanation}</div>
                      )}
                    </div>
                  );
                })}

                {!quizResult && (
                  <button
                    style={{ ...S.btnY, opacity: (Object.keys(answers).length === quiz.questions.length && !evaluating) ? 1 : 0.4 }}
                    onClick={submitQuiz}
                    disabled={Object.keys(answers).length < quiz.questions.length || evaluating}>
                    {evaluating ? "⏳ Claude corectează..." : `✅ Trimite răspunsurile (${Object.keys(answers).length}/10)`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SCREENSHOT ── */}
        {tab === "screenshot" && (
          <div>
            <div style={S.card}>
              <div style={S.cardTitle}>📸 Dovada muncii tale</div>
              <p style={{ fontSize: 13, color: "#444", marginBottom: 16, lineHeight: 1.6 }}>
                Fă o poză sau un screenshot cu notițele, exercițiile sau manualul din care ai studiat
                capitolul <strong style={{ color: sub.accent }}>{chapter.title}</strong>.
                <br /><br />
                <span style={{ color: "#F1C40F" }}>⚠️ Acest pas este obligatoriu</span> pentru a putea bifa capitolul.
              </p>

              {!quizPassed && (
                <div style={S.warningBox}>
                  🧠 Trebuie să treci mai întâi quiz-ul (8/10) înainte de a putea bifa capitolul.
                </div>
              )}

              <div style={{ ...S.dropZone, borderColor: screenshot ? "#2E7D32" : "#D5D0C8" }}
                onClick={() => fileRef.current?.click()}>
                {screenshot
                  ? <img src={screenshot} alt="screenshot" style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8 }} />
                  : <div style={{ textAlign: "center", color: "#444" }}>
                      <div style={{ fontSize: 40 }}>📷</div>
                      <div style={{ fontSize: 13 }}>Apasă pentru a alege o poză sau screenshot</div>
                    </div>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />

              {screenshot && (
                <div style={{ marginTop: 12 }}>
                  <button style={S.btnGray} onClick={() => fileRef.current?.click()}>🔄 Schimbă poza</button>
                </div>
              )}
            </div>

            {/* Final unlock status */}
            {isUnlocked ? (
              <div style={{ ...S.resultBanner, background: "#E8F5E9", borderColor: "#A5D6A7" }}>
                <div style={{ fontSize: 32 }}>🏆</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#2E7D32", fontFamily: "'Syne',sans-serif" }}>Capitol bifat cu succes!</div>
                <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                  Quiz trecut + dovada încărcată. Felicitări Ari! 💪
                </div>
              </div>
            ) : (
              <div style={S.unlockChecklist}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#444", marginBottom: 10 }}>Pentru a bifa capitolul:</div>
                <div style={S.checkItem}><span style={{ color: quizPassed ? "#6BCB77" : "#555" }}>{quizPassed ? "✅" : "⬜"}</span> Quiz trecut (min. 8/10)</div>
                <div style={S.checkItem}><span style={{ color: hasScreenshot ? "#6BCB77" : "#555" }}>{hasScreenshot ? "✅" : "⬜"}</span> Screenshot încărcat</div>
              </div>
            )}
          </div>
        )}

      </div>

      <style>{CSS}</style>
    </div>
  );
}

// ── Minimal markdown renderer ─────────────────────────────────────────────────
function renderMd(text) {
  return text
    .replace(/^# (.+)$/gm, '<h1 style="color:#1A1A1A;font-size:17px;margin:20px 0 10px;font-family:Syne,sans-serif;font-weight:800;border-bottom:2px solid #E0DBD0;padding-bottom:6px;">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#C8A84B;font-size:15px;margin:20px 0 8px;font-family:Syne,sans-serif;font-weight:800;">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="color:#1A5276;font-size:14px;margin:14px 0 6px;font-family:Syne,sans-serif;font-weight:700;">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1A1A1A;font-weight:700;">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="color:#333;font-size:13px;margin:5px 0;list-style:disc;margin-left:20px;line-height:1.6;">$1</li>')
    .replace(/\n/g, '<br/>');
}

function Spinner() {
  return <div style={{ width: 22, height: 22, border: "2px solid #E0DBD0", borderTop: "2px solid #C8A84B", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />;
}

const CONTENT_MESSAGES = [
  "Claude citește programa de clasa a VIII-a...",
  "Se pregătesc explicații pentru tine...",
  "Se caută cele mai bune exemple...",
  "Se construiesc exercițiile rezolvate...",
  "Aproape gata! Se finisează lecția...",
];

const QUIZ_MESSAGES = [
  "Claude inventează întrebări dificile... 😈",
  "Se calibrează dificultatea pentru tine...",
  "Se verifică întrebările cu programa EN...",
  "Se pregătesc capcanele... 🪤",
  "Ultimele retușuri la quiz...",
];

function AnimatedLoading({ messages, subtitle }) {
  const [idx, setIdx] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % messages.length), 2200);
    return () => clearInterval(t);
  }, [messages]);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px", gap: 16 }}>
      <div style={{ position: "relative", width: 56, height: 56 }}>
        <div style={{ position: "absolute", inset: 0, border: "3px solid #F0EDE6", borderTop: "3px solid #C8A84B", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
        <div style={{ position: "absolute", inset: 8, border: "2px solid #F0EDE6", borderBottom: "2px solid #1A5276", borderRadius: "50%", animation: "spin 1.4s linear infinite reverse" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "#333", fontWeight: 500, fontFamily: "'Inter',sans-serif", minHeight: 20, transition: "opacity .3s" }}>
          {messages[idx]}
        </div>
        {subtitle && <div style={{ fontSize: 11, color: "#AAA", marginTop: 6, fontFamily: "'Inter',sans-serif" }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  shell: { background: "#F0EDE6", minHeight: "100vh", fontFamily: "'Inter',sans-serif", color: "#1A1A1A", display: "flex", flexDirection: "column" },
  topBar: { background: "#fff", borderBottom: "2px solid #E0DBD0", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 6px rgba(0,0,0,.04)" },
  backBtn: { background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 14, fontFamily: "'Inter',sans-serif", padding: "4px 8px" },
  chapInfo: { display: "flex", alignItems: "center", gap: 8, flex: 1 },
  chapName: { fontSize: 15, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },
  unlocked: { background: "#E8F5E9", color: "#2E7D32", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, border: "1px solid #A5D6A7", fontFamily: "'Inter',sans-serif" },

  unlockBar: { background: "#fff", borderBottom: "2px solid #E0DBD0", padding: "10px 16px", display: "flex", alignItems: "center", gap: 0, justifyContent: "center" },
  unlockStep: { fontSize: 11, fontWeight: 700, color: "#333", padding: "5px 12px", borderRadius: 20, whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif", border: "1px solid #D5D0C8" },
  unlockLine: { flex: 1, maxWidth: 40, height: 1, background: "#D5D0C8", margin: "0 4px" },

  tabNav: { display: "flex", background: "#fff", borderBottom: "2px solid #E0DBD0" },
  tabBtn: { flex: 1, background: "none", border: "none", borderBottom: "3px solid transparent", color: "#999", padding: "12px 4px 13px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontFamily: "'Inter',sans-serif", fontSize: 22, transition: "color .15s" },
  tabBtnOn: { color: "#1A1A1A", borderBottom: "2px solid #F1C40F" },

  body: { flex: 1, padding: "16px 14px 80px", maxWidth: 640, margin: "0 auto", width: "100%" },

  loading: { display: "flex", alignItems: "center", gap: 12, color: "#444", fontSize: 13, padding: 32 },
  emptyState: { textAlign: "center", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: "#444", fontSize: 14 },

  mdContent: { fontSize: 13, lineHeight: 1.8, color: "#444" },
  btnY: { background: "#F1C40F", color: "#111", border: "none", borderRadius: 8, padding: "11px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13, marginTop: 16, fontFamily: "'Inter',sans-serif", width: "100%", display: "block" },
  btnGray: { background: "#E8E4DC", color: "#444", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 12, fontFamily: "'Inter',sans-serif" },

  chatWrap: { display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" },
  chatMessages: { flex: 1, overflowY: "auto", paddingBottom: 8 },
  chatWelcome: { textAlign: "center", padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  suggestions: { display: "flex", flexDirection: "column", gap: 6, width: "100%" },
  suggBtn: { background: "#F8F6F2", border: "1px solid #EAE6DF", color: "#888", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, textAlign: "left", fontFamily: "'Inter',sans-serif" },
  bubble: { margin: "8px 0", padding: "10px 14px", borderRadius: 12, maxWidth: "88%", fontSize: 13 },
  bubbleUser: { background: "#EEF4FF", color: "#1A1A1A", marginLeft: "auto", borderBottomRightRadius: 4 },
  bubbleAI: { background: "#F8F6F2", color: "#444", marginRight: "auto", borderBottomLeftRadius: 4 },
  aiLabel: { fontSize: 11, color: "#C8A84B", marginBottom: 4, fontWeight: 700, fontFamily: "'Syne',sans-serif" },
  typingDots: { display: "flex", gap: 4, alignItems: "center" },
  chatInput: { display: "flex", gap: 8, padding: "10px 0 0", borderTop: "2px solid #E0DBD0", marginTop: 8 },
  chatInputField: { flex: 1, background: "#fff", border: "1px solid #EAE6DF", color: "#1A1A1A", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontFamily: "'Inter',sans-serif", outline: "none" },

  qCard: { background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 12, border: "1px solid #E0DBD0", boxShadow: "0 1px 4px rgba(0,0,0,.04)" },
  qNum: { fontSize: 11, color: "#C8A84B", marginBottom: 6, fontWeight: 800, fontFamily: "'Syne',sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" },
  qText: { fontSize: 14, color: "#1A1A1A", marginBottom: 14, lineHeight: 1.65, fontWeight: 500 },
  qOptions: { display: "flex", flexDirection: "column", gap: 6 },
  optBtn: { borderRadius: 9, padding: "11px 14px", cursor: "pointer", fontSize: 13, textAlign: "left", fontFamily: "'Inter',sans-serif", transition: "all 0.15s", lineHeight: 1.4 },
  explanation: { marginTop: 10, fontSize: 12, color: "#555", fontStyle: "italic", borderTop: "1px solid #E0DBD0", paddingTop: 8 },
  resultBanner: { border: "1px solid", borderRadius: 12, padding: "18px 16px", marginBottom: 16, textAlign: "center" },

  card: { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 14 },
  cardTitle: { fontWeight: 700, fontSize: 14, color: "#bbb", marginBottom: 10 },
  dropZone: { background: "#F8F6F2", border: "2px dashed", borderRadius: 10, padding: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 130, marginTop: 8 },
  warningBox: { background: "#FFF8E7", border: "1px solid #F0D98A", borderRadius: 10, padding: "11px 14px", fontSize: 13, color: "#7A5C00", marginBottom: 14, fontFamily: "'Inter',sans-serif", fontWeight: 500 },

  unlockChecklist: { background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #E0DBD0" },
  checkItem: { display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#333", marginBottom: 10, fontFamily: "'Inter',sans-serif", fontWeight: 500 },
};

const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  * { box-sizing: border-box; }
  body { background: #F0EDE6; -webkit-tap-highlight-color: transparent; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #F0EDE6; }
  ::-webkit-scrollbar-thumb { background: #D5D0C8; border-radius: 2px; }
  div[style*="typingDots"] span {
    width: 6px; height: 6px; background: #555; border-radius: 50%;
    animation: bounce 1.2s infinite;
  }
  div[style*="typingDots"] span:nth-child(2) { animation-delay: 0.2s; }
  div[style*="typingDots"] span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce { 0%,80%,100% { transform: scale(0.7); opacity:0.5; } 40% { transform: scale(1); opacity:1; } }

  /* Hover effects */
  button:hover { opacity: 0.88; }
  .opt-btn:hover { border-color: #C8A84B !important; background: #FFF8E7 !important; }
  .chap-pill:hover { background: #F0EDE6 !important; }
  .sugg-btn:hover { border-color: #C8A84B !important; background: #FFF8E7 !important; color: #1A1A1A !important; }
  .tab-btn:hover { color: #555 !important; }
  .back-btn:hover { background: #F0EDE6 !important; border-color: #C8A84B !important; }
`;
