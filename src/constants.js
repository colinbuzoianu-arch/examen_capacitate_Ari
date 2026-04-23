// ── EXAM DATES ───────────────────────────────────────────────────────────────
export const EXAM_ROMANA  = new Date("2026-06-22T09:00:00");
export const EXAM_MATH    = new Date("2026-06-24T09:00:00");
export const START_DATE   = new Date("2026-04-23");

// ── CONFIG ────────────────────────────────────────────────────────────────────
export const CONFIG = {
  studentEmail: "ari.buzoianu@scoalababel.ro",
  parentEmail:  "colinbuzoianu@gmail.com",
  studentName:  "Ari",
  parentName:   "Colin",
  // Admin password (hashed as base64 for lightweight protection)
  // Password is: babel2026 — change here and in AdminPage if you want another
  adminPasswordB64: btoa("babel2026"),
};

// ── SUBJECTS & CURRICULUM ─────────────────────────────────────────────────────
export const SUBJECTS = {
  romana: {
    label: "Limbă și Literatură Română",
    short: "Română",
    color: "#7B1D1D",
    accent: "#FF6B6B",
    icon: "📖",
    examDate: EXAM_ROMANA,
    chapters: [
      {
        id: "r1", title: "Textul narativ literar",
        topics: ["Rezumat", "Perspectivă narativă", "Personaje", "Timp și spațiu", "Moduri de expunere"],
      },
      {
        id: "r2", title: "Textul descriptiv și liric",
        topics: ["Elemente de versificație", "Figuri de stil", "Imagini artistice", "Limbaj poetic"],
      },
      {
        id: "r3", title: "Textul argumentativ",
        topics: ["Structura argumentului", "Teză și ipoteză", "Argumente și contra-argumente", "Concluzia"],
      },
      {
        id: "r4", title: "Fonetică și Vocabular",
        topics: ["Foneme și litere", "Despărțirea în silabe", "Relații semantice", "Vocabular"],
      },
      {
        id: "r5", title: "Morfologie",
        topics: ["Substantiv", "Adjectiv", "Pronume", "Numeral", "Verb", "Adverb", "Prepoziție", "Conjuncție"],
      },
      {
        id: "r6", title: "Sintaxă",
        topics: ["Propoziția", "Fraza", "Subiect și predicat", "Complemente", "Propoziții subordonate"],
      },
      {
        id: "r7", title: "Redactare – Compuneri",
        topics: ["Compunere narativă", "Compunere descriptivă", "Redactare argumentativă", "Structura eseului"],
      },
    ],
  },
  matematica: {
    label: "Matematică",
    short: "Matematică",
    color: "#0D2E4E",
    accent: "#3498DB",
    icon: "📐",
    examDate: EXAM_MATH,
    chapters: [
      {
        id: "m1", title: "Mulțimi și operații",
        topics: ["Mulțimi", "Reuniune, intersecție, diferență", "Diagrame Venn"],
      },
      {
        id: "m2", title: "Numere reale",
        topics: ["Mulțimi numerice", "Modulul unui număr", "Operații cu radicali", "Puteri cu exponent întreg"],
      },
      {
        id: "m3", title: "Calcul algebric",
        topics: ["Expresii algebrice", "Produse notabile", "Descompunere în factori", "Fracții algebrice"],
      },
      {
        id: "m4", title: "Ecuații și inecuații",
        topics: ["Ecuații de grad I", "Sisteme de ecuații", "Ecuații de grad II", "Inecuații"],
      },
      {
        id: "m5", title: "Funcții",
        topics: ["Funcție liniară", "Funcție de gradul II", "Reprezentare grafică", "Interpretare grafic"],
      },
      {
        id: "m6", title: "Geometrie plană",
        topics: ["Triunghiuri – congruență, asemănare", "Teorema lui Pitagora", "Patrulater", "Cerc"],
      },
      {
        id: "m7", title: "Geometrie în spațiu",
        topics: ["Prismă, piramidă", "Cilindru, con, sferă", "Arie și volum"],
      },
      {
        id: "m8", title: "Statistică și probabilități",
        topics: ["Media aritmetică", "Mediană, mod", "Probabilitate", "Reprezentări statistice"],
      },
    ],
  },
};

// ── GENERATE WEEKLY SCHEDULE ──────────────────────────────────────────────────
export function generateWeeks() {
  const weeks = [];
  let current = new Date(START_DATE);
  let weekNum = 1;
  while (current < EXAM_ROMANA) {
    const end = new Date(current);
    end.setDate(end.getDate() + 6);
    const effectiveEnd = end > EXAM_ROMANA ? new Date(EXAM_ROMANA) : end;
    weeks.push({
      id: `w${weekNum}`,
      num: weekNum,
      start: new Date(current),
      end: new Date(effectiveEnd),
      label: `Săptămâna ${weekNum}`,
    });
    current.setDate(current.getDate() + 7);
    weekNum++;
  }
  return weeks;
}

export const WEEKS = generateWeeks();

export function buildWeeklyPlan() {
  const all = [
    ...SUBJECTS.romana.chapters.map(c => ({ ...c, subject: "romana" })),
    ...SUBJECTS.matematica.chapters.map(c => ({ ...c, subject: "matematica" })),
  ];
  const plan = {};
  WEEKS.forEach(w => { plan[w.id] = []; });
  all.forEach((ch, i) => {
    const idx = Math.min(Math.floor((i / all.length) * WEEKS.length), WEEKS.length - 1);
    plan[WEEKS[idx].id].push(ch);
  });
  return plan;
}

export const WEEKLY_PLAN = buildWeeklyPlan();

// ── HELPERS ───────────────────────────────────────────────────────────────────
export function fmt(date) {
  return date.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
}
export function daysLeft(target) {
  return Math.max(0, Math.ceil((target - new Date()) / 86400000));
}
export function getWeekStatus(week) {
  const now = new Date();
  if (now < week.start) return "future";
  if (now > week.end)   return "past";
  return "current";
}
export function currentWeek() {
  return WEEKS.find(w => getWeekStatus(w) === "current") || WEEKS[0];
}
