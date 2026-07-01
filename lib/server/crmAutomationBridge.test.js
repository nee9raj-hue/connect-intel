import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { CRM_TO_AUTOMATION_TRIGGERS, resolveAutomationTriggerTypes } from './workflowCatalog.js'
import { fireCrmWorkflowAutomations } from './crmAutomationBridge.js'

describe('fireCrmWorkflowAutomations', () => {
  it('returns zero when leadId missing', async () => {
    const result = await fireCrmWorkflowAutomations({ trigger: 'lead_created' })
    assert.equal(result.queued, 0)
  })
})

describe('CRM trigger map', () => {
  it('maps status_change to status_enter automations', () => {
    assert.ok(resolveAutomationTriggerTypes('status_change').includes('status_enter'))
    assert.ok(CRM_TO_AUTOMATION_TRIGGERS.status_change.includes('status_enter'))
  })

  it('maps deal_won', () => {
    assert.deepEqual(resolveAutomationTriggerTypes('deal_won'), ['deal_won'])
  })
})
