/**
 * AI Query Understanding Engine (AI-QUE)
 * Understand meaning before any search — never tokenize named entities.
 */

const TV_SHOW_ENTITIES = [
  { pattern: /\bshark\s+tank\s+india\b/i, name: 'Shark Tank India' },
  { pattern: /\bshark\s+tank\b/i, name: 'Shark Tank India' },
]

const BRAND_ENTITIES = [
  { pattern: /\bbo\s*at\b/i, name: 'boAt', company: 'Imagine Marketing Services (boAt)' },
  { pattern: /\bboat\s+(?:founder|ceo|brand|company)\b/i, name: 'boAt', company: 'Imagine Marketing Services (boAt)' },
  { pattern: /\bmama\s*earth\b/i, name: 'Mamaearth', company: 'Mamaearth' },
  { pattern: /\blenskart\b/i, name: 'Lenskart', company: 'Lenskart' },
  { pattern: /\bnykaa\b/i, name: 'Nykaa', company: 'FSN E-Commerce (Nykaa)' },
  { pattern: /\bbeardo\b/i, name: 'Beardo', company: 'Beardo' },
  { pattern: /\bsugar\s+cosmetics\b/i, name: 'Sugar Cosmetics', company: 'Sugar Cosmetics' },
]

const MARKETPLACE_ENTITIES = [
  { pattern: /\bamazon\s+fba\b/i, name: 'Amazon FBA' },
  { pattern: /\bamazon\s+sellers?\b/i, name: 'Amazon India' },
  { pattern: /\bflipkart\s+sellers?\b/i, name: 'Flipkart' },
  { pattern: /\bmeesho\s+sellers?\b/i, name: 'Meesho' },
]

const TRADE_SHOW_ENTITIES = [
  { pattern: /\bihgf\b/i, name: 'IHGF Delhi Fair' },
  { pattern: /\bindia\s+handicrafts?\s+(?:and\s+)?gifts?\s+fair\b/i, name: 'IHGF Delhi Fair' },
]

const INDUSTRY_RE =
  /\b(toys?|textiles?|handicrafts?|food|pharma|auto|garments?|electronics?|cosmetics?|furniture|leather|engineering)\b/i

const ROLE_RE = /\b(founder|co-?founder|ceo|cfo|cto|director|managing director|md|owner)\b/i

const KNOWLEDGE_OUTPUT = [
  'Company',
  'Founder',
  'Product',
  'Industry',
  'Website',
  'LinkedIn',
  'Export Status',
  'CRM Status',
]

const LEAD_OUTPUT = [
  'Company',
  'Founder',
  'Product',
  'Website',
  'Export Markets',
  'Decision Maker',
  'LinkedIn',
  'CRM Status',
]

/** Main entry — always pass conversation state when available. */
export function understandCopilotQuery(message, state = null) {
  const text = String(message || '').trim()
  if (!text) return standardUnderstanding(text)

  let understanding = understandFromMessage(text)

  if (state) {
    understanding = mergeStateIntoUnderstanding(text, state, understanding)
  }

  return understanding
}

function understandFromMessage(text) {
  const tvShow = matchFirst(text, TV_SHOW_ENTITIES)
  const brand = tvShow ? null : matchFirst(text, BRAND_ENTITIES)
  const marketplace = matchFirst(text, MARKETPLACE_ENTITIES)
  const tradeShow = tvShow || brand ? null : matchFirst(text, TRADE_SHOW_ENTITIES)

  const wantsContestants = detectContestantIntent(text)
  const preferExport = detectExporterPreference(text)
  const exporterFilter = detectExporterFilter(text)
  const industry = text.match(INDUSTRY_RE)?.[1] || ''
  const role = text.match(ROLE_RE)?.[1]?.replace(/\./g, '') || ''
  const season = extractSeasonScope(text)
  const wantsLinkedIn = /\blinkedin\b/i.test(text)

  if (tvShow && (wantsContestants || season || exporterFilter || preferExport)) {
    return buildTvShowUnderstanding(tvShow.name, text, {
      exporterFilter,
      preferExport,
      industry,
      season,
      wantsLinkedIn,
    })
  }

  if (tradeShow && (wantsContestants || exporterFilter)) {
    return buildTradeShowLeadUnderstanding(tradeShow.name, text, { exporterFilter, industry })
  }

  if (brand && role) {
    return buildBrandPersonUnderstanding(brand, role)
  }

  if (brand && /\b(company|brand|about|research)\b/i.test(text)) {
    return buildBrandKnowledgeUnderstanding(brand)
  }

  if (marketplace) {
    return buildMarketplaceLeadUnderstanding(marketplace.name, text, { industry, exporterFilter })
  }

  return standardUnderstanding(text)
}

