# Connect Intel — Pipeline Architecture Audit

**Date:** June 2026  
**Scope:** Audit only — no implementation until this document is reviewed.  
**Reference org:** Xindus (~6,667 pipeline rows, `pipeline_org_*` shard)  
**Production infra:** `redis: false`, `worker: false`, `pipelineLeadsTable: false`, `meilisearch: false`

---

## Executive summary

Almost every CRM mutation and many reads still flow through **`readPipelineShardEntries` → full `pipeline_org_*` JSON array** in Supabase `store_collections`, even when only **one lead** changes.

The function `loadPipelineStoreForLeadIds` **does not** load only selected IDs — it loads the **entire shard**, then filters in memory (`pipelineShard.js:377–391`).

`updatePipelineStore` always **read-modify-writes the full shard** (`pipelineShard.js:436–457`).

This single pattern explains: bulk email timeouts, dashboard slowness, slow notes/meetings, notification poll latency, and search fallback cost.

---

## 1. Full-shard dependency map

### 1.1 Core primitives (all callers inherit this cost)

| Primitive | Rows downloaded (Xindus) | Payload (est.) | Read | Write |
|-----------|--------------------------:|---------------:|:----:|:-----:|
| `readPipelineShardEntries(shard)` | 6,667 | 3–15 MB | ✓ | |
| `loadPipelineStoreContext` | 6,667 | 3–15 MB | ✓ | |
| `loadPipelineStoreForLeadIds` | **6,667** (then filter) | 3–15 MB | ✓ | |
| `updatePipelineStore` | 6,667 | 3–15 MB | ✓ | ✓ |
| `writePipelineShardEntries` | 6,667 | 3–15 MB | | ✓ |
| `mergeMonolithCrm: true` | 6,667 + monolith slice | 3–20 MB | ✓ | |

**In-process cache:** 60s TTL per serverless instance — cold starts and parallel requests still hit Supabase.

**Existing escape hatch (off in prod):** `pipeline_leads` table + `patchPipelineLeadsTable` — per-lead PATCH without shard read (`pipelineLeadsTable.js`, flag `PIPELINE_LEADS_TABLE`).

---

## 2. Endpoint audit (API routes)

Estimates use Xindus scale. **Execution time** = architectural estimate on Supabase Micro (not measured in prod — Vercel logs lack duration; see §6).

### 2.1 Critical — user-facing hot path

| Operation | Route | Shard reads | Shard writes | Rows | Payload | Est. time | Business impact | Priority |
|-----------|-------|:-----------:|:------------:|-----:|--------:|----------:|-----------------|----------|
| Open pipeline (first page) | `GET /api/pipeline/bootstrap` | 1 | 0 | 6,667 | 3–15 MB | 5–25 s | Every pipeline visit | **P0** |
| List/filter leads | `GET /api/saved-leads` | 1 | 0 | 6,667 | 3–15 MB | 5–25 s | Pipeline scroll/filter | **P0** |
| Open single lead | `GET /api/saved-leads?leadId=` | 1–2 | 0–1 | 6,667 | 3–15 MB | 5–45 s | Every contact open | **P0** |
| Save note / task / meeting / deal | `PATCH /api/saved-leads` | 1–2 | 1 | 6,667 | 3–15 MB | 15–60 s | Core CRM actions | **P0** |
| Move stage / assign | `PATCH /api/saved-leads` | 1–2 | 1 | 6,667 | 3–15 MB | 15–60 s | Pipeline drag-drop | **P0** |
| Send email (1 lead) | `POST /api/crm-send-email` | 2 | 1 | 6,667×2 | 6–30 MB | 20–90 s | Daily rep workflow | **P0** |
| Bulk email queue | `POST /api/crm/bulk-email` action=queue | 1 | 0–1 | 6,667 | 3–15 MB | 10–60 s | Marketing/sales bursts | **P0** |
| Bulk email drain | `POST /api/crm/bulk-email` action=drain | 1+ | 0–1 | 6,667 | 3–15 MB | 30–120 s | Sync send (no worker) | **P0** |
| Notifications poll | `GET /api/crm/notifications` | 1–2 | 0–1 | 6,667 | 3–15 MB | 5–30 s | **Highest frequency** in prod logs | **P0** |
| Activity log | `GET /api/crm/activity-log` | 1 (+monolith) | 0 | 6,667+ | 3–20 MB | 10–40 s | Compliance / manager review | **P1** |
| Platform search (no Meili) | `GET /api/platform/search` | 1 | 0 | 6,667 | 3–15 MB | 5–25 s | Global search | **P1** |
| Dashboard (cold) | `GET /api/crm/team-metrics`, `my-day` | 1 (+meta) | 0 | 6,667 | 3–15 MB | 10–60 s | Executive view | **P1** |
| Lead timeline | `GET /api/crm/lead-timeline` | 1 | 0 | 6,667 | 3–15 MB | 5–25 s | Contact sidebar | **P1** |
| Calendar view | `GET /api/crm/calendar` | 1 | 0 | 6,667 | 3–15 MB | 5–25 s | Meetings | **P1** |
| Bulk stage update | `POST /api/crm/bulk-update` | 1 | 1 | 6,667 | 3–15 MB | 15–60 s | Rep efficiency | **P1** |

