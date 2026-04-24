export const EXAM_ROMANA = new Date("2026-06-22T09:00:00");
export const EXAM_MATH   = new Date("2026-06-24T09:00:00");
export const START_DATE  = new Date("2026-04-23");

// App-level config — no personal data here
export const CONFIG = {
  appName:          "EN 2026",
  adminPasswordB64: btoa("Babel2012"),
  QUIZ_PASS_SCORE:  8,
};

export const SUBJECTS = {
  romana: {
    label: "Limbă și Literatură Română", short: "Română",
    color: "#7B1D1D", accent: "#C8392B", icon: "📖",
    examDate: EXAM_ROMANA,
    chapters: [
      { id: "r1", title: "Textul narativ literar", topics: ["Rezumat", "Perspectivă narativă", "Personaje", "Timp și spațiu", "Moduri de expunere"], aiContext: `Capitol din programa EN clasa a VIII-a: Textul narativ literar. Teme: rezumat, perspectivă narativă (omniscient, subiectiv, obiectiv), caracterizarea personajelor, relații timp-spațiu, moduri de expunere (narațiune, descriere, dialog, monolog). Nivel: clasa a VIII-a. Limbă: română.` },
      { id: "r2", title: "Textul descriptiv și liric", topics: ["Elemente de versificație", "Figuri de stil", "Imagini artistice", "Limbaj poetic"], aiContext: `Capitol EN VIII: Textul descriptiv și liric. Teme: versificație (rimă, ritm, măsură, strofe), figuri de stil (metaforă, personificare, comparație, epitet, hiperbolă), imagini artistice, limbaj poetic vs. comun. Nivel: clasa a VIII-a. Limbă: română.` },
      { id: "r3", title: "Textul argumentativ", topics: ["Structura argumentului", "Teză și ipoteză", "Argumente și contra-argumente", "Concluzia"], aiContext: `Capitol EN VIII: Textul argumentativ. Teme: structura textului argumentativ, teză și ipoteză, tipuri de argumente, contra-argumente, conectori argumentativi. Nivel: clasa a VIII-a. Limbă: română.` },
      { id: "r4", title: "Fonetică și Vocabular", topics: ["Foneme și litere", "Despărțirea în silabe", "Relații semantice", "Vocabular"], aiContext: `Capitol EN VIII: Fonetică și Vocabular. Teme: vocale, consoane, semivocale, diftong, triftong, hiat, despărțire în silabe, sinonime, antonime, omonime, paronime, familie lexicală, câmp semantic. Nivel: clasa a VIII-a. Limbă: română.` },
      { id: "r5", title: "Morfologie", topics: ["Substantiv", "Adjectiv", "Pronume", "Numeral", "Verb", "Adverb", "Prepoziție", "Conjuncție"], aiContext: `Capitol EN VIII: Morfologie. Teme: toate părțile de vorbire flexibile și neflexibile — substantiv, adjectiv, pronume (tipuri), numeral, verb (moduri, timpuri, diateze), adverb, prepoziție, conjuncție. Nivel: clasa a VIII-a. Limbă: română.` },
      { id: "r6", title: "Sintaxă", topics: ["Propoziția", "Fraza", "Subiect și predicat", "Complemente", "Propoziții subordonate"], aiContext: `Capitol EN VIII: Sintaxă. Teme: propoziție simplă/dezvoltată, subiect și predicat, atribut, complemente, fraza, tipuri de subordonate (subiectivă, predicativă, atributivă, completivă, circumstanțială). Nivel: clasa a VIII-a. Limbă: română.` },
      { id: "r7", title: "Redactare – Compuneri", topics: ["Compunere narativă", "Compunere descriptivă", "Redactare argumentativă", "Structura eseului"], aiContext: `Capitol EN VIII: Redactare și compuneri. Teme: compunere narativă, descriptivă, argumentativă, structura eseului, criterii de evaluare EN VIII subiectul III. Nivel: clasa a VIII-a. Limbă: română.` },
    ],
  },
  matematica: {
    label: "Matematică", short: "Matematică",
    color: "#0D2E4E", accent: "#1A5276", icon: "📐",
    examDate: EXAM_MATH,
    chapters: [
      { id: "m1", title: "Mulțimi și operații", topics: ["Mulțimi", "Reuniune, intersecție, diferență", "Diagrame Venn"], aiContext: `Capitol EN VIII matematică: Mulțimi. Teme: definiție, apartenența, incluziunea, operații (reuniune, intersecție, diferență), complement, diagrame Venn. Nivel: clasa a VIII-a. Limbă: română.` },
      { id: "m2", title: "Numere reale", topics: ["Mulțimi numerice", "Modulul unui număr", "Operații cu radicali", "Puteri"], aiContext: `Capitol EN VIII matematică: Numere reale. Teme: mulțimile N, Z, Q, R, modulul, radicali, raționalizare, puteri cu exponent întreg și rațional. Nivel: clasa a VIII-a. Limbă: română.` },
      { id: "m3", title: "Calcul algebric", topics: ["Expresii algebrice", "Produse notabile", "Descompunere în factori", "Fracții algebrice"], aiContext: `Capitol EN VIII matematică: Calcul algebric. Teme: monomi, polinoame, produse notabile, descompunere în factori, fracții algebrice. Nivel: clasa a VIII-a. Limbă: română.` },
      { id: "m4", title: "Ecuații și inecuații", topics: ["Ecuații de grad I", "Sisteme de ecuații", "Ecuații de grad II", "Inecuații"], aiContext: `Capitol EN VIII matematică: Ecuații și inecuații. Teme: ecuații grad I, sisteme (substituție, reducere, grafic), ecuații grad II, discriminant, relațiile lui Viète, inecuații. Nivel: clasa a VIII-a. Limbă: română.` },
      { id: "m5", title: "Funcții", topics: ["Funcție liniară", "Funcție de gradul II", "Reprezentare grafică"], aiContext: `Capitol EN VIII matematică: Funcții. Teme: definiție, funcție liniară f(x)=ax+b, funcție de gradul II f(x)=ax²+bx+c, parabolă, grafice. Nivel: clasa a VIII-a. Limbă: română.` },
      { id: "m6", title: "Geometrie plană", topics: ["Triunghiuri", "Teorema lui Pitagora", "Patrulater", "Cerc"], aiContext: `Capitol EN VIII matematică: Geometrie plană. Teme: congruență și asemănare triunghiuri, teorema lui Pitagora, patrulater, cerc, arie și perimetru. Nivel: clasa a VIII-a. Limbă: română.` },
      { id: "m7", title: "Geometrie în spațiu", topics: ["Prismă și piramidă", "Cilindru, con, sferă", "Arie și volum"], aiContext: `Capitol EN VIII matematică: Geometrie în spațiu. Teme: prismă, piramidă, cilindru, con, sferă — arie și volum. Nivel: clasa a VIII-a. Limbă: română.` },
      { id: "m8", title: "Statistică și probabilități", topics: ["Media aritmetică", "Mediană, mod", "Probabilitate", "Reprezentări statistice"], aiContext: `Capitol EN VIII matematică: Statistică și probabilități. Teme: medie aritmetică, mediană, mod, probabilitate clasică, reprezentări grafice. Nivel: clasa a VIII-a. Limbă: română.` },
    ],
  },
};

