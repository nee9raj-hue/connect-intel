# Team Dashboard KPI Handoff (Connect Intel)

**Production:** https://connectintel.net  
**Org example:** Xindus (~6,667 pipeline leads)  
**Live commit at handoff:** `143ec4f` (main)  
**Reporter:** Neeraj Kumar (org admin) — `neeraj.kumar@xindus.net`

---

## Problem statement

The **Team intelligence** dashboard (`Home → Dashboard`) must show per-rep KPIs that match the **Activity log** (`Home → Activity log`):

| KPI cell | Source |
|----------|--------|
| Hours in app | `user.workspaceUsage` (pulses) |
| Contacts worked | leads opened in CRM + leads with activity |
| Emails sent | `crm.activities[]` where `type === 'email'` |
| Calls logged | `crm.activities[]` where `type === 'call'` |
| Tasks created | `crm.activities[]` where `type === 'task'` |
| Meetings set | `crm.activities[]` where `type === 'meeting'` |

**Filters required:**
- Period: **Today** / **This week** / **This month**
- Team member: **All team members** or a single rep (`?userId=`)

**Observed bug (still reported broken after multiple deploys):**

1. Activity log shows today's actions (emails, calls, tasks) for Neeraj.
2. Dashboard KPI cells show **0** for emails, calls, tasks (only hours/contacts partially work).
3. Earlier: same numbers (e.g. 2.3h, 2 contacts) appeared for every rep when filtering — rep filter may be improved but CRM action counts remain wrong.

**Success criteria:** For Neeraj + "This week", dashboard `Emails sent` / `Calls logged` / `Tasks created` must equal counts from Activity log for the same period and user.

---

## Architecture (data flow)

```
Browser TeamIntelligenceSection.jsx
  → GET /api/crm/team-dashboard?period=week&userId=<optional>
    → lib/server/handlers/crm-team-dashboard.js
      → loadPipelineStoreContext(user)          // pipelineShard.js
      → buildTeamDashboard(store, user, ...)    // crmDashboard.js
        → buildActivityRollupsForPeriods(...)   // crmTouchpoints.js
        → buildTeamIntelligence(...)            // teamIntelligence.js
          → returns teamIntelligence.rollup → KPI cards

Activity log (WORKS):
  → GET /api/crm/activity-log?period=week&userId=<optional>
    → loadPipelineStoreContext(user)
    → sanitizeCrmForTenant + buildActivityFeed   // crmWorkflow.js
```

**Dashboard KPIs must use the same pipeline entries + activity feed as the activity log.**

---

## Root causes identified (not fully verified in prod)

### 1. Shard vs monolith CRM split (primary suspect)

Pipeline data lives in two places:
- **Org shard:** `pipeline_org_<organizationId>` (fast reads, 6k+ rows)
- **Monolith:** `savedLeads` in main store (where some CRM writes land first)

`loadPipelineStoreContext` in `lib/server/pipelineShard.js`:
- `dashboard: false` (activity log): merges shard + monolith via `overlayMonolithCrmForRead`
- Historically `dashboard: true` used **shard only** → missed fresh `crm.activities`

**Old bad merge logic** (fixed in `143ec4f` to use `mergePipelineEntry`):
- If shard had **more** activity rows (cap 80) than monolith, it kept shard and **dropped today's emails** on monolith.

**Reproduction test** (run in repo root):

```javascript
// Shard: 80 old notes. Monolith: 1 email + 1 call + 1 task today.
// Before merge fix → KPI count 0. After mergePipelineEntry → count 3.
```

### 2. KPI rollup path diverged from activity log

Activity log: `sanitizeCrmForTenant` → `buildActivityFeed`  
Dashboard (multiple iterations): custom rollups, 800-lead scan limits, `rollupRawActivities`, etc.

**Current intended fix (`143ec4f`):** `rollupFromSanitizedActivityFeed()` in `crmTouchpoints.js` calls the same `buildActivityFeed` as the log.

### 3. Team member filter (partially fixed)

- Frontend filter is local state `intelMemberId`; banner can show a name while server returns unfiltered rollup if `userId` is dropped.
- Server must honor `?userId=` and attribute actions by `activity.createdByUserId`, not lead assignee.
- Hours come from `aggregateWorkspaceUsage(storeUser)` per user id — should differ per rep.

### 4. Caching

`dashboardVisibleCache` in `pipelineShard.js` (60s TTL) can serve stale shard-only entries if `dashboard: true` without merge.

---

## Key files

| File | Role |
|------|------|
| `frontend/src/components/crm/TeamIntelligenceSection.jsx` | Dashboard UI, period/member filters, KPI grid |
| `lib/server/handlers/crm-team-dashboard.js` | API entry |
| `lib/server/handlers/crm-activity-log.js` | **Reference implementation that works** |
| `lib/server/crmDashboard.js` | Builds `teamIntelligence`, `activityByDay`, summary |
| `lib/server/teamIntelligence.js` | Per-rep profiles, `rollup` object for KPIs |
| `lib/server/crmTouchpoints.js` | Activity rollups, `rollupFromSanitizedActivityFeed` |
| `lib/server/crmWorkflow.js` | `buildActivityFeed`, `appendActivity`, `addTask` |
| `lib/server/pipelineShard.js` | Shard read, `overlayMonolithCrmForRead`, `mergePipelineEntry`, `mergeCrmRecords` |
| `lib/server/dashboardPeriod.js` | `periodStart('day'|'week'|'month')` |
| `lib/server/teamWorkspaceUsage.js` | Hours in app from `workspaceUsage.dailyMinutes` |
| `lib/server/crmEmailThread.js` | Logs emails via `appendActivity({ type: 'email', userId })` |
| `lib/server/handlers/saved-leads.js` | Logs calls/tasks via PATCH activity payload |

