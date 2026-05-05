import React, { useState, useEffect, useRef } from "react";
import { cloudGet, cloudSet } from "../utils/cloudStorage.js";
import { ls } from "../utils/storage.js";
import { generateChapterContent, generateQuiz, evaluateQuiz, chatWithTutor, generateEssayPrompt, evaluateEssay, generateMathProblems, evaluateMathSolution } from "../utils/api.js";
import { SUBJECTS, CONFIG } from "../constants.js";
import { logger } from "../utils/logger.js";
import { useAuth } from "../context/AuthContext.jsx";
import UpgradeModal from "./UpgradeModal.jsx";
import { recordContentRead, recordChatMessage, recordQuizAttempt } from "../utils/gamification.js";
import { trackFeature } from "../utils/featureTracking.js";

export default function ChapterPage({ chapterId, subject, userId, onBack, onUnlock }) {
  const { user } = useAuth();
  const sub      = SUBJECTS[subject];
  const chapter  = sub?.chapters?.find(c => c.id === chapterId);
  const storageKey = `chapter_${chapterId}`;
  const cloudKey   = `chapter_${chapterId}`;

  // ── STATE — all declared first, in correct order ───────────────────────────
  const [saved, setSaved]             = useState(() => ls.get(storageKey) || {});
  const savedRef                      = useRef(ls.get(storageKey) || {}); // always-fresh ref

  const [tab, setTab]                 = useState("content");
  const [cloudLoaded, setCloudLoaded] = useState(false);

  const [content, setContent]         = useState(() => (ls.get(storageKey) || {}).content || "");
  const [loadingContent, setLC]       = useState(false);

  const [chatHistory, setChatHistory] = useState(() => (ls.get(storageKey) || {}).chatHistory || []);
  const [chatInput, setChatInput]     = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const chatEndRef                    = useRef(null);

  const [quiz, setQuiz]               = useState(() => (ls.get(storageKey) || {}).quiz || null);
  const [loadingQuiz, setLQ]          = useState(false);
  const [quizError, setQuizError]     = useState(null);
  const [answers, setAnswers]         = useState(() => (ls.get(storageKey) || {}).quizAnswers || {});
  const [quizResult, setQuizResult]   = useState(() => (ls.get(storageKey) || {}).quizResult || null);
  const [evaluating, setEvaluating]   = useState(false);
  const [upgradeModal, setUpgradeModal] = useState(null);

  // ── ESSAY (Romanian only) ──────────────────────────────────────────────────
  const [essayPrompt, setEssayPrompt] = useState(() => (ls.get(storageKey) || {}).essayPrompt || null);
  const [essayText, setEssayText]     = useState(() => (ls.get(storageKey) || {}).essayText || "");
  const [essayResult, setEssayResult] = useState(() => (ls.get(storageKey) || {}).essayResult || null);
  const [loadingEssayPrompt, setLEP]  = useState(false);
  const [evaluatingEssay, setEvalEssay] = useState(false);
  const [essayError, setEssayError]   = useState(null);

  // ── MATH PROBLEMS (Math only) ──────────────────────────────────────────────
  const [mathProblems, setMathProblems] = useState(() => (ls.get(storageKey) || {}).mathProblems || null);
  const [loadingProblems, setLPB]       = useState(false);
  const [problemsError, setProblemsError] = useState(null);
  const [revealedSolutions, setRevealed]  = useState({}); // { problemId: true }
  const [studentSolutions, setStudentSol] = useState({}); // { problemId: "text" }
  const [solutionVerdicts, setVerdicts]   = useState({}); // { problemId: { verdict, scor, comentariu, indiciu } }
  const [evalProblemId, setEvalPid]       = useState(null); // which problem is being evaluated

  // ── DERIVED ────────────────────────────────────────────────────────────────
  const quizPassed = quizResult?.passed || saved.quizResult?.passed;
  const isUnlocked = quizPassed;

  // ── PERSIST ────────────────────────────────────────────────────────────────
  function persist(patch) {
    const updated = { ...savedRef.current, ...patch };
    savedRef.current = updated;
    setSaved(updated);
    ls.set(storageKey, updated);
    cloudSet(cloudKey, updated);
  }

  // Keep savedRef in sync
  useEffect(() => { savedRef.current = saved; }, [saved]);

  // ── EFFECTS ────────────────────────────────────────────────────────────────
  // Load from cloud on mount — with 5s timeout fallback
  useEffect(() => {
    if (!chapter || !sub) return;
    logger.chapterOpened(chapter, subject);
    const timeout = setTimeout(() => {
      // If cloud takes too long, proceed with localStorage data
      setCloudLoaded(true);
    }, 1500);

    cloudGet(cloudKey).then(val => {
      clearTimeout(timeout);
      if (val) {
        savedRef.current = val;
        setSaved(val);
        if (val.content)      setContent(val.content);
        if (val.chatHistory)  setChatHistory(val.chatHistory);
        if (val.quiz)         setQuiz(val.quiz);
        if (val.quizAnswers)  setAnswers(val.quizAnswers);
        if (val.quizResult)   setQuizResult(val.quizResult);
        if (val.essayPrompt)  setEssayPrompt(val.essayPrompt);
        if (val.essayText)    setEssayText(val.essayText);
        if (val.essayResult)  setEssayResult(val.essayResult);
        if (val.mathProblems) setMathProblems(val.mathProblems);
      }
      setCloudLoaded(true);
    }).catch(() => {
      clearTimeout(timeout);
      setCloudLoaded(true); // proceed with local data on error
    });
  }, [userId]);

  // Auto-load content when tab opens — wait for cloud data first
  useEffect(() => {
    if (cloudLoaded && !content && tab === "content") loadContent();
  }, [tab, cloudLoaded]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  useEffect(() => {
    if (!chapter || !sub) return;
    if (tab === "essay" && subject === "romana") {
      trackFeature("essay_tab_opened", { chapterId, chapterTitle: chapter.title, subject });
    }
    if (tab === "math" && subject === "matematica") {
      trackFeature("math_tab_opened", { chapterId, chapterTitle: chapter.title, subject });
    }
  }, [tab, chapterId, subject]);

  // ── ACTIONS ────────────────────────────────────────────────────────────────
  async function loadContent() {
    setLC(true);
    try {
      const text = await generateChapterContent(chapter);
      setContent(text);
      persist({ content: text });
      logger.contentGenerated(chapter, subject);
      recordContentRead();
    } catch (err) {
      if (err.message?.startsWith("LIMIT_REACHED:")) {
        setUpgradeModal("lesson");
      } else {
        setContent("❌ Nu s-a putut genera lecția. Verifică conexiunea și încearcă din nou.");
      }
    }
    setLC(false);
  }

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || loadingChat) return;
    const newHistory = [...chatHistory, { role: "user", content: msg }];
    setChatHistory(newHistory);
    setChatInput("");
    setLoadingChat(true);
    try {
      const reply = await chatWithTutor(chapter, newHistory, msg, user?.name?.split(" ")[0] || "elev");
      const full  = [...newHistory, { role: "assistant", content: reply }];
      setChatHistory(full);
      persist({ chatHistory: full });
      logger.chatMessage(chapter, subject, msg, reply);
      recordChatMessage();
    } catch (err) {
      if (err.message?.startsWith("LIMIT_REACHED:")) {
        setChatHistory(newHistory); // Remove the pending user message
        setUpgradeModal("chat");
      } else {
        setChatHistory([...newHistory, { role: "assistant", content: "❌ Eroare. Încearcă din nou." }]);
      }
    }
    setLoadingChat(false);
  }

  async function loadQuiz() {
    setLQ(true);
    setQuizError(null);
    logger.quizStarted(chapter, subject);
    try {
      const q = await generateQuiz(chapter);
      setQuiz(q);
      setAnswers({});
      setQuizResult(null);
      persist({ quiz: q, quizAnswers: {}, quizResult: null });
    } catch (e) {
      if (e.message?.startsWith("LIMIT_REACHED:")) {
        setUpgradeModal("quiz");
      } else {
        setQuizError(e.message || "Eroare la generarea quiz-ului.");
      }
    }
    setLQ(false);
  }

  function selectAnswer(qIdx, letter) {
    if (quizResult) return;
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
      const result = await evaluateQuiz(chapter, quiz.questions, answers, user?.name?.split(" ")[0] || "tu");
      setQuizResult(result);
      const attemptNum = (savedRef.current.quizAttempts || 0) + 1;
      persist({ quizResult: result, quizAttempts: attemptNum });
      logger.quizSubmitted(chapter, subject, result.score, result.passed, answers, quiz.questions, attemptNum);
      recordQuizAttempt(result.score, result.passed);
      if (result.passed && !savedRef.current._unlockCalled) {
        savedRef.current._unlockCalled = true;
        onUnlock(chapterId);
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

  // ── ESSAY HANDLERS ──────────────────────────────────────────────────────────
  async function loadEssayPrompt() {
    setLEP(true);
    setEssayError(null);
    try {
      const p = await generateEssayPrompt(chapter);
      setEssayPrompt(p);
      setEssayText("");
      setEssayResult(null);
      persist({ essayPrompt: p, essayText: "", essayResult: null });
      trackFeature("essay_prompt_generated", { chapterId, chapterTitle: chapter.title, subject });
    } catch (e) {
      if (e.message?.startsWith("LIMIT_REACHED:")) setUpgradeModal("chat");
      else setEssayError(e.message || "Eroare la generarea cerinței.");
    }
    setLEP(false);
  }

  function updateEssayText(t) {
    setEssayText(t);
    const started = !!savedRef.current._essayDraftStarted;
    persist({ essayText: t, ...(t.trim() && !started ? { _essayDraftStarted: true } : {}) });
    if (t.trim() && !started) {
      trackFeature("essay_draft_started", { chapterId, chapterTitle: chapter.title, subject });
    }
  }

  async function submitEssay() {
    if (!essayPrompt || !essayText.trim() || evaluatingEssay) return;
    setEvalEssay(true);
    setEssayError(null);
    try {
      trackFeature("essay_evaluation_submitted", { chapterId, chapterTitle: chapter.title, subject, wordCount: essayWordCount });
      const result = await evaluateEssay(chapter, essayPrompt, essayText, user?.name?.split(" ")[0] || "elevul");
      setEssayResult(result);
      persist({ essayResult: result });
      logger.essayEvaluated(chapter, subject, result.score, result.wordCount);
      trackFeature("essay_evaluation_completed", { chapterId, chapterTitle: chapter.title, subject, score: result.score, wordCount: result.wordCount || essayWordCount });
    } catch (e) {
      if (e.message?.startsWith("LIMIT_REACHED:")) setUpgradeModal("chat");
      else setEssayError(e.message || "Eroare la evaluare.");
    }
    setEvalEssay(false);
  }

  function resetEssay() {
    setEssayPrompt(null); setEssayText(""); setEssayResult(null);
    persist({ essayPrompt: null, essayText: "", essayResult: null, _essayDraftStarted: false });
  }

  // ── MATH PROBLEMS HANDLERS ──────────────────────────────────────────────────
  async function loadMathProblems() {
    setLPB(true);
    setProblemsError(null);
    try {
      const data = await generateMathProblems(chapter);
      setMathProblems(data);
      setRevealed({});
      setStudentSol({});
      setVerdicts({});
      persist({ mathProblems: data });
      logger.mathProblemsGenerated(chapter, subject);
      trackFeature("math_set_generated", { chapterId, chapterTitle: chapter.title, subject, problemCount: data?.problems?.length || 0 });
    } catch (e) {
      if (e.message?.startsWith("LIMIT_REACHED:")) setUpgradeModal("lesson");
      else setProblemsError(e.message || "Eroare la generarea problemelor.");
    }
    setLPB(false);
  }

  function toggleSolution(problemId) {
    setRevealed(prev => {
      const nextValue = !prev[problemId];
      if (nextValue) {
        trackFeature("math_solution_revealed", { chapterId, chapterTitle: chapter.title, subject, problemId });
      }
      return { ...prev, [problemId]: nextValue };
    });
  }

  function updateStudentSolution(problemId, text) {
    setStudentSol(prev => ({ ...prev, [problemId]: text }));
  }

  async function checkMathSolution(problem) {
    const sol = studentSolutions[problem.id]?.trim();
    if (!sol || evalProblemId === problem.id) return;
    setEvalPid(problem.id);
    try {
      trackFeature("math_solution_submitted", { chapterId, chapterTitle: chapter.title, subject, problemId: problem.id, dificultate: problem.dificultate });
      const verdict = await evaluateMathSolution(problem, sol, user?.name?.split(" ")[0] || "elevul");
      setVerdicts(prev => ({ ...prev, [problem.id]: verdict }));
      logger.mathSolutionEvaluated(chapter, subject, problem.dificultate, verdict.verdict, verdict.scor);
      trackFeature("math_solution_evaluated", { chapterId, chapterTitle: chapter.title, subject, problemId: problem.id, dificultate: problem.dificultate, verdict: verdict.verdict, score: verdict.scor });
    } catch (e) {
      if (e.message?.startsWith("LIMIT_REACHED:")) setUpgradeModal("chat");
      else setVerdicts(prev => ({ ...prev, [problem.id]: { verdict: "gresit", scor: 0, comentariu: "Eroare la verificare. Încearcă din nou.", indiciu: "" } }));
    }
    setEvalPid(null);
  }

  function resetMathProblems() {
    setMathProblems(null); setRevealed({}); setStudentSol({}); setVerdicts({});
    persist({ mathProblems: null });
  }

  // ── DERIVED FOR ESSAY ──────────────────────────────────────────────────────
  const essayWordCount = essayText.trim().split(/\s+/).filter(Boolean).length;
  const essayInRange = essayPrompt
    ? essayWordCount >= essayPrompt.lungimeMin && essayWordCount <= essayPrompt.lungimeMax
    : false;

  // ── TABS ───────────────────────────────────────────────────────────────────
  const tabs = [
    { id: "content", icon: "📚", label: "Lecție" },
    { id: "chat",    icon: "💬", label: "Tutore" },
    { id: "quiz",    icon: "🧠", label: "Quiz" + (quizPassed ? " ✓" : "") },
    ...(subject === "romana"
      ? [{ id: "essay", icon: "📝", label: "Compunere" + (essayResult ? ` ${essayResult.score}` : "") }]
      : []),
    ...(subject === "matematica"
      ? [{ id: "math", icon: "🧮", label: "Probleme" }]
      : []),
  ];

  // ── RENDER ─────────────────────────────────────────────────────────────────
  if (!sub || !chapter) return (
    <div style={{ padding: 20, fontFamily: "'Inter', sans-serif" }}>
      <h2>Nu s-a putut încărca lecția</h2>
      <p>Capitolul sau materia nu există în structura aplicației. Te rog revino la pagina anterioară.</p>
      <button style={S.btnY} onClick={onBack}>Înapoi</button>
    </div>
  );

  if (!cloudLoaded) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 16, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ fontSize: 32 }}>📖</div>
      <div style={{ fontSize: 15, color: "#666" }}>Se încarcă capitolul...</div>
    </div>
  );

  return (
    <div style={S.shell}>
      {/* Header */}
      <div style={S.topBar}>
        <button style={S.backBtn} onClick={onBack}>← Înapoi</button>
        <div style={S.chapInfo}>
          <span style={{ fontSize: 16 }}>{sub.icon}</span>
          <span style={S.chapName}>{chapter.title}</span>
        </div>
        {isUnlocked && <span style={S.unlockedBadge}>✅ Bifat</span>}
      </div>

      {/* Unlock bar */}
      <div style={S.unlockBar}>
        <Step done={quizPassed} label="Quiz 8/10" n="1" />
        <div style={S.unlockLine} />
        <Step done={isUnlocked} label="Bifat" n="🔒" gold />
      </div>

      {/* Tab nav */}
      <div style={S.tabNav}>
        {tabs.map(t => (
          <button key={t.id}
            style={{ ...S.tabBtn, ...(tab === t.id ? { ...S.tabBtnOn, borderBottomColor: sub.accent } : {}) }}
            onClick={() => setTab(t.id)}>
            <span>{t.icon}</span>
            <span style={{ fontSize: 12, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={S.body}>

        {/* LECȚIE */}
        {tab === "content" && (
          <div>
            {loadingContent
              ? <AnimatedLoading messages={CONTENT_MESSAGES} subtitle="Prima generare ~15 sec. Se salvează local după." />
              : content
                ? <div style={S.mdContent} dangerouslySetInnerHTML={{ __html: renderMd(content) }} />
                : <div style={S.emptyState}>
                    <div style={{ fontSize: 40 }}>📚</div>
                    <p>Lecția nu a fost generată încă.</p>
                    <button style={S.btnY} onClick={loadContent}>Generează lecția</button>
                  </div>
            }
            {content && !loadingContent && (
              <button style={{ ...S.btnGray, marginTop: 16 }} onClick={loadContent}>🔄 Regenerează</button>
            )}
          </div>
        )}

        {/* CHAT */}
        {tab === "chat" && (
          <div style={S.chatWrap}>
            <div style={S.chatMessages}>
              {chatHistory.length === 0 && (
                <div style={S.chatWelcome}>
                  <div style={{ fontSize: 32 }}>🤖</div>
                  <p style={{ color: "#444", fontSize: 13 }}>
                    Bună{user?.name ? ` ${user.name.split(" ")[0]}` : ""}! Sunt tutorele tău pentru <strong style={{ color: sub.accent }}>{chapter.title}</strong>.
                    <br />Întreabă-mă orice!
                  </p>
                  <div style={S.suggestions}>
                    {["Explică-mi pe scurt capitolul", "Dă-mi un exemplu", "Ce e cel mai important pentru EN?"].map(s => (
                      <button key={s} style={S.suggBtn} onClick={() => setChatInput(s)}>{s}</button>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={S.typingDots}><span /><span /><span /></div>
                    <span style={{ fontSize: 11, color: "#AAA", fontStyle: "italic" }}>se gândește...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={S.chatInputRow}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Scrie întrebarea ta..."
                style={S.chatInputField}
                disabled={loadingChat}
              />
              <button style={{ ...S.btnY, width: "auto", marginTop: 0, padding: "10px 18px", opacity: loadingChat ? 0.5 : 1 }}
                onClick={sendChat} disabled={loadingChat}>↑</button>
            </div>
          </div>
        )}

        {/* QUIZ */}
        {tab === "quiz" && (
          <div>
            {quizError && (
              <div style={S.errorBox}>
                <div style={{ fontSize: 13, color: "#C62828", fontWeight: 600, marginBottom: 6 }}>❌ {quizError}</div>
                <button style={{ ...S.btnY, width: "auto", marginTop: 0 }} onClick={() => { setQuizError(null); loadQuiz(); }}>🔄 Încearcă din nou</button>
              </div>
            )}
            {!quiz && !loadingQuiz && !quizError && (
              <div style={S.emptyState}>
                <div style={{ fontSize: 40 }}>🧠</div>
                <p style={{ color: "#888", fontSize: 14 }}>
                  Quiz de 10 întrebări din <strong>{chapter.title}</strong>.<br />
                  Minim <strong style={{ color: "#C8A84B" }}>8/10</strong> pentru a bifa capitolul.
                </p>
                <button style={{ ...S.btnY, width: "auto" }} onClick={loadQuiz}>🎯 Începe quiz-ul</button>
              </div>
            )}
            {loadingQuiz && <AnimatedLoading messages={QUIZ_MESSAGES} subtitle="Se reîncearcă automat dacă e nevoie. 🧠" />}
            {quiz && !loadingQuiz && (
              <div>
                {quizResult && (
                  <div style={{ ...S.resultBanner, background: quizResult.passed ? "#E8F5E9" : "#FFF0EE", borderColor: quizResult.passed ? "#A5D6A7" : "#FFCDD2" }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{quizResult.passed ? "🎉" : "😔"}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: quizResult.passed ? "#2E7D32" : "#C62828", fontFamily: "'Syne',sans-serif" }}>
                      {quizResult.score}/10
                    </div>
                    <div style={{ fontSize: 13, color: "#444", margin: "6px 0" }}>
                      {quizResult.passed ? "Felicitări! Capitolul e bifat 🎉" : "Nu ai trecut. Mai încearcă!"}
                    </div>
                    <div style={{ fontSize: 12, color: "#888", lineHeight: 1.6, fontStyle: "italic" }}>{quizResult.feedback}</div>
                    {!quizResult.passed && <button style={{ ...S.btnY, width: "auto", marginTop: 12 }} onClick={resetQuiz}>🔄 Încearcă din nou</button>}
                  </div>
                )}
                {quiz.questions.map((q, qi) => {
                  const ua = answers[qi];
                  const isCorrect = quizResult && ua === q.correct;
                  const isWrong   = quizResult && ua && ua !== q.correct;
                  return (
                    <div key={q.id} style={{ ...S.qCard, borderLeft: `3px solid ${quizResult ? (isCorrect ? "#6BCB77" : isWrong ? "#FF6B6B" : "#555") : sub.accent}` }}>
                      <div style={S.qNum}>Întrebarea {qi + 1}</div>
                      <div style={S.qText}>{q.question}</div>
                      <div style={S.qOptions}>
                        {q.options.map(opt => {
                          const letter = opt[0];
                          const sel     = ua === letter;
                          const correct = quizResult && letter === q.correct;
                          const wrong   = quizResult && sel && letter !== q.correct;
                          return (
                            <button key={letter} onClick={() => selectAnswer(qi, letter)} style={{
                              ...S.optBtn,
                              background: correct ? "#E8F5E9" : wrong ? "#FFF0EE" : sel ? "#EEF4FF" : "#F8F6F2",
                              border: `1px solid ${correct ? "#A5D6A7" : wrong ? "#FFCDD2" : sel ? sub.accent : "#D5D0C8"}`,
                              color: correct ? "#2E7D32" : wrong ? "#C62828" : sel ? "#1A1A1A" : "#333",
                              fontWeight: sel || correct || wrong ? 600 : 400,
                            }}>{opt}</button>
                          );
                        })}
                      </div>
                      {quizResult && q.explanation && <div style={S.explanation}>💡 {q.explanation}</div>}
                    </div>
                  );
                })}
                {!quizResult && (
                  <button
                    style={{ ...S.btnY, opacity: (Object.keys(answers).length === quiz.questions.length && !evaluating) ? 1 : 0.4 }}
                    onClick={submitQuiz}
                    disabled={Object.keys(answers).length < quiz.questions.length || evaluating}>
                    {evaluating ? "⏳ Aplicația corectează..." : `✅ Trimite răspunsurile (${Object.keys(answers).length}/10)`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* COMPUNERE (Romana only) */}
        {tab === "essay" && subject === "romana" && (
          <div>
            {!essayPrompt ? (
              <div style={S.card}>
                <div style={S.cardTitle}>📝 Antrenament redactare — Subiectul II</div>
                <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, margin: "0 0 14px" }}>
                  La EN VIII, Subiectul II îți cere să redactezi un text de <strong>150-300 cuvinte</strong>.
                  E unde se câștigă sau se pierd 16 puncte. Aici primești o cerință pe tema capitolului
                  <strong> "{chapter.title}"</strong>, scrii compunerea, iar Aplicația o evaluează după baremul oficial.
                </p>
                <div style={{ background: "#FFF8E7", border: "1px solid #F0D98A", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#7A5C00", marginBottom: 14, lineHeight: 1.5 }}>
                  ⚠️ <strong>Important:</strong> lungimea trebuie să fie strict 150-300 cuvinte.
                  Texte mai scurte sau mai lungi pierd puncte la criteriul de redactare — exact ca la examenul real.
                </div>
                <button style={S.btnY} onClick={loadEssayPrompt} disabled={loadingEssayPrompt}>
                  {loadingEssayPrompt ? "⏳ Generează cerința..." : "📝 Cere subiect de compunere"}
                </button>
                {essayError && <div style={{ ...S.errorBox, marginTop: 12 }}>❌ {essayError}</div>}
              </div>
            ) : (
              <>
                {/* Subiectul */}
                <div style={S.card}>
                  <div style={{ fontSize: 11, color: "#C8A84B", marginBottom: 6, fontWeight: 800, fontFamily: "'Syne',sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Subiect — text {essayPrompt.tip}
                  </div>
                  <div style={{ fontSize: 14, color: "#1A1A1A", lineHeight: 1.65, marginBottom: 12, fontWeight: 500 }}>
                    {essayPrompt.cerinta}
                  </div>
                  {essayPrompt.indicatii?.length > 0 && (
                    <div style={{ background: "#F8F6F2", borderRadius: 8, padding: "10px 12px", marginBottom: 4 }}>
                      <div style={{ fontSize: 11, color: "#888", fontWeight: 700, marginBottom: 6 }}>Indicații:</div>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#555", lineHeight: 1.6 }}>
                        {essayPrompt.indicatii.map((ind, i) => <li key={i}>{ind}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Compunerea elevului */}
                <div style={S.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1A1A1A" }}>✏️ Scrie aici compunerea ta</div>
                    <div style={{
                      fontSize: 12, fontWeight: 700,
                      color: essayInRange ? "#2E7D32" : essayWordCount === 0 ? "#999" : "#C62828",
                      fontFamily: "'Inter',sans-serif",
                    }}>
                      {essayWordCount} / {essayPrompt.lungimeMin}-{essayPrompt.lungimeMax} cuvinte
                      {essayInRange && " ✓"}
                    </div>
                  </div>
                  <textarea
                    value={essayText}
                    onChange={e => updateEssayText(e.target.value)}
                    placeholder={`Începe să scrii aici... (minim ${essayPrompt.lungimeMin}, maxim ${essayPrompt.lungimeMax} cuvinte)`}
                    disabled={!!essayResult}
                    style={{
                      width: "100%", minHeight: 220, padding: 12, fontSize: 14, lineHeight: 1.7,
                      border: `1px solid ${essayInRange ? "#A5D6A7" : "#E0DBD0"}`,
                      borderRadius: 8, fontFamily: "Georgia, serif", resize: "vertical",
                      background: essayResult ? "#F8F6F2" : "#fff", color: "#1A1A1A", outline: "none",
                    }}
                  />
                  {!essayResult && (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button
                        style={{ ...S.btnY, marginTop: 0, opacity: (essayInRange && !evaluatingEssay) ? 1 : 0.5 }}
                        onClick={submitEssay}
                        disabled={!essayInRange || evaluatingEssay}
                      >
                        {evaluatingEssay ? "⏳ Aplicația evaluează..." : "✅ Trimite spre evaluare"}
                      </button>
                      <button style={S.btnGray} onClick={resetEssay}>🔄 Alt subiect</button>
                    </div>
                  )}
                  {!essayInRange && essayWordCount > 0 && !essayResult && (
                    <div style={{ fontSize: 11, color: "#C62828", marginTop: 8, fontStyle: "italic" }}>
                      {essayWordCount < essayPrompt.lungimeMin
                        ? `Mai ai nevoie de cel puțin ${essayPrompt.lungimeMin - essayWordCount} cuvinte.`
                        : `Ai depășit limita cu ${essayWordCount - essayPrompt.lungimeMax} cuvinte. Restrânge textul.`}
                    </div>
                  )}
                  {essayError && <div style={{ ...S.errorBox, marginTop: 12 }}>❌ {essayError}</div>}
                </div>

                {/* Rezultat */}
                {essayResult && (
                  <>
                    {/* Score banner */}
                    <div style={{ ...S.resultBanner, background: essayResult.score >= 8 ? "#E8F5E9" : essayResult.score >= 5 ? "#FFF8E7" : "#FFF0EE", borderColor: essayResult.score >= 8 ? "#A5D6A7" : essayResult.score >= 5 ? "#F0D98A" : "#FFCDD2" }}>
                      <div style={{ fontSize: 32, marginBottom: 6 }}>{essayResult.score >= 8 ? "🎉" : essayResult.score >= 5 ? "📈" : "💪"}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: essayResult.score >= 8 ? "#2E7D32" : essayResult.score >= 5 ? "#7A5C00" : "#C62828", fontFamily: "'Syne',sans-serif" }}>
                        {essayResult.score}/10
                      </div>
                      <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                        {essayResult.totalP}/{essayResult.maxP} puncte · {essayResult.wordCount} cuvinte
                      </div>
                    </div>

                    {/* Defalcare per criteriu */}
                    <div style={S.card}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1A1A1A", marginBottom: 12 }}>📊 Defalcare pe criterii (barem EN VIII)</div>
                      {essayResult.criterii.map((c, i) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#1A1A1A", textTransform: "capitalize" }}>{c.nume}</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: c.punctaj === c.maxim ? "#2E7D32" : c.punctaj >= c.maxim * 0.6 ? "#C8A84B" : "#C62828" }}>
                              {c.punctaj}/{c.maxim}p
                            </div>
                          </div>
                          <div style={{ height: 6, background: "#F0EDE6", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                            <div style={{ height: "100%", width: `${(c.punctaj / c.maxim) * 100}%`, background: c.punctaj === c.maxim ? "#2E7D32" : c.punctaj >= c.maxim * 0.6 ? "#C8A84B" : "#E8654A", borderRadius: 3 }} />
                          </div>
                          {c.comentariu && <div style={{ fontSize: 11, color: "#666", lineHeight: 1.5, fontStyle: "italic" }}>{c.comentariu}</div>}
                        </div>
                      ))}
                    </div>

                    {/* Puncte forte */}
                    {essayResult.puncteforte?.length > 0 && (
                      <div style={S.card}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#2E7D32", marginBottom: 8 }}>✨ Puncte forte</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#444", lineHeight: 1.7 }}>
                          {essayResult.puncteforte.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* De îmbunătățit */}
                    {essayResult.deImbunatatit?.length > 0 && (
                      <div style={S.card}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#C8A84B", marginBottom: 8 }}>🎯 De îmbunătățit</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "#444", lineHeight: 1.7 }}>
                          {essayResult.deImbunatatit.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Rescrieri sugerate */}
                    {essayResult.rescrieri?.length > 0 && (
                      <div style={S.card}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#1A1A1A", marginBottom: 10 }}>✏️ Sugestii de rescriere</div>
                        {essayResult.rescrieri.map((r, i) => (
                          <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < essayResult.rescrieri.length - 1 ? "1px solid #F0EDE6" : "none" }}>
                            <div style={{ fontSize: 11, color: "#C62828", marginBottom: 4, fontWeight: 600 }}>Original:</div>
                            <div style={{ fontSize: 12, color: "#666", fontStyle: "italic", marginBottom: 8, padding: "6px 10px", background: "#FFF0EE", borderRadius: 6, borderLeft: "3px solid #FFCDD2" }}>"{r.original}"</div>
                            <div style={{ fontSize: 11, color: "#2E7D32", marginBottom: 4, fontWeight: 600 }}>Sugestie:</div>
                            <div style={{ fontSize: 12, color: "#1A1A1A", padding: "6px 10px", background: "#E8F5E9", borderRadius: 6, borderLeft: "3px solid #A5D6A7", lineHeight: 1.5 }}>"{r.sugestie}"</div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button style={{ ...S.btnY, marginTop: 16 }} onClick={resetEssay}>
                      📝 Încearcă altă compunere
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* PROBLEME (Mate only) */}
        {tab === "math" && subject === "matematica" && (
          <div>
            {!mathProblems ? (
              <div style={S.card}>
                <div style={S.cardTitle}>🧮 Probleme rezolvate pas-cu-pas</div>
                <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, margin: "0 0 14px" }}>
                  La EN VIII Matematică, ce contează e să <strong>arăți pașii</strong>, nu doar răspunsul.
                  La Subiectul III primești puncte parțiale chiar dacă răspunsul final e greșit.
                </p>
                <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6, margin: "0 0 14px" }}>
                  Aici Aplicația îți generează 3 probleme pe tema <strong>"{chapter.title}"</strong> —
                  una ușoară, una medie, una grea — cu rezolvare pas-cu-pas. Poți încerca singur și
                  primi feedback, sau să vezi direct rezolvarea.
                </p>
                <button style={S.btnY} onClick={loadMathProblems} disabled={loadingProblems}>
                  {loadingProblems ? "⏳ Generează probleme..." : "🧮 Generează 3 probleme model"}
                </button>
                {problemsError && <div style={{ ...S.errorBox, marginTop: 12 }}>❌ {problemsError}</div>}
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "#888", fontFamily: "'Inter',sans-serif" }}>
                    {mathProblems.problems.length} probleme generate
                  </div>
                  <button style={S.btnGray} onClick={resetMathProblems}>🔄 Probleme noi</button>
                </div>

                {mathProblems.problems.map((p, idx) => {
                  const revealed = !!revealedSolutions[p.id];
                  const studentSol = studentSolutions[p.id] || "";
                  const verdict = solutionVerdicts[p.id];
                  const evaluating = evalProblemId === p.id;
                  const diffColor = p.dificultate === "ușor" ? "#2E7D32" : p.dificultate === "mediu" ? "#C8A84B" : "#C62828";
                  const diffBg    = p.dificultate === "ușor" ? "#E8F5E9" : p.dificultate === "mediu" ? "#FFF8E7" : "#FFF0EE";
                  return (
                    <div key={p.id} style={{ ...S.card, borderLeft: `4px solid ${diffColor}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontWeight: 800, fontSize: 12, color: "#1A1A1A", fontFamily: "'Syne',sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Problema {idx + 1}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 12, background: diffBg, color: diffColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          {p.dificultate}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, color: "#1A1A1A", lineHeight: 1.7, marginBottom: 14, whiteSpace: "pre-wrap" }}>
                        {p.enunt}
                      </div>

                      {/* Try-yourself area */}
                      {!revealed && !verdict && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: "#666", fontWeight: 700, marginBottom: 6 }}>🤔 Încearcă singur:</div>
                          <textarea
                            value={studentSol}
                            onChange={e => updateStudentSolution(p.id, e.target.value)}
                            placeholder="Scrie aici rezolvarea ta, pas cu pas..."
                            style={{ width: "100%", minHeight: 100, padding: 10, fontSize: 13, lineHeight: 1.6, border: "1px solid #E0DBD0", borderRadius: 8, fontFamily: "'Inter',sans-serif", resize: "vertical", background: "#fff", color: "#1A1A1A", outline: "none" }}
                          />
                          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                            <button
                              style={{ ...S.btnY, marginTop: 0, flex: "1 1 auto", opacity: (studentSol.trim() && !evaluating) ? 1 : 0.5 }}
                              onClick={() => checkMathSolution(p)}
                              disabled={!studentSol.trim() || evaluating}
                            >
                              {evaluating ? "⏳ Verifică..." : "✅ Verifică rezolvarea"}
                            </button>
                            <button style={S.btnGray} onClick={() => toggleSolution(p.id)}>
                              👁️ Arată rezolvarea
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Verdict */}
                      {verdict && (
                        <div style={{
                          background: verdict.verdict === "corect" ? "#E8F5E9" : verdict.verdict === "partial" ? "#FFF8E7" : "#FFF0EE",
                          border: `1px solid ${verdict.verdict === "corect" ? "#A5D6A7" : verdict.verdict === "partial" ? "#F0D98A" : "#FFCDD2"}`,
                          borderRadius: 10, padding: 12, marginBottom: 12,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: verdict.verdict === "corect" ? "#2E7D32" : verdict.verdict === "partial" ? "#7A5C00" : "#C62828", fontFamily: "'Syne',sans-serif", textTransform: "uppercase" }}>
                              {verdict.verdict === "corect" ? "✅ Corect" : verdict.verdict === "partial" ? "📈 Parțial" : "💪 Mai exersează"}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#666" }}>{verdict.scor}/3p</div>
                          </div>
                          {verdict.comentariu && <div style={{ fontSize: 12, color: "#444", lineHeight: 1.6, marginBottom: 8 }}>{verdict.comentariu}</div>}
                          {verdict.primulPasGresit && (
                            <div style={{ fontSize: 11, color: "#C62828", marginBottom: 8, fontStyle: "italic" }}>
                              ⚠️ Primul pas greșit: {verdict.primulPasGresit}
                            </div>
                          )}
                          {verdict.indiciu && verdict.verdict !== "corect" && (
                            <div style={{ background: "#fff", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#555", borderLeft: "3px solid #C8A84B" }}>
                              💡 <strong>Indiciu:</strong> {verdict.indiciu}
                            </div>
                          )}
                          <button
                            style={{ ...S.btnGray, marginTop: 10, width: "100%" }}
                            onClick={() => toggleSolution(p.id)}
                          >
                            {revealed ? "🙈 Ascunde rezolvarea" : "👁️ Vezi rezolvarea oficială"}
                          </button>
                        </div>
                      )}

                      {/* Solution */}
                      {revealed && (
                        <div style={{ background: "#F8F6F2", borderRadius: 10, padding: 14, marginTop: 4 }}>
                          <div style={{ fontWeight: 800, fontSize: 12, color: "#C8A84B", marginBottom: 10, fontFamily: "'Syne',sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            ✏️ Rezolvare pas-cu-pas
                          </div>
                          {p.solutie.pasi.map((pas, i) => (
                            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                              <div style={{ background: "#C8A84B", color: "#fff", borderRadius: "50%", minWidth: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                                {i + 1}
                              </div>
                              <div style={{ fontSize: 13, color: "#1A1A1A", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{pas}</div>
                            </div>
                          ))}
                          {p.solutie.raspunsFinal && (
                            <div style={{ marginTop: 12, padding: "10px 12px", background: "#E8F5E9", border: "1px solid #A5D6A7", borderRadius: 8, fontSize: 13, color: "#2E7D32", fontWeight: 700 }}>
                              <span style={{ fontFamily: "'Syne',sans-serif", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>Răspuns final</span>
                              {p.solutie.raspunsFinal}
                            </div>
                          )}
                          {p.solutie.intuitie && (
                            <div style={{ marginTop: 10, padding: "8px 12px", background: "#FFF8E7", border: "1px solid #F0D98A", borderRadius: 8, fontSize: 12, color: "#7A5C00", lineHeight: 1.6, fontStyle: "italic" }}>
                              💡 {p.solutie.intuitie}
                            </div>
                          )}
                          {!verdict && (
                            <button style={{ ...S.btnGray, marginTop: 12, width: "100%" }} onClick={() => toggleSolution(p.id)}>
                              🙈 Ascunde rezolvarea
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

      </div>
      <style>{CSS}</style>
      {upgradeModal && (
        <UpgradeModal
          limitType={upgradeModal}
          token={localStorage.getItem("en2026_token")}
          onClose={() => setUpgradeModal(null)}
        />
      )}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────
function Step({ done, label, n, gold }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 20,
      whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif",
      background: done ? (gold ? "#C8A84B" : "#E8F5E9") : "#F0EDE6",
      color:      done ? (gold ? "#fff"     : "#2E7D32") : "#999",
      border:     `1px solid ${done ? (gold ? "#C8A84B" : "#A5D6A7") : "#D5D0C8"}`,
    }}>{done ? "✓" : n} {label}</div>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderMd(text) {
  return text
    .replace(/^# (.+)$/gm,  '<h1 style="color:#1A1A1A;font-size:17px;margin:20px 0 10px;font-family:Syne,sans-serif;font-weight:800;border-bottom:2px solid #E0DBD0;padding-bottom:6px;">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 style="color:#C8A84B;font-size:15px;margin:18px 0 8px;font-family:Syne,sans-serif;font-weight:800;">$1</h2>')
    .replace(/^### (.+)$/gm,'<h3 style="color:#1A5276;font-size:14px;margin:14px 0 6px;font-family:Syne,sans-serif;font-weight:700;">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g,'<strong style="color:#1A1A1A;font-weight:700;">$1</strong>')
    .replace(/^- (.+)$/gm,  '<li style="color:#333;font-size:13px;margin:5px 0;margin-left:20px;line-height:1.6;">$1</li>')
    .replace(/\n/g, '<br/>');
}

// ── Animated loading ──────────────────────────────────────────────────────────
const CONTENT_MESSAGES = [
  "Aplicația citește programa de clasa a VIII-a...",
  "Se pregătesc explicații pentru tine...",
  "Se caută cele mai bune exemple...",
  "Se construiesc exercițiile rezolvate...",
  "Aproape gata! Se finisează lecția...",
];
const QUIZ_MESSAGES = [
  "Aplicația inventează întrebări dificile... 😈",
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
        <div style={{ fontSize: 14, color: "#333", fontWeight: 500, fontFamily: "'Inter',sans-serif" }}>{messages[idx]}</div>
        {subtitle && <div style={{ fontSize: 11, color: "#AAA", marginTop: 6, fontFamily: "'Inter',sans-serif" }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  shell:       { background: "#F0EDE6", minHeight: "100vh", fontFamily: "'Inter',sans-serif", color: "#1A1A1A", display: "flex", flexDirection: "column" },
  topBar:      { background: "#fff", borderBottom: "2px solid #E0DBD0", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 6px rgba(0,0,0,.04)" },
  backBtn:     { background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 14, fontFamily: "'Inter',sans-serif", padding: "4px 8px" },
  chapInfo:    { display: "flex", alignItems: "center", gap: 8, flex: 1 },
  chapName:    { fontSize: 15, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },
  unlockedBadge: { background: "#E8F5E9", color: "#2E7D32", fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, border: "1px solid #A5D6A7", fontFamily: "'Inter',sans-serif" },
  unlockBar:   { background: "#fff", borderBottom: "2px solid #E0DBD0", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 0 },
  unlockLine:  { flex: 1, maxWidth: 40, height: 1, background: "#D5D0C8", margin: "0 4px" },
  tabNav:      { display: "flex", background: "#fff", borderBottom: "2px solid #E0DBD0" },
  tabBtn:      { flex: 1, background: "none", border: "none", borderBottom: "3px solid transparent", color: "#999", padding: "12px 4px 13px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontFamily: "'Inter',sans-serif", fontSize: 22, transition: "color .15s" },
  tabBtnOn:    { color: "#1A1A1A", borderBottom: "2px solid #F1C40F" },
  body:        { flex: 1, padding: "16px 14px 80px", maxWidth: 640, margin: "0 auto", width: "100%" },
  emptyState:  { textAlign: "center", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: "#444", fontSize: 14 },
  mdContent:   { fontSize: 13, lineHeight: 1.8, color: "#444" },
  btnY:        { background: "#F1C40F", color: "#111", border: "none", borderRadius: 8, padding: "11px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13, marginTop: 16, fontFamily: "'Inter',sans-serif", width: "100%", display: "block" },
  btnGray:     { background: "#E8E4DC", color: "#444", border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 12, fontFamily: "'Inter',sans-serif" },
  chatWrap:    { display: "flex", flexDirection: "column", height: "calc(100vh - 200px)" },
  chatMessages:{ flex: 1, overflowY: "auto", paddingBottom: 8 },
  chatWelcome: { textAlign: "center", padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
  suggestions: { display: "flex", flexDirection: "column", gap: 6, width: "100%" },
  suggBtn:     { background: "#F8F6F2", border: "1px solid #EAE6DF", color: "#888", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 12, textAlign: "left", fontFamily: "'Inter',sans-serif" },
  bubble:      { margin: "8px 0", padding: "10px 14px", borderRadius: 12, maxWidth: "88%", fontSize: 13 },
  bubbleUser:  { background: "#EEF4FF", color: "#1A1A1A", marginLeft: "auto", borderBottomRightRadius: 4 },
  bubbleAI:    { background: "#F8F6F2", color: "#444", marginRight: "auto", borderBottomLeftRadius: 4 },
  aiLabel:     { fontSize: 11, color: "#C8A84B", marginBottom: 4, fontWeight: 700, fontFamily: "'Syne',sans-serif" },
  typingDots:  { display: "flex", gap: 4, alignItems: "center" },
  chatInputRow:{ display: "flex", gap: 8, padding: "10px 0 0", borderTop: "2px solid #E0DBD0", marginTop: 8 },
  chatInputField: { flex: 1, background: "#fff", border: "1px solid #EAE6DF", color: "#1A1A1A", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontFamily: "'Inter',sans-serif", outline: "none" },
  qCard:       { background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 12, border: "1px solid #E0DBD0", boxShadow: "0 1px 4px rgba(0,0,0,.04)" },
  qNum:        { fontSize: 11, color: "#C8A84B", marginBottom: 6, fontWeight: 800, fontFamily: "'Syne',sans-serif", textTransform: "uppercase", letterSpacing: "0.5px" },
  qText:       { fontSize: 14, color: "#1A1A1A", marginBottom: 14, lineHeight: 1.65, fontWeight: 500 },
  qOptions:    { display: "flex", flexDirection: "column", gap: 6 },
  optBtn:      { borderRadius: 9, padding: "11px 14px", cursor: "pointer", fontSize: 13, textAlign: "left", fontFamily: "'Inter',sans-serif", transition: "all 0.15s", lineHeight: 1.4 },
  explanation: { marginTop: 10, fontSize: 12, color: "#555", fontStyle: "italic", borderTop: "1px solid #E0DBD0", paddingTop: 8 },
  resultBanner:{ border: "1px solid", borderRadius: 12, padding: "18px 16px", marginBottom: 16, textAlign: "center" },
  card:        { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 14 },
  cardTitle:   { fontWeight: 700, fontSize: 14, color: "#AAA", marginBottom: 10 },
  dropZone:    { background: "#F8F6F2", border: "2px dashed", borderRadius: 10, padding: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 110, marginTop: 8 },
  warningBox:  { background: "#FFF8E7", border: "1px solid #F0D98A", borderRadius: 10, padding: "11px 14px", fontSize: 13, color: "#7A5C00", marginBottom: 14 },
  unlockChecklist: { background: "#fff", borderRadius: 12, padding: 16, border: "1px solid #E0DBD0" },
  checkItem:   { display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#333", marginBottom: 10, fontWeight: 500 },
  errorBox:    { background: "#FFF0EE", border: "1px solid #FFCDD2", borderRadius: 12, padding: "14px 16px", marginBottom: 14 },
};

const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }
  * { box-sizing: border-box; }
  body { background: #F0EDE6; -webkit-tap-highlight-color: transparent; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: #D5D0C8; border-radius: 2px; }
  div[style*="typingDots"] span { width:6px;height:6px;background:#555;border-radius:50%;display:inline-block;animation:bounce 1.2s infinite; }
  div[style*="typingDots"] span:nth-child(2){animation-delay:.2s}
  div[style*="typingDots"] span:nth-child(3){animation-delay:.4s}
  @keyframes bounce{0%,80%,100%{transform:scale(0.7);opacity:.5}40%{transform:scale(1);opacity:1}}
`;
