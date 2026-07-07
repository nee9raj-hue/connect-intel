/**
 * Conversation memory for lead discovery — filter without re-searching.
 */

import { parseDiscoveryRefinement } from './salesIntent.js'
import { buildV4Reply } from './structuredResponse.js'
import { buildApproachPlanSteps } from './businessGoal.js'
import { rankDiscoveryCompanies } from './companyRanker.js'
import {
  getConversationState,
  getResearchCompanies,
  mergeAccumulatedFilters,
  applyResearchFilter,
  saveResearchSession,
  buildStateAwarePlanSteps,
} from './conversationState.js'

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function companyMatchesExport(company, countries) {
  if (!countries?.length) return true
  const hay = norm(
    [company.exportMarkets, company.exportCountries, company.products, company.industry].join(' ')
  )
  return countries.some((c) => hay.includes(norm(c).slice(0, 12)))
}

function companyMatchesLocation(company, { cities = [], states = [] }) {
  const loc = norm([company.city, company.state, company.location, company.headquarters].join(' '))
  if (cities.length && !cities.some((c) => loc.includes(norm(c)))) return false
  if (states.length && !states.some((s) => loc.includes(norm(s)))) return false
  return true
}

export function filterDiscoveryCompanies(companies, refinement) {
  let list = [...(companies || [])]

  if (refinement.exportCountries?.length) {
    list = list.filter((c) => companyMatchesExport(c, refinement.exportCountries))
  }
  if (refinement.cities?.length || refinement.states?.length) {
    list = list.filter((c) => companyMatchesLocation(c, refinement))
  }
  if (refinement.keywords) {
    const kw = norm(refinement.keywords)
    list = list.filter((c) => {
      const hay = norm([c.company, c.name, c.industry, c.products].join(' '))
      return hay.includes(kw)
    })
  }

  if (refinement.notInCrmOnly) {
    list = list.filter((c) => !c.inCrm && !c.leadId)
  }

  if (refinement.publicEmailOnly) {
    list = list.filter((c) => String(c.email || '').trim().length > 3)
  }

  return list
}

export function buildRefinedDiscoveryReply({ companies, refinement, previousTotal }) {
  const filters = []
  if (refinement.exportCountries?.length) filters.push(`exporting to **${refinement.exportCountries.join(', ')}**`)
  if (refinement.cities?.length) filters.push(`in **${refinement.cities.join(', ')}**`)
  if (refinement.states?.length) filters.push(`in **${refinement.states.join(', ')}**`)
  if (refinement.notInCrmOnly) filters.push('**not in CRM**')
  if (refinement.publicEmailOnly) filters.push('**with public email**')
  const filterText = filters.length ? filters.join(' · ') : 'your criteria'

  const reply = buildV4Reply({
    approach: `Continuing from your last search — applying ${filterText}.`,
    whatIFound: `**${companies.length}** companies match (${filterText}) from **${previousTotal}** found earlier.`,
    whyItMatters: companies.length
      ? 'These are your strongest remaining prospects from the previous scan — no new web search needed.'
      : 'Nothing matches this filter — try loosening criteria or run a fresh search.',
  })

  return {
    reply,
    shortAnswer: `${companies.length} companies match your filter.`,
  }
}

export function saveDiscoverySession(thread, session) {
  saveResearchSession(thread, session)
}

export function tryRefineDiscovery(thread, message, plan = null) {
  const state = getConversationState(thread)
  const original = getResearchCompanies(state)
  const prev = thread?.lastDiscovery

  if (!original?.length && !prev?.companies?.length) return null

  const refinement = parseDiscoveryRefinement(message)
  const hasRefinement =
    refinement.exportCountries.length ||
    refinement.cities.length ||
    refinement.states.length ||
    refinement.keywords ||
    refinement.notInCrmOnly ||
    refinement.publicEmailOnly

  if (!hasRefinement) return null

  const baseCompanies = original.length ? original : prev.companies
  const previousTotal = state.researchSession?.originalTotal || baseCompanies.length
  const filtersApplied = [...(state.researchSession?.filtersApplied || []), refinement]
  const mergedFilter = mergeAccumulatedFilters(filtersApplied)
  const filtered = rankDiscoveryCompanies(filterDiscoveryCompanies(baseCompanies, mergedFilter))

  const { reply, shortAnswer } = buildRefinedDiscoveryReply({
    companies: filtered,
    refinement: mergedFilter,
    previousTotal,
  })

  applyResearchFilter(thread, refinement, filtered)

  return {
    reply,
    shortAnswer,
    companies: filtered,
    totalFound: filtered.length,
    source: 'discovery_memory',
    sources: [{ type: 'copilot', label: 'Conversation memory' }],
    confidence: filtered.length ? 'high' : 'medium',
    planSteps: buildStateAwarePlanSteps(plan || {}, state, { refined: true }),
    suggestions: [
      'Only exporting to USA',
      'Only Delhi NCR',
      'Only companies with public email',
      'Add top 5 to CRM',
    ],
    actions: buildDiscoveryActions(filtered),
    discoveryMeta: {
      total: filtered.length,
      previousTotal,
      refined: true,
      query: state.researchSession?.query || prev?.query,
    },
  }
}

export function buildPlanSteps({ refined = false, category = 'lead_generation' } = {}) {
  if (refined) {
    return [
      { id: 'memory', label: 'Using previous search', status: 'done' },
      { id: 'filter', label: 'Applying filters', status: 'done' },
      { id: 'rank', label: 'Re-ranking results', status: 'done' },
      { id: 'ready', label: 'Preparing recommendations', status: 'done' },
    ]
  }
  return buildApproachPlanSteps(category)
}

export function buildDiscoveryActions(companies = []) {
  const actions = [
    { type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' },
    { type: 'navigate', panel: 'bulk-email', label: 'Email campaign' },
  ]
  const firstNew = companies.find((c) => !c.leadId && c.company)
  if (firstNew) {
    actions.unshift({
      type: 'create_lead',
      label: 'Save top company',
      payload: {
        company: firstNew.company || firstNew.name,
        website: firstNew.website || firstNew.companyDomain || '',
        industry: firstNew.industry || '',
        city: firstNew.city || '',
        state: firstNew.state || '',
        email: firstNew.email || '',
        phone: firstNew.phone || '',
      },
    })
  }
  return actions.slice(0, 6)
}
