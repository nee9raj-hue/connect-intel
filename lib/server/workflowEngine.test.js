import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAutomationTriggerTypes } from './workflowCatalog.js'
import { postCrmWorkflowDispatch } from './workflowEngine.js'

describe('workflowCatalog', () => {
  it('maps CRM triggers to marketing automation types', () => {
    assert.deepEqual(resolveAutomationTriggerTypes('lead_created'), ['lead_created', 'contact_added'])
    assert.deepEqual(resolveAutomationTriggerTypes('status_change'), ['status_enter'])
    assert.deepEqual(resolveAutomationTriggerTypes('deal_won'), ['deal_won'])
    assert.deepEqual(resolveAutomationTriggerTypes('unknown'), [])
  })
})

describe('postCrmWorkflowDispatch', () => {
  it('returns a promise without fired rules', async () => {
    const result = await postCrmWorkflowDispatch({
      firedRules: [],
      trigger: 'deal_won',
      leadId: null,
      organizationId: null,
      actor: { id: 'u1' },
    })
    assert.equal(result?.queued, 0)
  })
})
