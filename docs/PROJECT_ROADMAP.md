# Connect Intel — Project Roadmap

**Version:** 1.0  
**Date:** 2026-06-24  
**Status:** Draft — requires approval before implementation  
**Related:** `CRM_GAP_ANALYSIS.md`, `CRM_PLATFORM_BLUEPRINT.md`, `ARCHITECTURE.md`

This roadmap follows the engineering constitution phase order while **respecting the extend-in-place blueprint** (Vite + Vercel + hybrid store → Postgres SoT).

---

## How to read each phase

Every phase includes: **Objectives**, **Deliverables**, **Dependencies**, **Database**, **API**, **Frontend**, **Testing**, **Acceptance criteria**.

**Status key:** `DONE` = shipped in production · `PARTIAL` = started · `PLANNED` = not started

---

## Phase 1 — Foundation

**Status:** PARTIAL

### Objectives
- Establish repo conventions, CI, documentation, and architecture guardrails.
- Define tenancy, logging, and error-handling standards.

### Deliverables
- `docs/ARCHITECTURE.md`, `CODING_STANDARDS.md`, `SECURITY.md`
- CI: build + handler import checks (`DONE`)
- Production deploy protocol (`prod:ship`, `PRODUCTION_LOG.md`) (`DONE`)

### Dependencies
None

### Database changes
None (document current hybrid model)

### API changes
`GET /api/health` (`DONE`)

### Frontend changes
Platform design tokens (`platform-design-system.css`) (`DONE`)

### Testing
Document `node --test` pattern; add `npm test` script (PLANNED)

### Acceptance criteria
- [x] Production deploys are reversible
- [x] Architecture docs exist
- [ ] Unit tests run in CI

---

## Phase 2 — Authentication

**Status:** PARTIAL

### Objectives
- Secure session-based auth for web and API.
- Google OAuth for sign-in; invite flows for team join.

### Deliverables
- Session JWT + httpOnly cookie (`lib/server/auth.js`) (`DONE`)
- Client session in `sessionAuth.js` (`DONE`)
- Google OAuth + RISC (`DONE`)

### Dependencies
Phase 1

### Database changes
`users` collection; `profiles.auth_user_id` (SQL, partial)

### API changes
`/api/auth/session` (`DONE`)

### Frontend changes
`AuthPage`, `GoogleSignIn` (`DONE`)

### Testing
Auth handler integration tests (PLANNED)

### Acceptance criteria
- [x] All protected routes require session
- [x] 401 triggers client refresh
- [ ] MFA roadmap documented

---

## Phase 3 — Organizations

**Status:** PARTIAL

### Objectives
- Multi-tenant workspaces (company + individual).
- Org settings, branding, plan limits.

### Deliverables
- `organizations` + memberships (`DONE` JSON)
- SQL `organizations` table + RLS (`PARTIAL`)
- Company workspace upload (`DONE`)

### Dependencies
Phase 2

### Database changes
`organizations`, `organizationMemberships`; SQL `public.organizations`

### API changes
`onboarding/complete`, `org/workspace`, `team/branding` (`DONE`)

### Frontend changes
`CompanyWorkspacePanel`, onboarding (`DONE`)

### Testing
Tenant write guard tests (`PARTIAL`)

### Acceptance criteria
- [x] Users scoped to `organizationId`
- [ ] SQL org is SoT for new signups

---

## Phase 4 — Users

**Status:** PARTIAL

### Objectives
- User profiles, team roster, hierarchy metadata.

### Deliverables
- `users` collection + `team-members` API (`DONE`)
- SQL `profiles` (`PARTIAL`)
- Org hierarchy departments/teams (`DONE`)

### Dependencies
Phase 3

### Database changes
`profiles`, hierarchy tables in migrations

### API changes
`team/members`, `org/teams`, `org/departments` (`DONE`)

### Frontend changes
`TeamPanel` hierarchy tabs (`DONE`)

### Testing
Member sync tests (PLANNED)

### Acceptance criteria
- [x] Manager sees scoped roster
- [ ] Profile SQL backfill complete

---

## Phase 5 — Roles

