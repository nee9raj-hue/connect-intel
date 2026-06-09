# Connect Intel — Enterprise Scalability & System Resilience

**Status:** Living architecture document (June 2026)  
**Incident driver:** ~200 pipeline bulk emails caused Supabase PostgREST `PGRST002` (unhealthy) and full-team CRM outage (Xindus org, ~6,600 pipeline rows).

---

## 1. Scalability audit (current state)

| Area | Today | Risk at 50 tenants / 100k contacts |
|------|--------|-------------------------------------|
| **Data store** | Supabase `store_collections` JSON blobs (~40 collections) | Entire org pipeline in one row (`pipeline_org_*`) — O(n) read/write per patch |
| **API runtime** | Vercel serverless, `maxDuration` 300s | Long requests block user perception; no process isolation |
| **Email — Marketing Hub** | Async: enrollments + `process_sends` bursts + daily cron | ✅ Correct pattern (8/chunk, 90s burst) |
| **Email — Pipeline bulk** | **Sync** in `crm-bulk-email` (was ~450+ PostgREST ops / 200 sends) | ❌ Root cause of outage; **Phase 1 moves to queue** |
| **Job queue** | Store-backed enrollment shards only | No Redis/BullMQ; cron once/day (50 sends) insufficient alone |
| **Pipeline UI** | Paginated bootstrap (100/page), server filters | ✅ Good; must never reload full shard client-side |
| **Dashboard** | `pipeline_index_*` precomputed doc + 60s cache | ✅ Good direction; expand |
| **Search** | Postgres/JSON scan + pipeline index | Will not scale to 100k; needs Meilisearch/Typesense |
| **Imports** | Admin chunked; org/user import sync in one request | Large imports can still spike DB |
| **Automations** | Cron + inline triggers (20/run/day) | Needs dedicated worker queue |
| **Caching** | In-memory shard cache (90s), dashboard cache (60s) | Per-instance only; no Redis |
| **Monitoring** | Health endpoint, production log | No Prometheus/Grafana/OTel yet |

---

## 2. Bottleneck analysis — 200 email send (measured trace)

### Request flow (before Phase 1 async)

```
Browser: 4 sequential POST /api/crm/bulk-email (50 leads each, finalize on chunk 4)
  └─ Per chunk (~50 emails):
       1. readStore(meta) ×2
       2. readPipelineShardEntries — FULL ~6,600 rows (×2: load + CRM patch)
       3. writePipelineShardEntries — FULL ~6,600 rows
       4. updateStore() — read ALL ~40 collections + ~40 parallel upserts (campaign stats)
       5. enrollment append — rewrite ALL enrollment chunks (growing 50→200)
       6. ×50: Gmail send + patchCampaignEnrollments (per email, no store lock)
       7. patchPipelineEntriesCrmBatch — full shard write (50 CRM rows changed)
```

### Estimated load (200 manual emails, 4 chunks)

| Operation | Count |
|-----------|------:|
| Full pipeline shard reads (~6,600 rows) | ~8 |
| Full pipeline shard writes | 4 |
| `updateStore` full-store read/write cycles | ~5 |
| Parallel `upsertCollection` (~40 collections each) | ~200 |
| Per-email enrollment patch | ~200 |
| Gmail API calls | ~200 |
| **Total PostgREST HTTP calls** | **~450–550** over 2–6 minutes |

### Precise bottleneck (not “email volume” alone)

1. **Full-shard read/write** on every chunk although only **50 leads** change — dominant for Xindus-scale pipelines.
2. **`updateStore()` storms** — rewrites ~40 collections for campaign stats each chunk.
3. **Per-email enrollment patches** — 200 small read-modify-write cycles without batching.
4. **Synchronous coupling** — same PostgREST pool serves CRM search, dashboard, and bulk send.
5. **Supabase Micro** — 73% RAM, 86k requests/24h; PostgREST `PGRST002` = API layer cannot build schema cache under Postgres pressure.

### Mitigations already shipped (`2e3c603`, `8c80060`)

- No `savedLeads` mirror during batch
- Pipeline index refresh only on final chunk
- No full pipeline in API response
- Modal recipient resolve fix

**Still insufficient** for 6k+ row shards — async queue required.

---

## 3. PostgreSQL / Supabase optimization plan

### Immediate (0–2 weeks)

| Action | Impact |
|--------|--------|
| **Async pipeline bulk send** (Phase 1) | API returns in &lt;2s; sends via worker bursts |
| **Stop `updateStore()` for stats** — use `mcstat_*` shard only | −~40 upserts per chunk |
| **Batch enrollment patches** per burst (not per email) | −~90% enrollment writes |
| **Upgrade Supabase compute** Micro → Small | Headroom for PostgREST |
| **Stagger `nextSendAt`** on enrollments (50/batch, 3s gap) | Rate limit without Redis |

### Short term (1–2 months)

| Action | Impact |
|--------|--------|
| **Per-lead pipeline rows** in `pipeline_leads` table (lead_id PK, org_id, jsonb crm) | Patch 50 rows without reading 6,600 |
| **Partial indexes** on org_id, status, assignee, email | Faster filtered pipeline |
| **PgBouncer** (Supabase Supavisor, transaction mode) | Pool protection |
| **Statement timeout** 8s on API role | Fail fast vs hang |
| **Circuit breaker** in `supabaseClient.js` | Stop hammering unhealthy PostgREST |

### Medium term (3–6 months)

| Action | Impact |
|--------|--------|
| Migrate `store_collections` → normalized Postgres tables | True relational queries |
| Read replica for analytics/search | Isolate reporting |
| Partition enrollments by campaign_id | No rewrite-all on append |

