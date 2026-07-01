# CRM Gap Analysis — Connect Intel vs Engineering Constitution

**Date:** 2026-06-24  
**Baseline:** Live production at https://connectintel.net (`9ea5b20` feature line)  
**Constitution:** Enterprise CRM AI Engineering Constitution (master instruction manual)  
**Platform blueprint:** `docs/CRM_PLATFORM_BLUEPRINT.md` (extend-in-place mandate)

> **Strategic tension:** The constitution prescribes a greenfield stack (Next.js, Prisma, TypeScript everywhere, `/api/v1`). The approved product blueprint mandates **evolving** the existing Vite + Vercel + JSON/SQL hybrid. This gap analysis scores **target enterprise outcomes**, not a mandatory stack rewrite, unless leadership explicitly approves migration.

---

## Legend

| Priority | Meaning |
|----------|---------|
| P0 | Security / tenancy / data-loss risk |
| P1 | Enterprise blocker for scale or sales |
| P2 | Important; can ship incrementally |
| P3 | Nice-to-have / polish |

| Complexity | Meaning |
|------------|---------|
| S | Days |
| M | 1–3 weeks |
| L | 1–2 months |
| XL | Quarter+ |

---

## Executive summary

| Area | Current maturity | Target (constitution) | Overall gap |
|------|------------------|----------------------|-------------|
| Multi-tenancy | Partial (shards + SQL path) | `org_id` on every row, every query | **High** |
| RBAC | Implemented (matrix + handlers) | API-enforced, auditable | **Medium** |
| Architecture | Monolithic serverless + domain modules | Clean Architecture / DDD / DI | **High** |
| Type safety | JavaScript only | TypeScript FE + BE | **High** |
| Database | Hybrid JSON + partial Postgres | PostgreSQL + Prisma, UUID, migrations only | **High** |
| API | ~130 flat routes, no versioning | REST `/api/v1`, OpenAPI, rate limits | **Medium** |
| Dashboard | Enterprise UI, poll pulse, local layout | SSE/WebSocket, server layout, export | **Medium** |
| Email | Mature (Resend/Gmail/queue/tracking) | Provider-agnostic + full audit | **Low–Medium** |
| Workflow | Dual engines (CRM + marketing) | Unified versioned workflow engine | **High** |
| Testing | 23 unit tests, not in CI | Mandatory coverage + E2E | **High** |
| Observability | Sentry + metrics hooks | Full audit trail + APM | **Medium** |
| IaC | Vercel + Railway toml | Terraform/K8s | **High** |

---

## Detailed gaps

### Foundation & architecture

| Feature / requirement | Current | Target | Priority | Complexity | Dependencies | Effort | Risk |
|---------------------|---------|--------|----------|------------|--------------|--------|------|
| Clean Architecture layers | Handlers call domain modules directly; no formal ports/adapters | UI → API → Service → Repository | P2 | L | Team agreement on boundaries | 6–10 wks | Refactor churn |
| Domain-Driven Design | Lead-centric model; implicit domains | Bounded contexts: Sales, Marketing, Platform | P2 | L | Architecture doc | 4–8 wks | Over-abstraction |
| TypeScript (FE + BE) | 100% JavaScript/JSX | Strict TS everywhere | P1 | XL | Build pipeline, gradual migration | 3–6 mo | Long-running branch |
| Dependency injection | Manual imports | Container / factory pattern | P3 | M | TS or lightweight DI | 2–4 wks | Low |
| CQRS | Read models (snapshots) for dashboard only | CQRS where read/write diverge | P2 | M | SQL read models | 4–6 wks | Complexity |
| Repository pattern | `store.js`, `pipelineLeadsTable.js` | Uniform repositories per aggregate | P1 | L | Postgres as SoT path | 8–12 wks | Dual-write period |
| Event-driven architecture | BullMQ jobs, cron triggers | Domain events + outbox | P2 | L | Redis, event schema | 6–8 wks | Ordering/idempotency |
| OpenAPI / Swagger | None | Every endpoint documented | P2 | M | Route inventory | 2–3 wks | Drift if not automated |
| API versioning | `/api/*` unversioned | `/api/v1/*` | P2 | M | Client migration | 2–4 wks | Breaking changes |

### Multi-tenancy & security

| Feature / requirement | Current | Target | Priority | Complexity | Dependencies | Effort | Risk |
|---------------------|---------|--------|----------|------------|--------------|--------|------|
| `org_id` on every table | JSON collections + some SQL tables; legacy solo shards | Every relational table + enforced query filter | P0 | XL | Migrations, backfill | 3–6 mo | Data leakage if rushed |
| Query-level tenant filter | `tenantIsolation.js`, `pipelineTableScope.js` | Middleware + DB RLS everywhere | P0 | L | Supabase RLS completion | 6–10 wks | Performance |
| RBAC at API | `permissionEnforce.js`, marketing gates | 100% handler coverage + audit | P0 | M | Permission matrix completion | 3–5 wks | Missed endpoints |
| JWT auth | Session JWT in cookie + Bearer | Standardized JWT claims (`org_id`, roles) | P2 | M | Auth refactor | 2–3 wks | Session migration |
| Encryption at rest | Vault PII on `leads` table (partial) | All sensitive fields encrypted | P1 | L | Key management | 4–8 wks | Query complexity |
| Encryption in transit | HTTPS (Vercel) | TLS everywhere + cert pinning mobile | P1 | S | Ops | Done | Low |
| Rate limiting | Partial / infra flags | All public endpoints | P1 | M | Redis/Upstash | 1–2 wks | False positives |
| Security audits / pen test | Ad hoc | Regular schedule | P2 | M | Vendor | Ongoing | Compliance |
| Audit log (all mutations) | `admin-tenant-audit`, activity log partial | Immutable audit stream per org | P1 | L | `audit_events` table | 4–6 wks | Storage cost |

