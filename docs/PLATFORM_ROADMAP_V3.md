# Connect Intel Platform Roadmap V3

Ten-step plan for HubSpot/Mailchimp-scale CRM. **Step 1–2 code in progress; Steps 3–10 documented for phased delivery.**

---

## Step 1 — Email Infrastructure V3 ✅ (code)

- Worker-only sends (`EMAIL_WORKER_ONLY`, default on)
- Browser drain removed from frontend
- `GET /api/infra/queue`
- Campaign lifecycle: draft → queued → preparing → sending → completed/failed
- **Ops required:** `REDIS_URL` + Railway `npm run workers`

See `docs/EMAIL_INFRASTRUCTURE_V3.md`.

---

## Step 2 — Remove full pipeline reads ✅ (Deploy 8)

| Done | Item |
|------|------|
| ✅ | Audit: `docs/PIPELINE_ARCHITECTURE_AUDIT.md` |
| ✅ | `readPipelineLeadsByIds` + `readPipelineLeadById` |
| ✅ | `loadPipelineStoreForLeadIds` uses table when `USE_PIPELINE_LEADS_TABLE=true` |
| ✅ | Bulk email queue uses targeted load |
| ✅ | `PATCH /api/saved-leads` → table row patch (no full-shard fallback) |
| ✅ | `crm-notifications` → SQL slice only (no full-shard error fallback) |
| ✅ | `platform/search` → Meili + table search (no full pipeline load) |

---

## Step 3 — Relational CRM tables 📋 (migration ready)

Migration: `supabase/migrations/20260610120000_crm_relational_v3.sql`

Tables: `pipeline_leads`, `pipeline_deals`, `pipeline_notes`, `pipeline_tasks`, `pipeline_meetings`, `pipeline_activities`, `pipeline_companies`

**Zero downtime:** dual-write → backfill → dual-read → cutover. See migration file comments.

Backfill: `npm run pipeline:backfill` (see `docs/INFRA_SETUP.md`).

---

## Step 4 — Campaign Engine V3 📋

Tables in same migration: `campaigns_v3`, `campaign_recipients`, `campaign_events`, `campaign_stats`

Providers: Gmail, M365, Resend, SES, SendGrid (adapter pattern in `marketingSend.js`).

Workers process recipients in batches; **never** load `pipeline_org_*` during send (use `campaign_recipients` snapshot).

---

## Step 5 — HubSpot-style dashboards ✅ (Deploy 9)

Snapshots (existing + planned):

| Snapshot | Status |
|----------|--------|
| `dashboard_snapshot_{org}` | ✅ |
| `team_snapshot_{org}_{period}` | ✅ |
| `activity_snapshot_*` | ✅ |
| `pipeline_snapshot_{org}` | ✅ alias of `pipeline_index_*` |
| `marketing_snapshot_{org}` | ✅ |

Refresh: on CRM write + 5-min worker cron + dashboard warm cron. Target: dashboard &lt;500ms.

---

## Step 6 — Meilisearch global search ✅ (Deploy 10)

Indexes: leads, deals, **contacts**, **companies**, campaigns, tasks, notes, messages.

Enable: `MEILI_HOST`, `MEILI_API_KEY`, `npm run meili:sync` / infra `meili-sync`.

Save-time sync: pipeline leads, contacts PATCH, pipeline_companies rebuild.

Target: &lt;200ms; platform search Meili-first when enabled.

---

## Step 7 — Real-time campaign monitoring 📋

UI: `CampaignSendProgress` + `useCampaignSendProgress` (polling today; SSE later).

Metrics from `campaign_stats` aggregates — not raw event replay.

---

## Step 8 — Team Intelligence redesign 📋

Sections: Executive Summary, Pipeline Health, Rep Performance, Forecast, Risk, Activity, Coaching.

Pattern: summary API first, lazy detail tabs. Target: &lt;1s initial render.

---

## Step 9 — Observability 📋

- Structured `api_pipeline` logs (`durationMs`, `pipelineRowsRead`, `source`)
- `PROMETHEUS_METRICS=true` + Grafana
- Sentry performance on `/api/crm/*`, `/api/marketing/*`

---

## Step 10 — Production readiness review 📋

Load test targets: 100 concurrent users, 50k contacts, 100k emails/month, 10 concurrent campaigns.

**Gate:** No new features until P50 dashboard &lt;500ms and email queue &lt;3s API response with workers on.

---

## Deploy order

1. **This release:** Email V3 code + pipeline lead reads (flag-gated)
2. **Ops:** Redis + Railway (unblocks sending)
3. **Next release:** `USE_PIPELINE_LEADS_TABLE` + backfill
4. **Then:** Meili → campaign v3 tables → TI redesign → observability
