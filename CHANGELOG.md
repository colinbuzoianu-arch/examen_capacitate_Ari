# CHANGELOG

## 2.1.0 — Simulare EN VIII + admin polish

### Features

- **Simulare Evaluare Națională VIII** — full mock exam, 4th bottom-nav tab
  - Română: Subiect I (text + 6 itemi A + 3 itemi B = 60p) + compunere 30p + 10p oficiu
  - Matematică: Subiect I (6 MC) + II (6 MC) + III (2 probleme scrise) = 90p + 10p oficiu
  - 120-min timer, pausable, auto-submit on zero, color-shifts at <10min and <3min
  - Auto-save answers to Redis every 800ms (close-and-resume safe)
  - AI evaluator with detailed per-item / per-criterion feedback, "capitole de revăzut"
  - Per-subject history with last/best nota tracking
  - Word counter on Subiectul II compunere with min/max validation
  - Math MC items graded client-side (free, instant); only Subiectul III hits AI
- New AI limit type `simulare` — 4 free / 12 premium

### Admin

- Overview redesign with 8 KPIs (added Activi 7 zile, Quiz-uri trecute, Simulări finalizate, Stuck 3+)
- New "⚠️ Elevi inactivi (3+ zile)" panel surfaces stuck users using `lastActiveAt`
- User rows show last-active relative time + last area chip (Lecții / Compunere / Probleme / Simulare)
- New 🎓 simulare tag on user list with "X sim · max Y.YY"
- FeatureUsagePanel adds Simulare card with Română / Matematică breakdown
- Email view: shared destinatar input with quick-pick chips for known users (no more sync bug)
- Admin AI usage row now includes "🎓 Simulări: X/4"
- Re-clicking same user no longer re-fetches detail (cheap view switch)
- Proper "Se încarcă elevii…" loading state instead of misleading empty state

### Bug fixes

- **Chapter unlock email no longer crashes** — `gState.totalXP` referenced an undefined variable inside `handleUnlock`; renamed to `gStateNew` (the actual variable from a few lines up). Was throwing on every chapter unlock and silently failing the email send.

### Backend

- `api/claude.js`: `simulare` added to `LIMITS` and premium tier; `getUsage` backfills `simulare: 0` for legacy users
- `api/admin-users.js`:
  - `featureUsage` schema gains `simulare.{romana,matematica}` with started/completed/bestNota/lastNota/notaTotal
  - `applyFeatureEvent` handles `simulare_started` and `simulare_completed`
  - List endpoint surfaces `simRoCompleted` / `simMaCompleted` / `simRoBestNota` / `simMaBestNota`
  - Engagement score weights simulări 5x
  - `latestArea` includes "Simulare"
  - `reset-usage` and `grant-premium` zero the simulare counter too
- `src/utils/logger.js`: new `simulareStarted` / `simulareCompleted` events
- `src/pages/AdminApp.jsx`: `EVENT_LABELS` + `LogEntry` render simulare events with nota badge

### Files added

- `src/pages/SimularePage.jsx` — full feature, ~700 lines
- `CHANGELOG.md` — this file

### Files modified

- `package.json` — version 2.0.0 → 2.1.0
- `README.md` — features list + limits table
- `src/pages/StudentApp.jsx` — Simulare tab in BottomNav, gState bug fix
- `src/pages/AdminApp.jsx` — Overview redesign, FeatureUsagePanel extension, email view cleanup, UserRow extracted, simulare event labels, simulare counter in usage row, forceRefresh on selectUser
- `src/pages/UpgradeModal.jsx` — added `simulare` to typeLabels
- `src/utils/api.js` — added `generateSimulareRomana`, `generateSimulareMatematica`, `evaluateSimulareRomana`, `evaluateSimulareMatematica`
- `src/utils/logger.js` — simulare events
- `api/claude.js` — simulare limit type, getUsage backfill
- `api/admin-users.js` — simulare in featureUsage, applyFeatureEvent, list endpoint, reset

### Migration notes

- Zero schema breakage. Older accounts get backfilled `simulare: 0` lazily on first read.
- New `featureUsage.simulare` shape is initialized via `ensureFeatureUsage`, existing records stay readable.
- No environment variables added.
