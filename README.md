# 🎓 Planul lui Ari – EN 2026 v2

## Cum funcționează bifarea unui capitol
1. **📚 Lecție** — Claude generează explicația (salvată local, nu se regenerează)
2. **💬 Tutore** — Chat cu Claude contextualizat pe capitol
3. **🧠 Quiz** — 10 întrebări generate de Claude, minim 8/10 pentru a trece
4. **📸 Screenshot** — Ari încarcă dovada că a studiat
5. ✅ Abia după quiz trecut + screenshot → capitolul e bifat automat

## Deploy pe Vercel

### 1. Instalează și testează local
```bash
npm install
npm run dev
```

### 2. Push pe GitHub
```bash
git init && git add . && git commit -m "EN 2026 v2"
git remote add origin https://github.com/YOUR/studiu-en2026.git
git push -u origin main
```

### 3. Vercel Environment Variables
| Variabilă | De unde | Obligatorie |
|-----------|---------|-------------|
| `ANTHROPIC_API_KEY` | platform.claude.com → API Keys | ✅ |
| `RESEND_API_KEY` | resend.com → API Keys | ✅ |
| `CRON_SECRET` | Orice string random | ✅ |

### 4. Redeploy după ce adaugi variabilele
Vercel Dashboard → Deployments → Redeploy

## Parola Admin
Implicită: **`babel2026`**

Pentru a schimba: editează în `src/constants.js`:
```js
adminPasswordB64: btoa("parola_ta_noua"),
```

## Cheia Anthropic
Mergi pe https://platform.claude.com/settings/workspaces/default/keys
→ Create Key → copiaz-o → pune-o în Vercel ca `ANTHROPIC_API_KEY`

## Structura
```
api/
  claude.js          ← proxy Anthropic (ține cheia secret pe server)
  send-email.js      ← Resend email
  cron-reminder.js   ← vineri 18:00 automat
src/
  App.jsx            ← router student/admin + login
  constants.js       ← curriculum complet EN VIII
  pages/
    StudentApp.jsx   ← interfața lui Ari
    AdminApp.jsx     ← panoul lui Colin
    ChapterPage.jsx  ← lecție + chat + quiz + screenshot
  utils/
    api.js           ← toate apelurile Claude + email
    storage.js       ← localStorage helpers
```
