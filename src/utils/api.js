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

// ── ROMÂNĂ: Generate essay prompt (EN VIII Subiectul II style) ────────────────
// Returns: { tip, tema, cerinta, criterii: [{nume, punctaj}], lungimeMin, lungimeMax }
export async function generateEssayPrompt(chapter) {
  const system = `EN VIII examinator pentru Limba și literatura română. Răspunde DOAR cu JSON valid, fără text extra.`;

  const prompt = `Generează o cerință de redactare pentru Subiectul II al EN VIII pe tema capitolului "${chapter.title}".
Context: ${chapter.aiContext}

Lungimea TREBUIE să fie strict 150-300 cuvinte (regula EN VIII Subiectul II).
Tipul textului trebuie să se potrivească cu capitolul:
- "narativ" pentru capitole de text narativ literar
- "descriptiv" pentru text descriptiv/liric
- "argumentativ" pentru text argumentativ
- pentru morfologie/sintaxă/fonetică/vocabular alege "argumentativ" cu temă potrivită
- pentru redactare alege orice tip e mai relevant

JSON STRICT (nimic altceva):
{
  "tip": "narativ|descriptiv|argumentativ",
  "tema": "Tema scurtă a compunerii (5-10 cuvinte)",
  "cerinta": "Cerința completă, în 1-2 fraze, exact cum apare la EN VIII (ex: 'Redactează un text de minimum 150 de cuvinte și maximum 300 de cuvinte în care să...').",
  "lungimeMin": 150,
  "lungimeMax": 300,
  "indicatii": ["3-4 indicații concrete despre ce trebuie să conțină textul"]
}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await aiCallFast([{ role: "user", content: prompt }], system, 800, "chat");
      const parsed = extractJSON(raw);
      if (!parsed.cerinta || !parsed.tip) throw new Error("Structură invalidă");
      return {
        tip: parsed.tip,
        tema: parsed.tema || "",
        cerinta: parsed.cerinta,
        lungimeMin: parsed.lungimeMin || 150,
        lungimeMax: parsed.lungimeMax || 300,
        indicatii: Array.isArray(parsed.indicatii) ? parsed.indicatii.slice(0, 5) : [],
      };
    } catch (err) {
      if (err.message?.startsWith("LIMIT_REACHED:")) throw err;
      if (attempt === 2) throw new Error("Nu s-a putut genera cerința. Încearcă din nou.");
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ── ROMÂNĂ: Evaluate student essay against EN VIII rubric ─────────────────────
// Returns: { score (0-10), criterii: [{nume, punctaj, maxim, comentariu}], puncteforte: [], deImbunatatit: [], rescrieri: [{original, sugestie}] }
export async function evaluateEssay(chapter, essayPrompt, essayText, userName = "elevul") {
  const system = `Ești profesor de limba română evaluator EN VIII. Aplici baremul oficial cu rigoare, dar oferi feedback constructiv.
Răspunde DOAR cu JSON valid, fără text extra.`;

  const wordCount = essayText.trim().split(/\s+/).filter(Boolean).length;
  const lengthOk = wordCount >= essayPrompt.lungimeMin && wordCount <= essayPrompt.lungimeMax;

  const prompt = `Evaluează compunerea de mai jos după baremul EN VIII Subiectul II (16 puncte total, mapat apoi la nota /10).

CERINȚA dată elevului:
"${essayPrompt.cerinta}"
Tip: ${essayPrompt.tip}
Lungime cerută: ${essayPrompt.lungimeMin}-${essayPrompt.lungimeMax} cuvinte
Lungime efectivă: ${wordCount} cuvinte ${lengthOk ? "(în limită ✓)" : "(ÎN AFARA LIMITEI — penalizează la criteriul lizibilitate/redactare)"}

TEXTUL ELEVULUI:
"""
${essayText}
"""

BAREM EN VIII (puncte maxime per criteriu):
1. "continut" (4p): respectă cerința, idei clare, dezvoltare adecvată tipului de text
2. "structura" (3p): introducere/cuprins/concluzie, coerență, paragrafe
3. "stil" (3p): registru adecvat, vocabular variat, figuri de stil dacă tipul cere
4. "ortografie" (3p): scădere -0.5p per greșeală gravă, max -3p
5. "redactare" (3p): lizibilitate, lungime în limită, punctuație, aranjarea în pagină

JSON STRICT (nimic altceva):
{
  "criterii": [
    {"nume": "continut", "punctaj": 0-4, "maxim": 4, "comentariu": "1-2 propoziții specifice"},
    {"nume": "structura", "punctaj": 0-3, "maxim": 3, "comentariu": "..."},
    {"nume": "stil", "punctaj": 0-3, "maxim": 3, "comentariu": "..."},
    {"nume": "ortografie", "punctaj": 0-3, "maxim": 3, "comentariu": "..."},
    {"nume": "redactare", "punctaj": 0-3, "maxim": 3, "comentariu": "..."}
  ],
  "puncteforte": ["2-3 lucruri pe care ${userName} le-a făcut bine"],
  "deImbunatatit": ["2-3 lucruri concrete de îmbunătățit"],
  "rescrieri": [
    {"original": "fraza din text exact cum a scris-o elevul", "sugestie": "varianta îmbunătățită"}
  ]
}

Reguli:
- Scor pe criterii suma maxim 16
- 1-3 rescrieri concrete (alege cele mai problematice fraze)
- Comentariile să fie specifice, NU generice
- Limba română corectă, cu diacritice`;

  const raw = await aiCall([{ role: "user", content: prompt }], system, 2000, 3, "chat");
  const parsed = extractJSON(raw);

  // Defensive: compute total from criteria
  const criterii = (parsed.criterii || []).map(c => ({
    nume: c.nume || "",
    punctaj: Math.max(0, Math.min(c.maxim || 4, Number(c.punctaj) || 0)),
    maxim: c.maxim || 4,
    comentariu: c.comentariu || "",
  }));
  const totalP = criterii.reduce((s, c) => s + c.punctaj, 0);
  const score = Math.round((totalP / 16) * 10 * 10) / 10; // /10 cu o zecimală

  return {
    score,
    totalP,
    maxP: 16,
    wordCount,
    lengthOk,
    criterii,
    puncteforte: Array.isArray(parsed.puncteforte) ? parsed.puncteforte.slice(0, 5) : [],
    deImbunatatit: Array.isArray(parsed.deImbunatatit) ? parsed.deImbunatatit.slice(0, 5) : [],
    rescrieri: Array.isArray(parsed.rescrieri) ? parsed.rescrieri.slice(0, 3) : [],
  };
}

// ── MATE: Generate 3 model problems with stepped solutions ────────────────────
// Returns: { problems: [{id, dificultate, enunt, solutie: {pasi: [], raspunsFinal, intuitie}}] }
export async function generateMathProblems(chapter) {
  const system = `Ești profesor de matematică, autor de probleme pentru EN VIII. Răspunde DOAR cu JSON valid, fără text extra.`;

  const prompt = `Generează 3 probleme model pentru capitolul "${chapter.title}" la EN VIII.
Context: ${chapter.aiContext}

Una ușoară (Subiectul I), una medie (Subiectul II), una grea (Subiectul III).
Fiecare cu rezolvare completă în pași justificați.

JSON STRICT (nimic altceva):
{
  "problems": [
    {
      "id": 1,
      "dificultate": "ușor",
      "enunt": "Enunțul complet, cu date numerice concrete",
      "solutie": {
        "pasi": [
          "Pasul 1: ce facem și de ce",
          "Pasul 2: ...",
          "Pasul 3: ..."
        ],
        "raspunsFinal": "Rezultatul final, scris clar",
        "intuitie": "1-2 propoziții despre cum să gândești problema"
      }
    },
    {"id": 2, "dificultate": "mediu", ...},
    {"id": 3, "dificultate": "greu", ...}
  ]
}

Reguli:
- Probleme realistice tip EN VIII
- Pașii să fie clari, fiecare cu o singură idee
- Notație matematică în text simplu (ex: x^2, sqrt(2), nu LaTeX)
- Răspuns final identificabil clar
- 3-7 pași per problemă`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await aiCall([{ role: "user", content: prompt }], system, 2500, 2, "lesson");
      const parsed = extractJSON(raw);
      if (!parsed.problems || !Array.isArray(parsed.problems) || parsed.problems.length < 1) {
        throw new Error("Structură invalidă");
      }
      return {
        problems: parsed.problems.slice(0, 3).map((p, i) => ({
          id: i + 1,
          dificultate: p.dificultate || (i === 0 ? "ușor" : i === 1 ? "mediu" : "greu"),
          enunt: p.enunt || "",
          solutie: {
            pasi: Array.isArray(p.solutie?.pasi) ? p.solutie.pasi : [],
            raspunsFinal: p.solutie?.raspunsFinal || "",
            intuitie: p.solutie?.intuitie || "",
          },
        })),
      };
    } catch (err) {
      if (err.message?.startsWith("LIMIT_REACHED:")) throw err;
      if (attempt === 2) throw new Error("Nu s-au putut genera problemele. Încearcă din nou.");
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ── MATE: Evaluate student's solution attempt ─────────────────────────────────
// Returns: { verdict: "corect"|"partial"|"gresit", scor (0-3), comentariu, indiciu, primulPasGresit }
export async function evaluateMathSolution(problem, studentSolution, userName = "elevul") {
  const system = `Ești profesor de matematică EN VIII. Evaluezi rezolvări scrise de elevi cu rigoare și empatie.
Acorzi punctaj parțial pentru pași corecți chiar dacă răspunsul final e greșit (cum se face la EN VIII).
Răspunde DOAR cu JSON valid, fără text extra.`;

  const prompt = `Evaluează rezolvarea elevului ${userName} pentru problema de mai jos.

PROBLEMĂ:
${problem.enunt}

REZOLVARE OFICIALĂ (referință):
Pași: ${problem.solutie.pasi.join(" | ")}
Răspuns final: ${problem.solutie.raspunsFinal}

REZOLVAREA ELEVULUI:
"""
${studentSolution}
"""

JSON STRICT (nimic altceva):
{
  "verdict": "corect|partial|gresit",
  "scor": 0-3,
  "comentariu": "2-3 propoziții care explică ce a făcut bine și ce nu",
  "primulPasGresit": "dacă există, descrierea primului pas greșit; altfel ''",
  "indiciu": "un indiciu concret pentru a continua corect (NU rezolvarea completă)"
}

Reguli pentru scor:
- 3 = răspuns final corect cu pași complet justificați
- 2 = răspuns final corect dar cu unele lacune sau notație greșită; SAU pași corecți cu o singură eroare de calcul finală
- 1 = pași inițiali corecți dar abandonează sau greșește mediocru
- 0 = abordare complet greșită sau nimic relevant

Fii cald și încurajator, dar onest. Nu da rezolvarea completă în "indiciu" — doar direcția.`;

  const raw = await aiCall([{ role: "user", content: prompt }], system, 800, 3, "chat");
  const parsed = extractJSON(raw);

  return {
    verdict: ["corect", "partial", "gresit"].includes(parsed.verdict) ? parsed.verdict : "partial",
    scor: Math.max(0, Math.min(3, Number(parsed.scor) || 0)),
    comentariu: parsed.comentariu || "",
    primulPasGresit: parsed.primulPasGresit || "",
    indiciu: parsed.indiciu || "",
  };
}

// ── SIMULARE EN VIII ──────────────────────────────────────────────────────────
// Generate a full mock exam paper (Romanian or Math), structured per the
// official EN VIII format. Returns a strict JSON object the UI can render.

// Build a compact list of topics for context
function topicsFromSubject(subjectKey, chapters) {
  return chapters.map(c => `${c.title}: ${(c.topics || []).join(", ")}`).join(" | ");
}

// ── ROMÂNĂ simulare ──
// Format real EN VIII română:
//   Subiectul I (60p): text la prima vedere + 9 itemi
//     A. Înțelegerea textului (30p): 6 itemi a câte 5p (răspuns scurt)
//     B. Limba română (30p): 3 itemi a câte 10p (gramatică/vocabular)
//   Subiectul II (30p): compunere 150-300 cuvinte
//   10p din oficiu → total 100p, scalat la nota /10
export async function generateSimulareRomana(allRomanaChapters) {
  const system = `Ești autor de subiecte EN VIII pentru Limba și literatura română. Cunoști baremul oficial.\nRăspunde DOAR cu JSON valid, fără text suplimentar.`;

  const topics = topicsFromSubject("romana", allRomanaChapters);

  const prompt = `Generează un subiect complet de SIMULARE EN VIII Română, format real.\n\nTeme acoperite în clasa a VIII-a: ${topics}\n\nFormat OBLIGATORIU (cu punctaje exacte):\n- Subiectul I (60p):\n  - Text la prima vedere (literar sau nonliterar, ~250-400 cuvinte, original, NU citat din alte surse)\n  - Partea A (30p): 6 itemi cu răspuns scurt din text (a câte 5p) — înțelegere, vocabular din text, identificarea unui mijloc artistic, etc.\n  - Partea B (30p): 3 itemi (a câte 10p) — gramatică/morfologie/sintaxă cu exemple din text sau independent\n- Subiectul II (30p): compunere argumentativă/narativă/descriptivă, 150-300 cuvinte, cu cerință clară\n- Total răspunsuri: 10 itemi\n\nJSON STRICT (nimic altceva):\n{\n  "titlu": "Simulare EN VIII Română",\n  "durata": 120,\n  "punctajOficiu": 10,\n  "subiectI": {\n    "punctaj": 60,\n    "text": "Textul integral, formatat cu paragrafe (\\\\n\\\\n între paragrafe). NU pune ghilimele la început/sfârșit.",\n    "textTitlu": "Titlul textului",\n    "textAutor": "Autor fictiv sau «adaptare»",\n    "parteaA": {\n      "punctaj": 30,\n      "itemi": [\n        {"id": "I.A.1", "punctaj": 5, "cerinta": "Cerința completă a întrebării.", "tipRaspuns": "scurt"},\n        {"id": "I.A.2", "punctaj": 5, "cerinta": "...", "tipRaspuns": "scurt"},\n        {"id": "I.A.3", "punctaj": 5, "cerinta": "...", "tipRaspuns": "scurt"},\n        {"id": "I.A.4", "punctaj": 5, "cerinta": "...", "tipRaspuns": "scurt"},\n        {"id": "I.A.5", "punctaj": 5, "cerinta": "...", "tipRaspuns": "scurt"},\n        {"id": "I.A.6", "punctaj": 5, "cerinta": "...", "tipRaspuns": "scurt"}\n      ]\n    },\n    "parteaB": {\n      "punctaj": 30,\n      "itemi": [\n        {"id": "I.B.1", "punctaj": 10, "cerinta": "Cerința completă (gramatică/vocabular).", "tipRaspuns": "lung"},\n        {"id": "I.B.2", "punctaj": 10, "cerinta": "...", "tipRaspuns": "lung"},\n        {"id": "I.B.3", "punctaj": 10, "cerinta": "...", "tipRaspuns": "lung"}\n      ]\n    }\n  },\n  "subiectII": {\n    "punctaj": 30,\n    "tip": "argumentativ|narativ|descriptiv",\n    "cerinta": "Cerința completă, ex: 'Redactează un text de minimum 150 de cuvinte și maximum 300 de cuvinte în care...'",\n    "lungimeMin": 150,\n    "lungimeMax": 300\n  }\n}\n\nReguli:\n- Toate textele în română corectă cu diacritice\n- Cerințele să fie clare, de nivel EN VIII real\n- Itemii din parteaA să se refere la text\n- Itemii din parteaB să acopere teme de gramatică/morfologie/vocabular variate (NU toți din același capitol)\n- Compunerea să fie pe o temă apropiată tinerilor\n- NU folosi citate din opere reale (probleme de drepturi de autor)`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await aiCall([{ role: "user", content: prompt }], system, 4000, 2, "simulare");
      const parsed = extractJSON(raw);
      if (!parsed.subiectI?.text || !parsed.subiectI?.parteaA?.itemi || !parsed.subiectII?.cerinta) {
        throw new Error("Structură invalidă");
      }
      return {
        titlu: parsed.titlu || "Simulare EN VIII Română",
        materie: "romana",
        durata: parsed.durata || 120,
        punctajOficiu: parsed.punctajOficiu || 10,
        subiectI: {
          punctaj: 60,
          text: parsed.subiectI.text,
          textTitlu: parsed.subiectI.textTitlu || "",
          textAutor: parsed.subiectI.textAutor || "",
          parteaA: {
            punctaj: 30,
            itemi: (parsed.subiectI.parteaA.itemi || []).slice(0, 6).map((it, i) => ({
              id: it.id || `I.A.${i + 1}`,
              punctaj: it.punctaj || 5,
              cerinta: it.cerinta || "",
              tipRaspuns: "scurt",
            })),
          },
          parteaB: {
            punctaj: 30,
            itemi: (parsed.subiectI.parteaB?.itemi || []).slice(0, 3).map((it, i) => ({
              id: it.id || `I.B.${i + 1}`,
              punctaj: it.punctaj || 10,
              cerinta: it.cerinta || "",
              tipRaspuns: "lung",
            })),
          },
        },
        subiectII: {
          punctaj: 30,
          tip: parsed.subiectII.tip || "argumentativ",
          cerinta: parsed.subiectII.cerinta,
          lungimeMin: parsed.subiectII.lungimeMin || 150,
          lungimeMax: parsed.subiectII.lungimeMax || 300,
        },
      };
    } catch (err) {
      if (err.message?.startsWith("LIMIT_REACHED:")) throw err;
      if (attempt === 2) throw new Error("Nu s-a putut genera simularea. Încearcă din nou.");
      await new Promise(r => setTimeout(r, 1200));
    }
  }
}

// ── MATEMATICĂ simulare ──
// Format real EN VIII matematică:
//   Subiectul I (30p):  6 itemi multiple-choice (a câte 5p), litera A/B/C/D
//   Subiectul II (30p): 6 itemi multiple-choice (a câte 5p), litera A/B/C/D
//   Subiectul III (30p): 2 probleme cu rezolvare scrisă completă (15p fiecare, 2p+3p+...)
//   10p din oficiu → total 100p
export async function generateSimulareMatematica(allMathChapters) {
  const system = `Ești autor de subiecte EN VIII pentru matematică. Cunoști baremul oficial.\nRăspunde DOAR cu JSON valid, fără text extra.`;

  const topics = topicsFromSubject("matematica", allMathChapters);

  const prompt = `Generează un subiect complet de SIMULARE EN VIII Matematică, format real.\n\nTeme acoperite: ${topics}\n\nFormat OBLIGATORIU (cu punctaje exacte):\n- Subiectul I (30p): 6 itemi multiple-choice cu 4 variante A/B/C/D, a câte 5p\n- Subiectul II (30p): 6 itemi multiple-choice cu 4 variante A/B/C/D, a câte 5p\n- Subiectul III (30p): 2 probleme cu rezolvare scrisă completă, 15p fiecare, structurate cu sub-puncte (a, b, c)\n\nJSON STRICT (nimic altceva):\n{\n  "titlu": "Simulare EN VIII Matematică",\n  "durata": 120,\n  "punctajOficiu": 10,\n  "subiectI": {\n    "punctaj": 30,\n    "itemi": [\n      {"id": "I.1", "punctaj": 5, "enunt": "Enunțul complet (poate include figuri descrise în text)", "optiuni": ["A) ...", "B) ...", "C) ...", "D) ..."], "corect": "A"},\n      {"id": "I.2", "punctaj": 5, "enunt": "...", "optiuni": ["A) ...", "B) ...", "C) ...", "D) ..."], "corect": "B"},\n      ...\n    ]\n  },\n  "subiectII": {\n    "punctaj": 30,\n    "itemi": [...6 itemi multiple-choice]\n  },\n  "subiectIII": {\n    "punctaj": 30,\n    "probleme": [\n      {\n        "id": "III.1",\n        "punctaj": 15,\n        "enunt": "Enunțul complet al problemei, cu date numerice concrete",\n        "subpuncte": [\n          {"id": "a", "punctaj": 2, "cerinta": "Cerința sub-punctului a)"},\n          {"id": "b", "punctaj": 3, "cerinta": "..."},\n          {"id": "c", "punctaj": 5, "cerinta": "..."},\n          {"id": "d", "punctaj": 5, "cerinta": "..."}\n        ],\n        "rezolvareReferinta": {\n          "pasi": ["Pas 1: ...", "Pas 2: ..."],\n          "raspunsFinal": "Rezultatul final clar pentru fiecare sub-punct"\n        }\n      },\n      {"id": "III.2", "punctaj": 15, ...}\n    ]\n  }\n}\n\nReguli:\n- Probleme și itemi REALISTICI tip EN VIII\n- Itemii multiple-choice să acopere algebră, geometrie, funcții, calcul, statistică (variat)\n- Cele 2 probleme: una de algebră/funcții, una de geometrie\n- Notație matematică în text simplu (ex: x^2, sqrt(2), nu LaTeX)\n- "corect" = exact A, B, C sau D\n- Punctajul subpunctelor să sumeze 15 per problemă\n- Sub-punctele să fie 3-5 per problemă, gradat dificultate`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await aiCall([{ role: "user", content: prompt }], system, 4500, 2, "simulare");
      const parsed = extractJSON(raw);
      if (!parsed.subiectI?.itemi || !parsed.subiectII?.itemi || !parsed.subiectIII?.probleme) {
        throw new Error("Structură invalidă");
      }
      const normItems = (arr, prefix) =>
        (arr || []).slice(0, 6).map((it, i) => ({
          id: it.id || `${prefix}.${i + 1}`,
          punctaj: it.punctaj || 5,
          enunt: it.enunt || "",
          optiuni: Array.isArray(it.optiuni) && it.optiuni.length === 4 ? it.optiuni : ["A) -", "B) -", "C) -", "D) -"],
          corect: ["A", "B", "C", "D"].includes(it.corect) ? it.corect : "A",
        }));
      return {
        titlu: parsed.titlu || "Simulare EN VIII Matematică",
        materie: "matematica",
        durata: parsed.durata || 120,
        punctajOficiu: parsed.punctajOficiu || 10,
        subiectI: { punctaj: 30, itemi: normItems(parsed.subiectI.itemi, "I") },
        subiectII: { punctaj: 30, itemi: normItems(parsed.subiectII.itemi, "II") },
        subiectIII: {
          punctaj: 30,
          probleme: (parsed.subiectIII.probleme || []).slice(0, 2).map((p, i) => ({
            id: p.id || `III.${i + 1}`,
            punctaj: p.punctaj || 15,
            enunt: p.enunt || "",
            subpuncte: Array.isArray(p.subpuncte) ? p.subpuncte.map((s, j) => ({
              id: s.id || String.fromCharCode(97 + j),
              punctaj: s.punctaj || 2,
              cerinta: s.cerinta || "",
            })) : [],
            rezolvareReferinta: {
              pasi: Array.isArray(p.rezolvareReferinta?.pasi) ? p.rezolvareReferinta.pasi : [],
              raspunsFinal: p.rezolvareReferinta?.raspunsFinal || "",
            },
          })),
        },
      };
    } catch (err) {
      if (err.message?.startsWith("LIMIT_REACHED:")) throw err;
      if (attempt === 2) throw new Error("Nu s-a putut genera simularea. Încearcă din nou.");
      await new Promise(r => setTimeout(r, 1200));
    }
  }
}

// ── EVALUATE simulare română ──
// answers shape: { "I.A.1": "text răspuns", ..., "I.B.3": "text", "essay": "compunere" }
// Returns: detailed evaluation with score per subiect and total
export async function evaluateSimulareRomana(simulare, answers, userName = "elevul") {
  const system = `Ești profesor evaluator EN VIII pentru limba română. Aplici baremul oficial cu rigoare, dar oferi feedback constructiv pentru elev.\nRăspunde DOAR cu JSON valid.`;

  const essayText = answers.essay || "";
  const wordCount = essayText.trim().split(/\s+/).filter(Boolean).length;

  const itemsForEval = [
    ...simulare.subiectI.parteaA.itemi.map(it => ({
      id: it.id, punctajMaxim: it.punctaj, cerinta: it.cerinta, raspuns: answers[it.id] || "",
    })),
    ...simulare.subiectI.parteaB.itemi.map(it => ({
      id: it.id, punctajMaxim: it.punctaj, cerinta: it.cerinta, raspuns: answers[it.id] || "",
    })),
  ];

  const prompt = `Evaluează simularea EN VIII Română a elevului ${userName}.\n\nTEXTUL DE LA SUBIECTUL I:\n${simulare.subiectI.text}\n\nITEMII ȘI RĂSPUNSURILE:\n${JSON.stringify(itemsForEval, null, 2)}\n\nSUBIECTUL II — COMPUNERE:\nCerință: ${simulare.subiectII.cerinta}\nLungime cerută: ${simulare.subiectII.lungimeMin}-${simulare.subiectII.lungimeMax} cuvinte\nLungime efectivă: ${wordCount} cuvinte\n\nTEXT compunere:\n"""\n${essayText}\n"""\n\nJSON STRICT (nimic altceva):\n{\n  "subiectI": {\n    "punctajTotal": numar (0-60),\n    "itemi": [\n      {"id": "I.A.1", "punctaj": 0-5, "punctajMaxim": 5, "comentariu": "1 propoziție"},\n      ...toți cei 9 itemi\n    ]\n  },\n  "subiectII": {\n    "punctajTotal": numar (0-30),\n    "criterii": [\n      {"nume": "continut", "punctaj": 0-8, "maxim": 8, "comentariu": "..."},\n      {"nume": "structura", "punctaj": 0-6, "maxim": 6, "comentariu": "..."},\n      {"nume": "stil", "punctaj": 0-6, "maxim": 6, "comentariu": "..."},\n      {"nume": "ortografie", "punctaj": 0-6, "maxim": 6, "comentariu": "..."},\n      {"nume": "redactare", "punctaj": 0-4, "maxim": 4, "comentariu": "..."}\n    ],\n    "puncteForte": ["..."],\n    "deImbunatatit": ["..."]\n  },\n  "feedbackGeneral": "2-4 propoziții calde, motivante, despre cum a mers și ce să prioritizeze",\n  "capitoleDeRevazut": ["nume capitol/temă concretă pe care s-au pierdut puncte"]\n}\n\nReguli:\n- Punctajul itemilor trebuie să respecte maximul fiecărui item\n- Pentru itemi de tip "scurt" (5p): 0/3/5 e tipic — 3p pentru parțial corect, 5p pentru complet\n- Pentru itemi "lung" (10p): scor parțial pe pași (3-7-10)\n- Compunerea: 30p total, criteriile sumează 30p\n- Dacă lungimea compunerii e în afara limitei (${simulare.subiectII.lungimeMin}-${simulare.subiectII.lungimeMax}), scade din "redactare"\n- Comentariile scurte și SPECIFICE, NU generice`;

  const raw = await aiCall([{ role: "user", content: prompt }], system, 3000, 2, "chat");
  const parsed = extractJSON(raw);

  const subiectIPuncte = (parsed.subiectI?.itemi || []).reduce((s, i) => s + (Number(i.punctaj) || 0), 0);
  const subiectIIPuncte = (parsed.subiectII?.criterii || []).reduce((s, c) => s + (Number(c.punctaj) || 0), 0);
  const totalPuncte = subiectIPuncte + subiectIIPuncte + (simulare.punctajOficiu || 10);
  const nota = Math.round((totalPuncte / 10) * 100) / 100; // /10 cu 2 zecimale

  return {
    materie: "romana",
    nota,
    totalPuncte,
    punctajOficiu: simulare.punctajOficiu || 10,
    wordCount,
    subiectI: {
      punctaj: subiectIPuncte,
      maxim: 60,
      itemi: parsed.subiectI?.itemi || [],
    },
    subiectII: {
      punctaj: subiectIIPuncte,
      maxim: 30,
      criterii: parsed.subiectII?.criterii || [],
      puncteForte: parsed.subiectII?.puncteForte || [],
      deImbunatatit: parsed.subiectII?.deImbunatatit || [],
    },
    feedbackGeneral: parsed.feedbackGeneral || "",
    capitoleDeRevazut: parsed.capitoleDeRevazut || [],
  };
}

// ── EVALUATE simulare matematică ──
// answers shape: { "I.1": "A", "II.1": "B", ..., "III.1": "rezolvare scrisă", "III.2": "rezolvare" }
export async function evaluateSimulareMatematica(simulare, answers, userName = "elevul") {
  const system = `Ești profesor evaluator EN VIII pentru matematică. Aplici baremul oficial. Acorzi punctaj parțial pentru pași corecți (cum se face la EN).\nRăspunde DOAR cu JSON valid.`;

  // Auto-grade multiple choice client-side first (fast, free, no AI needed)
  const gradeMC = (item, given) => ({
    id: item.id, punctaj: given === item.corect ? item.punctaj : 0, punctajMaxim: item.punctaj,
    rasspunsCorect: item.corect, raspunsDat: given || null,
  });
  const subiectIRez = simulare.subiectI.itemi.map(it => gradeMC(it, answers[it.id]));
  const subiectIIRez = simulare.subiectII.itemi.map(it => gradeMC(it, answers[it.id]));
  const subiectIPuncte = subiectIRez.reduce((s, i) => s + i.punctaj, 0);
  const subiectIIPuncte = subiectIIRez.reduce((s, i) => s + i.punctaj, 0);

  // Subiectul III needs AI evaluation (open-ended written solutions)
  const problemeCuRaspunsuri = simulare.subiectIII.probleme.map(p => ({
    id: p.id,
    punctajMaxim: p.punctaj,
    enunt: p.enunt,
    subpuncte: p.subpuncte,
    rezolvareReferinta: p.rezolvareReferinta,
    rezolvareElev: answers[p.id] || "",
  }));

  const prompt = `Evaluează rezolvările elevului ${userName} pentru Subiectul III al simulării EN VIII matematică.\n\nPROBLEME ȘI REZOLVĂRI:\n${JSON.stringify(problemeCuRaspunsuri, null, 2)}\n\nJSON STRICT:\n{\n  "probleme": [\n    {\n      "id": "III.1",\n      "punctajTotal": 0-15,\n      "subpuncte": [\n        {"id": "a", "punctaj": 0-Nmax, "punctajMaxim": Nmax, "comentariu": "1-2 propoziții"},\n        ...\n      ],\n      "comentariu": "Comentariu general despre rezolvare",\n      "primulPasGresit": "dacă e cazul"\n    },\n    {"id": "III.2", ...}\n  ],\n  "feedbackGeneral": "2-4 propoziții calde și motivante",\n  "capitoleDeRevazut": ["..."]\n}\n\nReguli barem EN VIII:\n- Răspuns final corect cu rezolvare completă: punctaj maxim sub-punct\n- Răspuns final corect dar fără justificare: ~50% din sub-punct\n- Pași inițiali corecți care apoi greșesc: punctaj parțial\n- Abordare complet greșită: 0p\n- Suma punctajelor sub-punctelor = punctaj total problemă (15p)\n- Dacă elevul nu a scris nimic: 0p toate sub-punctele\n- Fii cald și motivant, dar onest`;

  const raw = await aiCall([{ role: "user", content: prompt }], system, 2500, 2, "chat");
  const parsed = extractJSON(raw);

  const subiectIIIRez = (parsed.probleme || []).map(p => ({
    id: p.id,
    punctaj: (p.subpuncte || []).reduce((s, sp) => s + (Number(sp.punctaj) || 0), 0),
    maxim: 15,
    subpuncte: p.subpuncte || [],
    comentariu: p.comentariu || "",
    primulPasGresit: p.primulPasGresit || "",
  }));
  const subiectIIIPuncte = subiectIIIRez.reduce((s, p) => s + p.punctaj, 0);

  const totalPuncte = subiectIPuncte + subiectIIPuncte + subiectIIIPuncte + (simulare.punctajOficiu || 10);
  const nota = Math.round((totalPuncte / 10) * 100) / 100;

  return {
    materie: "matematica",
    nota,
    totalPuncte,
    punctajOficiu: simulare.punctajOficiu || 10,
    subiectI: { punctaj: subiectIPuncte, maxim: 30, itemi: subiectIRez },
    subiectII: { punctaj: subiectIIPuncte, maxim: 30, itemi: subiectIIRez },
    subiectIII: { punctaj: subiectIIIPuncte, maxim: 30, probleme: subiectIIIRez },
    feedbackGeneral: parsed.feedbackGeneral || "",
    capitoleDeRevazut: parsed.capitoleDeRevazut || [],
  };
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
