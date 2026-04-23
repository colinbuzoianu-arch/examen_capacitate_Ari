/**
 * Sends email via /api/send-email (Vercel serverless function using Resend)
 */
export async function sendEmail({ to, subject, html }) {
  try {
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, html }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Email failed");
    return { ok: true };
  } catch (err) {
    console.error("sendEmail error:", err);
    return { ok: false, error: err.message };
  }
}

// ── Email templates ───────────────────────────────────────────────────────────

export function reminderTemplate({ studentName, weekLabel, weekStart, weekEnd, doneChapters, totalChapters, appUrl }) {
  const pct = totalChapters > 0 ? Math.round((doneChapters / totalChapters) * 100) : 0;
  const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));

  return `
<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="background:#111;font-family:Georgia,serif;color:#eee;padding:0;margin:0;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:40px;">🎓</div>
      <h1 style="color:#F1C40F;font-size:22px;margin:8px 0 4px;">Reminder studiu EN 2026</h1>
      <p style="color:#888;font-size:13px;margin:0;">Hai ${studentName}, mai e de lucru! 💪</p>
    </div>

    <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:16px;border-left:4px solid #F1C40F;">
      <div style="font-weight:700;font-size:15px;color:#fff;margin-bottom:4px;">${weekLabel}</div>
      <div style="font-size:12px;color:#888;margin-bottom:12px;">${weekStart} → ${weekEnd}</div>
      <div style="font-size:13px;color:#ccc;margin-bottom:6px;">Progres săptămâna aceasta:</div>
      <div style="font-family:monospace;color:#F1C40F;font-size:15px;letter-spacing:2px;">${bar} ${pct}%</div>
      <div style="font-size:12px;color:#888;margin-top:4px;">${doneChapters} din ${totalChapters} capitole bifate</div>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="${appUrl}" style="background:#F1C40F;color:#111;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px;font-size:15px;display:inline-block;">
        Deschide planul meu →
      </a>
    </div>

    <div style="background:#1a1a1a;border-radius:10px;padding:16px;font-size:12px;color:#666;text-align:center;">
      Examen Română: <strong style="color:#FF6B6B;">22 iunie 2026</strong> &nbsp;·&nbsp;
      Examen Matematică: <strong style="color:#3498DB;">24 iunie 2026</strong>
    </div>
  </div>
</body>
</html>`;
}

export function checkInNotifyTemplate({ studentName, parentName, weekLabel, comment, appUrl }) {
  return `
<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="background:#111;font-family:Georgia,serif;color:#eee;padding:0;margin:0;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:40px;">📸</div>
      <h1 style="color:#6BCB77;font-size:20px;margin:8px 0 4px;">${studentName} a urcat un check-in!</h1>
      <p style="color:#888;font-size:13px;margin:0;">${weekLabel}</p>
    </div>

    ${comment ? `
    <div style="background:#1a1a1a;border-radius:10px;padding:16px;margin-bottom:16px;border-left:4px solid #6BCB77;">
      <div style="font-size:12px;color:#888;margin-bottom:6px;">Comentariul lui ${studentName}:</div>
      <div style="font-size:14px;color:#eee;font-style:italic;">"${comment}"</div>
    </div>` : ""}

    <div style="text-align:center;margin:24px 0;">
      <a href="${appUrl}#admin" style="background:#6BCB77;color:#111;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px;font-size:15px;display:inline-block;">
        Vezi progresul complet →
      </a>
    </div>

    <p style="color:#666;font-size:12px;text-align:center;">
      Notificare automată · EN 2026 Planul lui ${studentName}
    </p>
  </div>
</body>
</html>`;
}

export function manualReminderTemplate({ studentName, message, appUrl }) {
  return `
<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="background:#111;font-family:Georgia,serif;color:#eee;padding:0;margin:0;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:40px;">✉️</div>
      <h1 style="color:#F1C40F;font-size:20px;margin:8px 0 4px;">Mesaj de la Tata</h1>
    </div>

    <div style="background:#1a1a1a;border-radius:12px;padding:20px;margin-bottom:20px;border-left:4px solid #F1C40F;">
      <p style="font-size:15px;color:#eee;line-height:1.6;margin:0;">${message}</p>
    </div>

    <div style="text-align:center;margin:24px 0;">
      <a href="${appUrl}" style="background:#F1C40F;color:#111;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:8px;font-size:15px;display:inline-block;">
        Deschide planul meu →
      </a>
    </div>
  </div>
</body>
</html>`;
}
