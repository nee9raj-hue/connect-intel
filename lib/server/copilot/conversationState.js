/**
 * Conversation State Engine — persistent structured memory independent of the LLM.
 * The application owns state; every turn reads and updates it.
 */

import { createId } from '../store.js'
import { extractEntities, isPersonDiscoveryRequest } from './entityExtractor.js'
import { inferBusinessGoal } from './businessGoal.js'
import { parseDiscoveryRefinement } from './salesIntent.js'

const GOAL_MAP = {
  lead_generation: 'generate_leads',
  person_discovery: 'find_decision_maker',
  decision_maker_search: 'find_decision_maker',
  crm_follow_up: 'follow_up',
  crm_stalled: 'pipeline_review',
  morning_brief: 'pipeline_review',
  company_intelligence: 'research_company',
  market_intelligence: 'generate_leads',
  entity_research: 'entity_research',
  actions: 'draft_email',
  general: 'general',
}

const ORDINAL_INDEX = {
  first: 0,
  '1st': 0,
  second: 1,
  '2nd': 1,
  third: 2,
  '3rd': 2,
  fourth: 3,
  '4th': 3,
  fifth: 4,
  '5th': 4,
}

const INDUSTRY_ANSWER_RE =
  /\b(toys?|handicrafts?|textiles?|engineering|food|all industries?)\b/i

export function createEmptyConversationState(conversationId) {
  return {
    version: 1,
    conversationId: conversationId || createId('cst'),
    updatedAt: new Date().toISOString(),
    goal: null,
    intent: null,
    focus: {
      company: null,
      person: null,
      lead: null,
      contact: null,
      opportunity: null,
      selectedResult: null,
    },
    filters: {
      cities: [],
      states: [],
      exportCountries: [],
      keywords: '',
      industry: '',
      notInCrmOnly: false,
      publicEmailOnly: false,
    },
    crmContext: null,
    researchSession: null,
    recommendations: { lastNbsa: '', suggestedActions: [] },
    pendingQuestions: [],
    completedActions: [],
    conversationSummary: '',
    researchCache: {},
    toolResults: {},
  }
}

/** Load or initialize state on assistant thread; migrate legacy lastDiscovery. */
export function getConversationState(thread) {
  if (!thread) return createEmptyConversationState()

  if (!thread.copilotState) {
    thread.copilotState = createEmptyConversationState(thread.id)
  }

  migrateLegacyDiscovery(thread)
  return thread.copilotState
}

function migrateLegacyDiscovery(thread) {
  const legacy = thread.lastDiscovery
  const state = thread.copilotState
  if (!legacy?.companies?.length || state.researchSession?.originalCompanies?.length) return

  state.researchSession = {
    id: createId('rs'),
    query: legacy.query || '',
    at: legacy.at || new Date().toISOString(),
    intent: legacy.intent || 'lead_generation',
    researchDepth: legacy.researchDepth || 'standard',
    originalCompanies: [...legacy.companies],
    activeCompanies: [...legacy.companies],
    originalTotal: legacy.totalFound || legacy.companies.length,
    filtersApplied: legacy.lastFilter ? [legacy.lastFilter] : [],
  }
}

export function prepareTurnContext(thread, message, uiContext = {}) {
  const state = getConversationState(thread)
  const text = String(message || '').trim()

  const pendingResolution = tryResolvePendingQuestion(text, state)
  if (pendingResolution) {
    applyFiltersToState(state, pendingResolution.filters)
    state.pendingQuestions = []
  }

  const resolved = resolveReferences(text, state, uiContext)
  const entities = mergeEntities(extractEntities(text), resolved.entities)

  if (uiContext.leadId) {
    state.crmContext = {
      leadId: uiContext.leadId,
      panel: uiContext.panel || null,
      tab: uiContext.tab || null,
    }
    state.focus.lead = { id: uiContext.leadId }
  }

  return {
    state,
    resolved,
    entities,
    effectiveMessage: resolved.resolvedMessage || text,
  }
}

export function mergeEntities(base, fromState = {}) {
  const out = { ...base }
  if (!out.company && fromState.company) out.company = fromState.company
  if (!out.personRole && fromState.personRole) out.personRole = fromState.personRole
  if (fromState.selectedCompany) out.selectedCompany = fromState.selectedCompany
  if (fromState.product && !out.product) out.product = fromState.product
  return out
}