### 2.2 Marketing (full shard for audience resolution)

| Operation | Route | Shard reads | Rows | Est. time | Priority |
|-----------|-------|:-----------:|-----:|----------:|----------|
| Build list from pipeline | `GET/POST /api/marketing/lists` | 1 | 6,667 | 5–25 s | **P1** |
| Segment preview/count | `GET /api/marketing/segments` | 1 | 6,667 | 5–25 s | **P1** |
| Campaign audience | `POST /api/marketing/campaigns` | 1 | 6,667 | 5–25 s | **P1** |
| Marketing dashboard | `GET /api/marketing/dashboard` | 1 | 6,667 | 5–25 s | **P2** |

### 2.3 Background / async (still full shard)

| Operation | Trigger | Shard reads | Rows | Priority |
|-----------|---------|:-----------:|-----:|----------|
| Snapshot refresh | `refreshDashboardSnapshotsFromEntries` | 1 | 6,667 | **P1** |
| Pipeline index rebuild | `refreshPipelineIndexForShard` | 1 | 6,667 | **P1** |
| Meilisearch backfill | `meilisearch/sync.js` | 1 | 6,667 | **P2** |
| Email auto-sync | Inside notifications poll | 1 | 6,667 + write | **P0** |
| Google calendar sync | Inside notifications poll | 1 | 6,667 + write | **P1** |
| Inbound email match | `crmInboundEmail.js` | 1 per org shard | 6,667 | **P2** |

### 2.4 Partial mitigations already in code

| Operation | Route | Behavior | Still downloads full shard? |
|-----------|-------|----------|:----------------------------:|
| Pipeline summary strip | `GET /api/saved-leads?summary=1` | Tries `pipeline_index_*` first | Only on index miss |
| Dashboard KPI | `GET /api/crm/dashboard-kpi` | Meta + snapshot | No (when snapshot warm) |
| Team metrics / my-day | snapshot handlers | Snapshot doc ~100 KB | No (when warm; legacy yes) |
| CRM patch batch | `patchPipelineEntriesCrmBatch` | `pipeline_leads` row PATCH | **No** when table flag on |
| Workspace pulse | `POST /api/crm/workspace-pulse` | User pulse only | **No** |

### 2.5 Anti-patterns (worse than shard)

| Operation | Route | Problem | Priority |
|-----------|-------|---------|----------|
| AI email draft | `POST /api/crm-generate-email` | `readStore()` — **entire database** | **P0** |
| Email reply log | `POST /api/crm/log-email-reply` | `readStore()` full | **P1** |

