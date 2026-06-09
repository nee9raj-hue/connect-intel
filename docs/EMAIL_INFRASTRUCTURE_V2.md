# Connect Intel — Email Infrastructure V2

**Recommended stack:** Supabase + Upstash Redis + Railway Worker  
**Status:** Code shipped; enable with `REDIS_URL` + Railway deploy

---

## 1. Current architecture (MVP — browser-dependent)

```mermaid
flowchart TB
  U[User clicks Send] --> B[Browser]
  B --> Q[POST queue — enroll]
  Q --> DB[(Supabase enrollments)]
  B --> D[Browser drain loop]
  D --> API[Vercel API processCampaignSendBurst]
  API --> Gmail[Gmail / Resend]
  API --> DB
  C[Daily cron 09:00 UTC] -.->|catch-up 50 only| API
```

**Limitation:** If the user closes the tab, sending stops unless daily cron catches a few stuck emails.

---

## 2. Future architecture (V2 — implemented)

```mermaid
flowchart TB
  U[User clicks Send] --> API[Vercel API]
  API --> Q[Enroll + status Queued]
  Q --> R[(Upstash Redis / BullMQ)]
  API -->|immediate 200 OK| U
  R --> W[Railway Worker]
  W --> Burst[processCampaignSendBurst]
  Burst --> Gmail[Gmail / Resend]
  Burst --> DB[(Supabase stats + enrollments)]
  W -->|pending > 0| R
  UI[Browser polls /api/campaign-send/status] --> DB
```

**Browser is never required for delivery** once `REDIS_URL` is set and `npm run workers` runs on Railway.

---

## 3. Infrastructure options compared

| | **A: Supabase + Upstash + Railway** | **B: Supabase + Upstash + Fly.io** | **C: AWS SQS + ECS/Lambda** |
|---|-------------------------------------|-------------------------------------|-----------------------------|
| **Cost (starter)** | ~$25–45/mo | ~$20–40/mo | ~$80–200+/mo |
| **Complexity** | Low | Medium | High |
| **Ops burden** | Low | Medium | High |
| **Scale to 100k emails/mo** | Yes | Yes | Yes |
| **Scale to 1M emails/mo** | Yes (scale workers) | Yes | Yes |
| **Vercel fit** | Excellent | Excellent | Good |
| **Recommendation** | **✅ Best for Connect Intel now** | Good alternative | Overkill until 50+ eng team |

### Cost estimate (Option A)

| Service | Plan | ~Monthly |
|---------|------|----------|
| Supabase | Small (post-Micro) | $25 |
| Upstash Redis | Pay-as-you-go | $0–10 |
| Railway Worker | 512MB always-on | $5–15 |
| Vercel | Hobby/Pro (existing) | $0–20 |
| **Total** | | **~$30–50** |

---

## 4. Migration plan

| Phase | Action | Downtime |
|-------|--------|----------|
| **1** | Create Upstash Redis → set `REDIS_URL` on Vercel + Railway | None |
| **2** | Deploy Railway worker (`railway.toml` → `npm run workers`) | None |
| **3** | Verify `/api/health` → `backgroundEmail: true` | None |
| **4** | Test 10-email pipeline bulk — close tab, confirm progress API | None |
| **5** | Test 200-email send off-peak | None |
| **6** | Disable browser drain fallback optional (already auto when background on) | None |

**Rollback:** Unset `REDIS_URL` → reverts to browser drain MVP (no code deploy needed).

---

## 5. Implementation roadmap

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **P0** | Async enroll + client drain (no CRM blocking) | ✅ Live |
| **P1** | BullMQ + orchestrator + progress API | ✅ Code |
| **P1** | Railway worker + DLQ on failure | ✅ Code |
| **P1** | Frontend progress polling | ✅ Code |
| **P2** | Ops: Upstash + Railway production | 🔲 User action |
| **P3** | Batch enrollment writes (DB protection) | Planned |
| **P4** | Provider webhooks (bounce/unsub) in worker | Planned |
| **P5** | SSE/WebSocket live progress | Planned |

---

## 6. Campaign lifecycle (V2)

| Status | Meaning |
|--------|---------|
| `draft` | Not started |
| `queued` | Enrolled, waiting for worker |
| `preparing` | Job picked up |
| `sending` | Active bursts |
| `paused` | User paused |
| `completed` | All recipients processed |
| `failed` | Worker exhausted retries → DLQ |
| `cancelled` | User stopped |

**Progress API:** `GET /api/campaign-send/status?campaignId=`

Returns: total, queued, sending, sent, opened, clicked, failed, remaining, ETA.

---

## 7. Queue design

| Queue | Purpose |
|-------|---------|
| `ci-email` | Campaign send bursts (re-enqueue until done) |
| `ci-email-dlq` | Failed jobs after 3 retries |

**Job ID:** `campaign-send:{campaignId}` — one active processor per campaign (no duplicate sends).

**Recovery:** Enrollments are source of truth — worker only processes `status=active` + `nextSendAt<=now`. Completed enrollments are never resent.

---

## 8. Rate limiting

`lib/server/email/providerRateLimits.js` — conservative delays between bursts per provider (Gmail, Resend, SES, etc.).

---

## 9. Enable background sends

### Vercel

```
REDIS_URL=rediss://default:...@....upstash.io:6379
CRON_SECRET=...
```

### Railway

New service from repo root:

```
REDIS_URL=same as Vercel
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
EMAIL_WORKER_CONCURRENCY=2
```

Start: `npm run workers` (see `railway.toml`)

### Verify

```bash
curl https://connectintel.net/api/health
# infra.backgroundEmail: true

curl -H "Authorization: Bearer $TOKEN" \
  "https://connectintel.net/api/campaign-send/status?campaignId=mcamp_..."
```

---

## 10. Key files

| Area | Path |
|------|------|
| Orchestrator | `lib/server/email/campaignSendOrchestrator.js` |
| Progress | `lib/server/email/campaignProgress.js` |
| Lifecycle | `lib/server/email/campaignLifecycle.js` |
| Worker | `workers/index.mjs` |
| Progress API | `lib/server/handlers/campaign-send-status.js` |
| Frontend poll | `frontend/src/hooks/useCampaignSendProgress.js` |
| Cron audit | `docs/CRON_AUDIT.md` |