---

## 4. Queue architecture

### Target

```
API (user traffic)     →  enqueue only, <1s
Worker (email)         →  process_sends bursts, isolated
Worker (import)        →  chunked CSV
Worker (export)        →  file generation
Worker (automation)    →  graph steps
Cron (safety net)      →  due enrollments, sequences
```

### Phase 1 (implemented) — store queue, no Redis

Reuse Marketing Hub pattern:

```
POST /api/crm/bulk-email { action: 'queue' }
  → create pipeline_bulk campaign + seed enrollments (staggered)
  → return { campaignId, pendingSends, queued: true }

POST /api/crm/bulk-email { action: 'drain', campaignId }
  → processCampaignSendBurst (8 emails / 90s, separate request)
  → client loops until pendingSends = 0 (non-blocking UI)
```

### Phase 2 — Redis + BullMQ (Upstash)

| Queue | Worker | Concurrency |
|-------|--------|-------------|
| `email` | Vercel cron + dedicated worker service | 2/org |
| `import` | Import worker | 1/org |
| `export` | Export worker | 1 |
| `automation` | Automation worker | 5 global |
| `analytics` | Rollup worker | 1 |
| `search-index` | Meilisearch sync | 2 |

**Vercel constraint:** long workers need Railway/Fly.io sidecar or Supabase Edge Functions + queue consumer.

---

## 5. Redis strategy

| Cache key | TTL | Content |
|-----------|-----|---------|
| `dash:{orgId}:{userId}` | 60s SWR | My Day / team KPIs |
| `pipe:summary:{orgId}` | 120s | Pipeline index doc |
| `user:{id}` | 300s | Profile + permissions |
| `campaign:stats:{id}` | 30s | Send progress |

Use **Upstash Redis** (serverless-compatible). Invalidate on write via queue job.

---

## 6. Search architecture

**Recommendation: Meilisearch** (managed Cloud or self-hosted)

- Faster setup than Elasticsearch for contact search
- Typo tolerance, faceted filters (city, status, tags)
- Index: contacts, companies, deals, notes, email subjects

**Flow:** CDC from pipeline writes → `search-index` queue → Meilisearch upsert  
**Target:** &lt;200ms search at 100k docs

Until then: keep server-side `pipeline_index_*` + `filterPipelineEntries`.

---

## 7. Worker architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Vercel API     │────▶│  Job store       │────▶│  Workers    │
│  (user traffic) │     │  (Redis Phase 2) │     │  email      │
└─────────────────┘     │  enrollments P1  │     │  import     │
                        └──────────────────┘     │  automation │
                               ▲                  └─────────────┘
                               │ cron 09:00 UTC
                        ┌──────┴───────┐
                        │ marketing/   │
                        │ cron         │
                        └──────────────┘
```

**Failure isolation:** Worker failure must not return 503 on `/api/pipeline/bootstrap`.

---

## 8. Monitoring architecture

| Layer | Tool | Alerts |
|-------|------|--------|
| API | Vercel Analytics + custom `/api/health` | p95 &gt; 3s |
| DB | Supabase dashboard + pg_stat_statements | CPU &gt; 80%, connections &gt; 45 |
| PostgREST | Log drain `PGRST002/003` | &gt;5/min |
| Queue | Pending enrollment count | &gt;500 stuck |
| Email | Send failure rate | &gt;10% / burst |

Phase 1: extend `/api/health` with pending bulk campaigns count.  
Phase 2: OpenTelemetry → Grafana Cloud.

---

## 9. Migration plan

| Phase | Timeline | Deliverables |
|-------|----------|--------------|
| **P0** | Week 1 | Async pipeline bulk (this PR), Supabase compute upgrade, runbook |
| **P1** | Weeks 2–4 | Batch enrollment writes, stats shard-only updates, circuit breaker |
| **P2** | Months 2–3 | Per-lead pipeline table, import/export workers |
| **P3** | Months 3–6 | Redis/BullMQ, Meilisearch, analytics tables |
| **P4** | Months 6–12 | Multi-region, read replicas, 10k tenant sharding |

---

## 10. Performance targets

| Metric | Target | Today (Xindus) |
|--------|--------|----------------|
| Dashboard load | &lt;1s | ~1–3s (when healthy) |
| Pipeline first page | &lt;1s | ~1–2s |
| Contact open | &lt;500ms | ~300–800ms |
| Search | &lt;200ms | 500ms–2s (filters) |
| Bulk email queue start | &lt;1s | **was 2–6 min blocking** |
| CRM during campaign | Always responsive | **failed during bulk** |

---

## Related files

| Concern | Path |
|---------|------|
| Pipeline bulk handler | `lib/server/handlers/crm-bulk-email.js` |
| Bulk queue helpers | `lib/server/pipelineBulkQueue.js` |
| Send worker | `lib/server/marketingCampaigns.js` → `processCampaignSendBurst` |
| Shard I/O | `lib/server/pipelineShard.js` |
| Store lock | `lib/server/store.js` → `withStoreLock` |
| Frontend orchestration | `frontend/src/context/AppContext.jsx` → `sendBulkEmail` |
| Blueprint (future) | `docs/CRM_PLATFORM_BLUEPRINT.md` |

---

## Operational runbook — PostgREST unhealthy

1. **Pause bulk sends** — do not retry 200-batch until healthy.
2. **Supabase** → Restart project → wait 5–10 min.
3. **Upgrade compute** if RAM &gt; 70% on Micro.
4. **Verify** `/api/health` → `supabase.connected: true`.
5. **Resume** with async queue; max 50 per campaign until P1 shard split ships.