---

## 3. Top 20 endpoints by impact (frequency × estimated latency)

**Production measurement gap:** Vercel JSON logs include `requestPath` and `timestamp` but **no `durationMs`**. `PROMETHEUS_METRICS=false`. Rankings below combine **24h request counts** (sample of 2,000 log lines) with **architectural latency estimates**.

| Rank | Endpoint | 24h freq (sample) | Est. P50 | Est. P95 | Loads `pipeline_org_*`? | Root cause |
|-----:|----------|------------------:|---------:|---------:|:-----------------------:|------------|
| 1 | `GET /api/crm/notifications` | **509** | 8–15 s | 25–40 s | **Yes** (1–2×) | Poll + optional email/calendar sync → full shard |
| 2 | `POST /api/crm/workspace-pulse` | **426** | &lt;100 ms | &lt;200 ms | No | Lightweight (not a pipeline issue) |
| 3 | `GET /api/saved-leads` | High* | 5–20 s | 30–60 s | **Yes** | List/open lead |
| 4 | `GET /api/pipeline/bootstrap` | High* | 5–20 s | 30–50 s | **Yes** | Pipeline home |
| 5 | `PATCH /api/saved-leads` | High* | 15–30 s | 45–90 s | **Yes** R+W | Note/meeting/stage |
| 6 | `POST /api/crm/bulk-email` | **30** | 30–60 s | 120 s+ | **Yes** (2–4×) | Queue + drain |
| 7 | `POST /api/crm-send-email` | Med* | 20–40 s | 90 s | **Yes** (2×) | Misnamed `loadPipelineStoreForLeadIds` |
| 8 | `GET /api/crm/team-metrics` | **20** | 10–20 s | 60 s | Legacy path | Cold snapshot |
| 9 | `GET /api/crm/my-day` | **20** | 8–15 s | 60 s | Legacy path | Cold snapshot |
| 10 | `GET /api/crm/activity-timeline` | **22** | 5–15 s | 30 s | Snapshot / legacy | Timeline snapshot |
| 11 | `GET /api/crm/activity-log` | Med* | 10–25 s | 40 s | **Yes** + monolith | Activity feed |
| 12 | `GET /api/platform/search` | Med* | 5–20 s | 30 s | **Yes** if no Meili | Full shard scan |
| 13 | `POST /api/crm-generate-email` | Med* | 15–45 s | 120 s | **Full `readStore()`** | Worst pattern |
| 14 | `GET /api/marketing/lists` | Low* | 5–20 s | 30 s | **Yes** | Audience build |
| 15 | `GET /api/marketing/segments` | Low* | 5–20 s | 30 s | **Yes** | Segment rules |
| 16 | `POST /api/marketing/campaigns` | Low* | 10–30 s | 60 s | **Yes** | Enroll audience |
| 17 | `GET /api/crm/calendar` | Low* | 5–20 s | 30 s | **Yes** | All meetings in shard |
| 18 | `GET /api/crm/lead-timeline` | Low* | 5–20 s | 30 s | **Yes** | Per-lead still loads all |
| 19 | `POST /api/crm/bulk-update` | Low* | 15–45 s | 90 s | **Yes** R+W | Multi-lead patch |
| 20 | `GET /api/auth/session` | High* | 0.5–2 s | 5 s | No | Auth baseline |

\*Not fully captured in 2k-line sample; marked High/Med from product usage patterns.

**Conclusion:** **~15 of top 20** slow endpoints load `pipeline_org_*` or call `loadPipelineStoreContext` / `updatePipelineStore`. Fixing the primitive layer improves the entire CRM.

---

## 4. Target architecture