**Status:** PARTIAL

### Objectives
- Pipeline roles: org_admin, manager, member.
- Marketing roles separate from sales.

### Deliverables
- `pipelineRoles.js`, `marketingRoles.js` (`DONE`)
- `role_permissions` SQL matrix (`PARTIAL`)

### Dependencies
Phase 4

### Database changes
`role_permissions` migration (`20260621120000`)

### API changes
`team/permissions`, `org/permissions` (`DONE`)

### Frontend changes
Permissions tab in Team panel (`DONE`)

### Testing
`rolePermissions` unit tests (PLANNED)

### Acceptance criteria
- [x] Roles assigned per membership
- [ ] Single role UX (reduce overlap)

---

## Phase 6 — Permissions

**Status:** PARTIAL

### Objectives
- Enforce RBAC on every mutating API.
- Client gates for export, marketing, analytics.

### Deliverables
- `permissionEnforce.js` + handler wiring (`PARTIAL` — P0/P1 shipped)
- `orgPermissions` on session (`DONE`)

### Dependencies
Phase 5

### Database changes
`role_permissions` per org

### API changes
Audit all handlers for `assertOrgPermission` (IN PROGRESS)

### Frontend changes
Export gate in `PipelinePanel` (`DONE`)

### Testing
Permission matrix unit tests (PLANNED)

### Acceptance criteria
- [x] Delete/export/marketing gated
- [ ] 100% handler audit complete
- [ ] Audit log for permission denials

---

## Phase 7 — Leads

**Status:** PARTIAL

### Objectives
- Pipeline as primary sales object; fast list/board/kanban.
- SQL-backed pagination for scale.

### Deliverables
- `saved-leads` API + `PipelinePanel` (`DONE`)
- `pipeline_leads` table + backfill (`PARTIAL`)
- `pipeline-bootstrap` cache (`DONE`)

### Dependencies
Phase 6

### Database changes
`pipeline_leads`, filter columns, keyset indexes

### API changes
`saved-leads`, `pipeline/bootstrap` (`DONE`)

### Frontend changes
`LeadWorkspace`, board/table views (`DONE`)

### Testing
`pipelineLeadsTable.test.js` (`EXISTS` — not in CI)

### Acceptance criteria
- [x] Rep can CRUD own leads
- [ ] Production uses SQL table by default
- [ ] <200ms p95 list for 10k leads/org

---

## Phase 8 — Companies

**Status:** PARTIAL

### Objectives
- Account-centric view aggregated from pipeline.

### Deliverables
- `companies-hub` API (`DONE`)
- `CompaniesPanel` → Accounts label (`DONE`)

### Dependencies
Phase 7

### Database changes
`companies` collection; future `accounts` SQL table (PLANNED)

### API changes
`companies/hub` (`DONE`)

### Frontend changes
Accounts nav for company orgs (`DONE`)

### Testing
Hub aggregation tests (PLANNED)

### Acceptance criteria
- [x] Search accounts by name
- [ ] Domain-based account matching
- [ ] Parent/child account hierarchy

---

## Phase 9 — Contacts

**Status:** PARTIAL

### Objectives
- Master contact list; link to pipeline leads.

### Deliverables
- `contacts` API + panel (`DONE`)
- LinkedIn search (`DONE`)

### Dependencies
Phase 7

### Database changes
`contacts`, `companies` collections

### API changes
`contacts`, `contacts-linkedin-search` (`DONE`)

### Frontend changes
`ContactsPanel` (`DONE`)

### Testing
Link/unlink tests (PLANNED)

### Acceptance criteria
- [x] CRUD contacts
- [ ] Dedup merge UI

---

## Phase 10 — Activities

**Status:** PARTIAL

### Objectives
- Unified activity log (calls, emails, notes, status changes).

### Deliverables
- CRM activities on lead + `crm-activity-log` (`DONE`)
- SQL activity log + RPC (`PARTIAL`)

### Dependencies
Phase 7

### Database changes
Activity log migrations (`20260617120200`)

### API changes
`crm/activity-log`, `crm/activity-timeline` (`DONE`)

