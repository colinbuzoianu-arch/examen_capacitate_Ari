// logger.js — sends activity events to /api/log (Upstash Redis via serverless)
// Fire-and-forget: never blocks the UI, silently fails if offline

async function log(type, payload) {
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
  } catch {
    // Silent fail — logging should never break the app
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
      userMessage: userMessage.slice(0, 500), // cap at 500 chars
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
      // Store each Q&A for admin review
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