### Database

| Feature / requirement | Current | Target | Priority | Complexity | Dependencies | Effort | Risk |
|---------------------|---------|--------|----------|------------|--------------|--------|------|
| PostgreSQL as SoT | JSON `store_collections` primary | Postgres primary, JSON deprecated | P0 | XL | Backfill scripts | 6–12 mo | Downtime |
| Prisma ORM | Raw SQL migrations + PostgREST | Prisma migrations | P2 | XL | Schema consolidation | 3–6 mo | Migration bugs |
| UUID primary keys | Mixed TEXT legacy + UUID on new tables | UUID everywhere | P1 | L | ID mapping layer | 4–8 wks | Broken FKs |
| `created_at` / `updated_at` / `deleted_at` | Partial | All tables | P1 | M | Migration templates | 2–4 wks | — |
| Indexes on `org_id` | On new SQL tables | All tenant tables | P0 | M | Index audit | 1–2 wks | — |
| Reversible migrations | SQL files in `supabase/migrations/` | Prisma + down migrations | P1 | M | Process | 2 wks | — |
| No raw SQL in app | `pipelineLeadsTable.js`, RPCs | Repository layer only | P2 | L | Abstraction | 6–8 wks | Performance tuning |

### Authentication, orgs, users, roles

| Feature / requirement | Current | Target | Priority | Complexity | Dependencies | Effort | Risk |
|---------------------|---------|--------|----------|------------|--------------|--------|------|
| Authentication | Google OAuth + session (`auth.js`) | Multi-provider + MFA roadmap | P2 | M | Auth provider | 3–4 wks | — |
| Organizations | `organizations` JSON + SQL | First-class org service | P1 | M | SQL cutover | 3–4 wks | — |
| Users / profiles | `users` collection + `profiles` SQL | Unified profile model | P1 | M | Auth cutover | 3–4 wks | — |
| Roles | `pipelineRole`, `orgRole`, marketing roles | Single role + permission matrix | P1 | M | `role_permissions` | 2–3 wks | UX confusion |
| Permissions UI | Team permissions panel | Self-serve RBAC admin | P2 | M | API complete | 2–3 wks | — |
| Invites / onboarding | `team-invite`, `onboarding-complete` | Enterprise SSO later | P3 | L | IdP | Quarter+ | — |

### CRM objects (Sales)

| Feature / requirement | Current | Target | Priority | Complexity | Dependencies | Effort | Risk |
|---------------------|---------|--------|----------|------------|--------------|--------|------|
| Leads | `savedLeads` / `pipeline_leads` | First-class `leads` table + API | P1 | L | SQL migration | 6–8 wks | Import breakage |
| Companies / Accounts | `companies-hub`, CompaniesPanel | Account object with hierarchy | P1 | M | Company aggregation | 3–4 wks | — |
| Contacts | `contacts` handler + panel | Master contact graph | P1 | M | Link model | 2–4 wks | Duplicates |
| Deals / Opportunities | Nested `crm.deals[]`, Opportunities hub | First-class `deals` table | P1 | L | Pipeline SQL | 4–6 wks | Freight vs standard |
| Activities | `crm.activities` + SQL log | Unified activity service | P1 | M | Activity SQL | 3–4 wks | — |
| Tasks | `crm.tasks` + team tasks | Cross-object task engine | P2 | M | Notifications | 2–3 wks | — |
| Custom fields | `crmSettings` per org | Field schema registry | P2 | L | UI builder | 4–6 wks | — |

### Marketing & email

| Feature / requirement | Current | Target | Priority | Complexity | Dependencies | Effort | Risk |
|---------------------|---------|--------|----------|------------|--------------|--------|------|
| Provider-agnostic email | Resend, Gmail, SendGrid adapter | Pluggable provider interface | P2 | S | Already mostly there | 1 wk | — |
| Email audit log | Campaign + enrollment tracking | DB row per send (all types) | P1 | M | `email_sends` table | 2–3 wks | — |
| Dynamic templates | Marketing templates | CRM + marketing unified | P2 | M | Template service | 2–4 wks | — |
| Open/click tracking | `marketing-open`, `marketing-click` | Constitution-compliant | P1 | S | Done | — | Low |
| Background queue | BullMQ + SQL queue | Required pattern | P1 | S | Redis/Railway | Done | Worker uptime |

