# Connect Intel — Product & Architecture Overview

**Version:** June 2026 · **Live:** https://connectintel.net  
**Purpose:** Share with reviewers. Goal: HubSpot-grade revenue platform (CRM + Marketing + Team ops).

---

## 1. What Connect Intel Is

Connect Intel is a **B2B revenue workspace** for companies that prospect, qualify, and close leads. One app covers:

| Hub | What users do |
|-----|----------------|
| **CRM / Sales** | Pipeline kanban, lead records, deals, sequences, calendar, WhatsApp |
| **Marketing** | Campaigns, audiences, templates, automations, forms, analytics |
| **Home / Analytics** | Dashboard, team KPIs, activity log, my-day |
| **Collaboration** | Team chat (Chithi), notes, tasks |
| **AI Prospecting** | Search companies, save to pipeline |
| **Workspace** | Team invites, permissions, email domain, integrations |

**Design north star:** HubSpot-style objects, timeline, permissions, and reporting — built as a fast SPA, not a page-reload CRM.

---

## 2. Who Uses It (Roles)

| Role | Who | What they see |
|------|-----|----------------|
| **Rep** | Sales rep | Only leads they own (`owner_id` = self) |
| **Manager** | Team lead | Team pipeline by default; optional “All Departments” view |
| **Org Admin** | Company owner / admin | Full org pipeline, team settings, permissions, imports |
| **Marketing Manager** | Marketing lead | Full marketing hub + send rights |
| **Marketing Executive** | Campaign operator | Campaigns, lists, sends (scoped by marketing role) |
| **Platform Admin** | Connect Intel operator | Customer admin, system integrations (separate nav) |

**Data scoping (HubSpot-like):** enforced in **Postgres** via `pipeline_leads` columns (`owner_id`, `team_id`, `department_id`) and RPC `COUNT` queries — not by loading full datasets into memory.

---

## 3. How the App Works (Pages & Navigation)

Connect Intel is a **single-page app (SPA)**. There is no traditional multi-page router.

```
Browser URL                    →  Panel (screen)
─────────────────────────────────────────────────
/home/dashboard                →  Home overview
?panel=pipeline&status=new     →  CRM pipeline (filtered)
?panel=marketing&tab=campaigns →  Marketing hub
?panel=team                    →  Team & permissions
?lead=<id>                     →  Lead record workspace (deep link)
```

**Shell layout**

```
┌─────────────────────────────────────────────────────────┐
│  Top bar — search, notifications, user menu             │
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │  Panel content (Pipeline, Marketing, etc.)   │
│ (nav +   │                                              │
│  counts) │  Lead workspace opens as overlay / side panel│
└──────────┴──────────────────────────────────────────────┘
```

**Key frontend files**

| File | Role |
|------|------|
| `frontend/src/App.jsx` | Landing → Auth → App shell |
| `frontend/src/lib/navConfig.js` | Sidebar sections & lead counters |
| `frontend/src/lib/appHistory.js` | URL ↔ panel state |
| `frontend/src/components/layout/AppShell.jsx` | Main layout |
| `frontend/src/components/layout/PanelViewport.jsx` | Panel switcher |
| `frontend/src/components/crm/PipelinePanel.jsx` | CRM pipeline |
| `frontend/src/components/marketing/MarketingPanel.jsx` | Marketing hub |

**Sidebar lead counters** (“All Leads”, “New”, “Follow-up”) load from scoped SQL `COUNT` APIs — fast, permission-aware.

---

## 4. Code Structure

```
connect-intel/
├── frontend/          React + Vite SPA → builds to site/
├── api/index.js       Single Vercel function; routes all /api/*
├── lib/server/        Business logic (auth, CRM, marketing, store)
│   ├── handlers/      Thin HTTP handlers (~100 routes)
│   ├── pipeline*.js   Pipeline list, scope, counts, mutations
│   ├── marketing*.js  Campaigns, queue, analytics
│   └── infra/         Config flags, metrics
├── lib/               Shared client + server utilities
├── supabase/          SQL migrations (Postgres schema)
├── docs/              Blueprint, release, this doc
└── scripts/           Build, deploy verify, backfills
```

**API pattern:** `api/index.js` maps path → `lib/server/handlers/<name>.js`. Each handler: CORS → `requireUser()` → logic → JSON response.

**Example routes**

| API | Purpose |
|-----|---------|
| `GET /api/saved-leads` | Paginated pipeline list (scoped) |
| `GET /api/pipeline/bootstrap` | Sidebar counts + first page |
| `GET /api/crm/my-day` | Rep/manager daily tasks |
| `GET /api/crm/team-dashboard` | Manager team KPIs |
| `POST /api/marketing/campaigns` | Create/send campaigns |
| `GET /api/team/permissions` | Org admin role management |

---

## 5. Data & Deployment

### 5.1 Where data lives

**Hybrid model (migrating toward SQL for hot paths)**

| Layer | Storage | Used for |
|-------|---------|----------|
| **JSON store** | Supabase `store_collections` (or local SQLite) | Users, orgs, full lead `entry` blobs, marketing metadata |
| **SQL tables** | Supabase Postgres | Fast pipeline queries, hierarchy, email queue, activity snapshots |

**Important tables**

| Table | Purpose |
|-------|---------|
| `store_collections` | One JSON blob per collection (`savedLeads`, `users`, `marketingCampaigns`, …) |
| `pipeline_leads` | One row per lead; indexed `owner_id`, `team_id`, `department_id`, `lead_status` |
| `profiles` | Employee record: `role` (admin/manager/rep), team, department |
| `departments`, `teams` | Org hierarchy |
| `marketing_email_queue` | High-volume email send queue (no Redis required) |
| `pipeline_activities` | Activity log (SQL-backed, partial reads) |

