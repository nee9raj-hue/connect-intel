# Infrastructure setup — Redis, Meilisearch, workers, monitoring

Optional services that unlock enterprise scalability. **The app works without them** (in-memory fallbacks + existing JSON shards).

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

## 2. BullMQ workers

API enqueues jobs; **workers must run on a long-lived host** (not Vercel).

### Railway / Fly / VPS

```bash
REDIS_URL=rediss://... npm run workers
```

Queues: `ci-email`, `ci-automation`, `ci-import`, `ci-export`, `ci-analytics`, `ci-notification`, `ci-search-index`

### Safety net (no dedicated worker)

Vercel cron hits `/api/workers/cron` every 5 minutes (requires `CRON_SECRET`).

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

**Backfill** (future script): copy each `pipeline_org_*` shard into `pipeline_leads` before cutting over reads.

---

## 5. Monitoring

| Variable | Purpose |
|----------|---------|
| `PROMETHEUS_METRICS=true` | Enable `GET /api/metrics` |
| `METRICS_SECRET` | Optional bearer token for metrics scrape |

Health: `GET /api/health` includes Supabase circuit breaker, Redis, Meilisearch.

Scrape Prometheus from Grafana Cloud or self-hosted Prometheus.

---

## Rollout order

1. Upgrade Supabase Micro → Small
2. Redis + workers (email queue offloads bulk sends)
3. Meilisearch + backfill largest org
4. `USE_PIPELINE_LEADS_TABLE` after migration + backfill
5. Prometheus + Grafana alerts on PostgREST errors

See also: `docs/ENTERPRISE_SCALABILITY.md`