function mergeStateIntoUnderstanding(text, state, partial) {
  if (partial.mode !== 'standard') return partial

  const kc = state.knowledgeContext
  const rs = state.researchSession
  const lower = text.toLowerCase()

  const entity = kc?.entity || rs?.entity || rs?.discoveryMeta?.entity
  const entityType = kc?.entityType || rs?.entityType || 'TV_SHOW'

  if (!entity) return partial

  const isFollowUp =
    /\b(contestants?|information|info|linkedin|founders?|names?|seasons?|export|them|those|these)\b/i.test(
      lower
    ) || text.length < 100

  if (entityType === 'TV_SHOW' && isFollowUp) {
    return buildTvShowUnderstanding(entity, text, {
      exporterFilter: detectExporterFilter(text) || kc?.filters?.exporter,
      industry: state.filters?.industry || '',
      season: extractSeasonScope(text) || kc?.season || 'all',
      wantsLinkedIn: /\blinkedin\b/i.test(text),
      fromState: true,
    })
  }

  if (/\bshark\s+tank\b/i.test(lower) && detectContestantIntent(text)) {
    return buildTvShowUnderstanding('Shark Tank India', text, {
      exporterFilter: detectExporterFilter(text),
      season: extractSeasonScope(text) || 'all',
      wantsLinkedIn: /\blinkedin\b/i.test(text),
    })
  }

  return partial
}

function buildTvShowUnderstanding(show, text, opts = {}) {
  const { exporterFilter, preferExport, industry, season = 'all', wantsLinkedIn, fromState } = opts
  const seasonPhrase =
    season === 'all' ? ' across all seasons' : season ? ` from season ${season}` : ''

  const semanticParts = [
    `List all companies and startups featured on ${show}${seasonPhrase}`,
    'with founder names',
    'products',
    'websites',
  ]
  if (wantsLinkedIn) semanticParts.push('founder LinkedIn profiles')
  if (industry) semanticParts.push(industry)
  if (exporterFilter || preferExport) semanticParts.push('export activity and export markets where known')

  const intent = exporterFilter && !wantsLinkedIn && !detectContestantIntent(text)
    ? 'lead_generation'
    : 'knowledge_lookup'

  return {
    mode: intent === 'knowledge_lookup' ? 'knowledge_lookup' : 'entity_research',
    intent,
    domain: 'television',
    goal: intent === 'knowledge_lookup' ? 'knowledge_lookup' : 'lead_generation',
    entityType: 'TV_SHOW',
    entity: show,
    target: 'Contestants',
    season,
    filters: {
      exporter: Boolean(exporterFilter),
      preferExport: Boolean(preferExport),
      industry: industry || null,
      linkedin: wantsLinkedIn,
    },
    requiredOutput: wantsLinkedIn
      ? [...KNOWLEDGE_OUTPUT]
      : exporterFilter
        ? [...LEAD_OUTPUT]
        : [...KNOWLEDGE_OUTPUT],
    semanticQuery: semanticParts.join(' '),
    blockedTokens: pollutionTokensForEntity(show),
    explanation: fromState
      ? `continuing your **${show}** contestant research${season === 'all' ? ' (all seasons)' : ''}`
      : exporterFilter || preferExport
        ? `contestants from **${show}**${seasonPhrase} — prioritizing exporters where known`
        : `all contestants and companies from **${show}**${seasonPhrase}`,
    rawMessage: text,
    followUp: Boolean(fromState),
  }
}

