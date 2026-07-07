import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { planCopilotTurn } from './planner.js'

describe('planCopilotTurn', () => {
  it('routes pipeline counts to CRM facts not web', () => {
    const plan = planCopilotTurn('How many leads in my pipeline?', { panel: 'pipeline' })
    assert.equal(plan.runWeb, false)
    assert.equal(plan.runCrmFacts, true)
  })

  it('routes company research to web', () => {
    const plan = planCopilotTurn('Logistics managers at Innovist — LinkedIn URLs', {})
    assert.equal(plan.runWeb, true)
    assert.ok(plan.webQuery)
  })

  it('loads lead context when leadId present', () => {
    const plan = planCopilotTurn('Summarize this lead', { leadId: 'lead-123' })
    assert.equal(plan.runCrmLead, true)
    assert.equal(plan.leadId, 'lead-123')
  })

  it('detects CRM search intent', () => {
    const plan = planCopilotTurn('Find leads named Viraj', { panel: 'pipeline' })
    assert.equal(plan.runCrmSearch, true)
    assert.ok(plan.crmSearchQuery)
  })

  it('routes morning brief to CRM without web', () => {
    const plan = planCopilotTurn('Brief me', { copilotTab: 'crm' })
    assert.equal(plan.intents.morningBrief, true)
    assert.equal(plan.runWeb, false)
    assert.equal(plan.intentCategory, 'morning_brief')
  })

  it('detects lead generation and CRM cross-ref', () => {
    const plan = planCopilotTurn('Find toy exporters in Mumbai exporting to USA', { copilotTab: 'market' })
    assert.equal(plan.intents.leadGeneration, true)
    assert.equal(plan.runLeadDiscovery, true)
    assert.equal(plan.runWeb, false)
  })

  it('forces CRM tab to skip web', () => {
    const plan = planCopilotTurn('Research Acme Corp', { copilotTab: 'crm' })
    assert.equal(plan.runWeb, false)
    assert.equal(plan.runCrmSearch, true)
  })
})
