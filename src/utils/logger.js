// logger.js — activity logger (silent no-op if endpoint unavailable)

let _userName = "";
let _userId   = "";

export function setLoggerUser(name, userId) {
  _userName = name || "";
  _userId   = userId || "";
}

async function log(type, payload) {
  // Fire and forget — never block UI, never throw errors
  try {
    const token = localStorage.getItem("en2026_token") || "";
    fetch("/api/admin-users?mode=log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        type,
        payload: { ...payload, userName: _userName, userId: _userId },
      }),
    }).catch(() => {}); // silently ignore any errors
  } catch {}
}

export const logger = {
  chapterOpened:     (chapter, subject) => log("chapter_opened",     { chapterId: chapter.id, chapterTitle: chapter.title, subject }),
  contentGenerated:  (chapter, subject) => log("content_generated",  { chapterId: chapter.id, chapterTitle: chapter.title, subject }),
  chatMessage:       (chapter, subject, userMessage, aiReply) => log("chat_message", { chapterId: chapter.id, chapterTitle: chapter.title, subject, userMessage: userMessage.slice(0, 500), aiReply: aiReply.slice(0, 500) }),
  quizStarted:       (chapter, subject) => log("quiz_started",       { chapterId: chapter.id, chapterTitle: chapter.title, subject }),
  quizSubmitted:     (chapter, subject, score, passed, answers, questions, attemptNumber) => log("quiz_submitted", {
    chapterId: chapter.id, chapterTitle: chapter.title, subject, score, passed, attempts: attemptNumber,
    answers: questions.map((q, i) => ({ question: q.question, correct: q.correct, given: answers[i] || null, isCorrect: answers[i] === q.correct, explanation: q.explanation })),
  }),
  screenshotUploaded: (chapter, subject) => log("screenshot_uploaded", { chapterId: chapter.id, chapterTitle: chapter.title, subject }),
  chapterUnlocked:    (chapter, subject) => log("chapter_unlocked",    { chapterId: chapter.id, chapterTitle: chapter.title, subject }),
};
