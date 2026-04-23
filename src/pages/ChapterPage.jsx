import { useState, useEffect, useRef } from "react";
import { ls } from "../utils/storage.js";
import { generateChapterContent, generateQuiz, evaluateQuiz, chatWithTutor } from "../utils/api.js";
import { SUBJECTS, CONFIG } from "../constants.js";

// ── CHAPTER PAGE ─────────────────────────────────────────────────────────────
// Tab flow: Conținut → Chat → Quiz → Screenshot → (unlocks chapter)
export default function ChapterPage({ chapterId, subject, onBack, onUnlock }) {
  const sub     = SUBJECTS[subject];
  const chapter = sub.chapters.find(c => c.id === chapterId);
  const storageKey = `chapter_${chapterId}`;

  const [tab, setTab]           = useState("content");   // content|chat|quiz|screenshot
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
    } catch (e) {
      setContent("❌ Eroare la generarea conținutului. Verifică conexiunea și API key-ul.");
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
    } catch {
      const err = [...newHistory, { role: "assistant", content: "❌ Eroare. Încearcă din nou." }];
      setChatHistory(err);
    }
    setLoadingChat(false);
  }

  // ── Quiz ────────────────────────────────────────────────────────────────────
  async function loadQuiz() {
    setLQ(true);
    try {
      const q = await generateQuiz(chapter);
      setQuiz(q);
      setAnswers({});
      setQuizResult(null);
      persist({ quiz: q, quizAnswers: {}, quizResult: null });
    } catch (e) {
      alert("Eroare la generarea quiz-ului. Încearcă din nou.");
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
        <div style={{ ...S.unlockStep, background: quizPassed ? "#6BCB77" : "#333" }}>
          {quizPassed ? "✓" : "1"} Quiz 8/10
        </div>
        <div style={S.unlockLine} />
        <div style={{ ...S.unlockStep, background: hasScreenshot ? "#6BCB77" : "#333" }}>
          {hasScreenshot ? "✓" : "2"} Screenshot
        </div>
        <div style={S.unlockLine} />
        <div style={{ ...S.unlockStep, background: isUnlocked ? "#F1C40F" : "#333", color: isUnlocked ? "#111" : "#eee" }}>
          {isUnlocked ? "✓" : "🔒"} Bifat
        </div>
      </div>

      {/* Tab nav */}
      <div style={S.tabNav}>
        {tabs.map(t => (
          <button key={t.id} style={{ ...S.tabBtn, ...(tab === t.id ? { ...S.tabBtnOn, borderBottomColor: sub.accent } : {}) }}
            onClick={() => setTab(t.id)}>
            <span>{t.icon}</span> <span style={{ fontSize: 11 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={S.body}>

        {/* ── LECȚIE ── */}
        {tab === "content" && (
          <div>
            {loadingContent ? (
              <div style={S.loading}><Spinner /> <span>Claude generează lecția pentru tine...</span></div>
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
                  <p style={{ color: "#888", fontSize: 13 }}>
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
            {!quiz && !loadingQuiz && (
              <div style={S.emptyState}>
                <div style={{ fontSize: 40 }}>🧠</div>
                <p style={{ color: "#aaa", fontSize: 14 }}>
                  Quiz de 10 întrebări din <strong>{chapter.title}</strong>.<br />
                  Trebuie să răspunzi corect la minim <strong style={{ color: "#F1C40F" }}>8 din 10</strong> pentru a bifa capitolul.
                </p>
                <button style={{ ...S.btnY, width: "auto" }} onClick={loadQuiz}>
                  🎯 Începe quiz-ul
                </button>
              </div>
            )}

            {loadingQuiz && (
              <div style={S.loading}><Spinner /> <span>Claude generează întrebările...</span></div>
            )}

            {quiz && !loadingQuiz && (
              <div>
                {/* Score banner */}
                {quizResult && (
                  <div style={{ ...S.resultBanner, background: quizResult.passed ? "#1a3a1a" : "#3a1a1a", borderColor: quizResult.passed ? "#6BCB77" : "#FF6B6B" }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{quizResult.passed ? "🎉" : "😔"}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: quizResult.passed ? "#6BCB77" : "#FF6B6B" }}>
                      {quizResult.score}/10
                    </div>
                    <div style={{ fontSize: 13, color: "#ccc", margin: "6px 0" }}>
                      {quizResult.passed ? "Ai trecut! Acum încarcă și un screenshot." : "Nu ai trecut. Mai încearcă!"}
                    </div>
                    <div style={{ fontSize: 12, color: "#aaa", lineHeight: 1.6, fontStyle: "italic" }}>{quizResult.feedback}</div>
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
                                background: correct ? "#1a3a1a" : wrong ? "#3a1a1a" : sel ? "#252525" : "#1a1a1a",
                                border: `1px solid ${correct ? "#6BCB77" : wrong ? "#FF6B6B" : sel ? sub.accent : "#333"}`,
                                color: correct ? "#6BCB77" : wrong ? "#FF6B6B" : sel ? "#fff" : "#ccc",
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
                    {evaluating ? "Claude evaluează..." : `✅ Trimite răspunsurile (${Object.keys(answers).length}/10)`}
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
              <p style={{ fontSize: 13, color: "#888", marginBottom: 16, lineHeight: 1.6 }}>
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

              <div style={{ ...S.dropZone, borderColor: screenshot ? "#6BCB77" : "#333" }}
                onClick={() => fileRef.current?.click()}>
                {screenshot
                  ? <img src={screenshot} alt="screenshot" style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 8 }} />
                  : <div style={{ textAlign: "center", color: "#555" }}>
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
              <div style={{ ...S.resultBanner, background: "#1a2e1a", borderColor: "#6BCB77" }}>
                <div style={{ fontSize: 32 }}>🏆</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#6BCB77" }}>Capitol bifat cu succes!</div>
                <div style={{ fontSize: 13, color: "#aaa", marginTop: 4 }}>
                  Quiz trecut + dovada încărcată. Felicitări Ari! 💪
                </div>
              </div>
            ) : (
              <div style={S.unlockChecklist}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#888", marginBottom: 10 }}>Pentru a bifa capitolul:</div>
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
    .replace(/^## (.+)$/gm, '<h2 style="color:#F1C40F;font-size:16px;margin:20px 0 8px;font-family:Georgia,serif;">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="color:#eee;font-size:14px;margin:14px 0 6px;font-family:Georgia,serif;">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff;">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="color:#ccc;font-size:13px;margin:3px 0;list-style:disc;margin-left:18px;">$1</li>')
    .replace(/\n/g, '<br/>');
}

function Spinner() {
  return <div style={{ width: 20, height: 20, border: "2px solid #333", borderTop: "2px solid #F1C40F", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />;
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S = {
  shell: { background: "#111", minHeight: "100vh", fontFamily: "Georgia,'Times New Roman',serif", color: "#eee", display: "flex", flexDirection: "column" },
  topBar: { background: "#181818", borderBottom: "1px solid #222", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 },
  backBtn: { background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 14, fontFamily: "Georgia,serif", padding: "4px 8px" },
  chapInfo: { display: "flex", alignItems: "center", gap: 8, flex: 1 },
  chapName: { fontSize: 14, fontWeight: 700, color: "#eee" },
  unlocked: { background: "#1a3a1a", color: "#6BCB77", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, border: "1px solid #2a5a2a" },

  unlockBar: { background: "#161616", borderBottom: "1px solid #1e1e1e", padding: "8px 16px", display: "flex", alignItems: "center", gap: 0, justifyContent: "center" },
  unlockStep: { fontSize: 10, fontWeight: 700, color: "#eee", padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap" },
  unlockLine: { flex: 1, maxWidth: 40, height: 1, background: "#333", margin: "0 4px" },

  tabNav: { display: "flex", background: "#181818", borderBottom: "1px solid #222" },
  tabBtn: { flex: 1, background: "none", border: "none", borderBottom: "2px solid transparent", color: "#666", padding: "10px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontFamily: "Georgia,serif", fontSize: 16 },
  tabBtnOn: { color: "#eee", borderBottom: "2px solid #F1C40F" },

  body: { flex: 1, padding: "16px 14px 80px", maxWidth: 640, margin: "0 auto", width: "100%" },

  loading: { display: "flex", alignItems: "center", gap: 12, color: "#888", fontSize: 13, padding: 32 },
  emptyState: { textAlign: "center", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: "#888", fontSize: 14 },

  mdContent: { fontSize: 13, lineHeight: 1.8, color: "#ccc" },
  btnY: { background: "#F1C40F", color: "#111", border: "none", borderRadius: 8, padding: "11px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13, marginTop: 16, fontFamily: "Georgia,serif", width: "100%", display: "block" },
  btnGray: { background: "#2a2a2a", color: "#ccc", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif" },

  chatWrap: { display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" },
  chatMessages: { flex: 1, overflowY: "auto", paddingBottom: 8 },
  chatWelcome: { textAlign: "center", padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  suggestions: { display: "flex", flexDirection: "column", gap: 6, width: "100%" },
  suggBtn: { background: "#1e1e1e", border: "1px solid #2a2a2a", color: "#aaa", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, textAlign: "left", fontFamily: "Georgia,serif" },
  bubble: { margin: "8px 0", padding: "10px 14px", borderRadius: 12, maxWidth: "88%", fontSize: 13 },
  bubbleUser: { background: "#1e2e3e", color: "#eee", marginLeft: "auto", borderBottomRightRadius: 4 },
  bubbleAI: { background: "#1e1e1e", color: "#ddd", marginRight: "auto", borderBottomLeftRadius: 4 },
  aiLabel: { fontSize: 10, color: "#555", marginBottom: 4 },
  typingDots: { display: "flex", gap: 4, alignItems: "center" },
  chatInput: { display: "flex", gap: 8, padding: "10px 0 0", borderTop: "1px solid #222", marginTop: 8 },
  chatInputField: { flex: 1, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#eee", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontFamily: "Georgia,serif", outline: "none" },

  qCard: { background: "#1a1a1a", borderRadius: 10, padding: 14, marginBottom: 12 },
  qNum: { fontSize: 10, color: "#666", marginBottom: 4, fontWeight: 700 },
  qText: { fontSize: 13, color: "#eee", marginBottom: 12, lineHeight: 1.6 },
  qOptions: { display: "flex", flexDirection: "column", gap: 6 },
  optBtn: { borderRadius: 8, padding: "9px 14px", cursor: "pointer", fontSize: 12, textAlign: "left", fontFamily: "Georgia,serif", transition: "all 0.15s" },
  explanation: { marginTop: 10, fontSize: 11, color: "#888", fontStyle: "italic", borderTop: "1px solid #2a2a2a", paddingTop: 8 },
  resultBanner: { border: "1px solid", borderRadius: 12, padding: "18px 16px", marginBottom: 16, textAlign: "center" },

  card: { background: "#1a1a1a", borderRadius: 12, padding: 16, marginBottom: 14 },
  cardTitle: { fontWeight: 700, fontSize: 14, color: "#bbb", marginBottom: 10 },
  dropZone: { background: "#161616", border: "2px dashed", borderRadius: 10, padding: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 130, marginTop: 8 },
  warningBox: { background: "#2a1f10", border: "1px solid #553", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#cc9", marginBottom: 14 },

  unlockChecklist: { background: "#1a1a1a", borderRadius: 10, padding: 16 },
  checkItem: { display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#ccc", marginBottom: 8 },
};

const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #111; }
  ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
  div[style*="typingDots"] span {
    width: 6px; height: 6px; background: #555; border-radius: 50%;
    animation: bounce 1.2s infinite;
  }
  div[style*="typingDots"] span:nth-child(2) { animation-delay: 0.2s; }
  div[style*="typingDots"] span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce { 0%,80%,100% { transform: scale(0.7); opacity:0.5; } 40% { transform: scale(1); opacity:1; } }
`;
