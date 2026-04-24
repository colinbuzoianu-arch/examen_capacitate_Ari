export const EXAM_ROMANA = new Date("2026-06-22T09:00:00");
export const EXAM_MATH   = new Date("2026-06-24T09:00:00");
export const START_DATE  = new Date("2026-04-23");

export const CONFIG = {
  studentEmail:    "ari.buzoianu@scoalababel.ro",
  parentEmail:     "colinbuzoianu@gmail.com",
  motherEmail:     "anamunteanucontact@gmail.com",
  studentName:     "Ari",
  parentName:      "Colin",
  adminPasswordB64: btoa("Babel2012"),
  QUIZ_PASS_SCORE: 8,   // out of 10
};

export const SUBJECTS = {
  romana: {
    label: "Limbă și Literatură Română", short: "Română",
    color: "#7B1D1D", accent: "#FF6B6B", icon: "📖",
    examDate: EXAM_ROMANA,
    chapters: [
      {
        id: "r1", title: "Textul narativ literar",
        topics: ["Rezumat", "Perspectivă narativă", "Personaje", "Timp și spațiu", "Moduri de expunere"],
        aiContext: `Capitol din programa Evaluării Naționale clasa a VIII-a: Textul narativ literar.
Teme principale: rezumatul unui text narativ, perspectiva narativă (narator omniscient, subiectiv, obiectiv),
caracterizarea personajelor (directă și indirectă), relațiile de timp și spațiu în narațiune,
modurile de expunere (narațiune, descriere, dialog, monolog).
Nivel: elev clasa a VIII-a, România. Limbă: română.`
      },
      {
        id: "r2", title: "Textul descriptiv și liric",
        topics: ["Elemente de versificație", "Figuri de stil", "Imagini artistice", "Limbaj poetic"],
        aiContext: `Capitol: Textul descriptiv și liric – programa EN VIII.
Teme: versificație (rimă, ritm, măsură, strofe), figuri de stil (metaforă, personificare, comparație,
epitet, hiperbola, enumerație, repetiție), imagini artistice (vizuale, auditive, motorii),
trăsăturile limbajului poetic vs. limbajul comun.
Nivel: clasa a VIII-a. Limbă: română.`
      },
      {
        id: "r3", title: "Textul argumentativ",
        topics: ["Structura argumentului", "Teză și ipoteză", "Argumente și contra-argumente", "Concluzia"],
        aiContext: `Capitol: Textul argumentativ – programa EN VIII.
Teme: structura textului argumentativ (introducere, cuprins cu argumente, concluzie),
diferența dintre teză și ipoteză, tipuri de argumente (raționale, prin exemplu, prin autoritate),
contra-argumente și tehnici de respingere, conectori argumentativi.
Nivel: clasa a VIII-a. Limbă: română.`
      },
      {
        id: "r4", title: "Fonetică și Vocabular",
        topics: ["Foneme și litere", "Despărțirea în silabe", "Relații semantice", "Vocabular"],
        aiContext: `Capitol: Fonetică și Vocabular – programa EN VIII.
Teme: vocale, consoane, semivocale; diftong, triftong, hiat; despărțirea în silabe (reguli);
sinonime, antonime, omonime, paronime; cuvinte cu sens propriu/figurat; familia lexicală; câmpul semantic.
Nivel: clasa a VIII-a. Limbă: română.`
      },
      {
        id: "r5", title: "Morfologie",
        topics: ["Substantiv", "Adjectiv", "Pronume", "Numeral", "Verb", "Adverb", "Prepoziție", "Conjuncție"],
        aiContext: `Capitol: Morfologie – programa EN VIII.
Teme: toate părțile de vorbire flexibile și neflexibile: substantiv (gen, număr, caz, articol),
adjectiv (grade de comparație), pronume (tipuri: personal, posesiv, demonstrativ, relativ, interogativ, nehotărât),
numeral (tipuri), verb (moduri, timpuri, diateze, conjugări), adverb, prepoziție, conjuncție, interjecție.
Nivel: clasa a VIII-a. Limbă: română.`
      },
      {
        id: "r6", title: "Sintaxă",
        topics: ["Propoziția", "Fraza", "Subiect și predicat", "Complemente", "Propoziții subordonate"],
        aiContext: `Capitol: Sintaxă – programa EN VIII.
Teme: propoziția simplă și dezvoltată; subiect (simplu, multiplu, inclus, subînțeles) și predicat (verbal, nominal);
atribut și complement (direct, indirect, circumstanțial de loc/timp/mod/cauză/scop);
fraza: propoziție principală și subordonată; tipuri de subordonate (subiectivă, predicativă, atributivă,
completivă directă/indirectă, circumstanțială).
Nivel: clasa a VIII-a. Limbă: română.`
      },
      {
        id: "r7", title: "Redactare – Compuneri",
        topics: ["Compunere narativă", "Compunere descriptivă", "Redactare argumentativă", "Structura eseului"],
        aiContext: `Capitol: Redactare și compuneri – programa EN VIII.
Teme: structura compunerii narative (acțiune, personaje, timp, spațiu), compunerea descriptivă
(tablou static și dinamic), redactarea argumentativă (teză, argumente, concluzie),
eseul structurat (introducere, cuprins, concluzie), criterii de evaluare EN VIII la subiectul III.
Nivel: clasa a VIII-a. Limbă: română.`
      },
    ],
  },
  matematica: {
    label: "Matematică", short: "Matematică",
    color: "#0D2E4E", accent: "#3498DB", icon: "📐",
    examDate: EXAM_MATH,
    chapters: [
      {
        id: "m1", title: "Mulțimi și operații",
        topics: ["Mulțimi", "Reuniune, intersecție, diferență", "Diagrame Venn"],
        aiContext: `Capitol: Mulțimi – programa Evaluării Naționale clasa a VIII-a, matematică.
Teme: definiția mulțimii, element, apartenența, incluziunea; operații cu mulțimi: reuniune (∪), intersecție (∩),
diferență (\\); complement; diagrame Venn; mulțimi finite și infinite; mulțimea vidă.
Nivel: clasa a VIII-a. Limbă: română. Include exemple și exerciții tip EN.`
      },
      {
        id: "m2", title: "Numere reale",
        topics: ["Mulțimi numerice", "Modulul unui număr", "Operații cu radicali", "Puteri"],
        aiContext: `Capitol: Numere reale – programa EN VIII matematică.
Teme: mulțimile N, Z, Q, R și relațiile dintre ele; modulul unui număr real; radicali (simplificare,
înmulțire, împărțire, adunare cu condiții); raționalizarea numitorului; puteri cu exponent întreg și
rațional; ordinea operațiilor.
Nivel: clasa a VIII-a. Limbă: română.`
      },
      {
        id: "m3", title: "Calcul algebric",
        topics: ["Expresii algebrice", "Produse notabile", "Descompunere în factori", "Fracții algebrice"],
        aiContext: `Capitol: Calcul algebric – programa EN VIII matematică.
Teme: monomi și polinoame (adunare, scădere, înmulțire, împărțire); produse notabile
(pătratul sumei, pătratul diferenței, diferența de pătrate, cubul sumei/diferenței);
descompunerea în factori (factor comun, produse notabile, grupare); fracții algebrice (simplificare, operații).
Nivel: clasa a VIII-a. Limbă: română.`
      },
      {
        id: "m4", title: "Ecuații și inecuații",
        topics: ["Ecuații de grad I", "Sisteme de ecuații", "Ecuații de grad II", "Inecuații"],
        aiContext: `Capitol: Ecuații și inecuații – programa EN VIII matematică.
Teme: ecuații de gradul I cu o necunoscută; sisteme de ecuații de gradul I (metoda substituției,
metoda reducerii, metoda grafică); ecuații de gradul II (formulă rezolvantă, discriminant, relațiile lui Viète);
inecuații de gradul I; discuție după parametru.
Nivel: clasa a VIII-a. Limbă: română.`
      },
      {
        id: "m5", title: "Funcții",
        topics: ["Funcție liniară", "Funcție de gradul II", "Reprezentare grafică"],
        aiContext: `Capitol: Funcții – programa EN VIII matematică.
Teme: definiția funcției, domeniu, codomeniu, imagine; funcția liniară f(x)=ax+b (pantă, intersecții cu axele,
reprezentare grafică); funcția de gradul II f(x)=ax²+bx+c (parabolă, vârf, axă de simetrie, sens de variație);
citirea și interpretarea graficelor.
Nivel: clasa a VIII-a. Limbă: română.`
      },
      {
        id: "m6", title: "Geometrie plană",
        topics: ["Triunghiuri", "Teorema lui Pitagora", "Patrulater", "Cerc"],
        aiContext: `Capitol: Geometrie plană – programa EN VIII matematică.
Teme: triunghiuri – congruență (criteriile LUL, ULU, LLL), asemănare (criteriile UU, LUL, LL);
teorema lui Pitagora și reciproca; teorema medianei; patrulater (paralelogram, dreptunghi, romb, pătrat, trapez)
– proprietăți și calcul arie/perimetru; cerc – elemente, unghi înscris, unghi la centru, arie, lungime arc.
Nivel: clasa a VIII-a. Limbă: română.`
      },
      {
        id: "m7", title: "Geometrie în spațiu",
        topics: ["Prismă și piramidă", "Cilindru, con, sferă", "Arie și volum"],
        aiContext: `Capitol: Geometrie în spațiu – programa EN VIII matematică.
Teme: prismă (dreaptă, oblică) – arie laterală, arie totală, volum; piramidă – apotema, arie, volum;
trunchiul de piramidă; cilindru circular drept – arie, volum; con circular drept – generatoare, arie, volum;
trunchi de con; sfera – arie, volum. Formule și aplicații tip EN.
Nivel: clasa a VIII-a. Limbă: română.`
      },
      {
        id: "m8", title: "Statistică și probabilități",
        topics: ["Media aritmetică", "Mediană, mod", "Probabilitate", "Reprezentări statistice"],
        aiContext: `Capitol: Statistică și probabilități – programa EN VIII matematică.
Teme: date statistice – colectare și organizare; media aritmetică (simplă și ponderată), mediana, modul;
reprezentări grafice (diagrama cu bare, histogramă, diagrama circulară); probabilitatea unui eveniment
(clasică), Evenimente sigure/imposibile/contrare; exerciții tip EN.
Nivel: clasa a VIII-a. Limbă: română.`
      },
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
  const all = [
    ...SUBJECTS.romana.chapters.map(c => ({ ...c, subject: "romana" })),
    ...SUBJECTS.matematica.chapters.map(c => ({ ...c, subject: "matematica" })),
  ];
  const plan = {}; WEEKS.forEach(w => { plan[w.id] = []; });
  all.forEach((ch, i) => {
    const idx = Math.min(Math.floor((i / all.length) * WEEKS.length), WEEKS.length - 1);
    plan[WEEKS[idx].id].push(ch);
  });
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
