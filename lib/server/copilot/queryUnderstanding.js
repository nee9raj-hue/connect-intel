/**
 * AI Query Understanding Engine (AI-QUE) — semantic NLU before any search.
 * Never search for tokenized keywords when a named entity carries the meaning.
 */

const TV_SHOW_ENTITIES = [
  { pattern: /\bshark\s+tank\s+india\b/i, name: 'Shark Tank India' },
  { pattern: /\bshark\s+tank\s+(?:season\s+\d+)?\b/i, name: 'Shark Tank India' },
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

const DEFAULT_CONTESTANT_OUTPUT = [
  'Company',
  'Founder',
  'Product',
  'Website',
  'Export Status',
  'Export Countries',
  'Decision Maker',
  'LinkedIn',
  'CRM Status',
]

export function understandCopilotQuery(message) {
  const text = String(message || '').trim()
  if (!text) return standardUnderstanding(text)

  const tvShow = matchFirst(text, TV_SHOW_ENTITIES)
  const brand = tvShow ? null : matchFirst(text, BRAND_ENTITIES)
  const marketplace = matchFirst(text, MARKETPLACE_ENTITIES)
  const tradeShow = tvShow || brand ? null : matchFirst(text, TRADE_SHOW_ENTITIES)

  const wantsContestants = /\b(contestants?|participants?|companies\s+featured|startups?\s+(?:from|on)|who\s+(?:all\s+)?(?:were\s+)?on)\b/i.test(
    text
  )
  const wantsInformation = /\b(information|info|details?|list|all)\b/i.test(text)
  const exporterFilter = detectExporterFilter(text)
  const industry = text.match(INDUSTRY_RE)?.[1] || ''
  const role = text.match(ROLE_RE)?.[1]?.replace(/\./g, '') || ''

  if (tvShow && (wantsContestants || wantsInformation || /\bfrom\b/i.test(text))) {
    return {
      mode: 'entity_research',
      goal: exporterFilter ? 'lead_generation' : 'entity_research',
      entityType: 'TV_SHOW',
      entity: tvShow.name,
      target: 'Contestants',
      filters: { exporter: exporterFilter, industry: industry || null },
      requiredOutput: DEFAULT_CONTESTANT_OUTPUT,
      semanticQuery: buildTvShowSemanticQuery(tvShow.name, { exporterOnly: exporterFilter, industry }),
      blockedTokens: pollutionTokensForEntity(tvShow.name),
      explanation: exporterFilter
        ? `companies featured on **${tvShow.name}** that **export**`
        : `contestants and companies from **${tvShow.name}**`,
      rawMessage: text,
    }
  }

  if (tradeShow && (wantsContestants || wantsInformation || exporterFilter)) {
    return {
      mode: 'entity_research',
      goal: 'lead_generation',
      entityType: 'TRADE_SHOW',
      entity: tradeShow.name,
      target: 'Exhibitors',
      filters: { exporter: exporterFilter, industry: industry || null },
      requiredOutput: DEFAULT_CONTESTANT_OUTPUT,
      semanticQuery: buildTradeShowSemanticQuery(tradeShow.name, { exporterOnly: exporterFilter, industry }),
      blockedTokens: [],
      explanation: `exhibitors at **${tradeShow.name}**${exporterFilter ? ' who export' : ''}`,
      rawMessage: text,
    }
  }

  if (brand && role) {
    return {
      mode: 'person_at_brand',
      goal: 'find_decision_maker',
      entityType: 'BRAND',
      entity: brand.name,
      company: brand.company || brand.name,
      target: role,
      filters: {},
      requiredOutput: ['Person', 'Role', 'LinkedIn', 'Company'],
      semanticQuery: `${brand.name} ${role} India official LinkedIn`,
      blockedTokens: pollutionTokensForBrand(brand.name),
      explanation: `the **${role}** of **${brand.name}**`,
      rawMessage: text,
    }
  }

  if (brand && !role && /\b(company|brand|about|research)\b/i.test(text)) {
    return {
      mode: 'entity_research',
      goal: 'company_intelligence',
      entityType: 'BRAND',
      entity: brand.name,
      company: brand.company || brand.name,
      target: 'Company Profile',
      filters: {},
      requiredOutput: ['Company', 'Founders', 'Website', 'Industry'],
      semanticQuery: `${brand.name} Indian D2C brand founders website`,
      blockedTokens: pollutionTokensForBrand(brand.name),
      explanation: `**${brand.name}** as a brand (not generic keywords)`,
      rawMessage: text,
    }
  }

  if (marketplace) {
    return {
      mode: 'entity_research',
      goal: 'lead_generation',
      entityType: 'MARKETPLACE',
      entity: marketplace.name,
      target: 'Sellers',
      filters: { exporter: exporterFilter, industry: industry || null },
      requiredOutput: DEFAULT_CONTESTANT_OUTPUT,
      semanticQuery: buildMarketplaceSemanticQuery(marketplace.name, { industry, exporterOnly: exporterFilter }),
      blockedTokens: [],
      explanation: `**${industry || 'companies'}** on **${marketplace.name}**${exporterFilter ? ' that export' : ''}`,
      rawMessage: text,
    }
  }

  return standardUnderstanding(text)
}

function standardUnderstanding(text) {
  return {
    mode: 'standard',
    goal: null,
    entityType: null,
    entity: null,
    target: null,
    filters: {},
    requiredOutput: [],
    semanticQuery: null,
    blockedTokens: [],
    explanation: null,
    rawMessage: text,
  }
}

function matchFirst(text, list) {
  for (const item of list) {
    if (item.pattern.test(text)) return item
  }
  return null
}

function detectExporterFilter(text) {
  return (
    /\b(who\s+(?:all\s+)?(?:do\s+)?export|exporters?|exporting|that\s+export|who\s+export)\b/i.test(text) ||
    /\bexport\s+(?:status|countries|markets)\b/i.test(text)
  )
}

function buildTvShowSemanticQuery(show, { exporterOnly, industry }) {
  const parts = [
    show,
    'contestants',
    'startups',
    'companies',
    'founders',
    'products',
    'India',
  ]
  if (industry) parts.push(industry)
  if (exporterOnly) parts.push('companies that export internationally', 'export markets')
  return parts.join(' ')
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
  if (n === 'boat' || n === 'boAt') return ['boat', 'shipping', 'marine', 'vessel']
  if (n.includes('mamaearth') || n === 'mamaearth') return ['earth', 'agriculture', 'soil']
  return []
}

export function applyQueryUnderstanding(salesIntent, understanding) {
  if (!understanding || understanding.mode === 'standard') return salesIntent

  const out = { ...salesIntent, queryUnderstanding: understanding }

  if (understanding.semanticQuery) {
    out.naturalQuery = understanding.semanticQuery
    out.filters = {
      ...out.filters,
      keywords: understanding.semanticQuery,
    }
  }

  if (understanding.mode === 'entity_research') {
    out.category = 'entity_research'
    out.isEntityResearch = true
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
  if (!understanding?.explanation) return null
  return understanding.explanation
}

export function buildExecutionPlan(understanding) {
  if (!understanding || understanding.mode === 'standard') return []

  const steps = [
    { id: 'nlu', label: 'Understanding named entities', status: 'done' },
    { id: 'resolve', label: `Resolved: ${understanding.entity} (${understanding.entityType})`, status: 'done' },
  ]

  if (understanding.mode === 'entity_research') {
    steps.push({ id: 'crm', label: 'Checking CRM for duplicates', status: 'done' })
    steps.push({
      id: 'research',
      label: `Researching ${understanding.target?.toLowerCase() || 'targets'}`,
      status: 'done',
    })
    if (understanding.filters?.exporter) {
      steps.push({ id: 'export', label: 'Filtering export-active companies', status: 'done' })
    }
    steps.push({ id: 'founders', label: 'Finding founders & decision makers', status: 'done' })
    steps.push({ id: 'rank', label: 'Ranking & validating results', status: 'done' })
  }

  if (understanding.mode === 'person_at_brand') {
    steps.push({ id: 'crm', label: 'Checking CRM', status: 'done' })
    steps.push({ id: 'people', label: 'Finding verified public profile', status: 'done' })
  }

  steps.push({ id: 'ready', label: 'Preparing recommendations', status: 'done' })
  return steps
}
