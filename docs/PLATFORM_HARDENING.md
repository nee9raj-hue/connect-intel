# Connect Intel — Platform Hardening (one-shot setup)

Ship code first, then provision external services. Total time: **~2 hours**.

---

## Milestone checklist

| Step | Service | Env vars | Verify |
|------|---------|----------|--------|
| 1 | **Supabase Small** | (Dashboard → Compute) | No PGRST002 under load |
| 2 | **Upstash Redis** | `REDIS_URL` | `/api/health` → `redis.ok: true` |
| 3 | **Railway worker** | Same as Vercel + `REDIS_URL` | `/api/health` → `worker.ok: true` |
| 4 | **Meilisearch** | `MEILI_HOST`, `MEILI_API_KEY` | `/api/health` → `meilisearch.ok: true` |
| 5 | **Backfill search** | — | `npm run meili:backfill` |
| 6 | **Prometheus** | `PROMETHEUS_METRICS=true`, `METRICS_SECRET` | `GET /api/metrics` |
| 7 | **Sentry** (optional) | `SENTRY_DSN` | Trigger test error |
| 8 | **Verify** | — | `npm run infra:verify` |

---

## 1. Supabase — upgrade to Small

1. [Supabase Dashboard](https://supabase.com/dashboard) → project `hkdrannqcnszfukcqchj`
2. **Settings → Infrastructure → Compute** → **Small** ($25/mo)
3. Enable **Supavisor** connection pooler (transaction mode) for future scale

**Capacity report (platform admin):** `GET /api/infra/capacity` while signed in as platform admin.

---

## 2. Upstash Redis

1. [console.upstash.com](https://console.upstash.com) → Create database
2. Copy **TCP** URL (`rediss://default:...@....upstash.io:6379`)
3. Vercel → **connect-intel** → Environment Variables → Production:

```
REDIS_URL=rediss://...
UPSTASH_REDIS_REST_URL=https://....upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

4. **Redeploy** production

---

## 3. Railway worker

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Set environment (mirror Vercel production):

```
REDIS_URL
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
EMAIL_FROM
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
EMAIL_WORKER_CONCURRENCY=2
```

3. Railway uses `railway.toml` → `npm run workers`
4. Logs should show: `Connect Intel workers started (7 queues)`

---

## 4. Meilisearch

**Option A — Meilisearch Cloud** (~$30/mo)  
**Option B — Railway/Fly** self-host (~$10–20/mo)

```
MEILI_HOST=https://your-meili-host
MEILI_API_KEY=your-master-key
```

Backfill (from laptop with env vars):

```bash
npm run meili:backfill
# Or one org:
node scripts/backfill-meilisearch.mjs --org=YOUR_ORG_ID
```

Search index: `connectintel_crm` (leads, deals, contacts, campaigns, tasks, notes, messages).

---

## 5. Monitoring

### Prometheus (built-in)

```
PROMETHEUS_METRICS=true
METRICS_SECRET=<random-32-chars>
```

Grafana Cloud → Add Prometheus data source → scrape:

```
https://connectintel.net/api/metrics?secret=YOUR_SECRET
```

Key metrics:
- `connectintel_api_request_duration_seconds`
- `connectintel_platform_search_duration_seconds`
- `connectintel_pipeline_bootstrap_duration_seconds`
- `connectintel_queue_jobs_total`

### Sentry (optional)

```
SENTRY_DSN=https://...@sentry.io/...
SENTRY_TRACES_SAMPLE_RATE=0.1
```

Browser errors POST to `/api/client-error` automatically via ErrorBoundary.

### Supabase alerts

Dashboard → Reports → set email when CPU > 80% or connections > 70% of max.

### Executive dashboard panels

| Panel | Source |
|-------|--------|
| CRM uptime | `/api/health` synthetic check |
| Search p95 | Grafana `connectintel_platform_search_duration_seconds` |
| Pipeline load | `connectintel_pipeline_bootstrap_duration_seconds` |
| Email backlog | `/api/health` → `worker.emailQueueBacklog` |
| Worker alive | `/api/health` → `worker.ok` |
| PostgREST errors | Sentry + `supabase.circuit` |

---

## 6. Verify production

```bash
npm run infra:verify
# Or against preview:
node scripts/infra-verify.mjs --url=https://your-preview.vercel.app
```

Expected when complete:

```json
{
  "readiness": {
    "backgroundEmail": true,
    "search": true,
    "worker": true,
    "platformReady": true
  }
}
```

---

## App-side concurrency (shipped in code)

These reduce load **before** infra upgrades; safe for all orgs:

| Optimization | Effect |
|--------------|--------|
| Session user cache (60s) | Fewer auth DB reads per API call |
| Session GET refresh at most every 5 min | Less `/api/auth/session` load |
| Notification poll loads **recent + due follow-ups** only | Not full 6k+ lead shard every 60s |
| Pipeline bootstrap / dashboard request dedup | Tab focus + mount storms coalesce |
| Background poll pauses when tab hidden | Saves bandwidth per active user |
| Pipeline text search via scoped SQL | Search without full-shard scan |

**Production env (enable when backfill complete):**

```
USE_PIPELINE_LEADS_TABLE=true
USE_PIPELINE_HIERARCHY_RBAC=true
REDIS_URL=...          # shared dashboard cache across instances
MEILI_HOST=...         # optional faster search
```

---

## 7. Smoke test (Xindus-scale org)

1. Pipeline search — should return `provider: "meilisearch"` in network tab
2. Send 10-email pipeline bulk → close tab → campaign completes
3. Dashboard + pipeline load while campaign runs — CRM stays responsive
4. `GET /api/infra/capacity` — note largest `pipeline_org_*` shard MB

---

## Rollout order

1. Supabase Small (no code deploy)
2. Redis + Vercel redeploy
3. Railway worker
4. Meilisearch + backfill
5. Prometheus + Sentry
6. `npm run infra:verify`

See also: `docs/INFRA_SETUP.md`, `docs/EMAIL_INFRASTRUCTURE_V2.md`
