# Connect Intel — Database Design

**Last updated:** 2026-06-24

---

## 1. Overview

Connect Intel uses a **hybrid data plane**:

| Store | Role | Location |
|-------|------|----------|
| **JSON document store** | Primary app state (users, orgs, marketing, pipeline shards) | Supabase `store_collections` / local SQLite |
| **PostgreSQL** | Scale path: pipeline rows, permissions, queues, enterprise leads | Supabase Postgres |
| **Redis** | Session/cache (optional); BullMQ job backend | Upstash |
| **Meilisearch** | Full-text search index (optional) | External |

**Constitution target:** PostgreSQL as single source of truth with `organization_id` on every table.  
**Current reality:** JSON shards remain authoritative for most CRM mutations; SQL is incrementally adopted.

---

## 2. JSON store (`lib/server/store.js`)

### 2.1 Collections (representative)

| Collection | Contents |
|------------|----------|
| `users` | User accounts, roles, org linkage |
| `organizations` | Workspace settings, plans, CRM settings |
| `organizationMemberships` | User ↔ org, pipeline/marketing roles |
| `savedLeads` | Legacy monolith pipeline (deprecated path) |
| `contacts`, `companies` | Master data |
| `marketingCampaigns`, `marketingLists`, … | Marketing hub |
| `marketingAutomations`, `marketingAutomationRuns` | Automation engine |
| `crmWorkflowRules` | CRM workflow definitions |
| `searches` | AI search history |

### 2.2 Pipeline shards (dynamic collection names)

| Pattern | Tenant |
|---------|--------|
| `pipeline_org_{orgId}` | Company workspace |
| `pipeline_user_{userId}` | Individual seller |
| `pipeline_index_{shard}` | Denormalized counts |
| `dashboard_snapshot_{orgId}` | Materialized dashboard |
| `rep_snapshot_{orgId}_{userId}_{period}` | Rep performance |

Each shard document is an array of **pipeline entries**:

```json
{
  "id": "lead-entry-id",
  "lead": { "id", "firstName", "lastName", "company", "email", ... },
  "crm": { "status", "deals", "tasks", "activities", "meetings", ... },
  "assignedToUserId": "...",
  "organizationId": "...",
  "savedAt": "ISO-8601"
}
```

### 2.3 Concurrency

- `withStoreLock()` — optimistic locking on collection writes
- `assertSafeWrite()` — guards against empty reads wiping data

---

## 3. PostgreSQL schema (`supabase/migrations/`)

### 3.1 Core tables

| Table | Purpose |
|-------|---------|
| `organizations` | UUID orgs; `legacy_id` maps JSON org |
| `profiles` | Users; `organization_id` FK |
| `pipeline_leads` | One row per lead; `entry` JSONB + filter columns |
| `leads` | Enterprise encrypted PII (Vault) |
| `role_permissions` | Per-org permission matrix |
| `marketing_email_queue` | SQL-backed email send queue |
| `marketing_campaign_batches` | Bulk send batches |
| Activity log tables + RPCs | Analytics queries |

### 3.2 `pipeline_leads` (critical scale table)

Migration: `20260609120000_pipeline_leads.sql` (+ filter column migrations)

| Column | Purpose |
|--------|---------|
| `id` | Row UUID |
| `shard_name` | `pipeline_org_*` or `pipeline_user_*` |
| `organization_id` | Tenant scope (nullable for solo) |
| `owner_id` | Assigned rep |
| `team_id` | Hierarchy scope |
| `lead_status` | Pipeline stage |
| `entry` | Full pipeline entry JSONB |
| `updated_at` | Sorting / pulse |

**Feature flag:** `USE_PIPELINE_LEADS_TABLE` (`lib/server/infra/config.js`)

### 3.3 Row-level security

- RLS enabled on enterprise tables (`20260614120000_leads_rls_security_definer.sql`)
- Service role used from Vercel (bypasses RLS) — app-layer tenancy must enforce until user-scoped JWT

### 3.4 PII encryption

- `leads` table uses Supabase Vault (`seal_lead_pii` / `open_lead_pii`)
- Trigger: `20260616120000_leads_auto_encrypt_trigger.sql`

---

## 4. Multi-tenancy rules

1. Every SQL row that holds tenant data MUST include `organization_id` (or `shard_name` derivable to tenant).
2. Solo users: scope by `pipeline_user_{userId}` — no org row required.
3. Application code MUST use:
   - `stampPipelineEntryOrg()` on writes
   - `visiblePipelineFromEntries()` / `pipelineTableScope` on reads
4. Never query `pipeline_leads` without org/owner filter.

---

## 5. Migrations

| Path | Tool |
|------|------|
| `supabase/migrations/*.sql` | Manual SQL migrations (21 files) |
| Backfill scripts | `scripts/backfill-*.mjs`, `npm run pipeline:backfill` |

**Constitution gap:** No Prisma; no automated down migrations.  
**Process:** Add forward migration → backfill script → feature flag → cutover.

### Reversibility checklist

- [ ] Forward migration tested on staging Supabase
- [ ] Backfill idempotent
- [ ] Rollback = disable flag + restore from snapshot (not auto-down SQL)

---

## 6. Indexing strategy

Required indexes (existing or planned):
- `organization_id` on all tenant tables
- `pipeline_leads (shard_name, lead_status, updated_at)` — list views
- `pipeline_leads (owner_id)` — rep scope
- Activity log by `org_id`, `created_at`

---

## 7. Data flow: lead save

```
PATCH /api/saved-leads
  → permissionEnforce (edit_leads)
  → updatePipelineStore (shard RMW)
  → pipelineLeadsTable.upsert (if SQL enabled)
  → enqueueDashboardSnapshotRefresh
  → fireAutomationTrigger / crmWorkflow
```

---

## 8. Related scripts

| Command | Purpose |
|---------|---------|
| `npm run pipeline:backfill` | JSON shard → `pipeline_leads` |
| `npm run enterprise:backfill` | JSON → enterprise `leads` table |
| `npm run dash:warm` | Rebuild dashboard snapshots |

---

## 9. Target state (roadmap)

See `PROJECT_ROADMAP.md` Phases 3, 7, 8, 12:
- Promote `pipeline_leads` to write SoT
- First-class `accounts`, `deals`, `tasks` tables
- Deprecate full-shard downloads on hot paths
- Optional Prisma layer after schema freeze