function buildTradeShowLeadUnderstanding(show, text, { exporterFilter, industry }) {
  return {
    mode: 'entity_research',
    intent: 'lead_generation',
    domain: 'events',
    goal: 'lead_generation',
    entityType: 'TRADE_SHOW',
    entity: show,
    target: 'Exhibitors',
    season: null,
    filters: { exporter: Boolean(exporterFilter), industry: industry || null },
    requiredOutput: LEAD_OUTPUT,
    semanticQuery: buildTradeShowSemanticQuery(show, { exporterOnly: exporterFilter, industry }),
    blockedTokens: [],
    explanation: `exhibitors at **${show}**${exporterFilter ? ' who export' : ''}`,
    rawMessage: text,
  }
}

function buildMarketplaceLeadUnderstanding(marketplace, text, { industry, exporterFilter }) {
  return {
    mode: 'entity_research',
    intent: 'lead_generation',
    domain: 'marketplace',
    goal: 'lead_generation',
    entityType: 'MARKETPLACE',
    entity: marketplace,
    target: 'Sellers',
    season: null,
    filters: { exporter: Boolean(exporterFilter), industry: industry || null },
    requiredOutput: LEAD_OUTPUT,
    semanticQuery: buildMarketplaceSemanticQuery(marketplace, { industry, exporterOnly: exporterFilter }),
    blockedTokens: [],
    explanation: `**${industry || 'companies'}** on **${marketplace}**${exporterFilter ? ' that export' : ''}`,
    rawMessage: text,
  }
}

function buildBrandPersonUnderstanding(brand, role) {
  return {
    mode: 'person_at_brand',
    intent: 'person_discovery',
    domain: 'brand',
    goal: 'find_decision_maker',
    entityType: 'BRAND',
    entity: brand.name,
    company: brand.company || brand.name,
    target: role,
    season: null,
    filters: {},
    requiredOutput: ['Person', 'Role', 'LinkedIn', 'Company'],
    semanticQuery: `${brand.name} ${role} India official LinkedIn`,
    blockedTokens: pollutionTokensForBrand(brand.name),
    explanation: `the **${role}** of **${brand.name}**`,
    rawMessage: '',
  }
}

function buildBrandKnowledgeUnderstanding(brand) {
  return {
    mode: 'knowledge_lookup',
    intent: 'knowledge_lookup',
    domain: 'brand',
    goal: 'company_intelligence',
    entityType: 'BRAND',
    entity: brand.name,
    company: brand.company || brand.name,
    target: 'Company Profile',
    season: null,
    filters: {},
    requiredOutput: ['Company', 'Founders', 'Website', 'Industry'],
    semanticQuery: `${brand.name} Indian D2C brand founders website`,
    blockedTokens: pollutionTokensForBrand(brand.name),
    explanation: `**${brand.name}** as a brand (not generic keywords)`,
    rawMessage: '',
  }
}

function standardUnderstanding(text) {
  return {
    mode: 'standard',
    intent: null,
    domain: null,
    goal: null,
    entityType: null,
    entity: null,
    target: null,
    season: null,
    filters: {},
    requiredOutput: [],
    semanticQuery: null,
    blockedTokens: [],
    explanation: null,
    rawMessage: text,
    followUp: false,
  }
}

function detectContestantIntent(text) {
  return (
    /\b(contestants?|participants?|companies\s+featured|startups?\s+(?:from|on)|who\s+(?:all\s+)?(?:were\s+)?on)\b/i.test(
      text
    ) ||
    /\b(names?\s+of|name\s+of|list\s+(?:of\s+)?all|all\s+(?:the\s+)?names?)\b/i.test(text) ||
    /\b(information|info|details?)\b/i.test(text)
  )
}

