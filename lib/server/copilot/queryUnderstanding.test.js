import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  understandCopilotQuery,
  applyQueryUnderstanding,
  isPollutedDiscoveryResult,
} from './queryUnderstanding.js'
import { inferSalesIntent } from './salesIntent.js'
import { planCopilotTurn } from './planner.js'
import { validateCopilotResponse } from './responseValidator.js'

describe('queryUnderstanding (AI-QUE)', () => {
  it('resolves Shark Tank India contestants — knowledge lookup, not keyword search', () => {
    const msg = 'I need name of all Shark Tank contestant from all seasons'
    const u = understandCopilotQuery(msg)

    assert.equal(u.mode, 'knowledge_lookup')
    assert.equal(u.intent, 'knowledge_lookup')
    assert.equal(u.entityType, 'TV_SHOW')
    assert.equal(u.entity, 'Shark Tank India')
    assert.equal(u.target, 'Contestants')
    assert.equal(u.season, 'all')
    assert.match(u.semanticQuery.toLowerCase(), /shark tank india/)
    assert.match(u.semanticQuery.toLowerCase(), /all seasons/)
    assert.doesNotMatch(u.semanticQuery.toLowerCase(), /^shark\s+export/)
  })

  it('routes Shark Tank to knowledge agent — never lead discovery', () => {
    const msg = 'all shark tank contestant all seasons'
    const u = understandCopilotQuery(msg)
    let intent = inferSalesIntent(msg)
    intent = applyQueryUnderstanding(intent, u)
    const plan = planCopilotTurn(msg, { copilotTab: 'copilot' }, { salesIntent: intent, understanding: u })

    assert.equal(plan.runKnowledgeLookup, true)
    assert.equal(plan.runEntityResearch, false)
    assert.equal(plan.runLeadDiscovery, false)
    assert.equal(intent.isLeadGeneration, false)
    assert.match(intent.filters.keywords.toLowerCase(), /shark tank india/)
  })

  it('treats prefer exporting as soft preference, not hard filter', () => {
    const msg =
      'i need list of all contestants from shark tank india all seasons, i also prefer contestant who are exporting and i also need their founders linkedin profile.'
    const u = understandCopilotQuery(msg)

    assert.equal(u.mode, 'knowledge_lookup')
    assert.equal(u.filters.preferExport, true)
    assert.equal(u.filters.exporter, false)
    assert.equal(u.filters.linkedin, true)
    assert.equal(u.season, 'all')
    assert.match(u.semanticQuery.toLowerCase(), /linkedin/)
  })

  it('keeps contestant + export as knowledge lookup with export filter', () => {
    const msg =
      'I need all contestant information from Shark Tank India and who all do export'
    const u = understandCopilotQuery(msg)

    assert.equal(u.mode, 'knowledge_lookup')
    assert.equal(u.filters.exporter, true)
    assert.match(u.semanticQuery.toLowerCase(), /export/)
  })

  it('inherits Shark Tank context on LinkedIn follow-up', () => {
    const state = {
      knowledgeContext: {
        entity: 'Shark Tank India',
        entityType: 'TV_SHOW',
        season: 'all',
        intent: 'knowledge_lookup',
      },
    }
    const u = understandCopilotQuery('all contestant information with linkedin profile', state)

    assert.equal(u.mode, 'knowledge_lookup')
    assert.equal(u.entity, 'Shark Tank India')
    assert.equal(u.followUp, true)
    assert.equal(u.filters.linkedin, true)
    assert.match(u.semanticQuery.toLowerCase(), /linkedin/)
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

  it('routes FBA Jaipur list to marketplace lead gen — not Shark Tank memory', () => {
    const msg =
      'I need FBA exporter list from Jaipur, who are selling on amazon.com with contact information or linkedin id'
    const state = {
      knowledgeContext: {
        entity: 'Shark Tank India',
        entityType: 'TV_SHOW',
        season: 'all',
        intent: 'knowledge_lookup',
      },
      researchSession: {
        entity: 'Shark Tank India',
        entityType: 'TV_SHOW',
        originalCompanies: [{ company: 'BluePine Industries', linkedinUrl: 'linkedin.com/in/aditimadan' }],
      },
    }
    const u = understandCopilotQuery(msg, state)

    assert.equal(u.mode, 'entity_research')
    assert.equal(u.intent, 'lead_generation')
    assert.equal(u.entityType, 'MARKETPLACE')
    assert.match(u.semanticQuery.toLowerCase(), /jaipur/)
    assert.match(u.semanticQuery.toLowerCase(), /amazon/)
    assert.notEqual(u.entity, 'Shark Tank India')

    let intent = inferSalesIntent(msg)
    intent = applyQueryUnderstanding(intent, u)
    const plan = planCopilotTurn(msg, { copilotTab: 'copilot' }, { salesIntent: intent, understanding: u })

    assert.equal(plan.runEntityResearch, true)
    assert.equal(plan.runKnowledgeLookup, false)
    assert.equal(plan.runLeadDiscovery, false)
  })

  it('salesIntent does not treat Shark Tank as generic lead generation', () => {
    const msg = 'I need name of all Shark Tank contestant from all seasons'
    const intent = inferSalesIntent(msg)
    assert.equal(intent.isLeadGeneration, false)
  })
})

describe('responseValidator', () => {
  it('flags lead discovery pipeline for knowledge queries', () => {
    const u = understandCopilotQuery('Shark Tank India all seasons contestants')
    const plan = { runLeadDiscovery: true, runKnowledgeLookup: false }
    const result = { source: 'discovery', companies: [], reply: 'Found exporters' }
    const v = validateCopilotResponse(result, plan, u, null)
    assert.equal(v.valid, false)
    assert.ok(v.issues.includes('wrong_pipeline_used_lead_discovery_instead_of_knowledge'))
  })
})
