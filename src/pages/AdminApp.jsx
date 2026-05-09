import { useState, useEffect } from "react";
import { sendEmail } from "../utils/api.js";
import { SUBJECTS, WEEKS, WEEKLY_PLAN, EXAM_ROMANA, EXAM_MATH, fmt, daysLeft, getWeekStatus, CONFIG } from "../constants.js";
import { reminderEmailHtml, chapterUnlockEmailHtml } from "../utils/emailTemplates.js";

// Admin secret removed from frontend — validated server-side
const ALL_CHAPTERS = [
  ...SUBJECTS.romana.chapters.map(c => ({ ...c, subject: "romana" })),
  ...SUBJECTS.matematica.chapters.map(c => ({ ...c, subject: "matematica" })),
];

async function apiFetch(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${sessionStorage.getItem("en2026_admin_token") || ""}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export default function AdminApp({ onLogout }) {
  const [view, setView]               = useState("overview");
  const [toast, setToast]             = useState(null);
  const [sending, setSending]         = useState(false);
  const [manualMsg, setManualMsg]     = useState("");
  const [manualTarget, setManualTarget] = useState("");

  // Users
  const [users, setUsers]             = useState([]);
  const [usersLoading, setUsersLoad]  = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Selected user detail
  const [userDetail, setUserDetail]   = useState(null);
  const [userLogs, setUserLogs]       = useState([]);
  const [userLogsDay, setUserLogsDay] = useState(new Date().toISOString().slice(0, 10));
  const [detailLoading, setDetailLoad] = useState(false);
  const [expandedLog, setExpandedLog] = useState({});

  // Usage & management
  const [userUsage, setUserUsage]     = useState(null);
  const [mgmtLoading, setMgmtLoading] = useState(false);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  // Load users list
  async function loadUsers() {
    setUsersLoad(true);
    try {
      const data = await apiFetch("/api/admin-users?mode=list");
      setUsers(data.users || []);
    } catch (e) { showToast("❌ Eroare la încărcarea utilizatorilor"); }
    setUsersLoad(false);
  }

  useEffect(() => { loadUsers(); }, []);

  // Load detail when user selected. Pass forceRefresh=true to reload even when re-clicking same user.
  async function selectUser(u, forceRefresh = false) {
    // Re-clicking the same user with data already loaded: just switch view (cheap)
    if (!forceRefresh && selectedUser?.userId === u.userId && userDetail) {
      setView("detail");
      return;
    }
    setSelectedUser(u);
    setUserDetail(null);
    setUserLogs([]);
    setUserUsage(null);
    setDetailLoad(true);
    setView("detail");
    loadUserUsage(u.userId);
    try {
      const [detail, logs] = await Promise.all([
        apiFetch(`/api/admin-users?mode=user&uid=${u.userId}`),
        apiFetch(`/api/admin-users?mode=logs&uid=${u.userId}&day=${userLogsDay}`),
      ]);
      setUserDetail(detail);
      setUserLogs(logs.logs || []);
    } catch (e) { showToast("❌ Eroare la încărcarea detaliilor"); }
    setDetailLoad(false);
  }

  async function loadUserLogs(day) {
    setUserLogsDay(day);
    if (!selectedUser) return;
    try {
      const data = await apiFetch(`/api/admin-users?mode=logs&uid=${selectedUser.userId}&day=${day}`);
      setUserLogs(data.logs || []);
    } catch {}
  }

  async function loadUserUsage(userId) {
    try {
      const data = await apiFetch(`/api/admin-users?mode=usage&uid=${userId}`);
      setUserUsage(data.usage || null);
    } catch { setUserUsage(null); }
  }

  async function blockUser(userId, blocked) {
    setMgmtLoading(true);
    try {
      await apiFetch("/api/admin-users?mode=block", {
        method: "POST",
        body: JSON.stringify({ userId, blocked }),
      });
      await loadUsers();
      showToast(blocked ? "🚫 User blocat" : "✅ User deblocat");
    } catch { showToast("❌ Eroare"); }
    setMgmtLoading(false);
  }

  async function resetUsage(userId) {
    if (!confirm("Resetezi toate contoarele de interacțiuni AI pentru acest user?")) return;
    setMgmtLoading(true);
    try {
      await apiFetch("/api/admin-users?mode=reset-usage", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await loadUserUsage(userId);
      showToast("🔄 Contoare resetate");
    } catch { showToast("❌ Eroare"); }
    setMgmtLoading(false);
  }

  async function grantPremium(userId) {
    if (!confirm("Acorzi acces premium gratuit acestui user?")) return;
    setMgmtLoading(true);
    try {
      await apiFetch("/api/admin-users?mode=grant-premium", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await loadUsers();
      showToast("⭐ Acces premium acordat");
    } catch { showToast("❌ Eroare"); }
    setMgmtLoading(false);
  }

  async function overrideChapter(userId, chapterId, value) {
    try {
      await apiFetch("/api/admin-users?mode=override", {
        method: "POST",
        body: JSON.stringify({ userId, chapterId, value }),
      });
      // Refresh detail
      const detail = await apiFetch(`/api/admin-users?mode=user&uid=${userId}`);
      setUserDetail(detail);
      showToast(value ? `✅ ${chapterId} bifat manual` : `↩️ ${chapterId} anulat`);
    } catch { showToast("❌ Eroare la override"); }
  }

  // Email functions
  async function sendReminder() {
    if (!manualTarget) { showToast("⚠️ Introdu un email destinatar"); return; }
    setSending(true);
    const curWeek = WEEKS.find(w => getWeekStatus(w) === "current") || WEEKS[0];
    const html = reminderEmailHtml({
      studentName: manualTarget.split("@")[0],
      weekLabel: curWeek.label,
      weekStart: fmt(curWeek.start),
      weekEnd: fmt(curWeek.end),
      doneChapters: 0, totalChapters: 15,
      doneRomana: 0, totalRomana: 7,
      doneMate: 0, totalMate: 8,
      chaptersThisWeek: (WEEKLY_PLAN[curWeek.id] || []).map(c => ({ title: c.title, subject: c.subject, done: false })),
      daysToRo: daysLeft(EXAM_ROMANA),
      daysToMa: daysLeft(EXAM_MATH),
      appUrl: window.location.origin,
      personalMessage: manualMsg,
    });
    const res = await sendEmail({ to: [manualTarget], subject: `📚 Reminder studiu – ${curWeek.label} · EN 2026`, html });
    setSending(false);
    showToast(res.ok ? "✅ Email trimis!" : "❌ Eroare la trimitere");
  }

  async function sendManualMessage() {
    if (!manualTarget || !manualMsg.trim()) { showToast("⚠️ Completează destinatarul și mesajul"); return; }
    setSending(true);
    const html = `<div style="background:#F0EDE6;font-family:Georgia,serif;padding:32px;max-width:500px;margin:0 auto;"><div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #E0DBD0;"><h2 style="color:#C8A84B;font-size:18px;margin:0 0 16px;">✉️ Mesaj de la Admin</h2><p style="font-size:14px;color:#333;line-height:1.7;">${manualMsg.replace(/\n/g, "<br/>")}</p><hr style="border:none;border-top:1px solid #E0DBD0;margin:16px 0;"><a href="${window.location.origin}" style="display:inline-block;background:#1A1A1A;color:#fff;padding:11px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px;">Deschide aplicația →</a></div></div>`;
    const res = await sendEmail({ to: [manualTarget], subject: "✉️ Mesaj de la administrator EN 2026", html });
    setSending(false);
    showToast(res.ok ? "✅ Mesaj trimis!" : "❌ Eroare");
  }

  // ── NAV TABS ────────────────────────────────────────────────────────────────
  const navItems = [
    { id: "overview", icon: "📊", label: "Overview" },
    { id: "users",    icon: "👥", label: "Elevi" },
    { id: "detail",   icon: "📋", label: "Detaliu", disabled: !selectedUser },
    { id: "email",    icon: "✉️",  label: "Email" },
  ];

  return (
    <div style={S.shell}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.logo}>Admin <span style={{ color: "#C8A84B" }}>EN'26</span></div>
          <div style={S.logoSub}>Panou administrare</div>
        </div>
        <button style={S.logoutBtn} onClick={onLogout}>Ieșire</button>
      </div>

      {/* Nav */}
      <div style={S.nav}>
        {navItems.map(n => (
          <button key={n.id}
            style={{ ...S.navBtn, ...(view === n.id ? S.navBtnOn : {}), ...(n.disabled ? { opacity: 0.4, cursor: "default" } : {}) }}
            onClick={() => !n.disabled && setView(n.id)}>
            {n.icon} {n.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={S.body}>

        {/* ── OVERVIEW ── */}
        {view === "overview" && (
          <div>
            <div style={S.sectionTitle}>Rezumat general</div>
            {usersLoading && users.length === 0 ? (
              <div style={S.loading}>Se încarcă elevii…</div>
            ) : (
              <>
                <div style={S.kpiRow}>
                  <Kpi label="Elevi înregistrați" value={users.length} icon="👥" />
                  <Kpi label="Activi azi" value={users.filter(u => u.stats?.lastStudyDate === new Date().toISOString().slice(0,10)).length} icon="🔥" />
                  <Kpi label="Capitole bifate" value={users.reduce((a, u) => a + (u.stats?.unlockedChapters || 0), 0)} icon="✅" />
                  <Kpi label="XP total" value={users.reduce((a, u) => a + (u.stats?.totalXP || 0), 0)} icon="⚡" />
                </div>

                {/* Secondary signals */}
                {(() => {
                  const now = Date.now();
                  const D = 86400000;
                  const active7d = users.filter(u => {
                    const t = u.stats?.lastActiveAt ? new Date(u.stats.lastActiveAt).getTime() : 0;
                    return t && (now - t) < 7 * D;
                  }).length;
                  const stuckUsers = users.filter(u => {
                    const t = u.stats?.lastActiveAt ? new Date(u.stats.lastActiveAt).getTime() : 0;
                    return t && (now - t) > 3 * D && (u.stats?.unlockedChapters || 0) < 15;
                  });
                  const totalSim = users.reduce((a, u) => a + (u.stats?.simRoCompleted || 0) + (u.stats?.simMaCompleted || 0), 0);
                  const totalQuizzes = users.reduce((a, u) => a + (u.stats?.quizzesPassed || 0), 0);
                  return (
                    <>
                      <div style={S.kpiRow}>
                        <Kpi label="Activi 7 zile" value={active7d} icon="📈" />
                        <Kpi label="Quiz-uri trecute" value={totalQuizzes} icon="🧠" />
                        <Kpi label="Simulări finalizate" value={totalSim} icon="🎓" />
                        <Kpi label="Stuck (3+ zile)" value={stuckUsers.length} icon="⚠️" />
                      </div>
                      {stuckUsers.length > 0 && (
                        <>
                          <div style={S.sectionTitle}>⚠️ Elevi inactivi (3+ zile)</div>
                          {stuckUsers.slice(0, 5).map(u => (
                            <UserRow key={u.userId} u={u} onClick={() => selectUser(u)} compact />
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}

                <div style={S.sectionTitle}>Clasament (după activitate)</div>
                {users.length === 0
                  ? <div style={S.empty}>Nu există elevi înregistrați încă.</div>
                  : users.map(u => (
                      <UserRow key={u.userId} u={u} onClick={() => selectUser(u)} />
                    ))
                }
              </>
            )}
          </div>
        )}

        {/* ── USERS LIST ── */}
        {view === "users" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={S.sectionTitle}>Elevi înregistrați ({users.length})</div>
              <button style={S.btnSmall} onClick={loadUsers}>{usersLoading ? "..." : "🔄 Reîncarcă"}</button>
            </div>
            {usersLoading && users.length === 0 && <div style={S.loading}>Se încarcă elevii…</div>}
            {!usersLoading && users.length === 0 && <div style={S.empty}>Nu există elevi înregistrați încă.</div>}
            {users.map(u => (
              <div key={u.userId} style={{ ...S.userCard, cursor: "pointer" }} onClick={() => selectUser(u)}>
                <div style={S.userCardLeft}>
                  <div style={S.userName}>{u.name}</div>
                  <div style={S.userEmail}>{u.email}</div>
                  <div style={{ fontSize: 11, color: "#AAA", marginTop: 2 }}>
                    Înregistrat: {u.createdAt ? new Date(u.createdAt).toLocaleDateString("ro-RO") : "—"}
                  </div>
                </div>
                <div style={S.userCardRight}>
                  <div style={S.userXP}>⚡ {u.stats?.totalXP || 0} XP</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", marginTop: 4 }}>
                    <Tag label={`${u.stats?.unlockedChapters || 0}/15`} icon="✅" />
                    <Tag label={`${u.stats?.quizzesPassed || 0} quiz`} icon="🧠" />
                    <Tag label={`${u.stats?.badges || 0} badges`} icon="🏅" />
                    <Tag label={`${u.stats?.essayEvaluations || 0} comp.`} icon="📝" />
                    <Tag label={`${u.stats?.mathSets || 0} seturi`} icon="🧮" />
                    {(() => {
                      const ro = u.stats?.simRoCompleted || 0;
                      const ma = u.stats?.simMaCompleted || 0;
                      const total = ro + ma;
                      if (total === 0) return null;
                      const bestRo = u.stats?.simRoBestNota;
                      const bestMa = u.stats?.simMaBestNota;
                      const bestPart = bestRo != null || bestMa != null
                        ? ` · max ${Math.max(bestRo ?? 0, bestMa ?? 0).toFixed(2)}`
                        : "";
                      return <Tag label={`${total} sim${bestPart}`} icon="🎓" highlight />;
                    })()}
                    {u.stats?.currentStreak > 0 && <Tag label={`${u.stats.currentStreak}🔥`} highlight />}
                  </div>
                  <div style={{ ...S.progressBar, marginTop: 6 }}>
                    <div style={{ ...S.progressFill, width: `${Math.round(((u.stats?.unlockedChapters || 0) / 15) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── USER DETAIL ── */}
        {view === "detail" && selectedUser && (
          <div>
            {/* User header */}
            <div style={S.detailHeader}>
              <div>
                <div style={S.detailName}>{selectedUser.name}</div>
                <div style={S.detailEmail}>{selectedUser.email}</div>
              </div>
              <button style={S.btnSmall} onClick={() => selectUser(selectedUser, true)}>🔄</button>
            </div>

            {detailLoading && <div style={S.loading}>Se încarcă datele...</div>}

            {userDetail && !detailLoading && (
              <>
                {/* Stats strip */}
                <div style={S.kpiRow}>
                  <Kpi label="XP total" value={userDetail.gamification?.totalXP || 0} icon="⚡" />
                  <Kpi label="Streak" value={`${userDetail.gamification?.currentStreak || 0} zile`} icon="🔥" />
                  <Kpi label="Quiz-uri trecute" value={userDetail.gamification?.quizzesPassed || 0} icon="🧠" />
                  <Kpi label="Capitole bifate" value={Object.keys(userDetail.unlocked || {}).length} icon="✅" />
                </div>

                <FeatureUsagePanel usage={userDetail.featureUsage} chapters={ALL_CHAPTERS} />

                {/* Management panel */}
                <div style={{ background: "#F8F6F2", borderRadius: 14, padding: "16px 20px", marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A", marginBottom: 12, fontFamily: "'Syne',sans-serif" }}>
                    ⚙️ Management cont
                  </div>

                  {/* Usage counters */}
                  {userUsage && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                      {[["lesson","Lecții","📖",15], ["quiz","Quiz-uri","🧠",30], ["chat","Chat","💬",150], ["simulare","Simulări","🎓",4]].map(([k, lbl, ico, lim]) => (
                        <div key={k} style={{ background: "#fff", borderRadius: 10, padding: "8px 14px", fontSize: 12, border: "1px solid #E0DBD0" }}>
                          {ico} {lbl}: <strong>{userUsage[k] || 0}</strong>
                          <span style={{ color: "#AAA" }}> /{lim}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Status badges */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                    {selectedUser?.blocked && (
                      <span style={{ background: "#FFF5F5", color: "#C53030", border: "1px solid #FEB2B2", borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "3px 10px" }}>
                        🚫 BLOCAT
                      </span>
                    )}
                    {selectedUser?.premium && (
                      <span style={{ background: "#FFFFF0", color: "#744210", border: "1px solid #FAF089", borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "3px 10px" }}>
                        ⭐ PREMIUM
                      </span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => blockUser(selectedUser.userId, !selectedUser?.blocked)}
                      disabled={mgmtLoading}
                      style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none",
                        background: selectedUser?.blocked ? "#2E7D32" : "#C53030", color: "#fff" }}>
                      {selectedUser?.blocked ? "✅ Deblochează" : "🚫 Blochează cont"}
                    </button>
                    <button
                      onClick={() => resetUsage(selectedUser.userId)}
                      disabled={mgmtLoading}
                      style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: "1px solid #E0DBD0", background: "#fff", color: "#1A1A1A" }}>
                      🔄 Resetează limite AI
                    </button>
                    {!selectedUser?.premium && (
                      <button
                        onClick={() => grantPremium(selectedUser.userId)}
                        disabled={mgmtLoading}
                        style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          border: "1px solid #C8A84B", background: "#FFF8E7", color: "#744210" }}>
                        ⭐ Acordă premium gratuit
                      </button>
                    )}
                  </div>
                </div>

                {/* Chapters — both subjects */}
                {["romana", "matematica"].map(subj => {
                  const sub = SUBJECTS[subj];
                  const chapters = userDetail.chapters?.filter(c => c.subject === subj) || [];
                  return (
                    <div key={subj} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: sub.accent, fontFamily: "'Syne',sans-serif", marginBottom: 8 }}>
                        {sub.icon} {sub.label}
                      </div>
                      {chapters.map(ch => {
                        const isDone = !!userDetail.unlocked?.[ch.id];
                        return (
                          <div key={ch.id} style={{ ...S.chRow, borderLeft: `3px solid ${isDone ? "#2E7D32" : "#E0DBD0"}` }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: isDone ? "#2E7D32" : "#333" }}>
                                {isDone ? "✅" : "⬜"} {ALL_CHAPTERS.find(c => c.id === ch.id)?.title || ch.id}
                              </div>
                              <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                                <ChipTag done={ch.hasContent} label="Lecție" />
                                <ChipTag done={ch.quizResult?.passed} label={`Quiz ${ch.quizResult?.score ?? "—"}/10`} warn={ch.quizAttempts > 1} />
                                {ch.chatMessages > 0 && <ChipTag done label={`${ch.chatMessages} întrebări`} icon="💬" />}
                              </div>
                            </div>
                            {/* Override button */}
                            <button
                              onClick={() => overrideChapter(selectedUser.userId, ch.id, !isDone)}
                              style={{ ...S.overrideBtn, background: isDone ? "#FFF0EE" : "#1A1A1A", color: isDone ? "#C62828" : "#fff", border: isDone ? "1px solid #FFCDD2" : "none" }}>
                              {isDone ? "Anulează" : "+ Bifează"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Logs section */}
                <div style={{ marginTop: 24 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={S.sectionTitle}>Activitate</div>
                    <input type="date" value={userLogsDay} onChange={e => loadUserLogs(e.target.value)}
                      style={{ border: "1px solid #E0DBD0", borderRadius: 8, padding: "5px 10px", fontSize: 12, background: "#F8F6F2", color: "#1A1A1A" }} />
                  </div>
                  {userLogs.length === 0
                    ? <div style={S.empty}>Nicio activitate în această zi.</div>
                    : userLogs.map((log, i) => <LogEntry key={i} log={log} expanded={!!expandedLog[i]} onToggle={() => setExpandedLog(p => ({ ...p, [i]: !p[i] }))} />)
                  }
                </div>
              </>
            )}
          </div>
        )}

        {/* ── EMAIL ── */}
        {view === "email" && (
          <div>
            {/* Shared recipient — single source of truth */}
            <div style={S.card}>
              <div style={S.cardTitle}>📧 Destinatar</div>
              <input type="email" placeholder="Email destinatar..." value={manualTarget}
                onChange={e => setManualTarget(e.target.value)}
                style={S.inputField} />
              <div style={{ fontSize: 11, color: "#777", margin: "6px 0 0" }}>
                {users.length > 0 && (
                  <>Sau alege rapid: {users.slice(0, 5).map(u => (
                    <button key={u.userId}
                      onClick={() => setManualTarget(u.email)}
                      style={{ background: "none", border: "1px solid #E0DBD0", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: manualTarget === u.email ? "#C8A84B" : "#666", cursor: "pointer", marginRight: 4, marginTop: 4, fontFamily: "'Inter',sans-serif" }}>
                      {u.name?.split(" ")[0] || u.email.split("@")[0]}
                    </button>
                  ))}</>
                )}
              </div>
            </div>

            {/* Reminder */}
            <div style={S.card}>
              <div style={S.cardTitle}>📨 Reminder săptămânal</div>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, margin: "0 0 12px" }}>
                Trimite un reminder cu progresul săptămânii curente către <strong>{manualTarget || "—"}</strong>.
              </p>
              <button style={{ ...S.btnDark, opacity: (sending || !manualTarget) ? 0.5 : 1 }}
                onClick={sendReminder} disabled={sending || !manualTarget}>
                {sending ? "Se trimite..." : "📨 Trimite reminder"}
              </button>
            </div>

            {/* Manual message */}
            <div style={S.card}>
              <div style={S.cardTitle}>✉️ Mesaj personal</div>
              <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, margin: "0 0 12px" }}>
                Scrie un mesaj personalizat pentru <strong>{manualTarget || "—"}</strong>.
              </p>
              <textarea value={manualMsg} onChange={e => setManualMsg(e.target.value)}
                placeholder="Scrie mesajul tău..."
                style={{ ...S.inputField, minHeight: 100, resize: "vertical" }} />
              <button style={{ ...S.btnDark, opacity: (manualMsg.trim() && manualTarget && !sending) ? 1 : 0.4 }}
                onClick={sendManualMessage} disabled={!manualMsg.trim() || !manualTarget || sending}>
                {sending ? "Se trimite..." : "✉️ Trimite mesaj"}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Toast */}
      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────
function Kpi({ label, value, icon }) {
  return (
    <div style={S.kpi}>
      <div style={S.kpiIcon}>{icon}</div>
      <div style={S.kpiValue}>{value}</div>
      <div style={S.kpiLabel}>{label}</div>
    </div>
  );
}

function UserRow({ u, onClick, compact }) {
  const lastActiveRel = relTime(u.stats?.lastActiveAt);
  const area = u.stats?.lastArea;
  return (
    <div style={{ ...S.userCard, cursor: "pointer" }} onClick={onClick}>
      <div style={S.userCardLeft}>
        <div style={S.userName}>
          {u.name}
          {u.blocked && <span style={S.miniBadgeRed}>🚫</span>}
          {u.premium && <span style={S.miniBadgeGold}>⭐</span>}
        </div>
        <div style={S.userEmail}>{u.email}</div>
        {lastActiveRel && (
          <div style={S.userLastSeen}>
            {lastActiveRel}{area ? ` · ${area}` : ""}
          </div>
        )}
      </div>
      <div style={S.userCardRight}>
        <div style={S.userXP}>⚡ {u.stats?.totalXP || 0} XP</div>
        {!compact && u.stats?.currentStreak > 0 && <div style={S.userStreak}>🔥 {u.stats.currentStreak} zile</div>}
        <div style={S.userChapters}>{u.stats?.unlockedChapters || 0}/15 capitole</div>
        <div style={S.progressBar}>
          <div style={{ ...S.progressFill, width: `${Math.round(((u.stats?.unlockedChapters || 0) / 15) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

function relTime(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "acum câteva secunde";
  if (min < 60) return `acum ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `acum ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `acum ${d} ${d === 1 ? "zi" : "zile"}`;
  return new Date(iso).toLocaleDateString("ro-RO");
}

function Tag({ label, icon, highlight }) {
  return (
    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, background: highlight ? "#FFF8E7" : "#F0EDE6", color: highlight ? "#E65100" : "#888", border: `1px solid ${highlight ? "#F0D98A" : "#E0DBD0"}`, fontFamily: "'Inter',sans-serif" }}>
      {icon} {label}
    </span>
  );
}

function ChipTag({ done, label, warn, icon }) {
  return (
    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, fontFamily: "'Inter',sans-serif", fontWeight: 600,
      background: done ? "#E8F5E9" : "#F0EDE6",
      color: done ? "#2E7D32" : warn ? "#E65100" : "#AAA",
      border: `1px solid ${done ? "#C8E6C9" : warn ? "#FFE0B2" : "#E0DBD0"}` }}>
      {icon || (done ? "✓" : "·")} {label}
    </span>
  );
}


function formatDateTime(v) {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("ro-RO"); } catch { return "—"; }
}

function FeatureUsagePanel({ usage, chapters }) {
  const essay = usage?.essay || {};
  const math = usage?.math || {};
  const sim = usage?.simulare || { romana: {}, matematica: {} };
  const simRo = sim.romana || {};
  const simMa = sim.matematica || {};
  const avgMath = math.evaluationsCompleted ? (math.scoreTotal / math.evaluationsCompleted).toFixed(1) : "—";
  const avgEssayWords = essay.evaluationsCompleted ? Math.round((essay.wordsTotal || 0) / essay.evaluationsCompleted) : "—";
  const avgSimRo = simRo.completed ? (simRo.notaTotal / simRo.completed).toFixed(2) : "—";
  const avgSimMa = simMa.completed ? (simMa.notaTotal / simMa.completed).toFixed(2) : "—";

  return (
    <div style={S.featurePanel}>
      <div style={S.featurePanelTitle}>📈 Utilizare feature-uri speciale</div>
      <div style={S.featureGrid}>
        <div style={S.featureCard}>
          <div style={S.featureHeader}>📝 Compunere</div>
          <div style={S.featureStatsGrid}>
            <MiniStat label="Tab deschis" value={essay.tabOpened || 0} />
            <MiniStat label="Cerințe generate" value={essay.promptsGenerated || 0} />
            <MiniStat label="Drafturi începute" value={essay.draftsStarted || 0} />
            <MiniStat label="Evaluări" value={essay.evaluationsCompleted || 0} />
            <MiniStat label="Cel mai bun scor" value={essay.bestScore ?? "—"} />
            <MiniStat label="Media cuvinte" value={avgEssayWords} />
          </div>
          <div style={S.featureLast}>Ultima folosire: {formatDateTime(essay.lastUsed)}</div>
          <ChapterFeatureList chapters={chapters.filter(c => c.subject === "romana")} feature={essay} primaryField="evaluationsCompleted" empty="Nicio compunere evaluată încă." />
        </div>

        <div style={S.featureCard}>
          <div style={S.featureHeader}>🧮 Probleme</div>
          <div style={S.featureStatsGrid}>
            <MiniStat label="Tab deschis" value={math.tabOpened || 0} />
            <MiniStat label="Seturi generate" value={math.setsGenerated || 0} />
            <MiniStat label="Rezolvări văzute" value={math.solutionsRevealed || 0} />
            <MiniStat label="Rezolvări trimise" value={math.solutionsSubmitted || 0} />
            <MiniStat label="Verificări" value={math.evaluationsCompleted || 0} />
            <MiniStat label="Scor mediu" value={avgMath} />
          </div>
          <div style={S.featureLast}>Ultima folosire: {formatDateTime(math.lastUsed)}</div>
          <ChapterFeatureList chapters={chapters.filter(c => c.subject === "matematica")} feature={math} primaryField="setsGenerated" empty="Nicio problemă generată încă." />
        </div>

        <div style={S.featureCard}>
          <div style={S.featureHeader}>🎓 Simulare EN</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <SimSubBlock label="📖 Română" color="#C8392B" started={simRo.started || 0} completed={simRo.completed || 0} bestNota={simRo.bestNota} lastNota={simRo.lastNota} avg={avgSimRo} />
            <SimSubBlock label="📐 Matematică" color="#1A5276" started={simMa.started || 0} completed={simMa.completed || 0} bestNota={simMa.bestNota} lastNota={simMa.lastNota} avg={avgSimMa} />
          </div>
          <div style={S.featureLast}>Ultima folosire: {formatDateTime(sim.lastUsed)}</div>
          {(simRo.completed || 0) + (simMa.completed || 0) === 0 && (
            <div style={S.featureEmpty}>Nicio simulare finalizată încă.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SimSubBlock({ label, color, started, completed, bestNota, lastNota, avg }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E0DBD0", borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color, fontFamily: "'Syne',sans-serif", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#444" }}>
        <div>Începute: <strong>{started}</strong></div>
        <div>Finalizate: <strong>{completed}</strong></div>
        <div>Cel mai bun: <strong style={{ color: bestNota != null && bestNota >= 8 ? "#2E7D32" : "#1A1A1A" }}>{bestNota != null ? Number(bestNota).toFixed(2) : "—"}</strong></div>
        <div>Ultima: <strong>{lastNota != null ? Number(lastNota).toFixed(2) : "—"}</strong></div>
        <div>Media: <strong>{avg}</strong></div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={S.miniStat}>
      <div style={S.miniStatValue}>{value}</div>
      <div style={S.miniStatLabel}>{label}</div>
    </div>
  );
}

function ChapterFeatureList({ chapters, feature, primaryField, empty }) {
  const rows = chapters
    .map(c => ({ ...c, data: feature?.chapters?.[c.id] || {} }))
    .filter(c => Object.keys(c.data).length > 0)
    .sort((a, b) => (b.data[primaryField] || 0) - (a.data[primaryField] || 0));

  if (!rows.length) return <div style={S.featureEmpty}>{empty}</div>;

  return (
    <div style={{ marginTop: 10 }}>
      {rows.map(c => (
        <div key={c.id} style={S.featureChapterRow}>
          <div style={{ flex: 1 }}>
            <div style={S.featureChapterTitle}>{c.title}</div>
            <div style={S.featureChapterMeta}>Ultima activitate: {formatDateTime(c.data.lastUsed)}</div>
          </div>
          <div style={S.featureChapterCounters}>
            {c.data.promptsGenerated ? <span>cerințe {c.data.promptsGenerated}</span> : null}
            {c.data.evaluationsCompleted ? <span>eval. {c.data.evaluationsCompleted}</span> : null}
            {c.data.setsGenerated ? <span>seturi {c.data.setsGenerated}</span> : null}
            {c.data.solutionsSubmitted ? <span>trimise {c.data.solutionsSubmitted}</span> : null}
            {c.data.solutionsRevealed ? <span>văzute {c.data.solutionsRevealed}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

const EVENT_LABELS = {
  chapter_opened:     { icon: "📂", label: "Capitol deschis", color: "#F59E0B" },
  content_generated:  { icon: "✨", label: "Lecție generată", color: "#8B5CF6" },
  chat_message:       { icon: "💬", label: "Întrebare tutore", color: "#9C6FE4" },
  quiz_started:       { icon: "🎯", label: "Quiz început", color: "#3B82F6" },
  quiz_submitted:     { icon: "🧠", label: "Quiz trimis", color: "#10B981" },
  essay_evaluated:    { icon: "📝", label: "Compunere evaluată", color: "#9C6FE4" },
  math_problems_generated: { icon: "🧮", label: "Probleme generate", color: "#1A5276" },
  math_solution_evaluated: { icon: "✍️", label: "Rezolvare verificată", color: "#1A5276" },
  chapter_unlocked:   { icon: "🏆", label: "Capitol bifat!", color: "#C8A84B" },
  simulare_started:   { icon: "🎓", label: "Simulare începută", color: "#7B1D1D" },
  simulare_completed: { icon: "📊", label: "Simulare finalizată", color: "#0D2E4E" },
};

function LogEntry({ log, expanded, onToggle }) {
  const ev = EVENT_LABELS[log.type] || { icon: "•", label: log.type, color: "#888" };
  const time = new Date(log.ts).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  const isQuiz = log.type === "quiz_submitted";
  const isSimCompleted = log.type === "simulare_completed";

  return (
    <div style={S.logRow}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 20, flexShrink: 0 }}>{ev.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: ev.color }}>{ev.label}</span>
            <span style={{ fontSize: 11, color: "#AAA" }}>{time}</span>
          </div>
          <div style={{ fontSize: 12, color: "#777" }}>
            {log.chapterTitle} · <span style={{ color: log.subject === "romana" ? "#C8392B" : "#1A5276", fontWeight: 600 }}>{log.subject === "romana" ? "Română" : "Matematică"}</span>
          </div>
          {isQuiz && (
            <div style={{ marginTop: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: log.passed ? "#2E7D32" : "#C62828", background: log.passed ? "#E8F5E9" : "#FFF0EE", padding: "2px 8px", borderRadius: 8, border: `1px solid ${log.passed ? "#A5D6A7" : "#FFCDD2"}` }}>
                {log.score}/10 {log.passed ? "✅ Trecut" : "❌ Netrecut"}
              </span>
              {log.answers?.length > 0 && (
                <button onClick={onToggle} style={{ fontSize: 11, color: "#888", background: "none", border: "none", cursor: "pointer", marginLeft: 8 }}>
                  {expanded ? "▲ Ascunde" : "▼ Răspunsuri"}
                </button>
              )}
            </div>
          )}
          {isQuiz && expanded && log.answers?.length > 0 && (
            <div style={{ marginTop: 8, background: "#F8F6F2", borderRadius: 8, padding: 10 }}>
              {log.answers.map((a, i) => (
                <div key={i} style={{ fontSize: 11, color: a.isCorrect ? "#2E7D32" : "#C62828", marginBottom: 4 }}>
                  {a.isCorrect ? "✓" : "✗"} {a.question?.slice(0, 60)}... → {a.given || "—"} (corect: {a.correct})
                </div>
              ))}
            </div>
          )}
          {isSimCompleted && (
            <div style={{ marginTop: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1A1A1A", background: "#FFF8E7", padding: "2px 8px", borderRadius: 8, border: "1px solid #F0D98A" }}>
                Nota: <strong>{log.nota?.toFixed?.(2) ?? log.nota}</strong> · {log.totalPuncte}/100p
              </span>
            </div>
          )}
          {log.type === "chat_message" && log.userMessage && (
            <div style={{ fontSize: 12, color: "#888", marginTop: 4, fontStyle: "italic" }}>
              "{log.userMessage.slice(0, 80)}{log.userMessage.length > 80 ? "..." : ""}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  shell:      { background: "#F0EDE6", minHeight: "100vh", fontFamily: "'Inter',sans-serif" },
  header:     { background: "#1A1A1A", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo:       { fontSize: 20, fontWeight: 800, color: "#fff", fontFamily: "'Syne',sans-serif" },
  logoSub:    { fontSize: 11, color: "#888", marginTop: 2 },
  logoutBtn:  { background: "none", border: "1px solid #555", color: "#AAA", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12 },
  nav:        { display: "flex", background: "#fff", borderBottom: "2px solid #E0DBD0", overflowX: "auto" },
  navBtn:     { flex: "0 0 auto", background: "none", border: "none", borderBottom: "3px solid transparent", color: "#888", padding: "12px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif" },
  navBtnOn:   { color: "#1A1A1A", borderBottomColor: "#C8A84B" },
  body:       { padding: "16px 14px 80px", maxWidth: 680, margin: "0 auto" },
  sectionTitle:{ fontSize: 13, fontWeight: 700, color: "#AAA", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12, marginTop: 4 },
  kpiRow:     { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 20 },
  kpi:        { background: "#fff", borderRadius: 12, padding: "12px 10px", textAlign: "center", border: "1px solid #E0DBD0" },
  kpiIcon:    { fontSize: 20, marginBottom: 4 },
  kpiValue:   { fontSize: 18, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif", lineHeight: 1 },
  kpiLabel:   { fontSize: 10, color: "#AAA", marginTop: 3 },
  userCard:   { background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 10, border: "1px solid #E0DBD0", display: "flex", gap: 12, alignItems: "flex-start" },
  userCardLeft: { flex: 1 },
  userCardRight:{ textAlign: "right", flexShrink: 0 },
  userName:   { fontSize: 14, fontWeight: 700, color: "#1A1A1A", fontFamily: "'Syne',sans-serif", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  miniBadgeRed:{ fontSize: 11 },
  miniBadgeGold:{ fontSize: 11 },
  userEmail:  { fontSize: 11, color: "#888", marginTop: 2 },
  userLastSeen:{ fontSize: 10, color: "#AAA", marginTop: 2 },
  userXP:     { fontSize: 16, fontWeight: 800, color: "#C8A84B", fontFamily: "'Syne',sans-serif" },
  userStreak: { fontSize: 11, color: "#E65100", fontWeight: 600, marginTop: 2 },
  userChapters:{ fontSize: 11, color: "#888", marginTop: 2 },
  progressBar:{ height: 4, background: "#F0EDE6", borderRadius: 2, overflow: "hidden", marginTop: 4, width: 80 },
  progressFill:{ height: "100%", background: "#C8A84B", borderRadius: 2 },
  detailHeader:{ background: "#fff", borderRadius: 12, padding: "14px 16px", marginBottom: 16, border: "1px solid #E0DBD0", display: "flex", justifyContent: "space-between", alignItems: "center" },
  detailName: { fontSize: 17, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif" },
  detailEmail:{ fontSize: 12, color: "#888", marginTop: 3 },
  chRow:      { background: "#fff", borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1px solid #E0DBD0", display: "flex", gap: 10, alignItems: "flex-start" },
  overrideBtn:{ fontSize: 10, padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "'Inter',sans-serif", fontWeight: 700, flexShrink: 0 },
  logRow:     { background: "#fff", borderRadius: 10, padding: "12px 14px", marginBottom: 8, border: "1px solid #E0DBD0" },
  card:       { background: "#fff", borderRadius: 12, padding: 16, marginBottom: 14, border: "1px solid #E0DBD0" },
  cardTitle:  { fontWeight: 700, fontSize: 14, color: "#1A1A1A", marginBottom: 10, fontFamily: "'Syne',sans-serif" },
  inputField: { width: "100%", background: "#F8F6F2", border: "1px solid #E0DBD0", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#1A1A1A", fontFamily: "'Inter',sans-serif", outline: "none", boxSizing: "border-box" },
  btnDark:    { background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 10, padding: "11px 18px", fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "'Syne',sans-serif", width: "100%", marginTop: 8 },
  btnSmall:   { background: "#1A1A1A", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontFamily: "'Inter',sans-serif", fontWeight: 600 },
  loading:    { textAlign: "center", color: "#AAA", padding: "30px 0", fontStyle: "italic", fontSize: 13 },
  empty:      { textAlign: "center", color: "#AAA", padding: "20px 0", fontStyle: "italic", fontSize: 13 },
  featurePanel:{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 20, border: "1px solid #E0DBD0" },
  featurePanelTitle:{ fontSize: 13, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif", marginBottom: 12 },
  featureGrid:{ display: "grid", gridTemplateColumns: "1fr", gap: 12 },
  featureCard:{ background: "#F8F6F2", borderRadius: 12, padding: 12, border: "1px solid #E0DBD0" },
  featureHeader:{ fontSize: 13, fontWeight: 800, color: "#1A1A1A", fontFamily: "'Syne',sans-serif", marginBottom: 10 },
  featureStatsGrid:{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  miniStat:{ background: "#fff", border: "1px solid #E0DBD0", borderRadius: 10, padding: "8px 6px", textAlign: "center" },
  miniStatValue:{ fontSize: 16, fontWeight: 800, color: "#C8A84B", fontFamily: "'Syne',sans-serif", lineHeight: 1 },
  miniStatLabel:{ fontSize: 9, color: "#888", marginTop: 4, lineHeight: 1.2 },
  featureLast:{ fontSize: 10, color: "#888", marginTop: 9, fontStyle: "italic" },
  featureEmpty:{ fontSize: 11, color: "#AAA", marginTop: 10, fontStyle: "italic" },
  featureChapterRow:{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #E0DBD0", borderRadius: 9, padding: "8px 10px", marginTop: 6 },
  featureChapterTitle:{ fontSize: 11, fontWeight: 700, color: "#1A1A1A" },
  featureChapterMeta:{ fontSize: 9, color: "#AAA", marginTop: 2 },
  featureChapterCounters:{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, fontSize: 9, color: "#666", fontWeight: 700 },
  lightboxOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  toast:      { position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#1A1A1A", color: "#fff", fontWeight: 700, padding: "11px 24px", borderRadius: 20, zIndex: 400, fontSize: 14, boxShadow: "0 4px 24px rgba(0,0,0,.2)", whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif" },
};
