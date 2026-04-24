// logger.js — sends activity events to /api/log (Upstash Redis via serverless)
// Logs errors to console so we can debug in browser DevTools

async function log(type, payload) {
  try {
    const res = await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn(`[logger] ${type} failed ${res.status}:`, data.error || data);
    }
  } catch (err) {
    console.warn(`[logger] ${type} network error:`, err.message);
  }
}

export const logger = {
  chapterOpened: (chapter, subject) =>
    log("chapter_opened", {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      subject,
    }),

  contentGenerated: (chapter, subject) =>
    log("content_generated", {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      subject,
    }),

  chatMessage: (chapter, subject, userMessage, aiReply) =>
    log("chat_message", {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      subject,
      userMessage: userMessage.slice(0, 500),
      aiReply: aiReply.slice(0, 500),
    }),

  quizStarted: (chapter, subject) =>
    log("quiz_started", {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      subject,
    }),

  quizSubmitted: (chapter, subject, score, passed, answers, questions, attemptNumber) =>
    log("quiz_submitted", {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      subject,
      score,
      passed,
      attempts: attemptNumber,
      answers: questions.map((q, i) => ({
        question: q.question,
        correct: q.correct,
        given: answers[i] || null,
        isCorrect: answers[i] === q.correct,
        explanation: q.explanation,
      })),
    }),

  screenshotUploaded: (chapter, subject) =>
    log("screenshot_uploaded", {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      subject,
    }),

  chapterUnlocked: (chapter, subject) =>
    log("chapter_unlocked", {
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      subject,
    }),
};
