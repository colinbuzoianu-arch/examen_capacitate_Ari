# 🎓 Studiu EN26 — Platformă de pregătire Evaluarea Națională 2026

Aplicație AI multi-utilizator pentru pregătirea Evaluării Naționale (clasa a VIII-a).
Limbă și Literatură Română + Matematică, 15 capitole, sistem de progres verificat.

## Funcționalități principale

1. **📚 Lecții AI** — tutore Socratic per capitol, limbă română
2. **✅ Quiz** — trebuie să obții minim 8/10 pentru a debloca capitolul următor
3. **📝 Compunere** — cerințe EN VIII Subiect II + evaluare după barem (Română)
4. **🧮 Probleme model** — set de 3 probleme cu rezolvare verificată AI (Matematică)
5. **🎓 Simulare EN VIII** — examen complet în format real (120 min, evaluare după barem oficial)
6. **🏆 Gamificare** — XP, streak-uri, badge-uri, clasament
7. **👨‍💼 Admin** — panou de administrare cu statistici per utilizator

## Limite per cont (free)

| Tip                  | Free | Premium |
| -------------------- | ---- | ------- |
| Lecții generate      | 15   | 45      |
| Quiz-uri             | 30   | 90      |
| Mesaje cu tutorele   | 150  | 500     |
| Simulări complete EN | 4    | 12      |

Conturile listate în `UNLIMITED_EMAILS` (env var) nu au limite.

## Stack

- **Frontend**: React + Vite
- **Backend**: Vercel Serverless Functions (Node.js)
- **Storage**: Upstash Redis
- **AI**: Anthropic Claude API (Sonnet pentru lecții/simulări, Haiku pentru quiz)
- **Email**: Resend
- **Plăți**: Stripe Checkout

## Environment variables (Vercel)

```
ANTHROPIC_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RESEND_API_KEY=
ADMIN_SECRET=          ← set a strong random string here
UNLIMITED_EMAILS=      ← comma-separated emails that bypass limits
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

## Structura proiectului

```
src/
  App.jsx              ← router principal
  pages/
    AuthPage.jsx       ← login / register / reset parolă
    StudentApp.jsx     ← interfața elevului
    AdminApp.jsx       ← panou administrare
    ChapterPage.jsx    ← lecție + quiz per capitol
    SimularePage.jsx   ← simulare EN VIII (full mock exam)
    GamificationWidget.jsx
    LogsView.jsx
    UpgradeModal.jsx
  utils/
    api.js             ← fetch helpers + AI calls
    cloudStorage.js    ← Redis wrapper
    gamification.js    ← logica XP/badge-uri
    featureTracking.js ← admin analytics
    logger.js          ← event logging
    email.js
    emailTemplates.js
api/
  auth.js              ← register / login / logout / verify
  claude.js            ← proxy Anthropic API + limite per cont
  progress.js          ← progres utilizator
  admin-users.js       ← admin endpoints + feature tracking
  reset-password.js    ← reset parolă
  cron-reminder.js     ← reminder săptămânal
  stripe.js            ← checkout + webhook
  send-email.js        ← Resend wrapper
```

## Subdomain

Aplicația rulează la **en26.verumsell.com** — un proiect Verumsell.

## Versiuni

Vezi [CHANGELOG.md](./CHANGELOG.md).
