# Connect Intel — Workflow Engine

**Last updated:** 2026-06-24

---

## 1. Overview

Connect Intel has **two workflow systems** today. The engineering constitution requires a **single unified, versioned, auditable** workflow engine.

| System | Scope | Engine |
|--------|-------|--------|
| **Marketing automations** | Campaigns, enrollments, delays | `automationGraphRunner.js` |
| **CRM workflow rules** | Pipeline status, inactivity | `crmWorkflowRules.js` + `crmWorkflow.js` |

**Blueprint target:** One engine driving CRM + marketing + notifications.

---

## 2. Marketing automation graph

### 2.1 Storage

| Collection | Purpose |
|------------|---------|
| `marketingAutomations` | Graph definitions (nodes + edges) |
| `marketingAutomationRuns` | In-flight run state |

### 2.2 Node types (representative)

- `trigger` — entry (form submit, tag, manual)
- `delay` — wait duration
- `condition` — branch on lead/campaign fields
- `enroll_campaign` — add to campaign
- `update_lead` — CRM field update
- `webhook` — HTTP outbound (partial)

### 2.3 Execution

**Runner:** `lib/server/automationGraphRunner.js`  
**Triggers:** `lib/server/automationTriggers.js` → `fireAutomationTrigger({ type, leadId, organizationId })`  
**Scheduler:** `processDueAutomationRuns` in `marketing-cron.js`  
**UI:** `AutomationCanvas` in marketing hub

### 2.4 Trigger sources

- Form submission
- Campaign events
- Manual enrollment
- Cron catch-up for due steps

---

## 3. CRM workflow rules

### 3.1 Storage

`crmWorkflowRules` collection — rule definitions per org.

### 3.2 Triggers (`crmWorkflowRules.js`)

| Trigger | Description |
|---------|-------------|
| `status_enter` | Lead enters pipeline stage |
| `lead_created` | New lead in pipeline |
| `no_activity_days` | Inactivity threshold |

### 3.3 Actions

- Create task
- Send email (template)
- Update field
- Notify user
- Enroll sequence

**Execution:** Invoked from `crmWorkflow.js` on pipeline save / maintenance.

### 3.4 Visual editor

`crmWorkflowGraph.js` — graph representation for CRM automation panel (`CrmAutomationPanel`).

---

## 4. CRM sequences

**Separate but related:** `lib/server/crmSequences.js`

- Drip sequences on leads
- Enrollments: `crmSequenceEnrollments`
- API: `crm/sequences` (enroll, process)
- Cron: processed in `marketing-cron.js`

---

## 5. Comparison matrix

| Capability | Marketing graph | CRM rules | Sequences |
|------------|-----------------|-----------|-----------|
| Visual editor | ✅ | Partial | ❌ |
| Versioning | ✅ publish snapshots | ✅ publish snapshots | ✅ on active publish |
| Audit trail | Partial runs | ❌ | Partial |
| Delay steps | ✅ | ❌ | ✅ |
| Branching | ✅ | Limited | ❌ |
| Webhooks | Partial | ❌ | ❌ |

---

## 6. Constitution gaps

| Requirement | Status |
|-------------|--------|
| Unified engine | ❌ Two systems |
| Versioned workflows | ❌ |
| Full audit | ❌ |
| Record create/update triggers | Partial |
| Time-based triggers | Partial (cron-dependent) |
| External webhooks | Partial |

---

## 7. Target unified architecture

```
┌─────────────────────────────────────────┐
│           WorkflowDefinition            │
│  (versioned, org_id, status: draft/live)│
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           TriggerBus (events)           │
│  lead.created · lead.updated · cron     │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           WorkflowRunner                │
│  (idempotent steps, run log)            │
└─────────────────┬───────────────────────┘
                  │
     ┌────────────┼────────────┐
     ▼            ▼            ▼
  email        task        webhook
```

**Implementation approach (approved path):**
1. Extend `automationGraphRunner` with CRM trigger types
2. Migrate `crmWorkflowRules` → automation graphs
3. Add `workflow_versions` + `workflow_runs` tables
4. Deprecate duplicate cron paths

---

## 8. Related files

| File | Role |
|------|------|
| `automationGraphRunner.js` | Marketing step executor |
| `automationTriggers.js` | Event fan-out |
| `crmWorkflowRules.js` | CRM trigger definitions |
| `crmWorkflow.js` | CRM mutation side-effects |
| `crmWorkflowGraph.js` | CRM graph model |
| `crmSequences.js` | Drip sequences |
| `handlers/marketing-automations.js` | HTTP API |
| `handlers/marketing-cron.js` | Scheduled processing |

---

## 9. Roadmap

See `PROJECT_ROADMAP.md` Phases 15–16 and `CRM_GAP_ANALYSIS.md` (Workflow section).

**Do not start unification implementation until roadmap Phase 15–16 is approved.**
