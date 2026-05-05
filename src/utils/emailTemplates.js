// emailTemplates.js — Rich HTML email templates
// Used by AdminApp and cron-reminder

export function reminderEmailHtml({
  studentName = "Elev",
  weekLabel,
  weekStart,
  weekEnd,
  doneChapters,
  totalChapters,
  doneRomana,
  totalRomana,
  doneMate,
  totalMate,
  chaptersThisWeek = [],  // [{ title, subject, done }]
  streak = 0,
  totalXP = 0,
  daysToRo,
  daysToMa,
  appUrl,
  personalMessage = "",
}) {
  const pct   = totalChapters > 0 ? Math.round((doneChapters / totalChapters) * 100) : 0;
  const pctRo = totalRomana > 0   ? Math.round((doneRomana / totalRomana) * 100)     : 0;
  const pctMa = totalMate > 0     ? Math.round((doneMate / totalMate) * 100)         : 0;

  const bar = (p, color) => {
    const filled = Math.round(p / 10);
    const empty  = 10 - filled;
    return `<span style="font-family:monospace;font-size:14px;letter-spacing:1px;color:${color};">${"█".repeat(filled)}</span><span style="font-family:monospace;font-size:14px;letter-spacing:1px;color:#E8E4DC;">${"░".repeat(empty)}</span>`;
  };

  const chapterRows = chaptersThisWeek.map(ch => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:${ch.done ? "#2E7D32" : "#333"};font-family:Georgia,serif;">
        ${ch.done ? "✅" : "⬜"} ${ch.title}
        <span style="font-size:11px;color:${ch.subject === "romana" ? "#C8392B" : "#1A5276"};margin-left:6px;">${ch.subject === "romana" ? "Română" : "Matematică"}</span>
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0EDE6;font-family:Georgia,serif;">
<div style="max-width:540px;margin:0 auto;padding:24px 16px;">

  <!-- Header -->
  <div style="background:#1A1A1A;border-radius:20px 20px 0 0;padding:24px 24px 20px;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">🎓</div>
    <h1 style="color:#C8A84B;font-size:22px;margin:0 0 4px;font-family:Georgia,serif;">Reminder studiu EN 2026</h1>
    <p style="color:#888;font-size:13px;margin:0;">${weekLabel} · ${weekStart} → ${weekEnd}</p>
    ${streak > 0 ? `<div style="margin-top:10px;display:inline-block;background:#252525;border-radius:20px;padding:5px 14px;font-size:13px;color:#E65100;">🔥 Streak ${streak} zile</div>` : ""}
  </div>

  <!-- Progress bar -->
  <div style="background:#fff;padding:20px 24px;border-left:1px solid #E8E4DC;border-right:1px solid #E8E4DC;">
    <div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Progres total</div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
      ${bar(pct, "#C8A84B")}
      <span style="font-size:20px;font-weight:bold;color:#C8A84B;">${pct}%</span>
    </div>
    <div style="font-size:12px;color:#999;">${doneChapters} din ${totalChapters} capitole bifate · ⚡ ${totalXP} XP</div>

    <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div style="background:#FFF5F5;border-radius:10px;padding:12px;border-left:3px solid #C8392B;">
        <div style="font-size:11px;color:#C8392B;font-weight:bold;margin-bottom:6px;">📖 ROMÂNĂ</div>
        ${bar(pctRo, "#C8392B")} <span style="font-size:12px;color:#C8392B;font-weight:bold;"> ${pctRo}%</span>
        <div style="font-size:11px;color:#999;margin-top:4px;">${doneRomana}/${totalRomana} capitole</div>
      </div>
      <div style="background:#EEF4FF;border-radius:10px;padding:12px;border-left:3px solid #1A5276;">
        <div style="font-size:11px;color:#1A5276;font-weight:bold;margin-bottom:6px;">📐 MATEMATICĂ</div>
        ${bar(pctMa, "#1A5276")} <span style="font-size:12px;color:#1A5276;font-weight:bold;"> ${pctMa}%</span>
        <div style="font-size:11px;color:#999;margin-top:4px;">${doneMate}/${totalMate} capitole</div>
      </div>
    </div>
  </div>

  <!-- This week's chapters -->
  ${chaptersThisWeek.length > 0 ? `
  <div style="background:#fff;padding:16px 24px;border-left:1px solid #E8E4DC;border-right:1px solid #E8E4DC;border-top:1px solid #F0EDE6;">
    <div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">Capitolele săptămânii</div>
    <table style="width:100%;border-collapse:collapse;">${chapterRows}</table>
  </div>` : ""}

  <!-- Personal message -->
  ${personalMessage ? `
  <div style="background:#FFF8E7;padding:16px 24px;border:1px solid #F0D98A;border-top:none;">
    <div style="font-size:12px;color:#7A5C00;font-weight:bold;margin-bottom:6px;">✉️ Mesaj de la Tata</div>
    <div style="font-size:14px;color:#333;line-height:1.7;">${personalMessage.replace(/\n/g, "<br/>")}</div>
  </div>` : ""}

  <!-- Countdown + CTA -->
  <div style="background:#fff;padding:20px 24px;border-left:1px solid #E8E4DC;border-right:1px solid #E8E4DC;border-top:1px solid #F0EDE6;text-align:center;">
    <div style="display:inline-flex;gap:16px;margin-bottom:18px;">
      <div style="text-align:center;background:#FFF5F5;border-radius:10px;padding:10px 16px;border:1px solid #FFCDD2;">
        <div style="font-size:24px;font-weight:bold;color:#C8392B;">${daysToRo}</div>
        <div style="font-size:11px;color:#C8392B;">zile Română</div>
      </div>
      <div style="text-align:center;background:#EEF4FF;border-radius:10px;padding:10px 16px;border:1px solid #BBDEFB;">
        <div style="font-size:24px;font-weight:bold;color:#1A5276;">${daysToMa}</div>
        <div style="font-size:11px;color:#1A5276;">zile Matematică</div>
      </div>
    </div>
    <br>
    <a href="${appUrl}" style="display:inline-block;background:#1A1A1A;color:#fff;text-decoration:none;font-weight:bold;padding:14px 32px;border-radius:12px;font-size:15px;">
      📚 Deschide planul meu →
    </a>
    <p style="font-size:11px;color:#BBB;margin-top:12px;">Poți bifa un capitol după quiz cu minim 8/10 🧠</p>
  </div>

  <!-- Footer -->
  <div style="background:#1A1A1A;border-radius:0 0 20px 20px;padding:14px 24px;text-align:center;">
    <p style="color:#666;font-size:11px;margin:0;">Studiu EN26 · en26.verumsell.com</p>
  </div>

</div>
</body>
</html>`;
}

export function chapterUnlockEmailHtml({ studentName, chapterTitle, subject, score, totalXP, streak, chaptersUnlocked, totalChapters, appUrl }) {
  const subColor = subject === "romana" ? "#C8392B" : "#1A5276";
  const subLabel = subject === "romana" ? "Română" : "Matematică";
  const pct = Math.round((chaptersUnlocked / totalChapters) * 100);

  return `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F0EDE6;font-family:Georgia,serif;">
<div style="max-width:540px;margin:0 auto;padding:24px 16px;">
  <div style="background:#1A1A1A;border-radius:20px;overflow:hidden;">
    <div style="padding:28px 24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:10px;">🏆</div>
      <h1 style="color:#C8A84B;font-size:22px;margin:0 0 6px;">Capitol bifat!</h1>
      <p style="color:#888;font-size:13px;margin:0;">${studentName} a finalizat un capitol</p>
    </div>
    <div style="background:#fff;margin:0 16px;border-radius:12px;padding:18px;">
      <div style="font-size:11px;color:${subColor};font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">${subLabel}</div>
      <div style="font-size:17px;font-weight:bold;color:#1A1A1A;margin-bottom:12px;">${chapterTitle}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <span style="background:#E8F5E9;color:#2E7D32;font-size:12px;font-weight:bold;padding:4px 12px;border-radius:20px;border:1px solid #A5D6A7;">✅ Quiz ${score}/10</span>
${streak > 0 ? `<span style="background:#FFF8E7;color:#E65100;font-size:12px;font-weight:bold;padding:4px 12px;border-radius:20px;border:1px solid #FFE0B2;">🔥 Streak ${streak} zile</span>` : ""}
      </div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid #F0EDE6;">
        <div style="font-size:12px;color:#999;margin-bottom:6px;">Progres total: ${chaptersUnlocked}/${totalChapters} capitole</div>
        <div style="height:8px;background:#F0EDE6;border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:#C8A84B;border-radius:4px;"></div>
        </div>
        <div style="font-size:11px;color:#C8A84B;font-weight:bold;margin-top:4px;">⚡ ${totalXP} XP total</div>
      </div>
    </div>
    <div style="padding:20px 24px;text-align:center;">
      <a href="${appUrl}" style="display:inline-block;background:#C8A84B;color:#1A1A1A;text-decoration:none;font-weight:bold;padding:12px 28px;border-radius:10px;font-size:14px;">
        Vezi progresul complet →
      </a>
    </div>
  </div>
</div>
</body>
</html>`;
}
