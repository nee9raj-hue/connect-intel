import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { leadInactiveDays, leadMatchesInactivityThreshold } from './leadInactivity.js'
import { buildWorkflowIdempotencyKey, isWorkflowRunsEnabled } from './workflowRuns.js'
import { crmRuleToWorkflowDefinition } from './workflowRuleBridge.js'
import { WORKFLOW_ENGINE_VERSION } from './workflowCatalog.js'

describe('leadInactivity', () => {
  it('computes days from pipeline freshness', () => {
    const daysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString()
    const entry = {
      savedAt: daysAgo,
      crm: { activities: [{ createdAt: daysAgo }] },
    }
    assert.ok(leadInactiveDays(entry) >= 9)
    assert.equal(leadMatchesInactivityThreshold(entry, 7), true)
    assert.equal(leadMatchesInactivityThreshold(entry, 30), false)
  })
})

describe('workflowRuns helpers', () => {
  it('builds stable idempotency keys', () => {
    const key = buildWorkflowIdempotencyKey({
      triggerType: 'no_activity_days',
      workflowKey: 'auto-1',
      leadId: 'lead-1',
    })
    assert.match(key, /^no_activity_days:auto-1:lead-1:/)
  })

  it('isWorkflowRunsEnabled returns boolean', () => {
    assert.equal(typeof isWorkflowRunsEnabled(), 'boolean')
  })
})

describe('workflowRuleBridge', () => {
  it('maps CRM rules for versioning', () => {
    const def = crmRuleToWorkflowDefinition({
      id: 'wfr-1',
      name: 'Stale follow-up',
      trigger: 'no_activity_days',
      days: 14,
      actions: [{ type: 'add_task' }],
    })
    assert.equal(def.trigger, 'no_activity_days')
    assert.equal(def.days, 14)
    assert.equal(WORKFLOW_ENGINE_VERSION, '2026-06-deploy4')
  })
})