function extractSeasonScope(text) {
  if (/\ball\s+seasons?\b/i.test(text)) return 'all'
  const m = String(text || '').match(/\bseason\s+(\d+)\b/i)
  return m ? m[1] : null
}

function matchFirst(text, list) {
  for (const item of list) {
    if (item.pattern.test(text)) return item
  }
  return null
}

function detectExporterPreference(text) {
  return (
    /\b(prefer|prioriti[sz]e|especially|also\s+(?:want|need|prefer))\b/i.test(text) &&
    /\bexport/i.test(text)
  )
}

function detectExporterFilter(text) {
  if (detectExporterPreference(text) && !/\b(only|just|exclusively)\s+export/i.test(text)) {
    return false
  }
  return (
    /\b(only\s+export|exporters?\s+only|who\s+(?:all\s+)?(?:do\s+)?export|exporters?|exporting|that\s+export|who\s+export)\b/i.test(
      text
    ) || /\bexport\s+(?:status|countries|markets)\b/i.test(text)
  )
}

function buildTradeShowSemanticQuery(show, { exporterOnly, industry }) {
  const parts = [show, 'exhibitors', 'companies', 'India']
  if (industry) parts.push(industry)
  if (exporterOnly) parts.push('exporters')
  return parts.join(' ')
}

function buildMarketplaceSemanticQuery(marketplace, { industry, exporterOnly }) {
  const parts = ['India', industry || 'companies', 'selling on', marketplace]
  if (exporterOnly) parts.push('exporters', 'exporting')
  return parts.filter(Boolean).join(' ')
}

function pollutionTokensForEntity(entityName) {
  const lower = String(entityName || '').toLowerCase()
  const tokens = []
  if (lower.includes('shark')) tokens.push('shark')
  if (lower.includes('tank')) tokens.push('tank')
  return tokens
}

function pollutionTokensForBrand(brandName) {
  const n = String(brandName || '').toLowerCase()
  if (n === 'boat' || n === 'boat') return ['boat', 'shipping', 'marine', 'vessel']
  if (n.includes('mamaearth')) return ['earth', 'agriculture', 'soil']
  return []
}

export function applyQueryUnderstanding(salesIntent, understanding) {
  if (!understanding || understanding.mode === 'standard') return salesIntent

  const out = { ...salesIntent, queryUnderstanding: understanding }

  if (understanding.semanticQuery) {
    out.naturalQuery = understanding.semanticQuery
    out.filters = { ...out.filters, keywords: understanding.semanticQuery }
  }

  if (understanding.mode === 'knowledge_lookup') {
    out.category = 'knowledge_lookup'
    out.isKnowledgeLookup = true
    out.isEntityResearch = false
    out.isLeadGeneration = false
    out.isPersonDiscovery = false
    out.needsIndustryClarification = false
    out.needsExportClarification = false
    out.entities = {
      ...out.entities,
      company: understanding.entity || '',
      keywords: understanding.semanticQuery,
      naturalQuery: understanding.semanticQuery,
    }
  }

  if (understanding.mode === 'entity_research') {
    out.category = 'entity_research'
    out.isEntityResearch = true
    out.isKnowledgeLookup = false
    out.isLeadGeneration = understanding.goal === 'lead_generation'
    out.isPersonDiscovery = false
    out.needsIndustryClarification = false
    out.needsExportClarification = false
    out.entities = {
      ...out.entities,
      company: understanding.entity || '',
      product: understanding.filters?.industry || out.entities.product,
      keywords: understanding.semanticQuery,
      naturalQuery: understanding.semanticQuery,
    }
  }

  if (understanding.mode === 'person_at_brand') {
    out.category = 'person_discovery'
    out.isPersonDiscovery = true
    out.isLeadGeneration = false
    out.isEntityResearch = false
    out.isKnowledgeLookup = false
    out.targetCompany = understanding.company || understanding.entity
    out.targetRole = understanding.target
    out.entities = {
      ...out.entities,
      company: understanding.company || understanding.entity,
      personRole: understanding.target,
    }
  }

  return out
}

