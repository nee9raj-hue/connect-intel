# Connect Intel — Email Engine

**Last updated:** 2026-06-24

---

## 1. Overview

The email engine supports **CRM 1:1**, **bulk CRM**, and **marketing campaigns** with provider abstraction, background queues, and open/click tracking.

**Constitution alignment:** Provider-agnostic ✅ · Queue-based sending ✅ · Tracking ✅ · Audit logging ⚠️ partial

---

## 2. Providers

| Provider | Use case | Module |
|----------|----------|--------|
| **Resend** | Transactional, marketing domain sends | `lib/server/resend.js` |
| **Gmail OAuth** | User mailbox send | `lib/server/crmUserGmail.js` |
| **SendGrid** | Adapter | `lib/server/emailProviders/sendgrid.js` |
| **Nodemailer** | SMTP fallback paths | nodemailer dependency |

**Dual mode:** `lib/server/email/dualModeSend.js` — sync vs background per policy.

---

## 3. Send paths

### 3.1 CRM 1:1

```
POST /api/crm/send-email
  → consent check (leadEmailSendable, emailConsent)
  → Gmail or Resend
  → activity on lead CRM
```

### 3.2 CRM bulk

```
POST /api/crm/bulk-email
  → batch enqueue or sync send
```

### 3.3 Marketing campaigns

```
POST /api/marketing/campaigns (send action)
  → campaignSendOrchestrator
  → BullMQ ci-email OR marketing_email_queue (SQL)
  → Resend/Gmail per recipient
```

---

## 4. Queue architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│ Vercel API  │────▶│ BullMQ (Redis)   │────▶│ Railway     │
│ enqueue     │     │ ci-email queue   │     │ worker      │
└─────────────┘     └──────────────────┘     └─────────────┘
       │
       ▼
┌──────────────────┐
│ SQL queue        │  (USE_MARKETING_SQL_QUEUE)
│ marketing_email_ │
│ queue table      │
└──────────────────┘
```

| Component | File |
|-----------|------|
| Producer | `lib/server/queue/producer.js` |
| Processors | `lib/server/queue/processors.js` |
| Worker entry | `workers/index.mjs` |
| SQL worker | `marketingEmailQueueWorker.js` |
| Cron drain | `marketing-cron.js`, `workers-cron.js` |

**Docs:** `EMAIL_INFRASTRUCTURE_V3.md`, `EMAIL_DUAL_MODE_ARCHITECTURE.md`, `RAILWAY_WORKER.md`

---

## 5. Templates & dynamic content

| Type | Storage |
|------|---------|
| Marketing templates | `marketingTemplates` collection |
| CRM generated email | AI `crm/generate-email` |
| Merge fields | Per-campaign / per-lead substitution in orchestrator |

---

## 6. Tracking

| Event | Endpoint |
|-------|----------|
| Open | `GET /api/marketing/open` (tracking pixel) |
| Click | `GET /api/marketing/click` (redirect) |
| Unsubscribe | `marketing/unsubscribe` |
| Webhooks | `resend-webhook`, `marketing-webhooks` |

**Module:** `lib/server/marketingTracking.js` (HMAC tokens)

---

## 7. Consent & compliance

| Control | File |
|---------|------|
| Marketing consent | `lib/emailConsent.js` |
| Sendability gate | `leadEmailSendable.js` |
| Suppressions | `marketing-suppressions` handler |
| Unsubscribe | `marketing-unsubscribe` |

---

## 8. Inbound email

- **CRM replies:** `crm/email-inbound-webhook` — sync thread without `gmail.readonly`
- **Doc:** `CRM_INBOUND_EMAIL.md`, `CRM_EMAIL_TRAIL_SYNC.md`

---

## 9. Audit & logging

| Logged today | Gap |
|--------------|-----|
| Campaign enrollments, send status | Per-message `email_sends` SQL table |
| Marketing events (open/click) | CRM 1:1 send row audit |
| Resend webhooks | Centralized email audit UI |

---

## 10. Rate limits & throughput

- `email/providerRateLimits.js`
- `infra/emailWorkerPolicy.js`
- `EMAIL_THROUGHPUT_PHASE_A.md`

---

## 11. Configuration (env)

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend sends |
| `REDIS_URL` | BullMQ |
| `CRON_SECRET` | Cron processors |
| Google OAuth vars | Gmail send |
| `USE_MARKETING_SQL_QUEUE` | SQL queue mode |

---

## 12. Roadmap

See `PROJECT_ROADMAP.md` Phase 13:
- Unified `email_sends` audit table (P1)
- Provider plugin interface formalization (P2)
- Dedicated email analytics dashboard (P2)
