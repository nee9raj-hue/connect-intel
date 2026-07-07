import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractEntities, isPersonDiscoveryRequest } from './entityExtractor.js'
import { planCopilotTurn } from './planner.js'

describe('entityExtractor', () => {
  it('extracts founder + company + linkedin intent', () => {
    const msg =
      'I need LinkedIn profile for founder of Jack in the Box Toys from Mumbai'
    const entities = extractEntities(msg)
    assert.ok(entities.company.toLowerCase().includes('jack'))
    assert.match(entities.personRole.toLowerCase(), /founder/)
    assert.ok(isPersonDiscoveryRequest(msg, entities))
  })

  it('does not treat founder query as lead generation', () => {
    const msg = 'LinkedIn profile for founder of ABC Toys Mumbai'
    const plan = planCopilotTurn(msg, { copilotTab: 'copilot' })
    assert.equal(plan.runPeopleDiscovery, true)
    assert.equal(plan.runLeadDiscovery, false)
  })
})
