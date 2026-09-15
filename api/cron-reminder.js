// api/cron-reminder.js — DISABLED (2026-09)
//
// The weekly study reminder has been permanently turned off:
//   - EN 2026 is over, so the countdown emails no longer make sense
//   - users asked to stop receiving them
//
// The cron entry was removed from vercel.json, so Vercel no longer triggers
// this endpoint. This handler is kept as a tombstone so that any leftover
// scheduler, bookmark, uptime check or manual call fails closed instead of
// mailing every registered user.
//
// DO NOT re-enable without an unsubscribe link and an opt-in flag per user.

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(410).json({
    ok: false,
    disabled: true,
    sent: 0,
    message: "Weekly reminder emails are permanently disabled. Nothing was sent.",
  });
}
