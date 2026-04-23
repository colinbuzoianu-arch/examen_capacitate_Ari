// All AI calls go through /api/claude (serverless, keeps API key secret)

export async function aiCall(messages, system = "") {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "API error");
  }
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ── Generate chapter explanation ─────────────────────────────────────────────
export async function generateChapterContent(chapter) {
  const system = `Ești un tutore expert pentru elevii de clasa a VIII-a din România care se pregătesc pentru Evaluarea Națională 2026.
Răspunde ÎNTOTDEAUNA în română. Fii clar, prietenos și adaptat nivelului unui elev de 14 ani.
Folosește exemple concrete, mnemonice și exerciții scurte. Structurează răspunsul cu titluri clare.`;

  const prompt = `Creează un rezumat educațional complet pentru capitolul: "${chapter.title}".

Context capitol: ${chapter.aiContext}

Structurează astfel:
## Ce vei învăța
(2-3 propoziții despre importanța capitolului la EN)

## Concepte cheie
(explică fiecare concept principal clar și simplu, cu exemple)

## Reguli de reținut
(bullets cu regulile esențiale, formule, definiții)

## Exemplu rezolvat
(un exercițiu/problemă tip EN complet rezolvat pas cu pas)

## Greșeli frecvente
(2-3 greșeli tipice și cum să le eviți)

Fii concis dar complet. Maxim 600 cuvinte.`;

  return aiCall([{ role: "user", content: prompt }], system);
}

// ── Generate quiz ─────────────────────────────────────────────────────────────
export async function generateQuiz(chapter) {
  const system = `Ești un examinator pentru Evaluarea Națională clasa a VIII-a România.
Generează EXCLUSIV JSON valid, fără text înainte sau după. Fără markdown, fără backticks.`;

  const prompt = `Generează un quiz de 10 întrebări pentru capitolul "${chapter.title}".
Context: ${chapter.aiContext}

Returnează DOAR acest JSON (fără altceva):
{
  "questions": [
    {
      "id": 1,
      "question": "textul întrebării",
      "options": ["A) varianta1", "B) varianta2", "C) varianta3", "D) varianta4"],
      "correct": "A",
      "explanation": "De ce A este corect"
    }
  ]
}

Reguli:
- Exact 10 întrebări cu câte 4 variante (A/B/C/D)
- Dificultate graduată: 3 ușoare, 4 medii, 3 grele
- Toate întrebările în română
- Relevante pentru programa EN VIII
- "correct" este litera singură: "A", "B", "C" sau "D"`;

  const raw = await aiCall([{ role: "user", content: prompt }], system);
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    throw new Error("Quiz parse error");
  }
}

// ── Evaluate quiz answers ─────────────────────────────────────────────────────
export async function evaluateQuiz(chapter, questions, answers) {
  const system = `Ești un tutore pentru elevi de clasa a VIII-a România. Răspunde în română, prietenos și încurajator.`;

  const summary = questions.map((q, i) => ({
    întrebare: q.question,
    răspunsElev: answers[i] || "Fără răspuns",
    răspunsCorect: q.correct,
    corect: answers[i] === q.correct,
    explicație: q.explanation,
  }));

  const score = summary.filter(s => s.corect).length;

  const prompt = `Ari a terminat quiz-ul la capitolul "${chapter.title}". Scor: ${score}/10.

Răspunsurile lui:
${JSON.stringify(summary, null, 2)}

Scrie un feedback personalizat de 3-4 propoziții:
1. Felicită-l dacă a trecut (${score >= 8 ? "DA, a trecut" : "NU, nu a trecut"})
2. Menționează 1-2 greșeli specifice pe care să le revadă
3. Încurajare pentru continuare
4. Dacă nu a trecut, spune-i ce capitol să revadă

Fii cald, direct și motivant. Maxim 80 cuvinte.`;

  const feedback = await aiCall([{ role: "user", content: prompt }], system);
  return { score, passed: score >= 8, feedback };
}

// ── Chapter chat ──────────────────────────────────────────────────────────────
export async function chatWithTutor(chapter, history, userMessage) {
  const system = `Ești tutorele personal al lui Ari, elev în clasa a VIII-a la Școala Babel Timișoara.
Îl ajuți să se pregătească pentru Evaluarea Națională 2026.
Capitolul curent: "${chapter.title}".
Context: ${chapter.aiContext}

Reguli:
- Răspunde ÎNTOTDEAUNA în română
- Fii prietenos, clar, adaptat nivelului de clasa a VIII-a
- Dacă întreabă ceva în afara capitolului, redirecționează-l blând
- Dă exemple concrete și practice
- Maxim 150 cuvinte per răspuns`;

  const messages = [
    ...history,
    { role: "user", content: userMessage },
  ];

  return aiCall(messages, system);
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
