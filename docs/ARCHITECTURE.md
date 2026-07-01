# Connect Intel — Architecture

**Last updated:** 2026-06-24  
**Live:** https://connectintel.net  
**Blueprint:** `CRM_PLATFORM_BLUEPRINT.md`  
**Gap analysis:** `CRM_GAP_ANALYSIS.md`

---

## 1. Mission

Connect Intel is a **B2B revenue platform**: AI prospecting, CRM pipeline, marketing automation, and team collaboration for companies and solo sellers. The architecture must support **thousands of organizations** and **millions of pipeline records** without sacrificing the existing product shell (SPA panels, lead workspace, marketing hub).

---

## 2. Current architecture (as-built)

### 2.1 High-level diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser / PWA (Vite + React 19 SPA)                            │
│  AppShell · PanelViewport · LeadWorkspace · CommandPalette      │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS  /api/*  (Bearer session JWT)
┌────────────────────────────▼────────────────────────────────────┐
│  Vercel Serverless — api/index.js (single router, ~130 routes)  │
│  lib/server/handlers/*  →  domain modules in lib/server/        │
└─────┬──────────────────┬──────────────────┬───────────────────┘
      │                  │                  │
      ▼                  ▼                  ▼
┌───────────┐    ┌───────────────┐   ┌────────────────┐
│ Supabase  │    │ Upstash Redis │   │ Railway Worker │
│ JSON store│    │ cache + BullMQ│   │ BullMQ consumer│
│ + Postgres│    │               │   │ email/import/… │
└───────────┘    └───────────────┘   └────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  External: Resend · Gmail API · Google OAuth · Meilisearch      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology stack

| Layer | Technology |
|-------|------------|
| Frontend | Vite 8, React 19, Tailwind 4, JavaScript/JSX |
| API | Node 22, Vercel serverless functions |
| Primary store | Supabase `store_collections` (JSON documents) |
| Scale path | PostgreSQL (`pipeline_leads`, enterprise schema, marketing queue) |
| Cache | In-memory + Upstash Redis (stale-while-revalidate) |
| Queue | BullMQ on Railway; SQL marketing queue fallback |
| Auth | Google OAuth + session JWT (cookie + Bearer) |
| Email | Resend, Gmail OAuth, SendGrid adapter |
| Search | Meilisearch (optional), in-app platform search |
| Observability | Sentry, custom metrics histograms |
| Deploy | Vercel (app + API), Railway (workers) |

### 2.3 Folder structure

```
connect-intel/
├── api/index.js              # HTTP router → lazy handlers
├── lib/
│   ├── server/               # Backend domain (~400 files)
│   │   ├── handlers/         # 128 route handlers
│   │   ├── infra/            # cache, redis, config, sentry
│   │   ├── queue/            # BullMQ producer/processors
│   │   ├── email/            # campaign orchestration
│   │   └── *.js              # CRM, marketing, auth, store
│   ├── dealPipeline.js       # Shared deal flatten (client+server)
│   └── freightDeal.js
├── frontend/src/
│   ├── components/           # Feature panels (~237 files)
│   ├── context/AppContext.jsx
│   ├── lib/                  # api.js, navConfig, CRM constants
│   ├── hooks/
│   └── styles/
├── supabase/migrations/      # 21 SQL migrations
├── workers/index.mjs         # Railway BullMQ worker
├── scripts/                  # deploy, backfill, warm, verify
├── docs/                     # Architecture & runbooks
├── site/                     # Production static build output
└── vercel.json               # Rewrites, crons, headers
```

### 2.4 Request flow

1. Browser calls `/api/{path}` → rewritten to `api/index.js?path=...`
2. Router lazy-imports `lib/server/handlers/{path}.js`
3. Handler: CORS → `requireUser()` → permission checks → domain logic → JSON
4. Domain modules read/write via `store.js` and/or SQL modules

### 2.5 Multi-tenancy model

| Tenant type | Pipeline shard | Scope key |
|-------------|----------------|-----------|
| Company org | `pipeline_org_{organizationId}` | `user.organizationId` |
| Individual | `pipeline_user_{userId}` | `user.id` |

Enforcement layers:
- **Write:** `tenantWriteGuard.js` stamps `organizationId` on entries
- **Read:** `tenantIsolation.js`, `pipelineVisibility.js`, manager hierarchy scope
- **SQL:** `organization_id` on `pipeline_leads` + RLS policies (partial)

### 2.6 Authentication

- **Sign-in:** Google OAuth → `auth-session` handler creates user + session
- **Session:** JWT in httpOnly cookie; client mirrors token in `sessionStorage`
- **API:** `Authorization: Bearer` + cookie; `authSessionCache` + Redis
- **Roles:** Resolved from `organizationMemberships`, `pipelineRole`, marketing roles

See `SECURITY.md` for RBAC detail.

### 2.7 Frontend shell

- **No react-router:** `AppContext` screen (`landing` | `auth` | `app`)
- **Panel navigation:** `activePanel` + `panelOptions` synced to URL query
- **Record pattern:** `LeadWorkspace` slide-over for lead CRUD
- **Global ⌘K:** `CommandPalette` → nav + `platform/search`
- **Design system:** `platform-design-system.css` tokens

### 2.8 Dashboard architecture

- **Bootstrap:** `dashboard/bootstrap` builds role-aware payload (snapshots preferred)
- **Snapshots:** `dashboardSnapshots.js` — materialized JSON per org (`dashboard_snapshot_*`, `rep_snapshot_*`)
- **Live updates:** Client polls `dashboard/pulse` version hash; refreshes on change
- **Layout:** Per-user widget order/visibility in `localStorage`
- **Warm path:** Cron `crm/dashboard-warm-cron` rebuilds snapshots

See `DASHBOARD.md`.

### 2.9 Existing modules (product)

| Module | Backend | Frontend panel |
|--------|---------|----------------|
| Pipeline / Leads | `saved-leads.js` | `pipeline` |
| Accounts | `companies-hub.js` | `companies` |
| Opportunities | `opportunities-hub.js` | `opportunities` |
| Contacts | `contacts.js` | `contacts` |
| Marketing | `marketing-*.js` | `marketing` |
| Calendar | `crm-calendar.js` | `crm-calendar` |
| Sequences | `crm-sequences.js` | `crm-sequences` |
| Automation | `crmWorkflow*`, `marketing-automations` | `crm-automation` |
| Team | `team-*.js` | `team` |
| Activity log | `crm-activity-log.js` | `crm-log` |
| Dashboard | `dashboard-bootstrap.js` | `overview` |
| AI search | `search-leads.js` | `search` |
| Chithi | `chithi.js` | `chithi` |
| Admin | `admin-*.js` | `admin-*` |

### 2.10 Integrations

- **Email:** Resend (transactional/marketing), Gmail (user OAuth), inbound webhook
- **Calendar:** Google Calendar OAuth
- **WhatsApp:** Cloud API webhooks
- **Push:** Web push (Chithi service worker)
- **AI:** OpenAI-compatible APIs for search, assistant, email gen

### 2.11 Technical debt (summary)

1. **Dual persistence** — JSON shards vs SQL tables; risk of drift
2. **Full-shard RMW** — hot-path reads entire org pipeline blob
3. **JavaScript only** — no compile-time type safety
4. **Dual automation engines** — marketing graph vs CRM workflow rules
5. **Tests not in CI** — 23 unit tests exist but not gated
6. **API unversioned** — flat `/api/*` namespace
7. **Incomplete SQL flag rollout** — `USE_PIPELINE_LEADS_TABLE` often off in prod
8. **Cron/doc drift** — marketing cron not in `vercel.json` (Hobby limit)

Full list: `CRM_GAP_ANALYSIS.md`.

---

## 3. Target architecture (constitution-aligned, evolution path)

### 3.1 Principles (non-negotiable outcomes)

1. **Multi-tenancy first** — every query scoped by `organization_id` (or solo user scope)
2. **Security by design** — RBAC on every API; audit sensitive actions
3. **Layered logic** — handlers thin; services own business rules; repositories own persistence
4. **Observable** — structured logs, metrics, trace IDs on requests
5. **Testable modules** — domain logic without HTTP coupling

### 3.2 Recommended layering (incremental)

```
handlers/     → HTTP, auth, validation, DTO mapping
services/     → business rules, permissions, orchestration  (NEW, extract from lib/server/*.js)
repositories/ → store.js, pipelineLeadsTable, supabase      (formalize existing)
events/       → domain events → queue                       (expand queue usage)
```

### 3.3 Data plane evolution

**Phase A (current):** JSON shards authoritative; SQL for list/filter hot paths  
**Phase B:** SQL authoritative for leads; JSON shard as write-through cache  
**Phase C:** Retire shard blobs; snapshots for analytics only  

### 3.4 Constitution stack mapping

| Constitution | Approved evolution |
|--------------|-------------------|
| Next.js | Keep Vite SPA; adopt App Router patterns via panel shell |
| Prisma | SQL migrations now; Prisma after schema stabilizes |
| TypeScript | `shared/` package → handlers → frontend |
| `/api/v1` | Add parallel routes; deprecate legacy over 2 quarters |
| WebSocket dashboard | SSE on Vercel first; WebSocket on worker if needed |

---

## 4. Architecture review checklist

| Area | Status | Notes |
|------|--------|-------|
| Naming conventions | Good | Consistent `crm-*`, `marketing-*`, `org-*` |
| Folder structure | Adequate | Needs `services/` extraction |
| Business logic duplication | Medium | Deal flatten shared; workflows duplicated |
| API design | Adequate | REST-ish JSON; no OpenAPI |
| DB normalization | Low | JSON nested CRM; SQL path improving |
| Caching | Good | Bootstrap, pipeline, session caches |
| Redis | Partial | Requires `REDIS_URL` in prod |
| Background workers | Good | Railway + cron fallbacks |
| Security | Improving | P1 RBAC shipped; audit incomplete |
| Performance | Risk | Shard reads; snapshot mitigates dashboard |
| Scalability | Partial | SQL migration critical path |
| Logging | Partial | Sentry; no unified audit stream |
| Testing | Weak | Not in CI |
| Deployment | Strong | prod:ship, rollback, production log |

---

## 5. Related documents

| Document | Purpose |
|----------|---------|
| `DATABASE.md` | Schema, migrations, tenancy |
| `API.md` | Route inventory, conventions |
| `SECURITY.md` | Auth, RBAC, encryption |
| `DASHBOARD.md` | Dashboard data plane |
| `EMAIL_ENGINE.md` | Email providers, queue |
| `WORKFLOW_ENGINE.md` | Automations |
| `DEPLOYMENT.md` | Production deploy |
| `TESTING.md` | Test strategy |
| `CODING_STANDARDS.md` | Style and patterns |
| `PROJECT_ROADMAP.md` | Phased delivery |
| `REPOSITORY_STRUCTURE_PROPOSAL.md` | Future repo layout |

---

## 6. Approval status

| Artifact | Status |
|----------|--------|
| Architecture review | Complete (this document) |
| Gap analysis | Complete |
| Roadmap | Draft — **awaiting approval** |
| Implementation | **Blocked** per Phase 7 constitution gate |