### Frontend changes
`CrmActivityLogPanel`, timeline in `LeadWorkspace` (`DONE`)

### Testing
Activity count rollup tests (PLANNED)

### Acceptance criteria
- [x] Filterable activity log
- [ ] SQL log is primary for analytics

---

## Phase 11 — Tasks

**Status:** PARTIAL

### Objectives
- Tasks on leads; team tasks; My Day priorities.

### Deliverables
- `crm.tasks` on leads (`DONE`)
- `team/tasks` (`DONE`)
- `crm/my-day` (`DONE`)

### Dependencies
Phase 10

### Database changes
Embedded in lead JSON; future `tasks` table (PLANNED)

### API changes
`crm/my-day`, `team/tasks` (`DONE`)

### Frontend changes
My Day, priorities on Home dashboard (`DONE`)

### Testing
Task due-date logic tests (PLANNED)

### Acceptance criteria
- [x] Tasks appear on dashboard priorities
- [ ] Standalone tasks not tied to leads

---

## Phase 12 — Deals

**Status:** PARTIAL

### Objectives
- Deal pipeline; freight-specific stages; opportunities hub.

### Deliverables
- `crm.deals[]` per lead (`DONE`)
- `OpportunitiesPanel` + hub API (`DONE`)
- Pipeline deals view for freight (`DONE`)

### Dependencies
Phase 7

### Database changes
Future `deals` SQL table (PLANNED)

### API changes
`opportunities/hub`, `saved-leads?view=deals` (`DONE`)

### Frontend changes
`LeadDealsSection`, `OpportunitiesPanel` (`DONE`)

### Testing
`dealPipeline.js` flatten tests (PLANNED)

### Acceptance criteria
- [x] Open deals from Opportunities nav
- [ ] First-class Deal record API
- [ ] Forecasting

---

## Phase 13 — Emails

**Status:** PARTIAL

### Objectives
- 1:1 CRM email, bulk, marketing campaigns; tracking; queue.

### Deliverables
- Resend + Gmail + SendGrid (`DONE`)
- BullMQ + SQL marketing queue (`DONE`)
- Open/click tracking (`DONE`)

### Dependencies
Phase 6 (send permissions)

### Database changes
`marketing_email_queue`, enrollments collections

### API changes
`crm/send-email`, `marketing/*`, webhooks (`DONE`)

### Frontend changes
Marketing hub, email in `LeadWorkspace` (`DONE`)

### Testing
Queue worker integration tests (PLANNED)

### Acceptance criteria
- [x] Campaign sends don't block HTTP
- [ ] Row-level audit for every CRM send

---

## Phase 14 — Calendar

**Status:** PARTIAL

### Objectives
- Meetings on leads; Google Calendar sync; reminders.

### Deliverables
- `crm/calendar`, Google OAuth (`DONE`)
- Reminder cron emails (`DONE`)

### Dependencies
Phase 11

### Database changes
Meetings in lead CRM JSON

### API changes
`crm/calendar`, `crm/calendar/google`, `crm/reminders-cron` (`DONE`)

### Frontend changes
`CrmCalendarPanel` (`DONE`)

### Testing
Reminder scheduling tests (PLANNED)

### Acceptance criteria
- [x] Schedule meeting on lead
- [ ] Bi-directional calendar sync reliability metrics

---

## Phase 15 — Workflow

**Status:** PARTIAL

### Objectives
- CRM workflow rules on status/activity triggers.

### Deliverables
- `crmWorkflowRules.js`, `crmWorkflow.js` (`DONE`)
- Visual workflow graph (`PARTIAL`)

### Dependencies
Phase 10

### Database changes
`crmWorkflowRules` collection

### API changes
Triggered on pipeline save (`DONE`)

### Frontend changes
`CrmAutomationPanel` (rules) (`DONE`)

### Testing
Workflow trigger unit tests (PLANNED)

### Acceptance criteria
- [x] Status-enter triggers fire
- [ ] Versioned workflow definitions

---

## Phase 16 — Automation

**Status:** PARTIAL

