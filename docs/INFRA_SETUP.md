# Infrastructure setup — Redis, Meilisearch, workers, monitoring

Optional services that unlock enterprise scalability. **The app works without them** (in-memory fallbacks + existing JSON shards).

**One-shot production setup:** see **`docs/PLATFORM_HARDENING.md`** (checklist + `npm run infra:verify`).

---

## 1. Redis (Upstash recommended)

Used for: dashboard cache, BullMQ job queues, stale-while-revalidate.

### Vercel env vars

| Variable | Example |
|----------|---------|
| `REDIS_URL` | `rediss://default:xxx@xxx.upstash.io:6379` |
| `UPSTASH_REDIS_REST_URL` | `https://xxx.upstash.io` (optional, serverless cache reads) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST token |

Set at least `REDIS_URL` for BullMQ. Add REST vars for faster cache on serverless without TCP.

Verify: `GET /api/health` → `redis.ok: true`

---

## 2. BullMQ workers (required for background email)

Without Railway worker, sends still use **browser drain** (MVP). With worker, users can **close the tab**.

### Railway (recommended)

1. New Railway service → connect repo
2. Set env: `REDIS_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Gmail/Resend vars same as Vercel
3. Deploy uses `railway.toml` → `npm run workers`

```bash
REDIS_URL=rediss://... npm run workers
```

See **`docs/EMAIL_INFRASTRUCTURE_V3.md`** (current) and **`docs/EMAIL_INFRASTRUCTURE_V2.md`** for history.

Queues: `ci-email`, `ci-automation`, `ci-import`, `ci-export`, `ci-analytics`, `ci-notification`, `ci-search-index`

### Event-driven drain (Hobby-safe — no frequent cron)

After any Redis enqueue, the API **fire-and-forgets** `POST /api/workers/cron` (see `lib/server/queue/triggerDrain.js`). Email sends do **not** wait for Vercel cron.

Primary email path remains: **user clicks Send → enroll → browser `drain` loop** (`AppContext.sendBulkEmail`).

### Safety net

- Daily `marketing/cron` (09:00 UTC): catch-up enrollments (50), reminders, scheduled campaigns — **not** the primary send path.
- Dedicated worker: `npm run workers` on Railway/Fly when `REDIS_URL` is set.

See **`docs/CRON_AUDIT.md`** for full cron analysis.

---

## 3. Meilisearch

Sub-200ms platform search at 100k+ contacts.

| Variable | Example |
|----------|---------|
| `MEILI_HOST` | `https://xxx.meilisearch.io` |
| `MEILI_API_KEY` | Master or search key |

Index: `connectintel_pipeline` (auto-created on first sync).

Initial backfill (run once from a machine with env vars):

```bash
node -e "
import { syncPipelineLeadsToMeilisearch } from './lib/server/meilisearch/sync.js';
await syncPipelineLeadsToMeilisearch({
  organizationId: 'YOUR_ORG_ID',
  shardName: 'pipeline_org_YOUR_ORG_ID',
});
"
```

Ongoing: `search-index` queue jobs on pipeline writes when Redis is enabled.

---

## 4. Per-lead pipeline table

Run migration in Supabase SQL editor:

`supabase/migrations/20260609120000_pipeline_leads.sql`

Then enable:

```
USE_PIPELINE_LEADS_TABLE=true
```

CRM batch patches use `pipeline_leads` rows instead of full shard rewrites.

Backfill existing shards (run once from a machine with Supabase env vars):

```bash
npm run pipeline:backfill              # all org + user shards
npm run pipeline:backfill -- --org=ORG_ID   # Xindus only
npm run pipeline:backfill -- --dry-run      # count only
npm run pipeline:backfill -- --verify       # confirm table matches shards
```

Then enable `USE_PIPELINE_LEADS_TABLE=true` and redeploy.

**Backfill** (future script): copy each `pipeline_org_*` shard into `pipeline_leads` before cutting over reads.

---

## 5. Monitoring

| Variable | Purpose |
|----------|---------|
| `PROMETHEUS_METRICS=true` | Enable `GET /api/metrics` |
| `METRICS_SECRET` | Optional bearer token for metrics scrape |

Health: `GET /api/health` includes Supabase circuit breaker, Redis, Meilisearch.

Scrape Prometheus from Grafana Cloud or self-hosted Prometheus.

**Grafana:** `npm run grafana:verify` then `docs/GRAFANA_SETUP.md` (Alloy on Railway + dashboard import).

**DB migrations:** Set `SUPABASE_DB_PASSWORD` + pooler host from Supabase dashboard (`SUPABASE_DB_HOST` or `DIRECT_URL`). Probe: `npm run db:probe`.

---

## Rollout order

1. Upgrade Supabase Micro → Small
2. Redis + workers (email queue offloads bulk sends)
3. Meilisearch + backfill largest org
4. `USE_PIPELINE_LEADS_TABLE` after migration + backfill
5. Prometheus + Grafana alerts on PostgREST errors

See also: `docs/ENTERPRISE_SCALABILITY.md`
