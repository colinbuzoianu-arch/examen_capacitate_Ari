// SimularePage.jsx — Simulare Evaluare Națională VIII (full mock exam)
// Format real: Română 2h, Matematică 2h. Auto-save, timer, AI evaluator.

import { useState, useEffect, useRef } from "react";
import { cloudGet, cloudSet } from "../utils/cloudStorage.js";
import {
  generateSimulareRomana, generateSimulareMatematica,
  evaluateSimulareRomana, evaluateSimulareMatematica,
} from "../utils/api.js";
import { SUBJECTS } from "../constants.js";
import { useAuth } from "../context/AuthContext.jsx";
import { logger } from "../utils/logger.js";
import { trackFeature } from "../utils/featureTracking.js";
import UpgradeModal from "./UpgradeModal.jsx";

const STORAGE_KEY = "simulare_active"; // active in-progress simulare
const HISTORY_KEY = "simulare_history"; // completed ones

export default function SimularePage({ onBack }) {
  const { user } = useAuth();
  const [view, setView]         = useState("intro"); // intro | exam | results
  const [subject, setSubject]   = useState(null);    // "romana" | "matematica"
  const [simulare, setSimulare] = useState(null);    // the generated exam
  const [answers, setAnswers]   = useState({});
  const [loading, setLoading]   = useState(false);
  const [evaluating, setEval]   = useState(false);
  const [error, setError]       = useState(null);
  const [result, setResult]     = useState(null);
  const [history, setHistory]   = useState([]);
  const [upgrade, setUpgrade]   = useState(null);

  // Timer
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [paused, setPaused]           = useState(false);
  const [startTs, setStartTs]         = useState(null);
  const timerRef                      = useRef(null);

  // Confirmation
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // Load any in-progress + history on mount
  useEffect(() => {
    cloudGet(STORAGE_KEY).then(saved => {
      if (saved?.simulare && saved?.subject && !saved?.completed) {
        setSimulare(saved.simulare);
        setSubject(saved.subject);
        setAnswers(saved.answers || {});
        setStartTs(saved.startTs || Date.now());
        const elapsed = Math.floor((Date.now() - (saved.startTs || Date.now())) / 1000);
        const total = (saved.simulare.durata || 120) * 60;
        setSecondsLeft(Math.max(0, total - elapsed));
        setView("exam");
      }
    });
    cloudGet(HISTORY_KEY).then(h => setHistory(Array.isArray(h) ? h : []));
  }, []);

  // Timer tick
  useEffect(() => {
    if (view !== "exam" || paused || !simulare) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          // auto-submit when time runs out
          submitSimulare();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [view, paused, simulare]);

  // Auto-save answers (debounced)
  useEffect(() => {
    if (view !== "exam" || !simulare) return;
    const t = setTimeout(() => {
      cloudSet(STORAGE_KEY, { simulare, subject, answers, startTs, completed: false });
    }, 800);
    return () => clearTimeout(t);
  }, [answers, view, simulare]);

  async function startSimulare(subj) {
    setSubject(subj);
    setLoading(true);
    setError(null);
    setAnswers({});
    setResult(null);
    try {
      const sim = subj === "romana"
        ? await generateSimulareRomana(SUBJECTS.romana.chapters)
        : await generateSimulareMatematica(SUBJECTS.matematica.chapters);
      setSimulare(sim);
      const start = Date.now();
      setStartTs(start);
      setSecondsLeft((sim.durata || 120) * 60);
      setView("exam");
      logger.simulareStarted(subj);
      trackFeature("simulare_started", { subject: subj });
      cloudSet(STORAGE_KEY, { simulare: sim, subject: subj, answers: {}, startTs: start, completed: false });
    } catch (e) {
      if (e.message?.startsWith("LIMIT_REACHED:")) {
        setUpgrade("simulare");
      } else {
        setError(e.message || "Nu s-a putut genera simularea. Încearcă din nou.");
      }
    }
    setLoading(false);
  }

  function setAnswer(id, value) {
    setAnswers(a => ({ ...a, [id]: value }));
  }

  async function submitSimulare() {
    if (!simulare || evaluating) return;
    clearInterval(timerRef.current);
    setEval(true);
    setConfirmSubmit(false);
    try {
      const res = subject === "romana"
        ? await evaluateSimulareRomana(simulare, answers, user?.name?.split(" ")[0] || "elevul")
        : await evaluateSimulareMatematica(simulare, answers, user?.name?.split(" ")[0] || "elevul");
      setResult(res);
      setView("results");
      logger.simulareCompleted(subject, res.nota, res.totalPuncte);
      trackFeature("simulare_completed", { subject, nota: res.nota });

      // Save to history
      const entry = {
        ts: new Date().toISOString(),
        subject,
        nota: res.nota,
        totalPuncte: res.totalPuncte,
        durataReala: Math.floor((Date.now() - startTs) / 60000), // minutes used
      };
      const newHist = [entry, ...history].slice(0, 20);
      setHistory(newHist);
      cloudSet(HISTORY_KEY, newHist);
      // Mark active as completed (so we don't reload it)
      cloudSet(STORAGE_KEY, null);
    } catch (e) {
      if (e.message?.startsWith("LIMIT_REACHED:")) {
        setUpgrade("simulare");
        setEval(false);
        return;
      }
      setError("Eroare la evaluare. Încearcă din nou.");
    }
    setEval(false);
  }

  function abandonSimulare() {
    if (!confirm("Sigur vrei să abandonezi simularea? Se va pierde tot progresul.")) return;
    clearInterval(timerRef.current);
    cloudSet(STORAGE_KEY, null);
    setSimulare(null);
    setAnswers({});
    setResult(null);
    setSubject(null);
    setView("intro");
  }

  function backToIntro() {
    setSimulare(null);
    setAnswers({});
    setResult(null);
    setSubject(null);
    setView("intro");
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={S.shell}>
      {upgrade && <UpgradeModal limitType={upgrade} onClose={() => setUpgrade(null)} />}

      <header style={S.header}>
        <button style={S.backBtn} onClick={view === "exam" ? abandonSimulare : onBack}>
          {view === "exam" ? "✕ Abandonează" : "← Înapoi"}
        </button>
        <div style={S.headerTitle}>
          🎓 Simulare EN VIII
          {subject && view === "exam" && (
            <span style={{ ...S.subjectChip, background: subject === "romana" ? "#FFF5F5" : "#EEF4FF", color: subject === "romana" ? "#C8392B" : "#1A5276" }}>
              {subject === "romana" ? "Română" : "Matematică"}
            </span>
          )}
        </div>
        {view === "exam" && (
          <Timer secondsLeft={secondsLeft} paused={paused} onTogglePause={() => setPaused(p => !p)} />
        )}
        {view !== "exam" && <div style={{ width: 80 }} />}
      </header>

      <main style={S.main}>
        {view === "intro" && (
          <IntroView
            onStart={startSimulare}
            loading={loading}
            error={error}
            history={history}
            user={user}
          />
        )}

        {view === "exam" && simulare && subject === "romana" && (
          <RomanaExam
            simulare={simulare}
            answers={answers}
            setAnswer={setAnswer}
            evaluating={evaluating}
            onSubmit={() => setConfirmSubmit(true)}
          />
        )}

        {view === "exam" && simulare && subject === "matematica" && (
          <MateExam
            simulare={simulare}
            answers={answers}
            setAnswer={setAnswer}
            evaluating={evaluating}
            onSubmit={() => setConfirmSubmit(true)}
          />
        )}

        {view === "results" && result && (
          <ResultsView result={result} simulare={simulare} answers={answers} onClose={backToIntro} />
        )}
      </main>

      {confirmSubmit && (
        <ConfirmModal
          title="Trimite simularea?"
          body={`Ai răspuns la ${countAnswered(simulare, answers)} din ${countTotal(simulare)} itemi. După trimitere primești evaluarea AI.`}
          confirmLabel="✓ Trimite"
          cancelLabel="Mai lucrez"
          onConfirm={submitSimulare}
          onCancel={() => setConfirmSubmit(false)}
        />
      )}

      {evaluating && (
        <div style={S.evalOverlay}>
          <div style={S.evalBox}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>Se evaluează simularea...</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>Profesorul AI verifică fiecare răspuns. Durează ~30 secunde.</div>
            <div style={S.evalSpinner} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function countAnswered(simulare, answers) {
  if (!simulare) return 0;
  let n = 0;
  if (simulare.materie === "romana") {
    [...simulare.subiectI.parteaA.itemi, ...simulare.subiectI.parteaB.itemi].forEach(it => {
      if ((answers[it.id] || "").trim()) n++;
    });
    if ((answers.essay || "").trim()) n++;
  } else {
    [...simulare.subiectI.itemi, ...simulare.subiectII.itemi].forEach(it => {
      if (answers[it.id]) n++;
    });
    simulare.subiectIII.probleme.forEach(p => {
      if ((answers[p.id] || "").trim()) n++;
    });
  }
  return n;
}

function countTotal(simulare) {
  if (!simulare) return 0;
  if (simulare.materie === "romana") {
    return simulare.subiectI.parteaA.itemi.length + simulare.subiectI.parteaB.itemi.length + 1;
  }
  return simulare.subiectI.itemi.length + simulare.subiectII.itemi.length + simulare.subiectIII.probleme.length;
}

function formatTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ── TIMER COMPONENT ────────────────────────────────────────────────────────
function Timer({ secondsLeft, paused, onTogglePause }) {
  const isLow = secondsLeft < 600; // <10 min
  const isCritical = secondsLeft < 180; // <3 min
  return (
    <button
      onClick={onTogglePause}
      style={{
        ...S.timer,
        background: isCritical ? "#FFF0EE" : isLow ? "#FFF8E7" : "#F0EDE6",
        color: isCritical ? "#C62828" : isLow ? "#E65100" : "#1A1A1A",
        borderColor: isCritical ? "#FFCDD2" : isLow ? "#F0D98A" : "#E0DBD0",
      }}>
      <span style={{ fontSize: 14 }}>{paused ? "⏸" : "⏱"}</span>
      <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14 }}>{formatTime(secondsLeft)}</span>
    </button>
  );
}

// ── INTRO VIEW ─────────────────────────────────────────────────────────────
function IntroView({ onStart, loading, error, history, user }) {
  const lastRomana = history.find(h => h.subject === "romana");
  const lastMate = history.find(h => h.subject === "matematica");
  const bestRomana = history.filter(h => h.subject === "romana").reduce((m, h) => h.nota > m ? h.nota : m, 0);
  const bestMate = history.filter(h => h.subject === "matematica").reduce((m, h) => h.nota > m ? h.nota : m, 0);

  return (
    <div style={S.page}>
      <div style={S.heroCard}>
        <div style={{ fontSize: 38, marginBottom: 6 }}>🎓</div>
        <div style={S.heroTitle}>Simulare Evaluarea Națională</div>
        <div style={S.heroSub}>
          Antrenament în condiții reale de examen.<br />
          120 minute · format oficial · evaluare AI după barem
        </div>
      </div>

      {error && (
        <div style={S.errorBox}>
          <div style={{ fontSize: 13, color: "#C62828", fontWeight: 600 }}>❌ {error}</div>
        </div>
      )}

      {loading && (
        <div style={S.loadingBox}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>⚙️</div>
          <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif" }}>Se generează subiectele...</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>~30-45 secunde. AI-ul construiește un subiect complet, original.</div>
          <div style={S.loadingSpinner} />
        </div>
      )}

      {!loading && (
        <>
          <div style={S.sectionTitle}>📝 Alege materia</div>

          <button
            onClick={() => onStart("romana")}
            style={{ ...S.subjectCard, borderColor: "#C8392B", background: "linear-gradient(135deg, #fff 0%, #FFF5F5 100%)" }}>
            <div style={S.subjectCardLeft}>
              <div style={{ fontSize: 32 }}>📖</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...S.subjectCardTitle, color: "#C8392B" }}>Limbă și Literatură Română</div>
              <div style={S.subjectCardSub}>Subiectul I (60p) + Compunere (30p) + 10 oficiu</div>
              {lastRomana && (
                <div style={S.lastResult}>
                  Ultima notă: <strong>{lastRomana.nota.toFixed(2)}</strong>
                  {bestRomana > 0 && <> · Cel mai bun: <strong>{bestRomana.toFixed(2)}</strong></>}
                </div>
              )}
            </div>
            <div style={{ fontSize: 24, color: "#C8392B" }}>→</div>
          </button>

          <button
            onClick={() => onStart("matematica")}
            style={{ ...S.subjectCard, borderColor: "#1A5276", background: "linear-gradient(135deg, #fff 0%, #EEF4FF 100%)" }}>
            <div style={S.subjectCardLeft}>
              <div style={{ fontSize: 32 }}>📐</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...S.subjectCardTitle, color: "#1A5276" }}>Matematică</div>
              <div style={S.subjectCardSub}>Subiectul I (30p) + II (30p) + III (30p) + 10 oficiu</div>
              {lastMate && (
                <div style={S.lastResult}>
                  Ultima notă: <strong>{lastMate.nota.toFixed(2)}</strong>
                  {bestMate > 0 && <> · Cel mai bun: <strong>{bestMate.toFixed(2)}</strong></>}
                </div>
              )}
            </div>
            <div style={{ fontSize: 24, color: "#1A5276" }}>→</div>
          </button>

          <div style={S.tipsCard}>
            <div style={S.tipsTitle}>💡 Cum funcționează</div>
            <ul style={S.tipsList}>
              <li>Ai <strong>120 minute</strong> per probă, ca la examenul real</li>
              <li>Răspunsurile se salvează automat — poți relua dacă închizi</li>
              <li>Apeși <strong>⏸</strong> dacă trebuie să faci pauză (timer-ul îngheață)</li>
              <li>La final apeși <strong>Trimite</strong>, AI-ul evaluează după barem</li>
              <li>Primești nota /10, punctaj per subiect și ce să revezi</li>
            </ul>
          </div>

          {history.length > 0 && (
            <>
              <div style={S.sectionTitle}>📊 Istoric simulări ({history.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {history.slice(0, 5).map((h, i) => (
                  <div key={i} style={S.historyRow}>
                    <span style={{ fontSize: 18 }}>{h.subject === "romana" ? "📖" : "📐"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: h.subject === "romana" ? "#C8392B" : "#1A5276" }}>
                        {h.subject === "romana" ? "Română" : "Matematică"}
                      </div>
                      <div style={{ fontSize: 10, color: "#888" }}>
                        {new Date(h.ts).toLocaleString("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {h.durataReala ? ` · ${h.durataReala} min` : ""}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: gradeColor(h.nota) }}>
                      {h.nota.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function gradeColor(n) {
  if (n >= 9) return "#2E7D32";
  if (n >= 7) return "#558B2F";
  if (n >= 5) return "#E65100";
  return "#C62828";
}

// ── ROMANA EXAM ────────────────────────────────────────────────────────────
function RomanaExam({ simulare, answers, setAnswer, evaluating, onSubmit }) {
  const wordCount = (answers.essay || "").trim().split(/\s+/).filter(Boolean).length;
  const overLimit = wordCount > simulare.subiectII.lungimeMax;
  const underLimit = wordCount > 0 && wordCount < simulare.subiectII.lungimeMin;

  return (
    <div style={S.page}>
      {/* SUBIECTUL I */}
      <div style={S.examSection}>
        <div style={S.examSectionHeader}>
          <span style={S.examSectionTag}>Subiectul I — 60 puncte</span>
          <span style={S.examSectionTime}>~75 min</span>
        </div>

        {/* Text */}
        <div style={S.textBox}>
          {simulare.subiectI.textTitlu && (
            <div style={S.textTitle}>{simulare.subiectI.textTitlu}</div>
          )}
          {simulare.subiectI.textAutor && (
            <div style={S.textAuthor}>de {simulare.subiectI.textAutor}</div>
          )}
          <div style={S.textBody}>
            {simulare.subiectI.text.split("\n\n").map((p, i) => (
              <p key={i} style={{ margin: "0 0 10px" }}>{p}</p>
            ))}
          </div>
        </div>

        <div style={S.partTag}>A. Înțelegerea textului — 30 puncte</div>
        {simulare.subiectI.parteaA.itemi.map((it, i) => (
          <div key={it.id} style={S.itemBox}>
            <div style={S.itemHeader}>
              <span style={S.itemId}>{it.id}</span>
              <span style={S.itemPts}>{it.punctaj}p</span>
            </div>
            <div style={S.itemCerinta}>{it.cerinta}</div>
            <textarea
              style={S.itemInputShort}
              placeholder="Scrie răspunsul tău..."
              value={answers[it.id] || ""}
              onChange={e => setAnswer(it.id, e.target.value)}
              rows={2}
            />
          </div>
        ))}

        <div style={S.partTag}>B. Limba română — 30 puncte</div>
        {simulare.subiectI.parteaB.itemi.map((it, i) => (
          <div key={it.id} style={S.itemBox}>
            <div style={S.itemHeader}>
              <span style={S.itemId}>{it.id}</span>
              <span style={S.itemPts}>{it.punctaj}p</span>
            </div>
            <div style={S.itemCerinta}>{it.cerinta}</div>
            <textarea
              style={S.itemInputLong}
              placeholder="Scrie răspunsul tău complet..."
              value={answers[it.id] || ""}
              onChange={e => setAnswer(it.id, e.target.value)}
              rows={4}
            />
          </div>
        ))}
      </div>

      {/* SUBIECTUL II */}
      <div style={S.examSection}>
        <div style={S.examSectionHeader}>
          <span style={{ ...S.examSectionTag, background: "#FFF8E7", color: "#744210", borderColor: "#F0D98A" }}>
            Subiectul II — Compunere — 30 puncte
          </span>
          <span style={S.examSectionTime}>~40 min</span>
        </div>

        <div style={S.essayCerinta}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 6, fontWeight: 600 }}>
            Tip: <span style={{ color: "#1A1A1A" }}>{simulare.subiectII.tip}</span> ·
            Lungime: <span style={{ color: "#1A1A1A" }}>{simulare.subiectII.lungimeMin}-{simulare.subiectII.lungimeMax} cuvinte</span>
          </div>
          <div style={S.essayCerintaText}>{simulare.subiectII.cerinta}</div>
        </div>

        <textarea
          style={{ ...S.essayInput, borderColor: overLimit ? "#E8654A" : underLimit ? "#F0D98A" : "#E0DBD0" }}
          placeholder="Scrie compunerea aici..."
          value={answers.essay || ""}
          onChange={e => setAnswer("essay", e.target.value)}
          rows={14}
        />
        <div style={S.wordCounter}>
          <span style={{ color: overLimit ? "#C62828" : underLimit ? "#E65100" : "#888" }}>
            {wordCount} / {simulare.subiectII.lungimeMin}-{simulare.subiectII.lungimeMax} cuvinte
            {overLimit && " · prea lung"}
            {underLimit && " · scurt"}
          </span>
        </div>
      </div>

      <div style={S.submitBar}>
        <button
          style={{ ...S.submitBtn, opacity: evaluating ? 0.5 : 1 }}
          onClick={onSubmit}
          disabled={evaluating}>
          ✓ Trimite simularea
        </button>
      </div>
    </div>
  );
}

// ── MATE EXAM ──────────────────────────────────────────────────────────────
function MateExam({ simulare, answers, setAnswer, evaluating, onSubmit }) {
  return (
    <div style={S.page}>
      {/* SUBIECTUL I */}
      <div style={S.examSection}>
        <div style={S.examSectionHeader}>
          <span style={S.examSectionTag}>Subiectul I — 30 puncte (multiple choice)</span>
          <span style={S.examSectionTime}>~30 min</span>
        </div>
        {simulare.subiectI.itemi.map(it => (
          <McItem key={it.id} item={it} given={answers[it.id]} onChange={v => setAnswer(it.id, v)} />
        ))}
      </div>

      {/* SUBIECTUL II */}
      <div style={S.examSection}>
        <div style={S.examSectionHeader}>
          <span style={S.examSectionTag}>Subiectul II — 30 puncte (multiple choice)</span>
          <span style={S.examSectionTime}>~30 min</span>
        </div>
        {simulare.subiectII.itemi.map(it => (
          <McItem key={it.id} item={it} given={answers[it.id]} onChange={v => setAnswer(it.id, v)} />
        ))}
      </div>

      {/* SUBIECTUL III */}
      <div style={S.examSection}>
        <div style={S.examSectionHeader}>
          <span style={{ ...S.examSectionTag, background: "#FFF8E7", color: "#744210", borderColor: "#F0D98A" }}>
            Subiectul III — 30 puncte (rezolvare scrisă)
          </span>
          <span style={S.examSectionTime}>~50 min</span>
        </div>
        <div style={{ fontSize: 11, color: "#888", marginBottom: 12, fontStyle: "italic" }}>
          Scrie rezolvarea completă pentru fiecare problemă, justificând fiecare pas.
        </div>
        {simulare.subiectIII.probleme.map(p => (
          <div key={p.id} style={S.problemBox}>
            <div style={S.itemHeader}>
              <span style={S.itemId}>Problema {p.id}</span>
              <span style={S.itemPts}>{p.punctaj}p</span>
            </div>
            <div style={S.itemCerinta}>{p.enunt}</div>
            {p.subpuncte && p.subpuncte.length > 0 && (
              <ol style={S.subpuncteList} type="a">
                {p.subpuncte.map(sp => (
                  <li key={sp.id} style={{ marginBottom: 4, fontSize: 13 }}>
                    <strong>{sp.id})</strong> {sp.cerinta}
                    <span style={{ color: "#888", fontSize: 11, marginLeft: 4 }}>({sp.punctaj}p)</span>
                  </li>
                ))}
              </ol>
            )}
            <textarea
              style={S.itemInputXLong}
              placeholder="Scrie rezolvarea aici. Pentru notație: x^2 = x la pătrat, sqrt(2) = radical din 2."
              value={answers[p.id] || ""}
              onChange={e => setAnswer(p.id, e.target.value)}
              rows={10}
            />
          </div>
        ))}
      </div>

      <div style={S.submitBar}>
        <button
          style={{ ...S.submitBtn, opacity: evaluating ? 0.5 : 1 }}
          onClick={onSubmit}
          disabled={evaluating}>
          ✓ Trimite simularea
        </button>
      </div>
    </div>
  );
}

function McItem({ item, given, onChange }) {
  return (
    <div style={S.itemBox}>
      <div style={S.itemHeader}>
        <span style={S.itemId}>{item.id}</span>
        <span style={S.itemPts}>{item.punctaj}p</span>
      </div>
      <div style={S.itemCerinta}>{item.enunt}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
        {item.optiuni.map((opt, i) => {
          const letter = ["A", "B", "C", "D"][i];
          const selected = given === letter;
          return (
            <button
              key={letter}
              onClick={() => onChange(letter)}
              style={{ ...S.mcOption, ...(selected ? S.mcOptionOn : {}) }}>
              <span style={{ ...S.mcLetter, ...(selected ? S.mcLetterOn : {}) }}>{letter}</span>
              <span style={{ flex: 1, textAlign: "left" }}>{opt.replace(/^[A-D]\)\s*/, "")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── RESULTS VIEW ───────────────────────────────────────────────────────────
function ResultsView({ result, simulare, answers, onClose }) {
  const isRo = result.materie === "romana";
  return (
    <div style={S.page}>
      {/* Big score banner */}
      <div style={{ ...S.resultsBanner, background: gradeColor(result.nota) === "#2E7D32" ? "#E8F5E9" : gradeColor(result.nota) === "#C62828" ? "#FFF0EE" : "#FFF8E7" }}>
        <div style={{ fontSize: 48, marginBottom: 4 }}>
          {result.nota >= 9 ? "🏆" : result.nota >= 7 ? "🎯" : result.nota >= 5 ? "💪" : "📚"}
        </div>
        <div style={{ fontSize: 14, color: "#666", marginBottom: 2 }}>Nota ta finală</div>
        <div style={{ fontSize: 48, fontWeight: 800, color: gradeColor(result.nota), fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>
          {result.nota.toFixed(2)}
        </div>
        <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
          {result.totalPuncte} / 100 puncte
        </div>
      </div>

      {/* Subject breakdown */}
      <div style={S.breakdownBox}>
        <div style={S.breakdownTitle}>📋 Punctaj pe subiecte</div>
        <BreakdownRow label="Subiectul I" punctaj={result.subiectI.punctaj} maxim={result.subiectI.maxim} />
        <BreakdownRow label="Subiectul II" punctaj={result.subiectII.punctaj} maxim={result.subiectII.maxim} />
        {!isRo && (
          <BreakdownRow label="Subiectul III" punctaj={result.subiectIII.punctaj} maxim={result.subiectIII.maxim} />
        )}
        <BreakdownRow label="Din oficiu" punctaj={result.punctajOficiu} maxim={10} freebie />
      </div>

      {/* Feedback general */}
      {result.feedbackGeneral && (
        <div style={S.feedbackBox}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 6, fontWeight: 600 }}>💬 FEEDBACK</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: "#1A1A1A" }}>{result.feedbackGeneral}</div>
        </div>
      )}

      {/* Capitole de revăzut */}
      {result.capitoleDeRevazut?.length > 0 && (
        <div style={S.tipsCard}>
          <div style={S.tipsTitle}>📚 De revăzut</div>
          <ul style={S.tipsList}>
            {result.capitoleDeRevazut.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      {/* Detailed: Romana — items + criteria */}
      {isRo && (
        <>
          <div style={S.sectionTitle}>Subiectul I — detalii itemi</div>
          {result.subiectI.itemi.map(it => (
            <ItemReview key={it.id} item={it} answer={answers[it.id]} />
          ))}

          <div style={S.sectionTitle}>Subiectul II — criterii compunere</div>
          {result.subiectII.criterii.map(c => (
            <div key={c.nume} style={S.criterionRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}>{c.nume}</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{c.comentariu}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: c.punctaj === c.maxim ? "#2E7D32" : c.punctaj === 0 ? "#C62828" : "#E65100", fontFamily: "'Syne',sans-serif" }}>
                {c.punctaj}/{c.maxim}
              </div>
            </div>
          ))}
          {result.subiectII.puncteForte?.length > 0 && (
            <div style={S.feedbackBox}>
              <div style={{ fontSize: 12, color: "#2E7D32", marginBottom: 6, fontWeight: 700 }}>✅ PUNCTE FORTE</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {result.subiectII.puncteForte.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {result.subiectII.deImbunatatit?.length > 0 && (
            <div style={S.feedbackBox}>
              <div style={{ fontSize: 12, color: "#E65100", marginBottom: 6, fontWeight: 700 }}>🔧 DE ÎMBUNĂTĂȚIT</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                {result.subiectII.deImbunatatit.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Detailed: Mate — MC items + problems */}
      {!isRo && (
        <>
          <div style={S.sectionTitle}>Subiectul I — Multiple choice</div>
          {result.subiectI.itemi.map(it => (
            <McReview key={it.id} item={it} simItem={simulare.subiectI.itemi.find(s => s.id === it.id)} />
          ))}

          <div style={S.sectionTitle}>Subiectul II — Multiple choice</div>
          {result.subiectII.itemi.map(it => (
            <McReview key={it.id} item={it} simItem={simulare.subiectII.itemi.find(s => s.id === it.id)} />
          ))}

          <div style={S.sectionTitle}>Subiectul III — Probleme</div>
          {result.subiectIII.probleme.map(p => (
            <ProblemReview key={p.id} problem={p} simProblem={simulare.subiectIII.probleme.find(s => s.id === p.id)} />
          ))}
        </>
      )}

      <div style={{ marginTop: 30, marginBottom: 40 }}>
        <button style={S.submitBtn} onClick={onClose}>Înapoi la simulări</button>
      </div>
    </div>
  );
}

function BreakdownRow({ label, punctaj, maxim, freebie }) {
  const pct = maxim > 0 ? (punctaj / maxim) * 100 : 0;
  return (
    <div style={S.breakdownRow}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A" }}>{label}</div>
        <div style={S.miniBar}>
          <div style={{ ...S.miniBarFill, width: `${pct}%`, background: freebie ? "#C8A84B" : pct >= 80 ? "#2E7D32" : pct >= 50 ? "#E65100" : "#C62828" }} />
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Syne',sans-serif", color: "#1A1A1A", minWidth: 56, textAlign: "right" }}>
        {punctaj}/{maxim}
      </div>
    </div>
  );
}

function ItemReview({ item, answer }) {
  const got = item.punctaj || 0;
  const max = item.punctajMaxim || item.maxim || 5;
  const pct = max > 0 ? got / max : 0;
  const color = pct >= 0.8 ? "#2E7D32" : pct >= 0.4 ? "#E65100" : "#C62828";
  return (
    <div style={S.reviewItem}>
      <div style={S.itemHeader}>
        <span style={S.itemId}>{item.id}</span>
        <span style={{ ...S.itemPts, color, fontWeight: 800 }}>{got}/{max}p</span>
      </div>
      {answer && (
        <div style={{ fontSize: 12, color: "#888", marginBottom: 4, fontStyle: "italic" }}>
          Răspunsul tău: "{answer.slice(0, 200)}{answer.length > 200 ? "..." : ""}"
        </div>
      )}
      {!answer && (
        <div style={{ fontSize: 12, color: "#C62828", marginBottom: 4, fontStyle: "italic" }}>
          (Niciun răspuns)
        </div>
      )}
      {item.comentariu && (
        <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>{item.comentariu}</div>
      )}
    </div>
  );
}

function McReview({ item, simItem }) {
  const correct = item.punctaj > 0;
  return (
    <div style={{ ...S.reviewItem, borderLeft: `3px solid ${correct ? "#2E7D32" : "#C62828"}` }}>
      <div style={S.itemHeader}>
        <span style={S.itemId}>{item.id}</span>
        <span style={{ ...S.itemPts, color: correct ? "#2E7D32" : "#C62828", fontWeight: 800 }}>
          {item.punctaj}/{item.punctajMaxim}p
        </span>
      </div>
      {simItem && (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>{simItem.enunt}</div>
      )}
      <div style={{ fontSize: 12, marginTop: 4 }}>
        Răspunsul tău: <strong style={{ color: correct ? "#2E7D32" : "#C62828" }}>{item.raspunsDat || "—"}</strong>
        {!correct && <> · Corect: <strong style={{ color: "#2E7D32" }}>{item.rasspunsCorect}</strong></>}
      </div>
    </div>
  );
}

function ProblemReview({ problem, simProblem }) {
  return (
    <div style={S.reviewItem}>
      <div style={S.itemHeader}>
        <span style={S.itemId}>Problema {problem.id}</span>
        <span style={{ ...S.itemPts, fontWeight: 800, color: gradeColor((problem.punctaj / problem.maxim) * 10) }}>
          {problem.punctaj}/{problem.maxim}p
        </span>
      </div>
      {simProblem && (
        <div style={{ fontSize: 11, color: "#888", marginBottom: 8, fontStyle: "italic" }}>{simProblem.enunt}</div>
      )}
      {(problem.subpuncte || []).map(sp => (
        <div key={sp.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #F0EDE6", fontSize: 12 }}>
          <span><strong>{sp.id})</strong> {sp.comentariu}</span>
          <span style={{ fontWeight: 700, color: sp.punctaj === sp.punctajMaxim ? "#2E7D32" : sp.punctaj === 0 ? "#C62828" : "#E65100" }}>
            {sp.punctaj}/{sp.punctajMaxim}
          </span>
        </div>
      ))}
      {problem.comentariu && (
        <div style={{ fontSize: 12, color: "#444", marginTop: 8, fontStyle: "italic" }}>
          💬 {problem.comentariu}
        </div>
      )}
      {problem.primulPasGresit && (
        <div style={{ fontSize: 12, color: "#E65100", marginTop: 6 }}>
          🔍 Primul pas greșit: {problem.primulPasGresit}
        </div>
      )}
    </div>
  );
}

// ── CONFIRM MODAL ──────────────────────────────────────────────────────────
function ConfirmModal({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.modalTitle}>{title}</div>
        <div style={S.modalBody}>{body}</div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button style={S.btnCancel} onClick={onCancel}>{cancelLabel}</button>
          <button style={S.btnConfirm} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── STYLES ─────────────────────────────────────────────────────────────────
const S = {
  shell:        { background: "#F0EDE6", minHeight: "100vh", fontFamily: "'Inter',sans-serif" },
  header:       { background: "#1A1A1A", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, position: "sticky", top: 0, zIndex: 100 },
  backBtn:      { background: "none", border: "1px solid #555", color: "#fff", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap" },
  headerTitle:  { color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Syne',sans-serif", display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "center" },
  subjectChip:  { fontSize: 10, padding: "2px 8px", borderRadius: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif" },
  timer:        { display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, border: "1px solid", cursor: "pointer", fontFamily: "'Inter',sans-serif" },
  main:         { padding: "16px 14px 80px", maxWidth: 720, margin: "0 auto" },
  page:         { display: "flex", flexDirection: "column", gap: 16 },

  // Intro
  heroCard:     { background: "linear-gradient(135deg, #fff 0%, #FFF8E7 100%)", borderRadius: 16, padding: "26px 20px", textAlign: "center", border: "1px solid #E0DBD0" },
  heroTitle:    { fontSize: 22, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif", marginBottom: 6 },
  heroSub:      { fontSize: 13, color: "#666", lineHeight: 1.6 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 8, marginBottom: 8 },
  subjectCard:  { display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 14, border: "2px solid", cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "'Inter',sans-serif" },
  subjectCardLeft: { flexShrink: 0 },
  subjectCardTitle: { fontSize: 15, fontWeight: 800, fontFamily: "'Syne',sans-serif" },
  subjectCardSub:{ fontSize: 11, color: "#666", marginTop: 3 },
  lastResult:   { fontSize: 11, color: "#888", marginTop: 6 },
  tipsCard:     { background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #E0DBD0" },
  tipsTitle:    { fontSize: 13, fontWeight: 700, marginBottom: 8, fontFamily: "'Syne',sans-serif" },
  tipsList:     { margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.7, color: "#444" },
  errorBox:     { background: "#FFF0EE", border: "1px solid #FFCDD2", borderRadius: 10, padding: "10px 14px" },
  loadingBox:   { background: "#fff", borderRadius: 14, padding: "30px 20px", textAlign: "center", border: "1px solid #E0DBD0" },
  loadingSpinner:{ width: 32, height: 32, border: "3px solid #E0DBD0", borderTop: "3px solid #C8A84B", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "16px auto 0" },
  historyRow:   { display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 10, padding: "10px 14px", border: "1px solid #E0DBD0" },

  // Exam
  examSection:    { background: "#fff", borderRadius: 14, padding: "16px 16px", border: "1px solid #E0DBD0" },
  examSectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  examSectionTag: { fontSize: 12, fontWeight: 800, padding: "4px 10px", borderRadius: 10, background: "#F8F6F2", color: "#1A1A1A", border: "1px solid #E0DBD0", fontFamily: "'Syne',sans-serif" },
  examSectionTime:{ fontSize: 11, color: "#888", fontStyle: "italic" },
  textBox:      { background: "#FAF8F2", borderRadius: 10, padding: "14px 16px", marginBottom: 16, border: "1px solid #E8E4DC" },
  textTitle:    { fontSize: 14, fontWeight: 800, color: "#1A1A1A", textAlign: "center", marginBottom: 4, fontFamily: "'Syne',sans-serif" },
  textAuthor:   { fontSize: 11, color: "#888", textAlign: "center", fontStyle: "italic", marginBottom: 12 },
  textBody:     { fontSize: 14, lineHeight: 1.7, color: "#1A1A1A", fontFamily: "Georgia, 'Inter', serif" },
  partTag:      { fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "0.4px", marginTop: 18, marginBottom: 8, paddingTop: 8, borderTop: "1px dashed #E0DBD0" },
  itemBox:      { background: "#FCFAF6", borderRadius: 10, padding: 12, marginBottom: 10, border: "1px solid #ECE7DC" },
  itemHeader:   { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  itemId:       { fontSize: 11, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif", background: "#fff", padding: "2px 8px", borderRadius: 6, border: "1px solid #E0DBD0" },
  itemPts:      { fontSize: 11, color: "#888", fontWeight: 600 },
  itemCerinta:  { fontSize: 13, color: "#1A1A1A", lineHeight: 1.5, marginBottom: 8 },
  itemInputShort:{ width: "100%", background: "#fff", border: "1px solid #E0DBD0", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "'Inter',sans-serif", outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 50 },
  itemInputLong: { width: "100%", background: "#fff", border: "1px solid #E0DBD0", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "'Inter',sans-serif", outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 90 },
  itemInputXLong:{ width: "100%", background: "#fff", border: "1px solid #E0DBD0", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "'Inter',sans-serif", outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 200, lineHeight: 1.6 },
  essayCerinta: { background: "#FFF8E7", borderRadius: 10, padding: 12, marginBottom: 12, border: "1px solid #F0D98A" },
  essayCerintaText:{ fontSize: 13, color: "#1A1A1A", lineHeight: 1.5 },
  essayInput:   { width: "100%", background: "#fff", border: "1px solid", borderRadius: 10, padding: "12px 14px", fontSize: 14, fontFamily: "Georgia, 'Inter', serif", lineHeight: 1.7, outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: 280 },
  wordCounter:  { fontSize: 11, marginTop: 6, textAlign: "right", fontWeight: 600, fontFamily: "'Inter',sans-serif" },
  problemBox:   { background: "#FCFAF6", borderRadius: 10, padding: 14, marginBottom: 12, border: "1px solid #ECE7DC" },
  subpuncteList:{ paddingLeft: 22, margin: "8px 0", color: "#444" },

  mcOption:     { display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #E0DBD0", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13, fontFamily: "'Inter',sans-serif", textAlign: "left", color: "#1A1A1A" },
  mcOptionOn:   { background: "#1A1A1A", color: "#fff", borderColor: "#1A1A1A" },
  mcLetter:     { width: 24, height: 24, borderRadius: "50%", background: "#F0EDE6", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, fontFamily: "'Syne',sans-serif", flexShrink: 0 },
  mcLetterOn:   { background: "#C8A84B", color: "#1A1A1A" },

  submitBar:    { padding: "20px 0 12px" },
  submitBtn:    { background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 12, padding: "14px 24px", fontSize: 14, fontWeight: 800, cursor: "pointer", width: "100%", fontFamily: "'Syne',sans-serif" },

  // Results
  resultsBanner:{ borderRadius: 16, padding: "26px 20px", textAlign: "center", border: "1px solid #E0DBD0" },
  breakdownBox: { background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #E0DBD0" },
  breakdownTitle:{ fontSize: 13, fontWeight: 700, color: "#1A1A1A", marginBottom: 12, fontFamily: "'Syne',sans-serif" },
  breakdownRow: { display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #F0EDE6" },
  miniBar:      { height: 5, background: "#F0EDE6", borderRadius: 3, marginTop: 4, overflow: "hidden" },
  miniBarFill:  { height: "100%", borderRadius: 3 },
  feedbackBox:  { background: "#FCFAF6", borderRadius: 12, padding: "12px 14px", border: "1px solid #ECE7DC" },
  reviewItem:   { background: "#fff", borderRadius: 10, padding: 12, marginBottom: 8, border: "1px solid #E0DBD0" },
  criterionRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#fff", borderRadius: 10, marginBottom: 6, border: "1px solid #E0DBD0" },

  // Modal
  overlay:      { position: "fixed", inset: 0, background: "rgba(20,18,14,0.65)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal:        { background: "#fff", borderRadius: 16, padding: 22, width: "100%", maxWidth: 360 },
  modalTitle:   { fontSize: 17, fontWeight: 800, color: "#1A1A1A", marginBottom: 8, fontFamily: "'Syne',sans-serif" },
  modalBody:    { fontSize: 13, color: "#666", lineHeight: 1.6 },
  btnCancel:    { flex: 1, background: "#F0EDE6", color: "#666", border: "none", borderRadius: 10, padding: "11px", cursor: "pointer", fontSize: 13, fontFamily: "'Inter',sans-serif", fontWeight: 600 },
  btnConfirm:   { flex: 1, background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 10, padding: "11px", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "'Syne',sans-serif" },

  // Eval overlay
  evalOverlay:  { position: "fixed", inset: 0, background: "rgba(20,18,14,0.85)", zIndex: 1500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  evalBox:      { background: "#fff", borderRadius: 16, padding: "28px 24px", textAlign: "center", maxWidth: 320 },
  evalSpinner:  { width: 32, height: 32, border: "3px solid #E0DBD0", borderTop: "3px solid #C8A84B", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "18px auto 0" },
};
