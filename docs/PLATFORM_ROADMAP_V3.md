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

## Step 3 — Relational CRM tables ✅ (Deploy 11 — tasks/meetings SQL)

Migrations: `20260610120000_crm_relational_v3.sql`, `20260702120000_pipeline_tasks_meetings_deploy11.sql`

| Table | Runtime |
|-------|---------|
| `pipeline_leads` | ✅ read/write |
| `pipeline_deals` | ✅ dual-write + backfill |
| `pipeline_companies` | ✅ dual-write + backfill |
| `pipeline_activities` | ✅ dual-write + timeline SQL reads |
| `pipeline_tasks` | ✅ dual-write + My Day SQL reads |
| `pipeline_meetings` | ✅ dual-write + My Day SQL reads |
| `pipeline_notes` | ⏭ skipped — notes stay in `crm.notes` + `pipeline_activities` |

Backfill: `POST /api/infra/bootstrap` action `tasks-meetings-sync` (org optional). Leads: `npm run pipeline:backfill`.

---

## Step 4 — Campaign Engine V3 ✅ (Deploy 12)

Tables: `campaigns_v3`, `campaign_recipients`, `campaign_events`, `campaign_stats`

Dual-write from enroll + send; SQL due-recipient path skips `pipeline_org_*` reads when recipients exist in SQL.

Backfill: `POST /api/infra/bootstrap` action `campaigns-v3-sync` (org optional). Migrate: `campaigns-v3-migrate`.

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

## Step 7 — Real-time campaign monitoring ✅ (Deploy 13)

`GET /api/campaign-send/status` prefers `campaign_stats` SQL aggregates when tables exist; falls back to stats shards.

UI: `CampaignSendProgress` + `useCampaignSendProgress` (3s polling; SSE later). Shown on campaign cards, reports, bulk compose, and global `EmailSendDock`.

---

## Step 8 — Team Intelligence redesign ✅ (Deploy 14)

Enabled: `TEAM_INTELLIGENCE_IN_CRM_ENABLED` + `homeTeamMetrics` on `general_crm` preset.

Sections (lazy tabs): Executive Summary, Pipeline Health, Rep Performance, Forecast, Risk, Activity, Coaching.

API: `GET /api/crm/team-metrics?summary=1` (snapshot-first, skips live rollup); activity timeline lazy via `GET /api/crm/activity-timeline`.

---

## Step 9 — Observability ✅

- Structured `api_pipeline` logs (`durationMs`, `pipelineRowsRead`, `source`) on `/api/crm/*` and `/api/marketing/*`
- `PROMETHEUS_METRICS=true` → `connectintel_api_pipeline_*` + `connectintel_pipeline_rows_read` histograms
- Sentry performance spans on `/api/crm/*`, `/api/marketing/*` when `SENTRY_DSN` is set

---

## Step 10 — Production readiness review ✅ (gate script)

Load test targets: 100 concurrent users, 50k contacts, 100k emails/month, 10 concurrent campaigns.

**Gate:** No new features until P50 dashboard &lt;500ms and email queue &lt;3s API response with workers on.

**Run gate:** `npm run step10:gate` — probes health, public-config, infra/queue (email), and authenticated dashboard bootstrap + team-metrics when `SESSION_SECRET` + `ADMIN_EMAILS` are available locally.

**Blueprint Phase 2+** starts after Step 10 full gate passes (dashboard + email queue paths).

---

## Deploy order

1. **This release:** Email V3 code + pipeline lead reads (flag-gated)
2. **Ops:** Redis + Railway (unblocks sending)
3. **Next release:** `USE_PIPELINE_LEADS_TABLE` + backfill
4. **Then:** Meili → campaign v3 tables → TI redesign → observability