```
                    ┌─────────────────────────────────────┐
                    │         User request                 │
                    └─────────────────┬───────────────────┘
                                      │
          ┌───────────────────────────┼───────────────────────────┐
          │                           │                           │
          ▼                           ▼                           ▼
   ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
   │ By lead_id   │          │  Paginated   │          │  Snapshots   │
   │ indexed GET  │          │  list query  │          │  (dashboard) │
   │ 1 row        │          │ 100 rows     │          │  ~100 KB     │
   └──────────────┘          └──────────────┘          └──────────────┘
          │                           │                           │
          └───────────────────────────┴───────────────────────────┘
                                      │
                              ┌───────▼────────┐
                              │ Supabase / Meili│
                              │ pipeline_leads  │
                              │ pipeline_*      │
                              └────────────────┘
```

### Per-operation target

| Operation | Today | Target |
|-----------|-------|--------|
| Send email to lead 123 | Load 6,667 → send → write 6,667 | `SELECT entry WHERE lead_id=123` → send → `PATCH` row 123 |
| Save note | R+W full shard | `INSERT pipeline_activities` + `PATCH pipeline_leads.crm` |
| Create meeting | R+W full shard | `INSERT pipeline_meetings` + link `lead_id` |
| Move stage | R+W full shard | `PATCH pipeline_leads` status field |
| Open lead | Load 6,667 | `GET` one row by `lead_id` |
| Search | Load 6,667 or full store | Meilisearch / SQL `WHERE org_id AND text @@ query` |
| Dashboard | Legacy scan 6,667 | Read `team_snapshot_{org}` only |
| Bulk email | Load 6,667 × N | `WHERE lead_id IN (...)` + background worker |

---

## 5. `pipeline_leads` migration roadmap

### Phase 0 — Flags (no downtime)

| Flag | Purpose |
|------|---------|
| `REDIS_URL` | Shared cache + job queue |
| `PIPELINE_LEADS_TABLE=true` | Enable per-lead reads/writes (code exists) |
| `MEILI_HOST` | Search without shard |
| Worker `npm run workers` | Background email + snapshot refresh |

### Phase 1 — Dual-write (2–3 weeks)

1. Create tables: `pipeline_leads`, `pipeline_activities`, `pipeline_meetings`, `pipeline_tasks`, `pipeline_deals` (notes → activities with `type=note`).
2. Backfill from `pipeline_org_*` shards (script per org).
3. **Dual-write:** every `updatePipelineStore` also upserts `pipeline_leads` row.
4. Verify row counts + checksum sample per org.

### Phase 2 — Dual-read (2–3 weeks)

1. `readPipelineLead(user, leadId)` → table first, shard fallback.
2. `readPipelineLeadsByIds(user, ids)` → `WHERE lead_id IN (...)`.
3. Replace `loadPipelineStoreForLeadIds` implementation (keep API).
4. Paginated list: `pipeline_leads WHERE shard_name ORDER BY updated_at LIMIT/OFFSET`.

### Phase 3 — Cutover (1 week)

1. Bootstrap + saved-leads list use table + `pipeline_index` only.
2. Stop writing `pipeline_org_*` (keep read-only rollback).
3. Shard becomes export/backup only.

### Phase 4 — Normalize activities (1–2 months)

1. Extract embedded `crm.activities[]` to `pipeline_activities`.
2. Dashboard snapshots built from activity table aggregates, not full scan.

**Rollback:** Feature flags revert reads to shard; shards unchanged until Phase 3 delete.

---

## 6. Email optimization plan

| Step | Change | Impact |
|------|--------|--------|
| 1 | Fix `loadPipelineStoreForLeadIds` → true `IN (ids)` query | **Immediate** — bulk + single send |
| 2 | Queue + worker (`backgroundEmail: true`) | API &lt;2 s; modal closes |
| 3 | `patchPipelineLeadsTable` for CRM log after send | No shard write |
| 4 | UI: fix progress `undefined/undefined` → `sentSoFar/total` | UX clarity |

---

## 7. Search optimization