### Objectives
- Marketing automation graph; sequences; enrollments.

### Deliverables
- `automationGraphRunner.js` (`DONE`)
- `crmSequences.js` (`DONE`)
- Marketing cron processor (`DONE`)

### Dependencies
Phase 13, 15

### Database changes
`marketingAutomations`, `marketingAutomationRuns`

### API changes
`marketing/automations`, `crm/sequences` (`DONE`)

### Frontend changes
`AutomationCanvas`, marketing automations tab (`DONE`)

### Testing
Graph runner step tests (PLANNED)

### Acceptance criteria
- [x] Enroll in campaign from automation
- [ ] Unified engine with CRM workflows (see gap analysis)

---

## Phase 17 — Dashboard

**Status:** PARTIAL

### Objectives
- Enterprise home dashboard; team intelligence; snapshots.

### Deliverables
- `HomeDashboard` enterprise UI (`DONE`)
- Widget customize + live pulse (`DONE`)
- Dashboard snapshots + warm cron (`DONE`)
- Rep/solo parity (`DONE`)

### Dependencies
Phase 6, 10

### Database changes
Snapshot collections `dashboard_snapshot_*`, `rep_snapshot_*`

### API changes
`dashboard/bootstrap`, `dashboard/pulse`, `crm/dashboard-warm-cron` (`DONE`)

### Frontend changes
`enterprise/*` components, `useDashboardLayout`, `useDashboardLive` (`DONE`)

### Testing
Dashboard bootstrap unit tests (PLANNED)

### Acceptance criteria
- [x] Manager and rep see enterprise home
- [ ] SSE/WebSocket live updates
- [ ] Server-persisted layouts
- [ ] WCAG 2.1 AA audit pass

---

## Phase 18 — Reports

**Status:** PLANNED

### Objectives
- Exportable reports; org-level analytics; scheduled delivery.

### Deliverables
- Team metrics API (`DONE`)
- CSV/PDF export service (PLANNED)
- Report builder UI (PLANNED)

### Dependencies
Phase 17, SQL read models

### Database changes
`report_definitions`, materialized views (PLANNED)

### API changes
`crm/team-metrics`, `crm/rep-summary` (`DONE`); `/api/reports/*` (PLANNED)

### Frontend changes
`TeamDashboardPanel`, export buttons (PARTIAL)

### Testing
Report query snapshot tests (PLANNED)

### Acceptance criteria
- [ ] Export pipeline snapshot CSV
- [ ] Saved reports per org

---

## Phase 19 — Search

**Status:** PARTIAL

### Objectives
- Global ⌘K search; AI prospecting; Meilisearch index.

### Deliverables
- `CommandPalette` + `platform-search` (`DONE`)
- `search-leads` AI (`DONE`)
- Meilisearch integration (`PARTIAL`)

### Dependencies
Phase 7

### Database changes
Search index external (Meilisearch)

### API changes
`platform/search`, `search-leads` (`DONE`)

### Frontend changes
`PeopleSearch`, command palette (`DONE`)

### Testing
Search ranking tests (PLANNED)

### Acceptance criteria
- [x] ⌘K finds leads and nav
- [ ] Sub-100ms full-text at 100k records

---

## Phase 20 — AI

**Status:** PARTIAL

### Objectives
- AI email generation, assistant, prospecting, embedded intelligence.

### Deliverables
- `assistant-chat`, `crm/generate-email` (`DONE`)
- Chithi collaboration AI (`DONE`, feature-flagged)
- Team intelligence insights (`DONE`)

### Dependencies
Phase 13, 19

### Database changes
None (API keys in env)

### API changes
`assistant/*`, `chithi`, `crm/generate-*` (`DONE`)

### Frontend changes
`ConnectAssistant`, Chithi panels (`DONE`)

### Testing
Prompt injection / PII redaction tests (PLANNED)

### Acceptance criteria
- [x] Generate email on lead
- [ ] AI action audit log
- [ ] Per-org AI usage billing

---

## Phase 21 — Notifications

**Status:** PARTIAL

### Objectives
- In-app notifications; push (Chithi); email digests.

