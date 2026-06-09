# Railway email worker — deploy once

Bulk email (**>10 recipients**) and Marketing campaigns require a **24/7 worker** to process the Redis queue. Vercel only enqueues jobs.

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
