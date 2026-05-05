# 🎓 Studiu EN26 — Platformă de pregătire Evaluarea Națională 2026

Aplicație AI multi-utilizator pentru pregătirea Evaluării Naționale (clasa a VIII-a).
Limbă și Literatură Română + Matematică, 15 capitole, sistem de progres verificat.

## Funcționalități principale

1. **📚 Lecții AI** — tutore Socratic per capitol, limbă română
2. **✅ Quiz** — trebuie să obții minim 8/10 pentru a debloca capitolul următor
3. **📸 Dovadă de studiu** — elevul încarcă o fotografie a temei făcute
4. **🏆 Gamificare** — XP, streak-uri, badge-uri, clasament
5. **👨‍💼 Admin** — panou de administrare cu statistici per utilizator

## Stack

- **Frontend**: React + Vite
- **Backend**: Vercel Serverless Functions (Node.js)
- **Storage**: Upstash Redis
- **AI**: Anthropic Claude API
- **Email**: Resend

## Environment variables (Vercel)

```
ANTHROPIC_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RESEND_API_KEY=
ADMIN_SECRET=          ← set a strong random string here
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
    GamificationWidget.jsx
    LogsView.jsx
  utils/
    api.js             ← fetch helpers
    cloudStorage.js    ← Redis wrapper
    gamification.js    ← logica XP/badge-uri
    email.js
    emailTemplates.js
api/
  auth.js              ← register / login / logout / verify
  claude.js            ← proxy Anthropic API
  progress.js          ← progres utilizator
  admin-users.js       ← admin endpoints
  reset-password.js    ← reset parolă
  cron-reminder.js     ← reminder săptămânal
```

## Subdomain

Aplicația rulează la **en26.verumsell.com** — un proiect Verumsell.
