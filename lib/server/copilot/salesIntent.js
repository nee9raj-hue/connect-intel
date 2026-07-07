/**
 * Sales intent inference — never treat lead-gen queries as Q&A.
 */

import { parseSearchQueryFallback } from '../searchQueryParser.js'
import { extractEntities, isPersonDiscoveryRequest } from './entityExtractor.js'

const INDUSTRY_PRODUCT_RE =
  /\b(toy|toys|textile|textiles|handicraft|handicrafts|engineering|food|plastic|leather|garment|pharma|auto|furniture|chemical|steel|agri|agriculture|electronic|jewelry|jewellery|rubber|paper|wooden|ceramic|sporting)\b/i

const EXPORT_COUNTRY_RE =
  /\b(usa|u\.?s\.?a|united states|uk|united kingdom|germany|europe|uae|saudi|canada|australia|france|italy|spain|japan|china|singapore|netherlands)\b/i

const LEAD_GEN_SIGNAL_RE =
  /\b(exporter|exporters|exporting|manufacturer|manufacturers|supplier|suppliers|importer|distributor|wholesaler|buyer|vendor|dealer|trader|traders|oem|sme|msme)\b/i

const NEED_WANT_RE = /\b(i need|need|looking for|want|find me|get me|show me|list)\b/i

const REFINE_RE =
  /\b(only|just|filter|narrow|excluding|except|limit to|not in crm|not already|new leads?|exporting to|exports? to|ships? to|in delhi|from delhi|delhi ncr|in mumbai|in punjab|public email|with email|has email)\b/i

const DEEP_RE = /\b(deep research|deep dive|comprehensive|thorough)\b/i
const QUICK_RE = /\b(quick|fast|brief)\b/i

export function inferSalesIntent(message, uiContext = {}) {
  const text = String(message || '').trim()
  const lower = text.toLowerCase()
  const parsed = parseSearchQueryFallback(text)
  const entities = extractEntities(text)

  const isPersonDiscovery = isPersonDiscoveryRequest(text, entities)

  const isKnowledgeTopic =
    /\b(shark\s+tank|contestants?|all\s+seasons?|who\s+(?:all\s+)?(?:were\s+)?on)\b/i.test(lower)

  const isLeadGeneration =
    !isPersonDiscovery &&
    !isKnowledgeTopic &&
    (uiContext.copilotTab === 'market' ||
      LEAD_GEN_SIGNAL_RE.test(lower) ||
      (NEED_WANT_RE.test(lower) && !/\b(how|what|why|when)\b/i.test(lower)) ||
      /\b(find|search|discover|list)\b.*\b(companies?|exporters?|manufacturers?|suppliers?|leads?)\b/i.test(
        lower
      ))

  const isDecisionMaker =
    /\b(decision.?maker|ceo|cfo|cto|founder|director|vp|head of|procurement|logistics manager)\b/i.test(
      lower
    )

  const isCrmFollowUp = /\bwho needs follow.?up|follow.?ups? (due|today)|overdue follow/i.test(lower)
  const isStalled = /\bstalled deals?\b/i.test(lower)
  const isMorningBrief = /\b(brief me|morning brief|daily brief|start my day)\b/i.test(lower)

  let researchDepth = 'standard'
  if (DEEP_RE.test(lower)) researchDepth = 'deep'
  else if (QUICK_RE.test(lower)) researchDepth = 'quick'

  const exportCountries = []
  const exportMatch = lower.match(
    /\bexport(?:ing)?\s+to\s+([a-z\s,]+?)(?:\s+from|\s+in|\s*$)/i
  )
  if (exportMatch?.[1]) {
    exportCountries.push(...exportMatch[1].split(/,| and /).map((s) => s.trim()).filter(Boolean))
  } else {
    const m = lower.match(EXPORT_COUNTRY_RE)
    if (m && /\bexport/i.test(lower)) exportCountries.push(m[1] || m[0])
  }

  return {
    text,
    entities,
    category: isMorningBrief
      ? 'morning_brief'
      : isCrmFollowUp
        ? 'crm_follow_up'
        : isStalled
          ? 'crm_stalled'
          : isPersonDiscovery
            ? 'person_discovery'
            : isLeadGeneration
              ? isDecisionMaker
                ? 'decision_maker_search'
                : 'lead_generation'
              : parsed.intent === 'find_people' || isDecisionMaker
                ? 'decision_maker_search'
                : 'general',
    filters: parsed.filters,
    naturalQuery: parsed.naturalQuery || text,
    intent: parsed.intent,
    targetCompany: entities.company || parsed.targetCompany,
    targetRole: entities.personRole || parsed.targetRole,
    isPersonDiscovery,
    isLeadGeneration,
    isDecisionMaker,
    isCrmFollowUp,
    isStalled,
    isMorningBrief,
    researchDepth,
    exportCountries,
    parsedBy: parsed.parsedBy,
    needsExportClarification: needsExportMarketClarification(text, {
      isLeadGeneration,
      exportCountries,
      filters: parsed.filters,
    }),
    needsIndustryClarification: needsIndustryClarification(text, {
      isLeadGeneration,
      exportCountries,
      filters: parsed.filters,
      entities,
    }),
  }
}

