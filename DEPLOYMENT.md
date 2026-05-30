# Deploy Connect Intel (go live for everyone)

This guide explains how to publish your app so **anyone with a link** can use it, add a **custom domain** later, and grow toward **enterprise** (API keys, CRM integrations, big-company tools).

**Production rollback:** See [`docs/PRODUCTION_LOG.md`](docs/PRODUCTION_LOG.md) — dated snapshots of every live deploy with one-command rollback (`npm run prod:rollback -- <commit>`).

**Release process:** [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) — run `npm run prod:ship` before push, `npm run prod:log` after Vercel is live.

---

## What gets deployed

After you build, these files are what the internet serves:

| File / folder | Purpose |
|---------------|---------|
| `index.html` | Main entry (open this in browser or on hosting) |
| `assets/` | JavaScript & CSS (required — keep next to `index.html`) |
| `favicon.svg` | Browser tab icon |

**Source code** lives in `frontend/`. **Deploy** the `site/` folder (or root copies after `npm run deploy:copy`).

---

## Step 1 — Build on your Mac

```bash
cd "/Users/apple/Downloads/Connect intel"
npm run deploy:copy
```

This will:

1. Build the React app into `site/`
2. Copy `index.html`, `assets/`, and `favicon.svg` into the **Connect intel** folder

**Test locally before deploying:**

- Double-click `index.html`, or  
- Run: `npx serve .` in the Connect intel folder → open the URL shown (e.g. `http://localhost:3000`)

> **Note:** Opening `index.html` as `file://` works for the UI; some browsers restrict modules. Prefer `npx serve .` for a realistic test.

---

## Step 2 — Choose where to host (recommended order)

### Option A — **Vercel** (recommended for startups)

- Free tier, fast CDN, easy custom domain (`connectintel.com`)
- Auto HTTPS, good for React SPAs

1. Push the project to **GitHub** (see Step 3).
2. Go to [vercel.com](https://vercel.com) → Sign up → **Add New Project**.
3. Import your GitHub repo.
4. Vercel reads `vercel.json` automatically:
   - Build: `cd frontend && npm install && npm run build`
   - Output: `site/`
5. Click **Deploy**. You get a URL like `https://connect-intel.vercel.app`.
6. **Custom domain:** Project → Settings → Domains → add `www.yourdomain.com`.

### Option B — **Netlify**

1. [netlify.com](https://netlify.com) → **Add new site** → Import from Git.
2. Uses `netlify.toml` in this repo (build in `frontend/`, publish `site/`).
3. Add custom domain under **Domain management**.

### Option C — **Cloudflare Pages**

1. [dash.cloudflare.com](https://dash.cloudflare.com) → Pages → Create project.
2. Connect GitHub.
3. Build settings:
   - **Root directory:** `frontend`
   - **Build command:** `npm install && npm run build`
   - **Build output:** `../site`
4. Great if you already use Cloudflare for DNS.

### Option D — **GitHub Pages** (free, good for demos)

If your repo is `username/connect-intel`:

```bash
cd frontend
VITE_BASE_PATH=/connect-intel/ npm run build
```

Upload contents of `site/` to the `gh-pages` branch, or use GitHub Actions.

Site URL: `https://username.github.io/connect-intel/`

---

## Step 3 — Put code on GitHub (one time)

```bash
cd "/Users/apple/Downloads/Connect intel"
git init
git add .
git commit -m "Connect Intel — lead search app"
```

Create a repo on GitHub, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/connect-intel.git
git branch -M main
git push -u origin main
```

Then connect that repo to Vercel / Netlify / Cloudflare.

---

## Step 4 — Custom domain (when you go professional)

1. Buy a domain (Namecheap, Google Domains, Cloudflare Registrar) — e.g. `connectintel.io`.
2. In Vercel/Netlify/Cloudflare → add domain → follow DNS instructions (usually 1–2 CNAME records).
3. HTTPS is automatic in ~minutes.

**For big-company credibility later:** use `app.connectintel.com` for the product and `connectintel.com` for marketing.

---

## Step 5 — What to add before “real” public launch

The current app runs **in the browser** with demo data. For production:

| Need | Why | Where to host |
|------|-----|----------------|
| **Backend API** | Hide Claude / Apollo / Hunter API keys | Railway, Render, Fly.io, or Vercel Serverless |
| **Database** | Users, saved leads, billing | Supabase, PlanetScale, or PostgreSQL on Railway |
| **Auth** | Real sign-up / login | Clerk, Auth0, or Supabase Auth |
| **Env variables** | `ANTHROPIC_API_KEY`, etc. | Hosting dashboard — never in frontend code |

Architecture when live:

```
User browser  →  connectintel.com (static: index.html)
              →  api.connectintel.com (Node/Python: search, save leads)
              →  Claude / Apollo / Hunter APIs (server-side only)
```

---

## Enterprise & big-company integrations (roadmap)

The landing page lists **planned** connections (Salesforce, HubSpot, Google, Microsoft, LinkedIn, Slack) and data partners (Apollo.io, Hunter.io, Claude).

**Before claiming “used by Company X”:** get legal partnership or customer permission and replace text placeholders with real logos.

**Typical order:**

1. Launch static app + waitlist (Vercel + custom domain)  
2. Add backend + Claude search API  
3. Add user accounts + database  
4. Apply for Apollo.io / Hunter.io API access  
5. Build CRM sync (HubSpot/Salesforce OAuth)  
6. SOC 2 / GDPR documentation if selling to enterprises  

---

## Updating the live site after changes

```bash
cd "/Users/apple/Downloads/Connect intel"
# Edit files in frontend/src/...
npm run deploy:copy   # refresh index.html + assets in this folder
git add .
git commit -m "Update lead search UI"
git push
```

If connected to Vercel/Netlify, **push to GitHub = automatic redeploy**.

---

## Files in this folder

| Path | Role |
|------|------|
| `index.html` | Deployable app entry (generated) |
| `assets/` | Built JS/CSS (generated) |
| `site/` | Build output (same as above, used by Vercel) |
| `frontend/` | Source — edit here |
| `connect-ai.html` | Older prototype — redirects to new app |
| `DEPLOYMENT.md` | This file |

---

## Quick help

| Problem | Fix |
|---------|-----|
| Blank page after deploy | Ensure `assets/` uploaded with `index.html`; check browser console |
| 404 on refresh | SPA redirect rules (`vercel.json` / `netlify.toml` already included) |
| Wrong path on GitHub Pages | Rebuild with `VITE_BASE_PATH=/your-repo-name/` |
| API keys exposed | Move all API calls to a backend — never commit `.env` |

For questions about a specific host, see their docs: [Vercel](https://vercel.com/docs), [Netlify](https://docs.netlify.com), [Cloudflare Pages](https://developers.cloudflare.com/pages/).