### Deliverables
- `crm/notifications` (`DONE`)
- Web push for Chithi (`DONE`)
- BullMQ `ci-notification` (`PARTIAL`)

### Dependencies
Phase 10

### Database changes
Notifications in store / user inbox collection

### API changes
`crm/notifications` (`DONE`)

### Frontend changes
Notification toasts in `AppShell` (`DONE`)

### Testing
Notification delivery tests (PLANNED)

### Acceptance criteria
- [x] Unread count on dashboard
- [ ] Unified preference center

---

## Phase 22 — Integrations

**Status:** PARTIAL

### Objectives
- WhatsApp Cloud API; inbound email; webhooks; integration status.

### Deliverables
- WhatsApp settings + webhooks (`DONE`)
- Inbound CRM email (`DONE`)
- `integrations-status` (`DONE`)

### Dependencies
Phase 13

### Database changes
Integration credentials per org (encrypted)

### API changes
`whatsapp-cloud-webhook`, `crm/email-inbound-webhook` (`DONE`)

### Frontend changes
`IntegrationsPanel`, `WhatsAppSettingsPanel` (`DONE`)

### Testing
Webhook signature verification tests (PLANNED)

### Acceptance criteria
- [x] WhatsApp send/receive
- [ ] Outbound integration webhooks catalog

---

## Phase 23 — Billing

**Status:** PARTIAL

### Objectives
- Org plans, credits, upgrades, usage limits.

### Deliverables
- `org-billing`, `org/plan-upgrade` (`DONE`)
- Credits UI (feature-flagged) (`PARTIAL`)

### Dependencies
Phase 3

### Database changes
Plan fields on `organizations`

### API changes
`org/plan-upgrade`, billing handlers (`DONE`)

### Frontend changes
`OrgBillingPanel` (`DONE`)

### Testing
Plan limit enforcement tests (PLANNED)

### Acceptance criteria
- [x] Admin can view billing panel
- [ ] Stripe subscription lifecycle

---

## Phase 24 — Infrastructure

**Status:** PARTIAL

### Objectives
- Redis, Railway workers, Supabase, Sentry, cron, capacity.

### Deliverables
- Vercel + Railway + Supabase (`DONE`)
- BullMQ queues (`DONE`)
- Infra bootstrap/diag endpoints (`DONE`)

### Dependencies
Phase 1

### Database changes
Supabase migrations (21 files)

### API changes
`infra/*`, `workers/cron` (`DONE`)

### Frontend changes
Admin integrations status (`DONE`)

### Testing
Worker health checks (`PARTIAL`)

### Acceptance criteria
- [x] Email worker on Railway
- [ ] All SQL feature flags on in prod
- [ ] Terraform module for non-Vercel resources (optional)

---

## Phase 25 — Production Deployment

**Status:** PARTIAL

### Objectives
- Safe, auditable releases; rollback; smoke checklist.

### Deliverables
- `npm run prod:ship`, `prod:log`, `prod:rollback` (`DONE`)
- `RELEASE_CHECKLIST.md` (`DONE`)
- GitHub Actions CI (`DONE`)

### Dependencies
All phases (continuous)

### Database changes
Migration runbook in `DATABASE.md`

### API changes
Versioned deploy markers in `PRODUCTION_LOG.md`

### Frontend changes
PWA auto-update (`DONE`)

### Testing
CI build gate (`DONE`); E2E smoke (PLANNED)

### Acceptance criteria
- [x] One-command rollback
- [x] Production log shows LIVE commit
- [ ] Automated smoke tests post-deploy

---

## Recommended execution order (next 90 days)

1. **P0:** SQL pipeline table + RBAC handler audit (Phases 6–7)
2. **P1:** CI unit tests + audit log (Phases 1, 6)
3. **P1:** Deals/Accounts SQL promotion (Phases 8, 12)
4. **P2:** Dashboard SSE + server layouts (Phase 17)
5. **P2:** Workflow engine unification plan (Phases 15–16)

**Approval gate:** No phase marked PLANNED should start implementation until dependencies are DONE and acceptance criteria for prior phases are reviewed.
