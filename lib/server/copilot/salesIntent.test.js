import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { inferSalesIntent, isDiscoveryRefinement, discoveryCountForDepth } from './salesIntent.js'
import { planCopilotTurn } from './planner.js'

describe('inferSalesIntent', () => {
  it('detects vague lead gen: toy exporters Delhi NCR', () => {
    const intent = inferSalesIntent('I need toys exporter from Delhi NCR')
    assert.equal(intent.isLeadGeneration, true)
    assert.equal(intent.category, 'lead_generation')
    assert.ok(intent.filters.keywords || intent.naturalQuery)
  })

  it('detects CRM follow-up intent', () => {
    const intent = inferSalesIntent('Who needs follow-up today?')
    assert.equal(intent.isCrmFollowUp, true)
    assert.equal(intent.category, 'crm_follow_up')
  })

  it('sets research depth', () => {
    assert.equal(discoveryCountForDepth('quick'), 6)
    assert.equal(discoveryCountForDepth('deep'), 15)
    assert.equal(discoveryCountForDepth('standard'), 10)
  })
})

describe('planCopilotTurn lead discovery', () => {
  it('routes toy exporters to lead discovery not web paragraph', () => {
    const plan = planCopilotTurn('I need toys exporter from Delhi NCR', { copilotTab: 'copilot' })
    assert.equal(plan.runLeadDiscovery, true)
    assert.equal(plan.runWeb, false)
  })

  it('routes who needs follow-up to CRM pipeline query', () => {
    const plan = planCopilotTurn('Who needs follow-up today?', { copilotTab: 'crm' })
    assert.equal(plan.intents.crmFollowUp, true)
    assert.equal(plan.runWeb, false)
    assert.equal(plan.runLeadDiscovery, false)
  })
})

describe('isDiscoveryRefinement', () => {
  it('detects filter-only follow-up', () => {
    const thread = {
      lastDiscovery: {
        companies: [{ company: 'ABC Toys', exportMarkets: 'USA UK' }],
      },
    }
    assert.equal(isDiscoveryRefinement('only exporting to USA', thread), true)
  })
})
