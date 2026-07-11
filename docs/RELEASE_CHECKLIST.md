# Release checklist (Connect Intel)

Use this before every **production** push to `main`. Production auto-deploys on Vercel when CI passes.

**Live site:** https://connectintel.net

---

## Local preview (do this before every deploy)

Review UI on your machine first. **Do not push to `main` until desktop and mobile look right.**

### Option A — Fast iteration (hot reload)

Terminal 1 — frontend with live edits:

```bash
npm run dev
```

Terminal 2 — API routes (same as production handlers):

```bash
npx vercel dev
```

Open **http://localhost:5173** (Vercel dev proxies `/api` to your local serverless functions).

| View | How |
|------|-----|
| **Desktop** | Full-width browser window |
| **Mobile** | Chrome DevTools → toggle device toolbar → iPhone / Pixel preset, or narrow window to &lt;768px |

Sign in with Google (add `http://localhost:5173` in Google Cloud OAuth origins if needed — see `GOOGLE-LOGIN-SETUP.md`).

### Option B — Production build preview (closest to what ships)

Builds the exact bundle Vercel deploys, then serves it locally:

```bash
npm run prod:preview
```

Open **http://127.0.0.1:4173** and repeat desktop + mobile checks above.

When satisfied:

```bash
npm run prod:ship
git push origin main
```

---

## Before you push

Run from repo root:

```bash
npm run prod:ship
```

This runs build + missing-file checks (e.g. `slackOAuth.js`, `phone-call-icon.png`).

Manual smoke (2–5 min) — on **local preview** (`5173` or `4173`), not only production:

- [ ] **Pipeline** — leads load; **5 filter icons** on mobile (same as desktop); merged top bar; call icon on phone column only
- [ ] **Chithi** — opens without API errors; menu icon visible
- [ ] **Marketing** — Lists tab filters work on mobile (Filters sheet → Apply)
- [ ] **Auth** — sign-in still works
- [ ] **Platform operator** — company user must **not** reach `?panel=admin-home` (redirects to Home); no Vercel/`ADMIN_EMAILS` text in UI
- [ ] **Platform operator (staff)** — `ADMIN_EMAILS` user sees Platform backend nav after sign-in
- [ ] **Scope** — Android/Capacitor not included unless explicitly shipping native

Automated smoke (no login):

```bash
npm run prod:smoke
```

---

## Push and deploy

```bash
git push origin main
```

1. **GitHub Actions** → [Actions tab](https://github.com/nee9raj-hue/connect-intel/actions) — wait for green CI
2. **Vercel** — Production deployment **Ready** (~20–30s after push)
3. Optional: open the deployment **preview URL** from Vercel before trusting live traffic

---

## After production is live

```bash
npm run prod:log
```

Confirm the new commit is **← LIVE** in [`PRODUCTION_LOG.md`](PRODUCTION_LOG.md).

```bash
npm run prod:smoke
```

Optional — search/index for one org after deploy:

```bash
npm run prod:ops -- --name=Xindus
```

Optional — mark a known-good release:

```bash
npm run prod:tag -- <commit>
# e.g. npm run prod:tag -- 1e99102
```

---

## If something breaks in production

1. **Rollback first** (users back on old build in ~30s):

   ```bash
   npm run prod:rollback -- <commit>
   ```

   Pick commit from [`PRODUCTION_LOG.md`](PRODUCTION_LOG.md).

2. **Fix on main** — `git revert` or new commit; do not force-push unless you understand the impact.

3. Re-run `npm run prod:ship` → push → `npm run prod:log`.

---

## Staging / preview (recommended habit)

Every push to `main` and every PR gets a **Vercel Preview URL** (not connectintel.net).

- Use preview URLs to test risky UI (marketing, mobile filters, PWA) before merging.
- For a long-lived staging site: create branch `staging`, connect it in Vercel → Settings → Git → Production Branch overrides, assign `staging.connectintel.net` (optional).

---

## Environment variables (Vercel)

If a feature works locally but fails in production, check Vercel → Project → Settings → Environment Variables:

- Anthropic / search keys
- VAPID keys (Chithi push)
- Slack (`SLACK_CLIENT_ID` / secret — only if using OAuth)
- Gmail / WhatsApp org settings (configured in app, not always env)

Document new required env vars in commit messages when you add them.

---

## What protects what

| Tool | Protects against |
|------|------------------|
| `npm run prod:ship` + CI | Broken build, missing files before deploy |
| Vercel Preview | Shipping broken UI without testing |
| `npm run prod:log` | Not knowing which commit was live when |
| `npm run prod:rollback` | Live site down after bad deploy |
| `npm run prod:tag` | Named restore points in git |
| DB backups (manual) | Data loss — plan separately if SQLite store is critical |
