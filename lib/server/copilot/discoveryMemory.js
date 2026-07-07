/**
 * Conversation memory for lead discovery — filter without re-searching.
 */

import { parseDiscoveryRefinement } from './salesIntent.js'

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

  return list
}

export function buildRefinedDiscoveryReply({ companies, refinement, previousTotal }) {
  const filters = []
  if (refinement.exportCountries?.length) filters.push(`exporting to **${refinement.exportCountries.join(', ')}**`)
  if (refinement.cities?.length) filters.push(`in **${refinement.cities.join(', ')}**`)
  if (refinement.states?.length) filters.push(`in **${refinement.states.join(', ')}**`)
  const filterText = filters.length ? filters.join(' · ') : 'your criteria'

  return {
    reply: `**Answer:** Filtered to **${companies.length}** companies (${filterText}) from **${previousTotal}** found earlier.\n\n**Next step:** Add leads to CRM or narrow further — e.g. "only USA" or "only Delhi".`,
    shortAnswer: `${companies.length} companies match your filter.`,
  }
}

export function saveDiscoverySession(thread, session) {
  if (!thread) return
  thread.lastDiscovery = {
    at: new Date().toISOString(),
    query: session.query,
    intent: session.intent,
    companies: session.companies,
    totalFound: session.totalFound,
    researchDepth: session.researchDepth,
  }
}

export function tryRefineDiscovery(thread, message) {
  const prev = thread?.lastDiscovery
  if (!prev?.companies?.length) return null

  const refinement = parseDiscoveryRefinement(message)
  const hasRefinement =
    refinement.exportCountries.length ||
    refinement.cities.length ||
    refinement.states.length ||
    refinement.keywords ||
    refinement.notInCrmOnly

  if (!hasRefinement) return null

  const filtered = filterDiscoveryCompanies(prev.companies, refinement)
  const { reply, shortAnswer } = buildRefinedDiscoveryReply({
    companies: filtered,
    refinement,
    previousTotal: prev.companies.length,
  })

  thread.lastDiscovery = {
    ...prev,
    at: new Date().toISOString(),
    companies: filtered,
    lastFilter: refinement,
  }

  return {
    reply,
    shortAnswer,
    companies: filtered,
    totalFound: filtered.length,
    source: 'discovery_memory',
    sources: [{ type: 'copilot', label: 'Filtered results' }],
    confidence: filtered.length ? 'high' : 'medium',
    planSteps: buildPlanSteps({ refined: true }),
    suggestions: [
      'Only exporting to USA',
      'Only Delhi NCR',
      'Add top 5 to CRM',
      'Draft outreach email',
    ],
    actions: buildDiscoveryActions(filtered),
    discoveryMeta: {
      total: filtered.length,
      previousTotal: prev.companies.length,
      refined: true,
      query: prev.query,
    },
  }
}

export function buildPlanSteps({ refined = false } = {}) {
  if (refined) {
    return [
      { id: 'memory', label: 'Using previous search', status: 'done' },
      { id: 'filter', label: 'Applying filters', status: 'done' },
      { id: 'ready', label: 'Results ready', status: 'done' },
    ]
  }
  return [
    { id: 'intent', label: 'Understanding your request', status: 'done' },
    { id: 'crm', label: 'Searching CRM', status: 'done' },
    { id: 'dup', label: 'Checking duplicates', status: 'done' },
    { id: 'discovery', label: 'Searching companies (TradeIndia, IndiaMART, web)', status: 'done' },
    { id: 'people', label: 'Finding decision makers', status: 'done' },
    { id: 'validate', label: 'Validating results', status: 'done' },
    { id: 'ready', label: 'Preparing recommendations', status: 'done' },
  ]
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