export function generateWeeks() {
  const weeks = []; let current = new Date(START_DATE); let n = 1;
  while (current < EXAM_ROMANA) {
    const end = new Date(current); end.setDate(end.getDate() + 6);
    weeks.push({ id: `w${n}`, num: n, start: new Date(current), end: end > EXAM_ROMANA ? new Date(EXAM_ROMANA) : end, label: `Săptămâna ${n}` });
    current.setDate(current.getDate() + 7); n++;
  }
  return weeks;
}
export const WEEKS = generateWeeks();

export function buildWeeklyPlan() {
  const romana   = SUBJECTS.romana.chapters.map(c => ({ ...c, subject: "romana" }));
  const mate     = SUBJECTS.matematica.chapters.map(c => ({ ...c, subject: "matematica" }));
  const plan     = {};
  WEEKS.forEach(w => { plan[w.id] = []; });
  const maxLen = Math.max(romana.length, mate.length);
  let weekIdx = 0;
  for (let i = 0; i < maxLen; i++) {
    if (weekIdx >= WEEKS.length) weekIdx = WEEKS.length - 1;
    if (romana[i]) { plan[WEEKS[weekIdx].id].push(romana[i]); }
    if (weekIdx >= WEEKS.length) weekIdx = WEEKS.length - 1;
    if (mate[i])   { plan[WEEKS[weekIdx].id].push(mate[i]); }
    weekIdx++;
  }
  return plan;
}
export const WEEKLY_PLAN = buildWeeklyPlan();

export function fmt(date) { return date.toLocaleDateString("ro-RO", { day: "numeric", month: "short" }); }
export function daysLeft(t) { return Math.max(0, Math.ceil((t - new Date()) / 86400000)); }
export function getWeekStatus(w) {
  const n = new Date();
  if (n < w.start) return "future";
  if (n > w.end)   return "past";
  return "current";
}