| Mode | Today | Target |
|------|-------|--------|
| Meili off (prod) | Full shard into memory | Enable Meili + backfill |
| Meili on | Index query | Default path |
| Fallback | Full shard | SQL full-text on `pipeline_leads` columns |

---

## 8. Dashboard compatibility

| Snapshot | Built from | Must not |
|----------|------------|----------|
| `dashboard_snapshot_{org}` | Pipeline index / incremental | Full shard on user request |
| `team_snapshot_{org}_{period}` | Worker job from index + activity rollups | `mergeMonolithCrm` on hot path |
| `activity_snapshot_{org}_{period}` | Activity table / indexed slice | Full scan per request |

**Rule:** User-facing dashboard handlers read **snapshot docs only**. Refresh jobs may scan sources until Phase 4 activity table exists.

---

## 9. Expected performance improvements (Xindus)

| Operation | Today (est.) | After Phase 1–2 | After full migration |
|-----------|-------------:|----------------:|-------------------:|
| Open 1 lead | 5–45 s | 200–500 ms | &lt;200 ms |
| Save note | 15–60 s | 300–800 ms | &lt;300 ms |
| Send 1 email | 20–90 s | 1–3 s (+ async) | &lt;1 s API |
| Bulk email 50 | Timeout | Queue &lt;2 s | Queue &lt;2 s |
| Notifications poll | 8–40 s | 1–3 s | &lt;500 ms |
| Dashboard | 10–60 s | &lt;500 ms (snapshots) | &lt;500 ms |
| Pipeline page 1 | 5–25 s | 500 ms–2 s | &lt;500 ms |

---

## 10. Rollout plan (zero downtime)

| Week | Action | User impact |
|------|--------|-------------|
| 1 | Redis + Railway worker + `dash` snapshot auto-refresh | Dashboard + email queue improve |
| 1 | Instrument `durationMs` + `pipeline_read_rows` on all handlers | Measurement |
| 2 | Ship true `readPipelineLeadsByIds` behind flag | Email + send fixed |
| 2–3 | `PIPELINE_LEADS_TABLE` dual-write backfill | None |
| 4–5 | Dual-read list + open lead | Pipeline faster |
| 6 | Meilisearch production | Search faster |
| 7+ | Disable shard writes | CRM fully migrated |

**Deploy rule:** Each phase behind env flag; rollback = flip flag, no data loss until Phase 3.

---

## 11. Recommended priority (matches product owner order)

### Critical
1. **Redis + Railway worker** — unlocks background email, snapshots, queue drain.
2. **True lead-ID loading** — replace fake `loadPipelineStoreForLeadIds`.
3. **This audit** — track remaining call sites in PR checklist.

### High
4. **Meilisearch** — remove search shard dependency.
5. **`pipeline_leads` dual-write/read** — per migration §5.

### Medium
6. UI redesigns, analytics — after latency SLO met (&lt;500 ms reads, &lt;2 s writes).

---

## 12. Next measurement step

Add one structured log line (or enable Prometheus + scrape):

```json
{
  "event": "api_pipeline",
  "route": "crm/bulk-email",
  "pipelineRows": 6667,
  "pipelineSource": "shard",
  "durationMs": 48200
}
```

Re-run §3 ranking with real P50/P95 within 48h of deploy.

---

## Appendix A — Code references

| File | Issue |
|------|-------|
| `lib/server/pipelineShard.js:377` | `loadPipelineStoreForLeadIds` loads full context |
| `lib/server/pipelineShard.js:436` | `updatePipelineStore` full RMW |
| `lib/server/pipelineBulkQueue.js:55` | Queue uses `shardOnly` but still full download |
| `lib/server/handlers/crm-notifications.js:35` | Poll loads full pipeline |
| `lib/server/handlers/crm-generate-email.js:29` | Full `readStore()` |
| `lib/server/pipelineLeadsTable.js` | Target pattern (disabled in prod) |
| `lib/server/dashboardLegacy.js` | Dashboard fallback full scan |