function isVagueIndustryKeywords(keywords) {
  const kw = String(keywords || '').trim().toLowerCase()
  if (!kw || kw.length < 4) return true
  const tokens = kw.split(/\s+/).filter(Boolean)
  if (!tokens.length) return true
  const generic = new Set([
    'exporter',
    'exporters',
    'exporting',
    'export',
    'exports',
    'usa',
    'uk',
    'europe',
    'manufacturer',
    'manufacturers',
    'companies',
    'company',
    'supplier',
    'suppliers',
    'from',
    'to',
    'in',
    'the',
    'and',
    'i',
    'need',
    'find',
    'looking',
    'for',
  ])
  return tokens.every((t) => generic.has(t))
}

function needsIndustryClarification(message, { isLeadGeneration, exportCountries, filters, entities }) {
  if (!isLeadGeneration) return false
  const lower = String(message || '').toLowerCase()

  if (entities?.product || INDUSTRY_PRODUCT_RE.test(lower)) return false

  const hasLocation =
    filters?.cities?.length ||
    filters?.states?.length ||
    /\b(delhi|mumbai|noida|gurugram|gurgaon|ncr|punjab|gujarat|chennai|bangalore|pune|ludhiana|surat)\b/i.test(
      lower
    )
  const hasExport =
    exportCountries?.length ||
    /\bexport(?:ing)?\s+to\b/i.test(lower) ||
    (/\bexport/i.test(lower) && EXPORT_COUNTRY_RE.test(lower))

  if (!hasLocation && !hasExport) return false

  return isVagueIndustryKeywords(filters?.keywords)
}

function needsExportMarketClarification(message, { isLeadGeneration, exportCountries, filters }) {
  if (!isLeadGeneration) return false
  if (exportCountries?.length) return false
  if (filters?.cities?.length || filters?.states?.length) return false
  const lower = String(message || '').toLowerCase().trim()
  if (lower.length > 80) return false
  return (
    /\b(find|need|want|looking for|list)\b.*\b(exporter|manufacturer|supplier)\b/i.test(lower) &&
    !/\bexport(?:ing)?\s+to\b/i.test(lower)
  )
}

export function isDiscoveryRefinement(message, thread) {
  const text = String(message || '').trim()
  if (!text || text.length > 120) return false

  const state = thread?.copilotState
  const hasResearch =
    state?.researchSession?.originalCompanies?.length ||
    thread?.lastDiscovery?.companies?.length

  if (!hasResearch) return false
  return REFINE_RE.test(text.toLowerCase()) || EXPORT_COUNTRY_RE.test(text)
}

export function parseDiscoveryRefinement(message) {
  const lower = String(message || '').toLowerCase()
  const out = { exportCountries: [], cities: [], states: [], keywords: '', notInCrmOnly: false, publicEmailOnly: false }

  const exportTo = lower.match(/\b(?:only|export(?:ing)?|exports?) to\s+([a-z\s,]+)/i)
  if (exportTo?.[1]) {
    out.exportCountries = exportTo[1].split(/,| and /).map((s) => s.trim()).filter(Boolean)
  } else {
    const m = lower.match(EXPORT_COUNTRY_RE)
    if (m && /\b(only|export)/i.test(lower)) out.exportCountries.push(m[0])
  }

  if (/\bdelhi ncr\b/i.test(lower)) out.states.push('Delhi NCR')
  else if (/\bdelhi\b/i.test(lower)) out.cities.push('Delhi')
  else if (/\bmumbai\b/i.test(lower)) out.cities.push('Mumbai')
  else if (/\bnoida\b/i.test(lower)) out.cities.push('Noida')
  else if (/\bgurugram|gurgaon\b/i.test(lower)) out.cities.push('Gurugram')

  const product = lower.match(/\bonly\s+([a-z][a-z\s]{2,30})\b/i)
  if (product?.[1] && !/export|delhi|mumbai|usa|uk/i.test(product[1])) {
    out.keywords = product[1].trim()
  }

  if (/\b(not in crm|not already in crm|new (?:leads?|companies)|exclude crm)\b/i.test(lower)) {
    out.notInCrmOnly = true
  }

  if (/\b(public email|with email|has email|email available|only (?:companies )?with email)\b/i.test(lower)) {
    out.publicEmailOnly = true
  }

  return out
}

export function discoveryCountForDepth(depth) {
  if (depth === 'quick') return 6
  if (depth === 'deep') return 15
  return 10
}
