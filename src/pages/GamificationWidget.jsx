import { useState, useEffect } from "react";
import {
  getGamState, getLevel, getNextLevel, getLevelProgress,
  BADGES, LEVELS, clearNewBadges,
} from "../utils/gamification.js";

export default function GamificationWidget({ onClose }) {
  const [state, setState]   = useState(getGamState());
  const [tab, setTab]       = useState("overview"); // overview | badges | log
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const s = getGamState();
    setState(s);
    if (s.newBadges && s.newBadges.length > 0) {
      setShowNew(true);
      setTimeout(() => { clearNewBadges(); }, 3000);
    }
  }, []);

  const level    = getLevel(state.totalXP || 0);
  const nextLvl  = getNextLevel(state.totalXP || 0);
  const lvlPct   = getLevelProgress(state.totalXP || 0);
  const unlocked = (state.unlockedBadges || []);
  const newB     = (state.newBadges || []);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.panel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={S.panelHeader}>
          <div style={S.panelTitle}>⚡ Progresul tău</div>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Level card */}
        <div style={S.levelCard}>
          <div style={S.levelLeft}>
            <div style={S.levelIcon}>{level.icon}</div>
            <div>
              <div style={S.levelName}>{level.name}</div>
              <div style={S.levelNum}>Nivel {level.level}</div>
            </div>
          </div>
          <div style={S.xpBig}>
            <div style={S.xpNum}>{state.totalXP || 0}</div>
            <div style={S.xpLabel}>XP total</div>
          </div>
        </div>

        {/* XP progress to next level */}
        {nextLvl && (
          <div style={S.lvlProgress}>
            <div style={S.lvlProgressTop}>
              <span style={S.lvlProgressLabel}>Spre {nextLvl.icon} {nextLvl.name}</span>
              <span style={S.lvlProgressPct}>{lvlPct}%</span>
            </div>
            <div style={S.lvlBarBg}>
              <div style={{ ...S.lvlBarFill, width: `${lvlPct}%` }} />
            </div>
            <div style={S.lvlXpLeft}>{nextLvl.minXP - (state.totalXP || 0)} XP rămași</div>
          </div>
        )}

        {/* Stats row */}
        <div style={S.statsRow}>
          <Stat icon="🔥" value={state.currentStreak || 0} label="Streak zile" highlight={state.currentStreak >= 3} />
          <Stat icon="⚡" value={state.maxStreak || 0} label="Record streak" />
          <Stat icon="🧠" value={state.quizzesPassed || 0} label="Quiz-uri trecute" />
          <Stat icon="💎" value={state.perfectQuizzes || 0} label="Scoruri 10/10" />
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          {[["overview","🎯","Overview"],["badges","🏅","Badges"],["log","📋","XP Log"]].map(([id,icon,label]) => (
            <button key={id} style={{ ...S.tabBtn, ...(tab===id?S.tabBtnOn:{}) }} onClick={() => setTab(id)}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={S.tabContent}>

          {tab === "overview" && (
            <div>
              {/* Streak visual */}
              <div style={S.streakCard}>
                <div style={S.streakTitle}>🔥 Streak curent: {state.currentStreak || 0} zile</div>
                <div style={S.streakDots}>
                  {Array.from({ length: 7 }, (_, i) => {
                    const active = i < (state.currentStreak || 0) % 8;
                    return (
                      <div key={i} style={{ ...S.streakDot, background: active ? "#C8A84B" : "#E8E4DC", transform: active ? "scale(1.15)" : "scale(1)" }}>
                        {active ? "🔥" : "·"}
                      </div>
                    );
                  })}
                </div>
                <div style={S.streakSub}>
                  {state.currentStreak >= 7 ? "⚡ O săptămână întreagă! Ești legendă!" :
                   state.currentStreak >= 3 ? "🔥 Ești în flăcări! Continuă!" :
                   state.currentStreak >= 1 ? `Mai ${3 - state.currentStreak} zile până la badge-ul 🔥` :
                   "Studiază azi ca să pornești streak-ul!"}
                </div>
              </div>

              {/* Next badge to unlock */}
              <div style={S.sectionTitle}>🎯 Următorul badge</div>
              {(() => {
                const next = BADGES.find(b => !unlocked.includes(b.id));
                if (!next) return <div style={S.empty}>Ai deblocat toate badge-urile! 🏆</div>;
                return (
                  <div style={S.nextBadge}>
                    <div style={S.nextBadgeIcon}>{next.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={S.nextBadgeName}>{next.name}</div>
                      <div style={S.nextBadgeDesc}>{next.desc}</div>
                    </div>
                    {next.xpReward > 0 && <div style={S.xpReward}>+{next.xpReward} XP</div>}
                  </div>
                );
              })()}

              {/* Recent XP */}
              <div style={S.sectionTitle}>⚡ Ultimele XP câștigate</div>
              {(state.xpLog || []).slice(0, 5).map((entry, i) => (
                <div key={i} style={S.xpEntry}>
                  <span style={S.xpEntryText}>{entry.reason}</span>
                  <span style={S.xpEntryAmount}>+{entry.amount}</span>
                </div>
              ))}
            </div>
          )}

          {tab === "badges" && (
            <div>
              <div style={S.badgesGrid}>
                {BADGES.map(badge => {
                  const earned = unlocked.includes(badge.id);
                  const isNew  = newB.includes(badge.id);
                  return (
                    <div key={badge.id} style={{ ...S.badgeCard, ...(earned ? S.badgeCardEarned : {}), ...(isNew ? S.badgeCardNew : {}) }}>
                      <div style={{ ...S.badgeIcon, opacity: earned ? 1 : 0.25 }}>{badge.icon}</div>
                      <div style={{ ...S.badgeName, color: earned ? "#1A1A1A" : "#BBB" }}>{badge.name}</div>
                      <div style={{ ...S.badgeDesc, color: earned ? "#555" : "#CCC" }}>{badge.desc}</div>
                      {badge.xpReward > 0 && earned && <div style={S.badgeXp}>+{badge.xpReward} XP</div>}
                      {!earned && <div style={S.badgeLock}>🔒</div>}
                      {isNew && <div style={S.newPill}>NOU!</div>}
                    </div>
                  );
                })}
              </div>
              <div style={S.badgeCount}>{unlocked.length} / {BADGES.length} badge-uri deblocate</div>
            </div>
          )}

          {tab === "log" && (
            <div>
              {(state.xpLog || []).length === 0
                ? <div style={S.empty}>Nicio activitate înregistrată. Hai să studiem!</div>
                : (state.xpLog || []).map((entry, i) => (
                  <div key={i} style={S.logRow}>
                    <div style={S.logText}>{entry.reason}</div>
                    <div style={S.logMeta}>
                      <span style={S.logXp}>+{entry.amount} XP</span>
                      <span style={S.logTime}>{new Date(entry.ts).toLocaleDateString("ro-RO", { day: "numeric", month: "short" })}</span>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

        </div>
      </div>

      {/* New badge popup */}
      {showNew && newB.length > 0 && (
        <div style={S.badgePopup}>
          {newB.map(bid => {
            const b = BADGES.find(x => x.id === bid);
            if (!b) return null;
            return (
              <div key={bid} style={S.badgePopupInner}>
                <div style={{ fontSize: 36 }}>{b.icon}</div>
                <div style={S.badgePopupTitle}>Badge deblocat!</div>
                <div style={S.badgePopupName}>{b.name}</div>
                <div style={S.badgePopupDesc}>{b.desc}</div>
              </div>
            );
          })}
        </div>
      )}

      <style>{CSS}</style>
    </div>
  );
}

function Stat({ icon, value, label, highlight }) {
  return (
    <div style={{ ...S.stat, background: highlight ? "#FFF8E7" : "#F8F6F2", border: `1px solid ${highlight ? "#F0D98A" : "#E0DBD0"}` }}>
      <div style={S.statIcon}>{icon}</div>
      <div style={{ ...S.statValue, color: highlight ? "#C8A84B" : "#1A1A1A" }}>{value}</div>
      <div style={S.statLabel}>{label}</div>
    </div>
  );
}

const S = {
  overlay: { position: "fixed", inset: 0, background: "rgba(20,18,14,0.55)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  panel: { background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 540, maxHeight: "88vh", overflowY: "auto", padding: "0 0 32px" },

  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px 12px", borderBottom: "2px solid #F0EDE6", position: "sticky", top: 0, background: "#fff", zIndex: 10 },
  panelTitle: { fontSize: 17, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },
  closeBtn: { background: "none", border: "none", fontSize: 18, color: "#AAA", cursor: "pointer", padding: 4 },

  levelCard: { margin: "14px 16px 0", background: "#1A1A1A", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  levelLeft: { display: "flex", alignItems: "center", gap: 12 },
  levelIcon: { fontSize: 36 },
  levelName: { fontSize: 16, fontWeight: 800, color: "#C8A84B", fontFamily: "'Syne',sans-serif" },
  levelNum: { fontSize: 12, color: "#888", fontFamily: "'Inter',sans-serif", marginTop: 2 },
  xpBig: { textAlign: "right" },
  xpNum: { fontSize: 28, fontWeight: 800, color: "#fff", fontFamily: "'Syne',sans-serif", lineHeight: 1 },
  xpLabel: { fontSize: 11, color: "#888", fontFamily: "'Inter',sans-serif", marginTop: 2 },

  lvlProgress: { margin: "10px 16px 0" },
  lvlProgressTop: { display: "flex", justifyContent: "space-between", marginBottom: 5 },
  lvlProgressLabel: { fontSize: 11, color: "#888", fontFamily: "'Inter',sans-serif" },
  lvlProgressPct: { fontSize: 11, color: "#C8A84B", fontWeight: 700, fontFamily: "'Inter',sans-serif" },
  lvlBarBg: { height: 8, background: "#F0EDE6", borderRadius: 4, overflow: "hidden" },
  lvlBarFill: { height: "100%", background: "linear-gradient(90deg, #C8A84B, #E8C96A)", borderRadius: 4, transition: "width 1s cubic-bezier(.4,0,.2,1)" },
  lvlXpLeft: { fontSize: 10, color: "#BBB", fontFamily: "'Inter',sans-serif", marginTop: 3 },

  statsRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, margin: "12px 16px 0" },
  stat: { borderRadius: 10, padding: "10px 6px", textAlign: "center" },
  statIcon: { fontSize: 16, marginBottom: 3 },
  statValue: { fontSize: 18, fontWeight: 800, fontFamily: "'Syne',sans-serif", lineHeight: 1 },
  statLabel: { fontSize: 9, color: "#AAA", fontFamily: "'Inter',sans-serif", marginTop: 2, lineHeight: 1.2 },

  tabs: { display: "flex", gap: 6, margin: "14px 16px 0" },
  tabBtn: { flex: 1, background: "#F0EDE6", border: "none", borderRadius: 8, padding: "8px 4px", cursor: "pointer", fontSize: 11, fontFamily: "'Inter',sans-serif", color: "#888", fontWeight: 600 },
  tabBtnOn: { background: "#1A1A1A", color: "#fff" },
  tabContent: { padding: "14px 16px 0" },

  streakCard: { background: "#FFF8E7", borderRadius: 12, padding: "14px 16px", marginBottom: 14, border: "1px solid #F0D98A" },
  streakTitle: { fontSize: 13, fontWeight: 700, color: "#7A5C00", fontFamily: "'Syne',sans-serif", marginBottom: 10 },
  streakDots: { display: "flex", gap: 6, marginBottom: 8 },
  streakDot: { width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, transition: "all .3s", fontWeight: 700 },
  streakSub: { fontSize: 12, color: "#7A5C00", fontFamily: "'Inter',sans-serif", fontStyle: "italic" },

  sectionTitle: { fontSize: 12, fontWeight: 700, color: "#999", fontFamily: "'Inter',sans-serif", textTransform: "uppercase", letterSpacing: "0.5px", margin: "14px 0 8px" },

  nextBadge: { background: "#F8F6F2", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, border: "1px solid #E0DBD0", marginBottom: 14 },
  nextBadgeIcon: { fontSize: 32, flexShrink: 0 },
  nextBadgeName: { fontSize: 14, fontWeight: 700, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },
  nextBadgeDesc: { fontSize: 12, color: "#777", fontFamily: "'Inter',sans-serif", marginTop: 2 },
  xpReward: { fontSize: 12, fontWeight: 700, color: "#C8A84B", fontFamily: "'Syne',sans-serif", background: "#FFF8E7", padding: "3px 8px", borderRadius: 8, border: "1px solid #F0D98A", flexShrink: 0 },

  xpEntry: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #F0EDE6" },
  xpEntryText: { fontSize: 12, color: "#333", fontFamily: "'Inter',sans-serif" },
  xpEntryAmount: { fontSize: 12, fontWeight: 700, color: "#C8A84B", fontFamily: "'Syne',sans-serif" },

  badgesGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 },
  badgeCard: { background: "#F8F6F2", borderRadius: 12, padding: "12px 8px", textAlign: "center", border: "1px solid #E0DBD0", position: "relative", transition: "all .2s" },
  badgeCardEarned: { background: "#fff", border: "1px solid #C8A84B", boxShadow: "0 2px 8px rgba(200,168,75,.15)" },
  badgeCardNew: { border: "2px solid #C8A84B", boxShadow: "0 0 16px rgba(200,168,75,.3)" },
  badgeIcon: { fontSize: 28, marginBottom: 6 },
  badgeName: { fontSize: 11, fontWeight: 700, fontFamily: "'Syne',sans-serif", marginBottom: 3 },
  badgeDesc: { fontSize: 9, fontFamily: "'Inter',sans-serif", lineHeight: 1.4 },
  badgeXp: { fontSize: 10, color: "#C8A84B", fontWeight: 700, marginTop: 4, fontFamily: "'Syne',sans-serif" },
  badgeLock: { fontSize: 12, position: "absolute", top: 6, right: 6 },
  newPill: { position: "absolute", top: -6, right: -6, background: "#C8392B", color: "#fff", fontSize: 8, fontWeight: 800, padding: "2px 6px", borderRadius: 10, fontFamily: "'Inter',sans-serif" },
  badgeCount: { textAlign: "center", fontSize: 12, color: "#AAA", fontFamily: "'Inter',sans-serif", marginTop: 8 },

  logRow: { padding: "8px 0", borderBottom: "1px solid #F0EDE6" },
  logText: { fontSize: 12, color: "#333", fontFamily: "'Inter',sans-serif", marginBottom: 3 },
  logMeta: { display: "flex", gap: 10, alignItems: "center" },
  logXp: { fontSize: 11, fontWeight: 700, color: "#C8A84B", fontFamily: "'Syne',sans-serif" },
  logTime: { fontSize: 10, color: "#BBB", fontFamily: "'Inter',sans-serif" },

  empty: { textAlign: "center", color: "#BBB", fontStyle: "italic", fontSize: 13, padding: "20px 0", fontFamily: "'Inter',sans-serif" },

  badgePopup: { position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)", zIndex: 500, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none" },
  badgePopupInner: { background: "#1A1A1A", borderRadius: 16, padding: "16px 20px", textAlign: "center", boxShadow: "0 8px 32px rgba(0,0,0,.3)", minWidth: 200, animation: "popIn .4s cubic-bezier(.34,1.56,.64,1)" },
  badgePopupTitle: { fontSize: 11, color: "#C8A84B", fontWeight: 700, fontFamily: "'Inter',sans-serif", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 8 },
  badgePopupName: { fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: "'Syne',sans-serif", margin: "4px 0" },
  badgePopupDesc: { fontSize: 12, color: "#888", fontFamily: "'Inter',sans-serif" },
};

const CSS = `
  @keyframes popIn { from { transform: scale(0.5); opacity:0; } to { transform: scale(1); opacity:1; } }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #E0DBD0; border-radius: 2px; }
`;
