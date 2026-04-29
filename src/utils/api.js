// All AI calls go through /api/claude (serverless, keeps API key secret)

// ── Auth token helper ─────────────────────────────────────────────────────────
function getAuthToken() {
  return localStorage.getItem("en2026_token") || "";
}

// ── Core call ────────────────────────────────────────────────────────────────
async function aiCallOnce(messages, system = "", max_tokens = 2000, fast = false, interactionType = "chat") {
  const token = getAuthToken();
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages, system, max_tokens, fast, interactionType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 429 && err.error === "limit_reached") {
      throw new Error(`LIMIT_REACHED:${err.message}`);
    }
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  if (!text) throw new Error("Empty response from AI");
  return text;
}

// Fast call — uses Haiku model, much faster for structured tasks like quiz
export async function aiCallFast(messages, system = "", max_tokens = 1800, interactionType = "quiz") {
  return aiCallOnce(messages, system, max_tokens, true, interactionType);
}

// Retry wrapper — tries up to `attempts` times with exponential backoff
export async function aiCall(messages, system = "", max_tokens = 2000, attempts = 3, interactionType = "chat") {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await aiCallOnce(messages, system, max_tokens, false, interactionType);
    } catch (err) {
      lastError = err;
      if (err.message?.startsWith("LIMIT_REACHED:")) throw err;
      console.warn(`aiCall attempt ${i + 1} failed:`, err.message);
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

// ── Robust JSON extractor ─────────────────────────────────────────────────────
function extractJSON(raw) {
  if (!raw) throw new Error("Empty response");
  let clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(clean); } catch {}
  const start = clean.indexOf("{");
  const end   = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch {}
  }
  const aStart = clean.indexOf("[");
  const aEnd   = clean.lastIndexOf("]");
  if (aStart !== -1 && aEnd !== -1 && aEnd > aStart) {
    try { return JSON.parse(clean.slice(aStart, aEnd + 1)); } catch {}
  }
  throw new Error("Could not extract valid JSON from response");
}

// ── Generate chapter explanation ──────────────────────────────────────────────
export async function generateChapterContent(chapter) {
  const system = `Ești un tutore expert pentru elevii de clasa a VIII-a din România care se pregătesc pentru Evaluarea Națională 2026.\nRăspunde ÎNTOTDEAUNA în română. Fii clar, prietenos și adaptat nivelului unui elev de 14 ani.\nFolosește exemple concrete, mnemonice și exerciții scurte. Structurează răspunsul cu titluri clare.`;

  const prompt = `Creează un rezumat educațional complet pentru capitolul: "${chapter.title}".\n\nContext capitol: ${chapter.aiContext}\n\nStructurează astfel:\n## Ce vei învăța\n(2-3 propoziții despre importanța capitolului la EN)\n\n## Concepte cheie\n(explică fiecare concept principal clar și simplu, cu exemple)\n\n## Reguli de reținut\n(bullets cu regulile esențiale, formule, definiții)\n\n## Exemplu rezolvat\n(un exercițiu/problemă tip EN complet rezolvat pas cu pas)\n\n## Greșeli frecvente\n(2-3 greșeli tipice și cum să le eviți)\n\nFii concis dar complet. Maxim 600 cuvinte.`;

  return aiCall([{ role: "user", content: prompt }], system, 2000, 3, "lesson");
}

// ── Generate quiz ─────────────────────────────────────────────────────────────
export async function generateQuiz(chapter) {
  const system = `EN VIII examinator. Răspunde DOAR cu JSON valid, fără text extra.`;

  const prompt = `Quiz 10 întrebări pentru "${chapter.title}" (EN VIII România).\nTeme: ${chapter.topics ? chapter.topics.join(", ") : chapter.aiContext.slice(0, 200)}\n\nJSON STRICT (nimic altceva):\n{"questions":[{"id":1,"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"correct":"A","explanation":"..."}]}\n\nReguli: 10 întrebări, română, correct=litera singură A/B/C/D, explicație scurtă max 15 cuvinte.`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await aiCallFast([{ role: "user", content: prompt }], system, 1800, "quiz");
      const parsed = extractJSON(raw);

      if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length < 5) {
        throw new Error("Structură invalidă");
      }

      parsed.questions = parsed.questions.slice(0, 10).map((q, i) => ({
        id: i + 1,
        question: q.question || `Întrebarea ${i + 1}`,
        options: Array.isArray(q.options) && q.options.length === 4
          ? q.options : ["A) -", "B) -", "C) -", "D) -"],
        correct: ["A","B","C","D"].includes(q.correct) ? q.correct : "A",
        explanation: q.explanation || "",
      }));

      return parsed;
    } catch (err) {
      if (err.message?.startsWith("LIMIT_REACHED:")) throw err;
      console.warn(`Quiz attempt ${attempt}/2:`, err.message);
      if (attempt === 2) throw new Error("Nu s-a putut genera quiz-ul. Încearcă din nou.");
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ── Evaluate quiz answers ─────────────────────────────────────────────────────
export async function evaluateQuiz(chapter, questions, answers, userName = "tu") {
  const system = `Ești un tutore pentru elevi de clasa a VIII-a România. Răspunde în română, prietenos și încurajator.`;

  const summary = questions.map((q, i) => ({
    întrebare: q.question,
    răspunsElev: answers[i] || "Fără răspuns",
    răspunsCorect: q.correct,
    corect: answers[i] === q.correct,
    explicație: q.explanation,
  }));

  const score = summary.filter(s => s.corect).length;

  const prompt = `${userName} a terminat quiz-ul la capitolul "${chapter.title}". Scor: ${score}/10.\n\nRăspunsurile lui:\n${JSON.stringify(summary, null, 2)}\n\nScrie un feedback personalizat de 3-4 propoziții:\n1. Felicită-l/felicit-o dacă a trecut (${score >= 8 ? "DA, a trecut" : "NU, nu a trecut"})\n2. Menționează 1-2 greșeli specifice pe care să le revadă\n3. Încurajare pentru continuare\n4. Dacă nu a trecut, spune-i ce capitol să revadă\n\nFii cald, direct și motivant. Maxim 80 cuvinte.`;

  const feedback = await aiCall([{ role: "user", content: prompt }], system, 500, 3, "chat");
  return { score, passed: score >= 8, feedback };
}

// ── Chapter chat ──────────────────────────────────────────────────────────────
export async function chatWithTutor(chapter, history, userMessage, userName = "elev") {
  const system = `Ești tutorele unui elev de clasa a VIII-a care se pregătește pentru Evaluarea Națională 2026.\nNume elev: ${userName}.\nÎl ajuți să se pregătească pentru Evaluarea Națională 2026.\nCapitolul curent: "${chapter.title}".\nContext: ${chapter.aiContext}\n\nReguli:\n- Răspunde ÎNTOTDEAUNA în română\n- Fii prietenos, clar, adaptat nivelului de clasa a VIII-a\n- Dacă întreabă ceva în afara capitolului, redirecționează-l blând\n- Dă exemple concrete și practice\n- Maxim 150 cuvinte per răspuns`;

  const messages = [
    ...history,
    { role: "user", content: userMessage },
  ];

  return aiCall(messages, system, 600, 3, "chat");
}

// ── Email send ────────────────────────────────────────────────────────────────
export async function sendEmail({ to, subject, html }) {
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html }),
    });
    const data = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: data.error };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
