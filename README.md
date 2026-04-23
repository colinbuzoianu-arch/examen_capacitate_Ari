# 🎓 Planul lui Ari – EN 2026

Aplicație de studiu pentru Evaluarea Națională 2026, cu:
- Plan săptămânal pe capitole (Română + Matematică)
- Check-in-uri cu poze, notificate automat pe email
- Panou Admin (tată) cu parolă separată
- Remindere automate vineri via Vercel Cron + Resend
- Mesaje manuale de la tată direct din app

---

## 🚀 Deploy în 5 pași

### 1. Instalează dependențele local
```bash
npm install
npm run dev   # testează local pe http://localhost:5173
```

### 2. Configurează Resend
1. Mergi pe [resend.com](https://resend.com) → Sign up gratuit
2. Dashboard → **API Keys** → Create API Key → copiaz-o
3. (Opțional dar recomandat) Verifică domeniul tău de email în Resend → **Domains**
   - Până atunci, emailurile se trimit de pe `onboarding@resend.dev` (funcționează pentru test)

### 3. Creează repo GitHub și fă push
```bash
git init
git add .
git commit -m "EN 2026 study app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/studiu-en2026.git
git push -u origin main
```

### 4. Deploy pe Vercel
1. Mergi pe [vercel.com](https://vercel.com) → **Add New Project**
2. Import din GitHub → selectează `studiu-en2026`
3. Framework: **Vite** (detectat automat)
4. Înainte de deploy, adaugă **Environment Variables**:

| Variable | Valoare |
|----------|---------|
| `RESEND_API_KEY` | cheia de la Resend (re_xxx...) |
| `CRON_SECRET` | orice string random (ex: `abc123xyz`) |

5. Click **Deploy** → gata în ~60 secunde

### 5. Trimite link-ul lui Ari
Link-ul va fi ceva de genul: `https://studiu-en2026.vercel.app`

---

## 🔒 Parolă Admin

Parola implicită pentru panoul Tata este: **`babel2026`**

Pentru a o schimba, editează în `src/constants.js`:
```js
adminPasswordB64: btoa("parola_ta_noua"),
```

---

## ✉️ Cum funcționează emailurile

| Trigger | Cine primește | Când |
|---------|---------------|------|
| Ari urcă check-in | Colin (tată) | Imediat |
| Reminder manual | Ari | Când Colin apasă butonul |
| Reminder automat | Ari + CC Colin | Vineri 18:00 |

---

## 📅 Date examene

- **Română:** 22 iunie 2026
- **Matematică:** 24 iunie 2026
- **Rezultate inițiale:** 1 iulie 2026

---

## 🔧 Structura proiectului

```
studiu-en2026/
├── api/
│   ├── send-email.js      # Serverless function - trimite emailuri via Resend
│   └── cron-reminder.js   # Cron job - rulează vineri 18:00
├── src/
│   ├── App.jsx            # Router student/admin + login admin
│   ├── constants.js       # Date examene, curriculum, săptămâni
│   ├── pages/
│   │   ├── StudentApp.jsx # Interfața lui Ari
│   │   └── AdminApp.jsx   # Panoul lui Colin
│   └── utils/
│       ├── storage.js     # localStorage helpers
│       └── email.js       # Funcții email + template-uri HTML
├── vercel.json            # Config cron + rewrites
├── .env.example           # Template pentru variabile de mediu
└── vite.config.js
```