export function isPollutedDiscoveryResult(company, understanding) {
  const name = String(company?.company || company?.name || '').toLowerCase().trim()
  if (!name || !understanding) return false

  const blocked = understanding.blockedTokens || []
  if (!blocked.length) return false

  const hasShark = blocked.includes('shark') && /^shark\b/.test(name)
  const hasTank = blocked.includes('tank') && /\btank\b/.test(name)
  const exporty = /\b(exports?|exim|trading|trade|marine|shipping)\b/i.test(name)

  if (understanding.entityType === 'TV_SHOW') {
    if (hasShark && exporty && !/shark\s+tank/i.test(name)) return true
    if (hasTank && exporty && !/shark\s+tank/i.test(name)) return true
    if (/^shark\s+.*\b(exports?|exim)\b/i.test(name)) return true
    if (/^tank\s+.*\b(exports?|exim)\b/i.test(name)) return true
  }

  if (understanding.entityType === 'BRAND') {
    if (blocked.includes('boat') && /\b(shipping|marine|vessel|logistics|freight)\b/i.test(name)) return true
    if (blocked.includes('earth') && /\b(agri|agriculture|soil|farm)\b/i.test(name) && !/mamaearth/i.test(name)) {
      return true
    }
  }

  return false
}

export function buildUnderstandingFromQue(understanding) {
  return understanding?.explanation || null
}

export function buildExecutionPlan(understanding) {
  if (!understanding || understanding.mode === 'standard') return []

  const steps = [
    { id: 'nlu', label: 'Understanding your objective', status: 'done' },
    { id: 'entity', label: `Entity: ${understanding.entity} (${understanding.entityType})`, status: 'done' },
  ]

  if (understanding.followUp) {
    steps.push({ id: 'memory', label: 'Using conversation context', status: 'done' })
  }

  if (understanding.mode === 'knowledge_lookup') {
    steps.push({ id: 'knowledge', label: 'Knowledge lookup — not keyword search', status: 'done' })
    if (understanding.season) {
      steps.push({
        id: 'season',
        label: understanding.season === 'all' ? 'All seasons' : `Season ${understanding.season}`,
        status: 'done',
      })
    }
    steps.push({ id: 'sources', label: 'Searching verified public sources', status: 'done' })
    if (understanding.filters?.linkedin) {
      steps.push({ id: 'linkedin', label: 'Collecting LinkedIn profiles', status: 'done' })
    }
    steps.push({ id: 'crm', label: 'Checking CRM status', status: 'done' })
  }

  if (understanding.mode === 'entity_research') {
    steps.push({ id: 'crm', label: 'Checking CRM for duplicates', status: 'done' })
    steps.push({ id: 'search', label: 'Semantic company search', status: 'done' })
    if (understanding.filters?.exporter) {
      steps.push({ id: 'export', label: 'Filtering exporters', status: 'done' })
    }
  }

  if (understanding.mode === 'person_at_brand') {
    steps.push({ id: 'crm', label: 'Checking CRM', status: 'done' })
    steps.push({ id: 'people', label: 'Finding verified public profile', status: 'done' })
  }

  steps.push({ id: 'validate', label: 'Validating relevance', status: 'done' })
  steps.push({ id: 'ready', label: 'Preparing recommendations', status: 'done' })
  return steps
}

export function toPlannerJson(understanding) {
  if (!understanding || understanding.mode === 'standard') return null
  return {
    intent: understanding.intent,
    domain: understanding.domain,
    entity_type: understanding.entityType,
    entity: understanding.entity,
    requested_object: understanding.target,
    season: understanding.season,
    filters: understanding.filters,
    required_output: understanding.requiredOutput,
    semantic_query: understanding.semanticQuery,
  }
}
