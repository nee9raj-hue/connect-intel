# Meilisearch on Railway

Platform search (`⌘K`, pipeline search) uses **Meilisearch** when `MEILI_HOST` + `MEILI_API_KEY` are set on Vercel.

**Current production host:** removed (Jul 2026) — solo-free production no longer uses Meilisearch. Railway projects `connect-intel-meili` and `connect-intel-workers` were deleted.

If `/api/health` shows `meilisearch.ok: false` or Railway returns **502**, the Meilisearch service is stopped — redeploy it.

---

## Quick redeploy (automated)

```bash
npx @railway/cli login
npm run meili:railway
```

This script:

1. Links/creates Railway project `connect-intel-meili`
2. Deploys `getmeili/meilisearch` from `infra/meilisearch/`
3. Reads the public URL + master key
4. Updates Vercel `MEILI_HOST` + `MEILI_API_KEY`
5. Redeploys production and runs `meili-sync` for Xindus

---

## Manual restart (dashboard)

1. Open [Railway](https://railway.app) → project **connect-intel-meili**
2. Select the Meilisearch service → **Restart** or **Redeploy**
3. Copy **Settings → Networking → Public domain**
4. Copy **Variables → MEILI_MASTER_KEY** (or `MEILI_API_KEY`)
5. Vercel → **connect-intel** → Settings → Environment Variables:
   - `MEILI_HOST` = `https://….up.railway.app` (no trailing slash)
   - `MEILI_API_KEY` = master key
6. Redeploy Vercel production (or push to `main`)
7. Verify:

```bash
curl -s https://connectintel.net/api/health | jq '.meilisearch, .readiness.search'
npm run prod:ops -- --name=Xindus
```

---

## Index

- UID: `connectintel_crm`
- Document IDs: `lead_<id>`, `contact_<id>`, `company_<id>` (no colons — Meilisearch constraint)

---

## Cost

Railway Hobby usage-based (~$5/mo for always-on Meilisearch). Alternative: [Meilisearch Cloud](https://www.meilisearch.com/cloud) — set the same env vars on Vercel.
