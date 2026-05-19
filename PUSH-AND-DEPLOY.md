# Push to GitHub + Deploy on Vercel

Your code is committed locally. Finish these steps in the browser + Terminal.

---

## PART A — Create GitHub repository (browser)

1. Go to **https://github.com** and sign in  
2. Click **+** (top right) → **New repository**  
3. Settings:
   - **Repository name:** `connect-intel` (or any name you like)
   - **Public** or **Private** — your choice  
   - **Do NOT** check “Add a README” (you already have code)  
4. Click **Create repository**  
5. GitHub shows a page with commands — **keep this tab open**

---

## PART B — Push your code (Terminal)

Copy your GitHub username from the URL (example: `github.com/johnsmith` → username is `johnsmith`).

Run these commands **one block at a time** (replace `YOUR_USERNAME`):

```bash
cd "/Users/apple/Downloads/Connect intel"

git remote add origin https://github.com/YOUR_USERNAME/connect-intel.git

git push -u origin main
```

### If GitHub asks you to log in

- Browser window may open — sign in and approve  
- Or use **Personal Access Token** as password:
  - GitHub → **Settings** → **Developer settings** → **Personal access tokens** → generate token with `repo` access  
  - Paste token when Terminal asks for password  

### If you see “remote origin already exists”

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/connect-intel.git
git push -u origin main
```

When done, refresh GitHub — you should see all your project files.

---

## PART C — Deploy on Vercel (browser)

1. Go to **https://vercel.com**  
2. **Sign up** or **Log in** → choose **Continue with GitHub**  
3. Authorize Vercel to access GitHub  
4. Click **Add New…** → **Project**  
5. Find **connect-intel** → click **Import**  
6. **Configure Project** — use these settings:

| Setting | Value |
|---------|--------|
| Framework Preset | Other (or Vite if listed) |
| Root Directory | `.` (leave default — whole repo) |
| Build Command | `cd frontend && npm ci && npm run build` |
| Output Directory | `site` |
| Install Command | `cd frontend && npm ci` |

(Vercel may auto-fill these from `vercel.json`.)

7. **Environment Variables** — click **Add**:
   - **Name:** `VITE_GOOGLE_CLIENT_ID`  
   - **Value:** same Client ID as in your `frontend/.env` file  
   - Enable: **Production**, **Preview**, **Development**  
8. Click **Deploy**  
9. Wait 1–3 minutes until status is **Ready**  
10. Click **Visit** — you get a URL like `https://connect-intel-xxxxx.vercel.app`

---

## PART D — Google login on live site (required)

Your live URL must be allowed in Google Cloud.

1. **Google Cloud** → **Google Auth Platform** → **Clients**  
2. Open your **Web** client  
3. **Authorized JavaScript origins** → **Add URI**:

```
https://YOUR-APP-NAME.vercel.app
```

(Use your real Vercel URL — `https`, no slash at the end)

4. **Save**  
5. **Vercel** → your project → **Deployments** → latest → **⋯** → **Redeploy**

Test: open live URL → **Continue with Google** → your Gmail.

---

## PART E — Updates later

After you change code:

```bash
cd "/Users/apple/Downloads/Connect intel"
git add .
git commit -m "Describe your change"
git push
```

Vercel redeploys automatically.

---

## Checklist

- [ ] GitHub repo created  
- [ ] `git push` succeeded  
- [ ] Vercel project imported  
- [ ] `VITE_GOOGLE_CLIENT_ID` added on Vercel  
- [ ] Vercel URL added to Google JavaScript origins  
- [ ] Redeployed after Google change  
- [ ] Google login works on live URL  

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build failed on Vercel | Check **Deployments** → **Building** → read error log |
| Google works locally but not live | Add Vercel URL to Google origins + redeploy |
| Blank page on Vercel | Confirm Output Directory is `site` |
| 404 on refresh | `vercel.json` rewrites are included — redeploy |

Your live link is safe to share after Google login works.
