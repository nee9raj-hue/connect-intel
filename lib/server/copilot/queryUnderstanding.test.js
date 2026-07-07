import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  understandCopilotQuery,
  applyQueryUnderstanding,
  isPollutedDiscoveryResult,
} from './queryUnderstanding.js'
import { inferSalesIntent } from './salesIntent.js'
import { planCopilotTurn } from './planner.js'

describe('queryUnderstanding (AI-QUE)', () => {
  it('resolves Shark Tank India contestants — not shark+tank keywords', () => {
    const msg =
      'I need all contestant information from Shark Tank India and who all do export'
    const u = understandCopilotQuery(msg)

    assert.equal(u.mode, 'entity_research')
    assert.equal(u.entityType, 'TV_SHOW')
    assert.equal(u.entity, 'Shark Tank India')
    assert.equal(u.target, 'Contestants')
    assert.equal(u.filters.exporter, true)
    assert.match(u.semanticQuery.toLowerCase(), /shark tank india/)
    assert.match(u.semanticQuery.toLowerCase(), /contestants/)
    assert.doesNotMatch(u.semanticQuery.toLowerCase(), /^shark\s+export/)
  })

  it('routes Shark Tank query to entity research agent, not keyword lead discovery', () => {
    const msg = 'I need all contestant information from Shark Tank India and who all do export'
    const u = understandCopilotQuery(msg)
    let intent = inferSalesIntent(msg)
    intent = applyQueryUnderstanding(intent, u)
    const plan = planCopilotTurn(msg, { copilotTab: 'copilot' }, { salesIntent: intent, understanding: u })

    assert.equal(plan.runEntityResearch, true)
    assert.equal(plan.runLeadDiscovery, false)
    assert.match(intent.filters.keywords.toLowerCase(), /shark tank india/)
  })

  it('resolves boAt founder — brand not shipping company', () => {
    const u = understandCopilotQuery('Need Boat founder')
    assert.equal(u.mode, 'person_at_brand')
    assert.equal(u.entity, 'boAt')
    assert.match(u.semanticQuery.toLowerCase(), /boat/)
  })

  it('resolves Mamaearth CEO', () => {
    const u = understandCopilotQuery('Need Mamaearth CEO')
    assert.equal(u.mode, 'person_at_brand')
    assert.equal(u.entity, 'Mamaearth')
    assert.equal(u.target, 'CEO')
  })

  it('filters polluted Shark Exports keyword matches', () => {
    const u = understandCopilotQuery('Shark Tank India contestants')
    assert.equal(isPollutedDiscoveryResult({ company: 'Shark Exports Pvt Ltd' }, u), true)
    assert.equal(isPollutedDiscoveryResult({ company: 'Lenskart' }, u), false)
  })

  it('handles Amazon FBA toy sellers semantically', () => {
    const u = understandCopilotQuery('Amazon FBA toy exporters')
    assert.equal(u.mode, 'entity_research')
    assert.equal(u.entityType, 'MARKETPLACE')
    assert.match(u.semanticQuery.toLowerCase(), /amazon fba/)
    assert.match(u.semanticQuery.toLowerCase(), /toy/)
  })
})
