# Email Throughput — Phase A

**Goal:** Reduce PostgREST operations for a 50-email pipeline campaign from ~507 to **<100** during the hot send path.

CRM email/activity updates are **deferred** to `email_activity_queue` and applied once after the campaign completes (~15–25 PostgREST ops, off the send-critical path).

---

## Changes

| # | Requirement | Implementation |
|---|-------------|----------------|
| 1 | Lead cache | `createCampaignSendSession` — one `readPipelineLeadsByIds` per worker job |
| 2 | Progress API O(1) | `getCampaignSendProgress` — only `mcstat_*` + `menroll_meta_*` |
| 3 | CRM deferral | `email_activity_queue` table + `appendEmailActivityEvents` during send; `processEmailActivityQueueForCampaign` on completion |
| 4 | Batch enrollment | In-memory enrollments; one write per dirty chunk per burst |
| 5 | Batch stats | In-memory `session.stats`; one `writeCampaignStatsShard` per burst |
| 6 | No N+1 in loops | No DB inside per-recipient loop; flush once per `processDueEnrollments` round |

**Migration:** `supabase/migrations/20260611120000_email_activity_queue.sql`

---

## Before / after — 50 emails (1 worker job, ~7 bursts)

| Metric | Before Phase A | After Phase A (send path) | After + CRM sync (async) |
|--------|---------------:|--------------------------:|-------------------------:|
| **PostgREST reads** | ~387 | **~52** | +~12 |
| **PostgREST writes** | ~120 | **~28** | +~8 |
| **Total PostgREST calls** | **~507** | **~80** | **~100** |
| **Full `pipeline_org_*` reads** | 0 (table on) | 0 | 0 |
| **Full `pipeline_org_*` writes** | 0 | 0 | 0 |
| **Progress poll (×25 @ 3s)** | ~225 reads | **~50 reads** (2/poll) | — |
| **CRM `pipeline_leads` PATCH during send** | ~100 | **0** | batch upsert ~4 |
| **Gmail API** | 50 | 50 | 50 |
| **Est. worker runtime** | 60–120s | **45–75s** | +5–15s CRM sync |

### Send-path call budget (50 emails, single job)

| Phase | Reads | Writes |
|-------|------:|-------:|
| Session start (meta + stats + mcamp + enrollments + leads) | 6 | 0 |
| Per burst ×7 (meta due check in-memory; flush chunk+meta+stats+activity batch) | 0 | 4×7 = 28 |
| Worker end `getCampaignSendProgress` | 2 | 0 |
| Progress UI ×25 polls | 50 | 0 |
| Queue setup (HTTP) | ~12 | ~10 |
| **Total hot path** | **~70** | **~38** |

CRM sync after completion: 1 read queue + 1 read leads IN + 1–2 batch upserts + 1 mark processed ≈ **+12–20** (not concurrent with send bursts).

---

## Scaling estimates

Assumes pipeline bulk, worker-only, `pipeline_leads` on, Phase A session.

| Recipients | Send-path PostgREST | Progress polls (60s @ 3s) | CRM sync (deferred) | Est. send runtime |
|------------|--------------------:|--------------------------:|--------------------:|------------------:|
| **50** | ~80 | ~50 | ~15 | 45–75s |
| **200** | ~110 | ~50 | ~45 | 3–5 min |
| **500** | ~145 | ~50 | ~90 | 8–14 min |
| **1000** | ~175 | ~50 | ~160 | 16–28 min |
| **5000** | ~280 | ~50 | ~700 | 80–140 min |

**Throughput (emails/min, send path only):**

| Recipients | Est. emails/min |
|------------|----------------:|
| 50 | ~40–65 |
| 200 | ~40–65 |
| 500 | ~35–60 |
| 1000 | ~35–60 |
| 5000 | ~35–55 |

Gmail rate limits dominate above ~200 recipients; DB is no longer the primary bottleneck after Phase A.

---

## Dashboard / team intelligence

Unchanged — still **not triggered** by email send path.

---

## Deploy notes

1. Run migration `20260611120000_email_activity_queue.sql` on Supabase.
2. Ship API + Railway worker together (session + deferral are server-side).
3. Smoke: send 50 pipeline emails; confirm progress UI updates; confirm CRM email trail appears within ~30s of completion.
