# Railway email worker — deploy once

Bulk email (**>10 recipients**) and Marketing campaigns require a **24/7 worker** to process the Redis queue. Vercel only enqueues jobs.

## Quick connect (automated)

From the repo root (Vercel CLI logged in):

```bash
npx @railway/cli login              # or: login --browserless
npm run railway:connect
```

This script:

1. Pulls production env from Vercel
2. Creates/links Railway project `connect-intel-workers`
3. Sets worker env vars (`REDIS_URL`, Supabase, Gmail, etc.)
4. Connects GitHub repo `nee9raj-hue/connect-intel`
5. Deploys `npm run workers` (from `railway.toml`)

Verify: `curl -s https://connectintel.net/api/health | jq '.worker, .emailV3'`

### Sensitive secrets (one-time)

Vercel marks `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_*`, etc. as **Sensitive** — the CLI cannot re-export them.

1. Copy `.env.railway.secrets.example` → `.env.railway.secrets`
2. Fill from [Supabase API settings](https://supabase.com/dashboard/project/hkdrannqcnszfukcqchj/settings/api) and Google Cloud OAuth
3. Re-run `npm run railway:connect` (syncs secrets + redeploys)

Or paste in Railway → **email-worker** → **Variables**.

---

## Manual setup

## 1. Create Railway service

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select **connect-intel** (same repo as Vercel)
3. Railway detects `railway.toml` → start command: `npm run workers`

## 2. Environment variables (copy from Vercel)

In Railway → service → **Variables**, add the same secrets as Vercel Production:

| Variable | Required |
|----------|----------|
| `REDIS_URL` | Yes |
| `SUPABASE_URL` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `GOOGLE_CLIENT_ID` | Yes (Gmail send) |
| `GOOGLE_CLIENT_SECRET` | Yes |
| `RESEND_API_KEY` | If using org domain |
| `EMAIL_FROM` | Yes |
| `SESSION_SECRET` | Yes |

Copy `REDIS_URL` from Vercel → Settings → Integrations → Upstash.

## 3. Deploy

Railway builds with `npm ci` and runs:

```bash
npm run workers
```

## 4. Verify

```bash
curl -s https://connectintel.net/api/health | jq '.worker, .emailV3'
```

Expect:

```json
{ "ok": true, ... }
{ "ready": true }
```

Or:

```bash
curl -s https://connectintel.net/api/infra/queue | jq '.email'
```

`queueBacklog` should drop to **0** after a test campaign.

## 5. Scale (20k+ emails)

Railway → service → **Settings** → increase **replicas** (multiple workers share one Redis queue).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `worker.ok: false` | Railway service not running or missing `REDIS_URL` |
| Jobs in `delayed` | Worker offline — deploy Railway |
| Emails stuck queued | Check Railway logs for Gmail auth errors |
