# Deploy Connect Intel (step-by-step)

## 1. Google login (do this before or right after deploy)

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create project → **APIs & Services** → **Credentials** → **Create OAuth client ID**
3. Type: **Web application**
4. **Authorized JavaScript origins:**
   - `http://localhost:5173` (local dev)
   - `https://YOUR-APP.vercel.app` (after first deploy)
   - `https://yourdomain.com` (custom domain later)
5. Copy the **Client ID**
6. In Vercel: **Project → Settings → Environment Variables**
   - Name: `VITE_GOOGLE_CLIENT_ID`
   - Value: your client ID
   - Apply to Production + Preview
7. **Redeploy** (Deployments → ⋯ → Redeploy)

Without this variable, the app shows **Continue with Google (demo)** — works for testing, not real accounts.

---

## 2. Deploy on Vercel (recommended)

### A. Push to GitHub

```bash
cd "/Users/apple/Downloads/Connect intel"
git init
git add .
git commit -m "Connect Intel — landing, Google auth, people search"
```

Create repo on GitHub, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/connect-intel.git
git push -u origin main
```

### B. Import on Vercel

1. [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Vercel auto-detects `vercel.json`:
   - Build: `frontend`
   - Output: `site/`
4. Add `VITE_GOOGLE_CLIENT_ID` (step 1)
5. **Deploy**

Your live URL: `https://connect-intel-xxxx.vercel.app`

### C. Custom domain (optional)

Vercel → **Settings → Domains** → add `app.yourcompany.com`

Update Google OAuth origins with the new domain.

---

## 3. Update local build after changes

```bash
cd "/Users/apple/Downloads/Connect intel"
npm run deploy:copy
```

---

## 4. Checklist before sharing publicly

- [ ] `VITE_GOOGLE_CLIENT_ID` set on Vercel
- [ ] Google OAuth origins include production URL
- [ ] Test Google sign-in on live URL
- [ ] Test People Search inside app
- [ ] Add Privacy Policy / Terms links (footer) when ready for enterprise

---

## 5. What’s next (after deploy)

| Phase | Task |
|-------|------|
| Backend | API for Claude lead search (hide API keys) |
| Database | Real users, saved leads |
| Apollo.io | People data API |
| Hunter.io | Email verification |

---

## Local dev with Google

```bash
cd frontend
cp ../.env.example .env
# Edit .env — paste VITE_GOOGLE_CLIENT_ID
npm run dev
```

Open http://localhost:5173
