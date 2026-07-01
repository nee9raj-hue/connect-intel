# Connect Intel — Dashboard

**Last updated:** 2026-06-24

---

## 1. Overview

The Connect Intel dashboard is the **Home** panel (`overview`) — an enterprise CRM command center for managers, reps, and solo users.

**Constitution targets:** real-time updates (WebSocket/SSE), drag-drop widgets, WCAG 2.1 AA, CSV/PDF export, custom views.

---

## 2. User experience

### 2.1 Who sees what

| Role | Home experience |
|------|-----------------|
| Org admin | Full KPIs, pipeline funnel, analytics, team review, insights |
| Manager | Team review, scoped pipeline, team metrics |
| Rep | Priorities, lead focus, personal KPIs, activity timeline |
| Solo individual | Same as rep (no org team widgets) |
| Marketing manager | Marketing campaigns widget |

**Routing:** `OverviewPanel.jsx` → `HomeDashboard.jsx` for all users.  
**Freight orgs:** Additional `FreightDealsDashboard` below home.

### 2.2 Enterprise shell components

| Component | Path |
|-----------|------|
| Top bar | `enterprise/DashboardTopBar.jsx` |
| KPI strip | `enterprise/ExecutiveKpiStrip.jsx` |
| Pipeline funnel | `enterprise/SalesPipelineSnapshot.jsx` |
| Customize modal | `enterprise/DashboardCustomizePanel.jsx` |
| Loading skeleton | `enterprise/DashboardSkeleton.jsx` |
| Styles | `styles/dashboard-enterprise.css` |

### 2.3 Widget customization

**Widgets:** `getting_started`, `kpis`, `pipeline`, `analytics`, `team_review`, `priorities`, `marketing`, `activity`, `sidebar`

- **Storage:** `localStorage` key `ci-dashboard-layout:{userId}`
- **Logic:** `lib/dashboardLayoutPreferences.js`, `hooks/useDashboardLayout.js`
- **Gap:** Not persisted server-side (constitution: server layouts)

### 2.4 Live updates

| Mechanism | Implementation |
|-----------|----------------|
| Poll interval | 25s (`useDashboardLive.js`) |
| Version endpoint | `GET /api/dashboard/pulse` |
| Manual refresh | Top bar ↺ button |
| Background interval | 90s silent reload in `HomeDashboard` |

**Gap:** Constitution requires WebSocket/SSE — current implementation is **poll-based pulse**.

---

## 3. Data plane

### 3.1 Bootstrap API

`GET /api/dashboard/bootstrap`

**Handler:** `lib/server/handlers/dashboard-bootstrap.js`  
**Builder:** `lib/server/dashboardBootstrap.js`

Returns role-aware payload:
- `statStrip` — actionable KPIs
- `pipelineSummary` — stages, deal value, stuck count
- `priorities` — rep tasks/follow-ups
- `activity` — recent CRM events
- `repPerformance` — manager snapshot rows
- `quickActions`, `insights`, `thisWeek`, `leadFocus`

**Cache:** Redis key `dashboard:bootstrap:{userId}:{orgId}:{scope}` (120s TTL)

### 3.2 Materialized snapshots

**Module:** `lib/server/dashboardSnapshots.js`

| Collection | Contents |
|------------|----------|
| `dashboard_snapshot_{orgId}` | Org dashboard doc |
| `team_snapshot_{orgId}_{period}` | Team rollup |
| `rep_snapshot_{orgId}_{userId}_{period}` | Rep metrics |
| `activity_snapshot_*` | Activity rollups |
| `myday_snapshot_{userId}` | My Day |

**Refresh triggers:**
- Async queue after pipeline save
- Cron `crm/dashboard-warm-cron` (daily 04:00 UTC)
- Script `npm run dash:warm`

**Principle:** Dashboard hot path does **not** scan full pipeline when snapshots hit.

### 3.3 Team metrics

`GET /api/crm/team-metrics?period=7d&userId=...`

Used for analytics charts on home. Reps pass `userId=self` for scoped charts.

### 3.4 Pulse API

`GET /api/dashboard/pulse` → `{ version, lastUpdated }`

Version hash from snapshot `updatedAt` + pipeline index timestamp.

---

## 4. Team intelligence (separate panel)

**Panel:** `crm-dashboard` → `TeamDashboardPanel.jsx`  
**Legacy hub:** `TeamActivityHubPanel.jsx` (no longer default Home; still in codebase)

Managers access deeper team analytics via **Analytics → Team intelligence** nav.

---

## 5. Accessibility (WCAG)

**Shipped:**
- Skip link to main content
- `focus-visible` outlines
- `aria-label` on KPI and pipeline stage buttons
- Dialog semantics on customize panel
- `main` / `aside` landmarks

**Gap:** Full WCAG 2.1 AA audit across all dashboard panels (constitution).

---

## 6. Performance

| Technique | Status |
|-----------|--------|
| Snapshot read | ✅ |
| Bootstrap Redis cache | ✅ |
| Parallel fetch (bootstrap + metrics) | ✅ |
| Panel client cache | ✅ `panelCache.js` |
| Zero-lead SQL fast path | ✅ `dashboardBootstrap.js` |
| Warm cron | ✅ |

See `DASHBOARD_PERFORMANCE.md` for historical refactor notes.

---

## 7. Roadmap (dashboard phase)

| Item | Priority |
|------|----------|
| SSE/WebSocket live widgets | P2 |
| Server-persisted layouts | P2 |
| CSV/PDF export | P2 |
| Cross-module saved views | P2 |
| Full WCAG audit | P1 |

See `PROJECT_ROADMAP.md` Phase 17.
