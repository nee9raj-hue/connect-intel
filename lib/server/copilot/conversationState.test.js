import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createEmptyConversationState,
  resolveReferences,
  mergeAccumulatedFilters,
  shouldSkipClarification,
  formatContactLookupReply,
  getConversationState,
  saveResearchSession,
} from './conversationState.js'

describe('conversationState', () => {
  it('resolves ordinal company from research session', () => {
    const state = createEmptyConversationState('t1')
    state.researchSession = {
      originalCompanies: [
        { company: 'Alpha Exports', email: 'a@alpha.com' },
        { company: 'Beta Toys', email: 'b@beta.com' },
      ],
    }
    state.focus.company = { name: 'Alpha Exports' }

    const resolved = resolveReferences('get email for the second company', state)
    assert.equal(resolved.entities.company, 'Beta Toys')
    assert.ok(resolved.usedState.includes('research_ordinal_2'))
  })

  it('resolves his contact details from focus company', () => {
    const state = createEmptyConversationState('t2')
    state.focus.company = { name: 'Singhal Exports' }
    state.focus.person = { role: 'CEO', name: '' }

    const resolved = resolveReferences('I need his contact details', state)
    assert.equal(resolved.entities.company, 'Singhal Exports')
    assert.equal(resolved.inferredIntent, 'person_discovery')
    assert.ok(resolved.usedState.includes('focus_contact'))
  })

  it('returns contact from selected research company without re-search', () => {
    const state = createEmptyConversationState('t3')
    state.researchSession = {
      originalCompanies: [{ company: 'Jack Toys', email: 'info@jacktoys.com', phone: '9876543210' }],
    }

    const resolved = resolveReferences('his email', state)
    assert.equal(resolved.contactFromResearch.email, 'info@jacktoys.com')
    assert.equal(resolved.inferredIntent, 'contact_lookup')
  })

  it('merges cumulative discovery filters', () => {
    const merged = mergeAccumulatedFilters([
      { cities: ['Delhi'], keywords: 'textile' },
      { exportCountries: ['USA'], notInCrmOnly: true },
    ])
    assert.deepEqual(merged.cities, ['Delhi'])
    assert.deepEqual(merged.exportCountries, ['USA'])
    assert.equal(merged.notInCrmOnly, true)
    assert.equal(merged.keywords, 'textile')
  })

  it('skips industry clarification when industry known in state', () => {
    const state = createEmptyConversationState('t4')
    state.filters.industry = 'Toys'
    assert.equal(shouldSkipClarification(state, 'industry'), true)
  })

  it('persists research on thread via saveResearchSession', () => {
    const thread = { id: 'ast-1', copilotState: null }
    saveResearchSession(thread, {
      query: 'toy exporters',
      intent: 'lead_generation',
      companies: [{ company: 'Toy Co', inCrm: false }],
      totalFound: 1,
    })
    const state = getConversationState(thread)
    assert.equal(state.researchSession.originalCompanies.length, 1)
    assert.equal(state.goal.id, 'generate_leads')
    assert.equal(thread.lastDiscovery.companies.length, 1)
  })

  it('formats contact lookup reply from research', () => {
    const result = formatContactLookupReply({
      company: 'Singhal Exports',
      email: 'sales@singhal.com',
      contactName: 'Raj Singh',
    })
    assert.match(result.reply, /Singhal Exports/)
    assert.match(result.reply, /sales@singhal.com/)
  })
})
