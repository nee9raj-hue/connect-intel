# Connect Intel — API Reference

**Last updated:** 2026-06-24  
**Base URL:** `https://connectintel.net/api`  
**Router:** `api/index.js` (~130 routes)

> **Note:** OpenAPI/Swagger spec is not yet generated (constitution gap). This document describes conventions and major route groups. A machine-readable spec is planned.

---

## 1. Conventions

| Aspect | Current behavior |
|--------|------------------|
| **Style** | REST-like JSON over HTTP |
| **Versioning** | None (`/api/*`); target `/api/v1/*` |
| **Auth** | Session JWT — `Authorization: Bearer <token>` or session cookie |
| **CORS** | `applyCors()` per handler |
| **Errors** | `{ "error": "message" }` with 4xx/5xx status |
| **Tenancy** | Implicit from session user's `organizationId` |
| **Permissions** | `assertOrgPermission(user, action)` on protected routes |

### HTTP methods

- `GET` — read
- `POST` — create / actions
- `PATCH` — partial update
- `DELETE` — remove (where implemented)
- `OPTIONS` — CORS preflight (all handlers)

### Rate limiting

Partial — not globally enforced (constitution gap). Marketing send paths have provider rate limits.

---

## 2. Authentication

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/auth/session` | Create, refresh, destroy session |

**Client:** `frontend/src/lib/api.js` → `createSession`, `destroySession`; auto-retry on 401.

---

## 3. Route groups

### 3.1 Pipeline & CRM core

| Path | Handler | Description |
|------|---------|-------------|
| `saved-leads` | `saved-leads.js` | Pipeline CRUD, summary, board, deals view |
| `pipeline/bootstrap` | `pipeline-bootstrap.js` | Fast pipeline boot (cached) |
| `pipeline/lead-quick-summary` | `pipeline-lead-quick-summary.js` | Lead card summary |
| `contacts` | `contacts.js` | Master contacts |
| `companies/hub` | `companies-hub.js` | Accounts aggregation |
| `opportunities/hub` | `opportunities-hub.js` | Deals/opportunities list |
| `crm/bulk-update` | `crm-bulk-update.js` | Bulk CRM patch |
| `crm/bulk-delete` | `crm-bulk-delete.js` | Bulk delete |
| `crm/settings` | `crm-settings.js` | Org CRM settings |
| `crm/saved-views` | `crm-saved-views.js` | Pipeline saved views |

### 3.2 Dashboard & analytics

| Path | Handler | Description |
|------|---------|-------------|
| `dashboard/bootstrap` | `dashboard-bootstrap.js` | Home dashboard payload |
| `dashboard/pulse` | `dashboard-pulse.js` | Snapshot version for live refresh |
| `crm/dashboard-kpi` | `crm-dashboard-kpi.js` | KPI strip data |
| `crm/team-metrics` | `crm-team-metrics.js` | Team intelligence metrics |
| `crm/team-dashboard` | `crm-team-dashboard.js` | Team dashboard |
| `crm/rep-summary` | `crm-rep-summary.js` | Rep rollup |
| `crm/rep-review` | `crm-rep-review.js` | Rep drill-down |
| `crm/activity-log` | `crm-activity-log.js` | Activity hub |
| `crm/activity-timeline` | `crm-activity-timeline.js` | Timeline feed |
| `crm/my-day` | `crm-my-day.js` | My Day priorities |
| `crm/dashboard-warm-cron` | `crm-dashboard-warm-cron.js` | Cron: warm snapshots |

### 3.3 Email & calendar

| Path | Handler | Description |
|------|---------|-------------|
| `crm/send-email` | `crm-send-email.js` | 1:1 send |
| `crm/bulk-email` | `crm-bulk-email.js` | Bulk CRM email |
| `crm/email-oauth/*` | OAuth handlers | Gmail connect |
| `crm/calendar` | `crm-calendar.js` | Meetings |
| `crm/calendar/google` | `crm-calendar-google.js` | Google sync |
| `crm/reminders-cron` | `crm-reminders-cron.js` | Meeting reminders |

### 3.4 Marketing

| Path prefix | Description |
|-------------|-------------|
| `marketing/campaigns` | Campaign CRUD + send |
| `marketing/lists`, `marketing/segments`, `marketing/audiences` | Audiences |
| `marketing/automations` | Graph automations |
| `marketing/templates`, `marketing/landing-pages`, `marketing/forms` | Content |
| `marketing/open`, `marketing/click` | Tracking pixels |
| `marketing/cron` | Scheduled marketing jobs |
| `marketing/webhooks` | Inbound events |

### 3.5 Sequences & automation

| Path | Handler |
|------|---------|
| `crm/sequences` | `crm-sequences.js` |
| `crm/automation` | (via workflow panels + rules) |

### 3.6 Organization & team

| Path | Description |
|------|-------------|
| `team/members`, `team/invite`, `team/permissions` | Team admin |
| `org/teams`, `org/departments`, `org/permissions` | Hierarchy |
| `org/imports`, `org/import-status` | Data import |
| `onboarding/complete` | Post-signup setup |

### 3.7 Platform

| Path | Description |
|------|-------------|
| `platform/search` | ⌘K record search |
| `search-leads` | AI prospecting |
| `health` | Health check |
| `client-error` | Client error reporting |
| `infra/*` | Capacity, queue stats (admin) |

### 3.8 Integrations

| Path | Description |
|------|-------------|
| `whatsapp-cloud-webhook` | WhatsApp inbound |
| `crm/email-inbound-webhook` | Inbound email |
| `resend-webhook` | Resend events |
| `chithi` | Team chat API |

### 3.9 Admin

| Path prefix | Description |
|-------------|-------------|
| `admin/*` | Platform operator tools |

---

## 4. Permission actions

Used with `assertOrgPermission`:

`view_all_leads`, `edit_leads`, `delete_leads`, `export_leads`, `manage_team`, `access_marketing`, `send_campaigns`, `view_analytics`, `manage_billing`

Defined in `lib/server/rolePermissions.js`.

---

## 5. Cron & worker endpoints

Protected by `CRON_SECRET` or `MARKETING_CRON_SECRET`:

| Path | Schedule |
|------|----------|
| `crm/dashboard-warm-cron` | Vercel cron 04:00 UTC daily |
| `marketing/cron` | Manual / external scheduler |
| `workers/cron` | BullMQ drain |
| `crm/reminders-cron` | Manual |

---

## 6. Client SDK

The frontend uses a monolithic client:

**File:** `frontend/src/lib/api.js`

Patterns:
- `request(path, { method, body }, { silent })`
- `dedupeGet(key, factory)` for in-flight deduplication
- Session retry on 401

**No public npm SDK** — constitution gap for partner integrations.

---

## 7. Target API improvements

| Item | Priority |
|------|----------|
| OpenAPI 3.1 spec from route registry | P2 |
| `/api/v1` version prefix | P2 |
| Global rate limiting (Redis) | P1 |
| Webhook signing standard | P2 |
| Public REST API keys per org | P3 |

See `CRM_GAP_ANALYSIS.md`.