### Workflow & automation

| Feature / requirement | Current | Target | Priority | Complexity | Dependencies | Effort | Risk |
|---------------------|---------|--------|----------|------------|--------------|--------|------|
| Unified workflow engine | `automationGraphRunner` + `crmWorkflowRules` | Single engine | P0 | XL | Blueprint Phase | 2–3 mo | Regression |
| Triggers (CRUD, time) | Partial both systems | Standard trigger catalog | P1 | L | Engine unification | 4–6 wks | — |
| Actions (email, webhook, task) | Partial | Full action library | P1 | L | Engine | 4–6 wks | — |
| Versioning & audit | Marketing automations versionless | Versioned workflows | P1 | L | Schema + UI | 4–6 wks | — |

### Dashboard & analytics

| Feature / requirement | Current | Target | Priority | Complexity | Dependencies | Effort | Risk |
|---------------------|---------|--------|----------|------------|--------------|--------|------|
| Real-time updates | Poll `/api/dashboard/pulse` 25s | WebSocket or SSE | P2 | M | Vercel limits | 2–4 wks | Connection scale |
| Drag-drop widgets | Customize panel + localStorage | Server-persisted layouts | P2 | M | `dashboard_layouts` table | 2–3 wks | — |
| WCAG 2.1 AA | Partial (enterprise home) | Full audit pass | P1 | M | Accessibility review | 2–4 wks | — |
| Export CSV/PDF | Limited exports | Dashboard + report export | P2 | M | Report service | 3–4 wks | — |
| Custom views / filters | Pipeline saved views | Cross-module saved views | P2 | M | View service | 3–4 wks | — |
| Sub-100ms API (core) | Variable; shard reads slow | Indexed SQL hot paths | P0 | XL | `pipeline_leads` default | 3–6 mo | — |

### Search, AI, notifications

| Feature / requirement | Current | Target | Priority | Complexity | Dependencies | Effort | Risk |
|---------------------|---------|--------|----------|------------|--------------|--------|------|
| Global search | `platform-search`, Meilisearch hooks | Enterprise search engine | P2 | L | Meilisearch prod | 4–6 wks | Index lag |
| AI prospecting | `search-leads`, assistant | Embedded AI per record | P2 | M | API keys, governance | Ongoing | Cost |
| Predictive analytics | Limited | AI engine pillar | P3 | XL | Data warehouse | Quarter+ | — |
| Notifications | `crm-notifications`, push (Chithi) | Unified notification service | P2 | M | `ci-notification` queue | 3–4 wks | — |

### Integrations, billing, infrastructure

| Feature / requirement | Current | Target | Priority | Complexity | Dependencies | Effort | Risk |
|---------------------|---------|--------|----------|------------|--------------|--------|------|
| Billing | `org-billing`, plan upgrade | Stripe-grade billing module | P2 | L | Payment provider | 6–8 wks | PCI scope |
| Webhooks (outbound) | Marketing/automation partial | Integration platform | P2 | L | Event bus | 4–6 wks | — |
| Terraform / K8s | None | IaC as constitution | P3 | XL | Ops team | Quarter+ | — |
| Docker local dev | None | `docker-compose` full stack | P2 | M | DevEx | 1–2 wks | — |
| E2E tests | None in CI | Playwright/Cypress suite | P1 | L | Test env | 4–6 wks | Flaky tests |
| Unit tests in CI | 23 tests, not gated | `npm test` in GitHub Actions | P1 | S | Script + fixes | 3–5 days | — |

---

## Constitution vs blueprint — recommended resolution

| Constitution says | Blueprint says | Recommendation |
|-------------------|----------------|----------------|
| Next.js + Shadcn | Vite + React shell | **Keep Vite**; adopt Shadcn-style tokens via `platform-design-system.css` |
| NestJS / containers API | Vercel serverless | **Keep serverless** for API; workers on Railway |
| Prisma + Postgres only | JSON shards + SQL path | **Phased SQL migration**; Prisma optional after schema stable |
| TypeScript mandatory | JS codebase | **Incremental TS**: `shared/` package first, then handlers |
| `/api/v1` | `/api/*` | Add v1 alias layer; deprecate over 2 quarters |

---

## Quick wins (next 30 days, no stack rewrite)

1. Enable `USE_PIPELINE_LEADS_TABLE` + hierarchy RBAC in production (P0 perf/tenancy).
2. Add `npm test` to CI (P1 quality).
3. RBAC audit: grep handlers missing `assertOrgPermission` (P0).
4. SSE dashboard pulse (upgrade from poll) (P2).
5. Consolidate cron docs + external scheduler for marketing cron (P1 ops).
6. OpenAPI spec generated from route registry (P2).

---

## Approval required before implementation

- [ ] Gap analysis reviewed by product + engineering  
- [ ] Stack evolution path (extend vs rewrite) confirmed  
- [ ] `PROJECT_ROADMAP.md` phase order approved  
- [ ] Repository structure proposal approved  

**No feature implementation should begin until the above are signed off.**