---

## API contracts

### Team dashboard

```
GET /api/crm/team-dashboard?period=week|month|day&userId=<optional-user-id>
```

Response path for KPIs:

```json
{
  "teamIntelligence": {
    "rollup": {
      "hoursInApp": 2.5,
      "contactsOpened": 2,
      "emails": 0,
      "calls": 0,
      "tasksCreated": 0,
      "meetings": 0,
      "activitiesTotal": 0
    },
    "memberUserId": "<id or null>",
    "members": [ /* per-rep rows */ ]
  }
}
```

### Activity log (ground truth)

```
GET /api/crm/activity-log?period=week&userId=<neeraj-id>
```

Returns `activities[]` with `type`, `createdAt`, `createdByUserId`, `summary`.

---

## Recommended fix approach (for next engineer)

### Step 1 — Single source of truth

Make dashboard KPIs **literally** call the same function as activity log:

```javascript
// Pseudocode — both endpoints should share this:
function countActivitiesForDashboard(store, user, entries, since, until, memberUserId) {
  const rows = entries.map(e => ({
    ...e,
    crm: sanitizeCrmForTenant(store, user, e.crm, e),
  }))
  let activities = buildActivityFeed(rows, { limit: 0 }) // no cap
  activities = activities.filter(a => inPeriod(a.createdAt, since, until))
  if (memberUserId) {
    activities = activities.filter(a => String(a.createdByUserId) === String(memberUserId))
  }
  // Count by type → emails, calls, tasksCreated, meetings, perUser map
}
```

### Step 2 — Fix pipeline read

Ensure team dashboard and activity log use **identical** `loadPipelineStoreContext` behavior:

```javascript
// Both should merge shard + monolith:
const { pipelineStore, visible } = await loadPipelineStoreContext(user)
// NOT shard-only for KPI paths
```

Verify `overlayMonolithCrmForRead` uses `mergePipelineEntry` (unions activities by id), not “pick copy with more rows”.

### Step 3 — Verify writes land on shard

When Neeraj sends email / logs call on a lead, confirm **both** monolith and org shard get updated `crm.activities`. If writes are monolith-only, dashboard must always merge.

Search: `updatePipelineStore`, `updatePipelineStoreForEntry`, `writePipelineShardEntries`.

### Step 4 — Debug in production

For org admin Neeraj, compare API responses side by side:

```bash
# Activity log (should list emails/calls/tasks)
curl -H "Authorization: Bearer $TOKEN" \
  "https://connectintel.net/api/crm/activity-log?period=week&userId=NEERAJ_ID"

# Dashboard rollup (should match counts)
curl -H "Authorization: Bearer $TOKEN" \
  "https://connectintel.net/api/crm/team-dashboard?period=week&userId=NEERAJ_ID" \
  | jq '.teamIntelligence.rollup'
```

If log has activities but `rollup.emails === 0`, the bug is in rollup or pipeline merge — not the UI.

### Step 5 — Frontend

KPI cards read `data.teamIntelligence.rollup` only (see `TeamIntelligenceSection.jsx`). No fallback to org-wide summary for CRM metrics.

---

## Activity shape (what gets logged)

Email send (`crmEmailThread.js`):

```javascript
appendActivity(crm, {
  type: 'email',           // or 'email_inbound' for replies
  summary: 'Email sent: …',
  userId: user.id,         // → createdByUserId
})
```

Call (`saved-leads.js` PATCH):

```javascript
appendActivity(crm, {
  type: 'call',
  summary: 'Call (Connected): …',
  userId: user.id,
})
```

Task (`crmWorkflow.js` addTask):

```javascript
appendActivity(crm, {
  type: 'task',
  summary: 'Task assigned: …',
  userId: createdByUserId,
})
```

KPI "Emails sent" should count only `type === 'email'`, not `email_inbound`.

---

## Commits attempted on main (dashboard work)

- `3ecf39a` — full pipeline scan for rollups
- `120803f` — per-rep filter, day view
- `07ad2b0` — filter fix + activity log alignment
- `a1ee2a9` — mergeMonolithCrm for dashboard handler
- `143ec4f` — mergePipelineEntry in overlay + rollupFromSanitizedActivityFeed

User still reports KPI cells at 0 while activity log is correct.

---

## Test org context

- ~6,667 leads — performance matters; full monolith merge on every dashboard load may timeout (API timeout 120s).
- Possible optimization: merge only leads with `lastCommunicationAt` or activity in period, not all 6k rows.
- `mergeCrmRecords` caps merged activities at **80 per lead** — if older noise fills 80 slots, new activities could still be dropped unless merge sorts by date and keeps newest 80.

---

## Out of scope

- Android/Capacitor (`capacitor.config.json` — not deployed)
- Pipeline value / won value (dealValue often unset → shows `—`)