export function resolveReferences(message, state, uiContext = {}) {
  const text = String(message || '').trim()
  const lower = text.toLowerCase()
  const out = {
    resolvedMessage: text,
    entities: {},
    inferredIntent: null,
    inferredCategory: null,
    usedState: [],
    contactFromResearch: null,
  }

  const focus = state.focus || {}
  const research = state.researchSession
  const companies = research?.originalCompanies || research?.activeCompanies || []

  const ordinalMatch = lower.match(
    /\b(?:the\s+)?(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\s*(?:one|company|exporter|lead|prospect)?\b/
  )
  if (ordinalMatch && companies.length) {
    const idx = ORDINAL_INDEX[ordinalMatch[1]]
    const picked = companies[idx]
    if (picked) {
      out.entities.company = picked.company || picked.name
      out.entities.selectedCompany = picked
      out.entities.personRole = picked.contactName ? '' : focus.person?.role || 'CEO'
      out.usedState.push(`research_ordinal_${idx + 1}`)
      state.focus.selectedResult = { type: 'company', index: idx, data: picked }
    }
  }

  if (
    !out.entities.company &&
    /\b(that company|this company|this exporter|that exporter|the company)\b/i.test(lower)
  ) {
    const name = focus.company?.name || focus.selectedResult?.data?.company
    if (name) {
      out.entities.company = name
      out.usedState.push('focus_company')
    }
  }

  if (/\b(that founder|that ceo|the founder|the ceo|him|her)\b/i.test(lower)) {
    if (focus.person?.name || focus.person?.role) {
      out.entities.personRole = focus.person.role || 'Founder'
      if (focus.company?.name) out.entities.company = focus.company.name
      out.inferredIntent = 'person_discovery'
      out.usedState.push('focus_person')
    } else if (focus.company?.name) {
      out.entities.company = focus.company.name
      out.entities.personRole = 'CEO'
      out.inferredIntent = 'person_discovery'
      out.usedState.push('focus_company_role')
    }
  }

  const wantsContact =
    /\b(contact details?|his email|her email|their email|his phone|her phone|linkedin profile|email address|phone number)\b/i.test(
      lower
    ) || (/\b(email|phone|mobile|linkedin)\b/i.test(lower) && /\b(his|her|their|get|find|need)\b/i.test(lower))

  if (wantsContact && !extractEntities(text).company) {
    const pickCompany =
      out.entities.selectedCompany ||
      (focus.company?.name
        ? companies.find(
            (c) =>
              String(c.company || c.name || '')
                .toLowerCase()
                .includes(focus.company.name.toLowerCase().slice(0, 12))
          )
        : null) ||
      companies.find((c) => c.email || c.phone)

    if (pickCompany && (pickCompany.email || pickCompany.phone || pickCompany.linkedinUrl)) {
      out.contactFromResearch = {
        email: pickCompany.email || '',
        phone: pickCompany.phone || '',
        linkedinUrl: pickCompany.linkedinUrl || '',
        contactName: pickCompany.contactName || '',
        company: pickCompany.company || pickCompany.name,
      }
      out.inferredIntent = 'contact_lookup'
      out.usedState.push('research_contact')
    } else if (focus.company?.name) {
      out.entities.company = focus.company.name
      out.entities.personRole = focus.person?.role || 'CEO'
      out.inferredIntent = 'person_discovery'
      out.usedState.push('focus_contact')
    } else if (focus.person?.name) {
      out.entities.personRole = focus.person.role || ''
      out.entities.company = focus.company?.name || ''
      out.inferredIntent = 'person_discovery'
      out.usedState.push('focus_person_contact')
    }
  }

  if (/\b(those companies|these companies|them|these leads|those exporters)\b/i.test(lower)) {
    if (companies.length) {
      out.inferredIntent = 'research_context'
      out.usedState.push('research_batch')
    }
  }

  if (state.filters?.industry && !out.entities.product) {
    out.entities.product = state.filters.industry
    out.usedState.push('state_industry')
  }

  if (state.goal?.id && !out.inferredIntent) {
    out.inferredCategory = state.intent?.category || null
  }

  return out
}

function tryResolvePendingQuestion(message, state) {
  const pending = state.pendingQuestions?.[0]
  if (!pending) return null

  if (pending.id === 'industry') {
    const m = String(message || '').match(INDUSTRY_ANSWER_RE)
    if (m) {
      const industry = m[1].toLowerCase().replace(/s$/, '')
      return {
        filters: {
          industry: industry === 'all industrie' ? '' : m[1],
          keywords: industry === 'all industrie' ? '' : m[1],
        },
      }
    }
  }

  if (pending.id === 'export_market') {
    const refinement = parseDiscoveryRefinement(message)
    if (refinement.exportCountries?.length) {
      return { filters: { exportCountries: refinement.exportCountries } }
    }
  }

  return null
}

function applyFiltersToState(state, filters = {}) {
  if (!filters) return
  if (filters.industry) state.filters.industry = filters.industry
  if (filters.keywords) state.filters.keywords = filters.keywords
  if (filters.exportCountries?.length) {
    state.filters.exportCountries = [
      ...new Set([...(state.filters.exportCountries || []), ...filters.exportCountries]),
    ]
  }
  if (filters.cities?.length) state.filters.cities = filters.cities
  if (filters.states?.length) state.filters.states = filters.states
}

export function shouldSkipClarification(state, type) {
  if (type === 'industry' && state.filters?.industry) return true
  if (type === 'export' && state.filters?.exportCountries?.length) return true
  if (type === 'company' && state.focus?.company?.name) return true
  if (type === 'lead' && (state.focus?.lead?.id || state.crmContext?.leadId)) return true
  return false
}

export function hasActiveResearch(state) {
  const rs = state?.researchSession
  return Boolean(rs?.originalCompanies?.length || rs?.activeCompanies?.length)
}

export function getResearchCompanies(state) {
  const rs = state?.researchSession
  if (!rs) return []
  return rs.originalCompanies?.length ? rs.originalCompanies : rs.activeCompanies || []
}

export function mergeAccumulatedFilters(filtersApplied = []) {
  const merged = {
    exportCountries: [],
    cities: [],
    states: [],
    keywords: '',
    notInCrmOnly: false,
    publicEmailOnly: false,
  }

  for (const f of filtersApplied) {
    if (f.exportCountries?.length) merged.exportCountries.push(...f.exportCountries)
    if (f.cities?.length) merged.cities.push(...f.cities)
    if (f.states?.length) merged.states.push(...f.states)
    if (f.keywords) merged.keywords = f.keywords
    if (f.notInCrmOnly) merged.notInCrmOnly = true
    if (f.publicEmailOnly) merged.publicEmailOnly = true
  }

  merged.exportCountries = [...new Set(merged.exportCountries)]
  merged.cities = [...new Set(merged.cities)]
  merged.states = [...new Set(merged.states)]
  return merged
}

export function saveResearchSession(thread, session) {
  if (!thread) return
  const state = getConversationState(thread)
  const companies = session.companies || []

  state.researchSession = {
    id: state.researchSession?.id || createId('rs'),
    query: session.query || '',
    at: new Date().toISOString(),
    intent: session.intent || 'lead_generation',
    researchDepth: session.researchDepth || 'standard',
    originalCompanies: [...companies],
    activeCompanies: [...companies],
    originalTotal: session.totalFound || companies.length,
    filtersApplied: [],
  }

  if (companies[0]) {
    state.focus.company = {
      name: companies[0].company || companies[0].name,
      leadId: companies[0].leadId || null,
      website: companies[0].website || '',
    }
  }

  state.goal = {
    id: GOAL_MAP[session.intent] || 'generate_leads',
    label: inferBusinessGoal(session.intent || 'lead_generation'),
    since: new Date().toISOString(),
  }
  state.intent = { category: session.intent || 'lead_generation', at: new Date().toISOString() }

  thread.lastDiscovery = {
    at: state.researchSession.at,
    query: state.researchSession.query,
    intent: state.researchSession.intent,
    companies: state.researchSession.activeCompanies,
    totalFound: state.researchSession.originalTotal,
    researchDepth: state.researchSession.researchDepth,
  }

  state.updatedAt = new Date().toISOString()
}

export function applyResearchFilter(thread, refinement, filteredCompanies) {
  const state = getConversationState(thread)
  const rs = state.researchSession
  if (!rs) return

  const filtersApplied = [...(rs.filtersApplied || []), refinement]
  rs.filtersApplied = filtersApplied
  rs.activeCompanies = filteredCompanies
  rs.at = new Date().toISOString()

  applyFiltersToState(state, refinement)

  thread.lastDiscovery = {
    ...thread.lastDiscovery,
    at: rs.at,
    companies: filteredCompanies,
    totalFound: filteredCompanies.length,
    lastFilter: refinement,
  }

  if (filteredCompanies[0]) {
    state.focus.company = {
      name: filteredCompanies[0].company || filteredCompanies[0].name,
      leadId: filteredCompanies[0].leadId || null,
    }
    state.focus.selectedResult = { type: 'company', index: 0, data: filteredCompanies[0] }
  }

  state.updatedAt = new Date().toISOString()
}

export function setPendingQuestion(state, question) {
  if (!state) return
  state.pendingQuestions = [question]
}

export function buildStateAwarePlanSteps(plan, state, { refined = false } = {}) {
  const steps = []
  steps.push({ id: 'understand', label: 'Understanding your objective', status: 'done' })

  if (state?.goal?.label) {
    steps.push({ id: 'goal', label: `Goal: ${state.goal.label}`, status: 'done' })
  }

  if (refined || state?.researchSession?.filtersApplied?.length) {
    steps.push({ id: 'memory', label: 'Reviewing previous research', status: 'done' })
  }

  steps.push({ id: 'crm', label: 'Checking CRM', status: 'done' })

  if (plan?.runLeadDiscovery) {
    steps.push({ id: 'dup', label: 'Looking for duplicate companies', status: 'done' })
    steps.push({ id: 'search', label: 'Searching verified public sources', status: 'done' })
    steps.push({ id: 'people', label: 'Finding public decision makers', status: 'done' })
    steps.push({ id: 'rank', label: 'Ranking prospects', status: 'done' })
  }

  if (plan?.runPeopleDiscovery) {
    steps.push({ id: 'people', label: 'Finding public decision makers', status: 'done' })
  }

  steps.push({ id: 'ready', label: 'Preparing recommendations', status: 'done' })
  return steps
}

export function updateConversationState(thread, { message, plan, result, uiContext, resolved }) {
  if (!thread) return
  const state = getConversationState(thread)
  const text = String(message || '').trim()

  const category = plan?.intentCategory || plan?.salesIntent?.category || 'general'
  const goalId = GOAL_MAP[category] || 'general'

  if (!state.goal || state.goal.id !== goalId) {
    state.goal = {
      id: goalId,
      label: inferBusinessGoal(category),
      since: new Date().toISOString(),
    }
  }

  state.intent = { category, message: text.slice(0, 200), at: new Date().toISOString() }

  if (result?.nbsa) {
    state.recommendations.lastNbsa = result.nbsa
  }
  if (result?.actions?.length) {
    state.recommendations.suggestedActions = result.actions.slice(0, 6)
  }

  if (result?.companyCard) {
    const c = result.companyCard
    state.focus.company = {
      name: c.name || c.company || '',
      leadId: c.leadId || null,
      website: c.website || c.companyDomain || '',
    }
    if (c.contactName || c.title) {
      state.focus.person = {
        name: c.contactName || '',
        role: c.title || '',
        linkedinUrl: c.linkedinUrl || '',
      }
    }
  }

  if (result?.people?.length) {
    const top = result.people[0]
    state.focus.person = {
      name: top.name || '',
      role: top.title || '',
      linkedinUrl: top.linkedinUrl || '',
    }
    if (top.company) {
      state.focus.company = { name: top.company, leadId: result.companyCard?.leadId || null }
    }
  }

  if (plan?.salesIntent?.entities?.company && !state.focus.company?.name) {
    state.focus.company = { name: plan.salesIntent.entities.company }
  }

  if (resolved?.entities?.selectedCompany) {
    state.focus.selectedResult = {
      type: 'company',
      index: resolved.entities.selectedCompany._index ?? 0,
      data: resolved.entities.selectedCompany,
    }
  }

  if (result?.source === 'clarification') {
    if (plan?.salesIntent?.needsIndustryClarification) {
      setPendingQuestion(state, { id: 'industry', askedAt: new Date().toISOString() })
    } else if (plan?.salesIntent?.needsExportClarification) {
      setPendingQuestion(state, { id: 'export_market', askedAt: new Date().toISOString() })
    }
  } else if (state.pendingQuestions?.length && result?.companies?.length) {
    state.pendingQuestions = []
  }

  const summaryParts = []
  if (state.goal?.label) summaryParts.push(`Goal: ${state.goal.label}`)
  if (state.focus.company?.name) summaryParts.push(`Company: ${state.focus.company.name}`)
  if (state.focus.person?.name) summaryParts.push(`Person: ${state.focus.person.name}`)
  if (state.researchSession?.activeCompanies?.length) {
    summaryParts.push(`Research: ${state.researchSession.activeCompanies.length} companies`)
  }
  state.conversationSummary = summaryParts.join(' · ').slice(0, 400)
  state.updatedAt = new Date().toISOString()
  thread.copilotState = state
}

export function formatContactLookupReply(contact) {
  if (!contact) return null
  const lines = []
  if (contact.contactName) lines.push(`**Contact:** ${contact.contactName}`)
  if (contact.email) lines.push(`**Email:** ${contact.email}`)
  else lines.push('**Email:** I couldn\'t verify a public business email from previous research.')
  if (contact.phone) lines.push(`**Phone:** ${contact.phone}`)
  if (contact.linkedinUrl) lines.push(`**LinkedIn:** ${contact.linkedinUrl}`)

  return {
    reply: `**Understanding your request:** Pulling contact details from our conversation for **${contact.company}**.\n\n**What I found:**\n${lines.map((l) => `- ${l}`).join('\n')}\n\n**Why it matters:** No need to re-search — this came from your current research session.`,
    source: 'conversation_state',
    sources: [{ type: 'copilot', label: 'Conversation memory' }],
    confidence: contact.email || contact.phone ? 'high' : 'medium',
    companyCard: {
      name: contact.company,
      contactName: contact.contactName,
      email: contact.email,
      phone: contact.phone,
      linkedinUrl: contact.linkedinUrl,
    },
    nbsa: contact.email
      ? 'Draft an intro email using this contact, or save the company to CRM if it\'s not there yet.'
      : 'I can search for a verified public LinkedIn profile or leadership page for this company.',
  }
}

export function selfCheckResponse(state, result, resolved) {
  const issues = []

  if (resolved?.usedState?.length && result?.reply?.match(/\bwhich company\b/i)) {
    issues.push('asked_which_company_despite_state')
  }
  if (state?.focus?.company?.name && result?.reply?.match(/\bwhose\b/i)) {
    issues.push('asked_whose_despite_focus')
  }
  if (hasActiveResearch(state) && result?.source === 'discovery' && !resolved?.usedState?.length) {
    const isRefine = result?.discoveryMeta?.refined
    if (!isRefine && state.researchSession?.query === result?.discoveryMeta?.query) {
      issues.push('possible_duplicate_search')
    }
  }

  return { ok: issues.length === 0, issues }
}

export function isPersonDiscoveryFromState(message, entities, resolved) {
  if (resolved?.inferredIntent === 'person_discovery') return true
  if (resolved?.inferredIntent === 'contact_lookup') return false
  return isPersonDiscoveryRequest(message, entities)
}

export function enrichSalesIntentFromState(salesIntent, state, resolved, entities) {
  const out = { ...salesIntent, entities: { ...salesIntent.entities, ...entities } }

  if (resolved?.entities?.company) {
    out.entities.company = resolved.entities.company
    out.targetCompany = resolved.entities.company
  }
  if (resolved?.entities?.personRole) {
    out.entities.personRole = resolved.entities.personRole
    out.targetRole = resolved.entities.personRole
  }
  if (state.filters?.industry) {
    out.entities.product = out.entities.product || state.filters.industry
  }
  if (state.filters?.exportCountries?.length && !out.exportCountries?.length) {
    out.exportCountries = state.filters.exportCountries
  }

  if (shouldSkipClarification(state, 'industry')) {
    out.needsIndustryClarification = false
  }
  if (shouldSkipClarification(state, 'export')) {
    out.needsExportClarification = false
  }

  if (resolved?.inferredIntent === 'person_discovery') {
    out.isPersonDiscovery = true
    out.category = 'person_discovery'
  }

  return out
}