**Bridge:** `profiles.legacy_user_id` = app user ID in JSON store.

### 5.2 How we deploy

| Step | What happens |
|------|----------------|
| 1 | Developer runs `npm run prod:ship` (build + import checks) |
| 2 | `git push origin main` |
| 3 | **GitHub Actions** runs CI build |
| 4 | **Vercel** deploys frontend (`site/`) + serverless API (`api/index.js`) |
| 5 | `npm run prod:log` marks live commit in `docs/PRODUCTION_LOG.md` |
| 6 | **Supabase migrations** run manually in SQL editor (schema changes) |

**Production:** https://connectintel.net · Vercel project `connect-intel`  
**Auth:** Google OAuth + session JWT cookie  
**Email:** Resend / Gmail · **Cron:** daily marketing job on Vercel

**Feature flags (env)**

| Flag | Effect |
|------|--------|
| `USE_PIPELINE_LEADS_TABLE` | Pipeline reads from SQL, not full JSON shard |
| `USE_PIPELINE_HIERARCHY_RBAC` | Rep/manager/admin scoping on SQL |
| `USE_MARKETING_SQL_QUEUE` | Campaign sends via Postgres queue |

---

## 6. Feature Modules (PRD Summary)

### 6.1 CRM / Pipeline (Sales Hub)

| Capability | Status | Notes |
|------------|--------|-------|
| Lead pipeline (kanban / table) | ✅ Live | Statuses: New → Contacted → Follow-up → Qualified → Won/Lost |
| Lead record workspace | ✅ Live | Timeline, tasks, emails, deals, notes |
| Deals view | ✅ Live | Nested deals per lead; freight variant for logistics orgs |
| Sequences & automation rules | ✅ Partial | Email sequences + CRM workflow rules |
| Calendar & meetings | ✅ Live | Google Calendar sync |
| WhatsApp inbox | ✅ Live | Cloud API integration |
| Companies & contacts | ✅ Partial | Master records; full account hierarchy = roadmap |
| Team hierarchy RBAC | ✅ Live (SQL) | Rep / manager / admin scoping |

### 6.2 Marketing Hub

| Capability | Status | Notes |
|------------|--------|-------|
| Campaigns (email) | ✅ Live | Bulk send via SQL queue |
| Audiences / lists / segments | ✅ Live | |
| Templates & landing pages | ✅ Live | |
| Automations (visual graph) | ✅ Live | |
| Analytics dashboard | ✅ Live | Snapshot KPIs in SQL |
| Forms | ✅ Live | |
| Domains & deliverability | ✅ Live | |

### 6.3 Dashboard & Analytics

| Capability | Status | Notes |
|------------|--------|-------|
| Home overview | ✅ Live | Pipeline summary, quick actions |
| My Day | ✅ Live | Tasks, follow-ups due |
| Team dashboard | ✅ Live | Manager KPIs (feature-gated) |
| Activity log | ✅ Live | SQL snapshots for fast load |
| Custom report builder | 🔲 Roadmap | |

### 6.4 Org Admin & Team

| Capability | Status | Notes |
|------------|--------|-------|
| Invite team members | ✅ Live | Email invite flow |
| Set roles (pipeline + marketing) | ✅ Live | Org admin panel |
| Org branding & email domain | ✅ Live | |
| Lead import / tags | ✅ Live | |
| Department & team setup | ✅ SQL ready | UI seeding in progress |

### 6.5 AI & Prospecting

| Capability | Status | Notes |
|------------|--------|-------|
| Company search | ✅ Live | |
| Save to pipeline | ✅ Live | |
| AI assistant (Chithi) | ✅ Live | Team chat + support |
| Command palette (⌘K) | ✅ Live | Global search |

---

## 7. HubSpot Parity — Gap Analysis (for review)

**What we already match**

- Pipeline with stage-based views and record workspace  
- Marketing hub (campaigns, lists, automation, analytics)  
- Team permissions and data scoping by role  
- Activity timeline on records  
- Email sequences and basic workflow automation  

**What reviewers should prioritize next**

| Priority | Gap | HubSpot equivalent |
|----------|-----|-------------------|
| P0 | Unified Companies as parent object | Company records with child contacts/deals |
| P0 | Deal object (not nested in lead JSON) | Standalone deal pipeline + forecasting |
| P1 | Single automation engine | Workflows across CRM + Marketing |
| P1 | Configurable reports | Report builder + dashboards |
| P2 | Service tickets on contacts | Service Hub |
| P2 | Multi-pipeline | Separate pipelines per team/product |
| P3 | Website tracking & behavioral scoring | HubSpot tracking code |

Full roadmap: `docs/CRM_PLATFORM_BLUEPRINT.md`

---

## 8. Request for Review

Please comment on:

1. **Role model** — Is rep / manager / org admin / marketing role split correct?  
2. **Data architecture** — JSON store + SQL hot path: acceptable until full Postgres cutover?  
3. **HubSpot gaps** — Which P0/P1 items matter most for your workflow?  
4. **Navigation** — Panel-based SPA vs traditional routes: any concerns for training users?  
5. **Marketing + CRM unification** — Shared contact object and journey view: priority?

**Contacts:** Product owner · Engineering lead  
**Repo:** connect-intel (private) · **Docs:** `docs/CRM_PLATFORM_BLUEPRINT.md`, `docs/RELEASE_CHECKLIST.md`

---

*Connect Intel — Confidential overview for internal and partner review.*
