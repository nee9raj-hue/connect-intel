import { buildStructuredReply, bulletsFromText, extractNewsLines } from './structuredResponse.js'

export function extractLeadGenQuery(message) {
  const text = String(message || '').trim()
  const quoted = text.match(/["']([^"']+)["']/)
  if (quoted) return quoted[1].trim()

  const patterns = [
    /\bfind\s+(.+?)(?:\s+exporting|\s+in\s+|\s*$)/i,
    /\b(?:exporters?|manufacturers?|suppliers?|companies?)\s+(?:in|from|at)\s+(.+)/i,
    /\bsearch\s+(?:for\s+)?(.+)/i,
    /\bresearch\s+(.+)/i,
  ]

  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1].trim().slice(0, 140)
  }

  return text.slice(0, 140)
}

function parseCompanyFieldsFromWeb(webText) {
  const text = String(webText || '')
  const fields = {}

  const industry = text.match(/\bindustry[:\s]+([^\n.]+)/i)
  if (industry) fields.industry = industry[1].trim().slice(0, 80)

  const hq = text.match(/\b(?:HQ|headquarters|based in)[:\s]+([^\n.]+)/i)
  if (hq) fields.headquarters = hq[1].trim().slice(0, 80)

  const employees = text.match(/\b(\d[\d,]+)\s*(?:employees|staff)/i)
  if (employees) fields.employeeSize = employees[1]

  const exportMarkets = text.match(/\bexport(?:s|ing)?\s+to[:\s]+([^\n.]+)/i)
  if (exportMarkets) fields.exportMarkets = exportMarkets[1].trim().slice(0, 120)

  const linkedin = text.match(/(https?:\/\/(?:www\.)?linkedin\.com\/company\/[^\s)\]]+)/i)
  if (linkedin) fields.linkedinUrl = linkedin[1]

  const website = text.match(/(https?:\/\/(?!linkedin)[^\s)\]]+)/i)
  if (website && !/linkedin/i.test(website[1])) fields.website = website[1]

  const products = text.match(/\bproducts?[:\s]+([^\n.]+)/i)
  if (products) fields.products = products[1].trim().slice(0, 100)

  return fields
}

function buildCompanyCardFromMerge({ crmSearch, webText, query }) {
  const card = { name: '', ...parseCompanyFieldsFromWeb(webText) }

  const topCrm = crmSearch?.results?.[0]
  if (topCrm) {
    card.name = topCrm.title?.split(' · ')[0] || topCrm.title || card.name
    card.crmStatus = topCrm.leadId ? `In CRM · open record` : `CRM match`
    card.leadId = topCrm.leadId || null
    card.ownerName = topCrm.subtitle || ''
  }

  if (!card.name) {
    const q = String(query || '').match(/([A-Z][A-Za-z0-9&.' -]{2,40})/)
    card.name = q?.[1] || extractLeadGenQuery(query).slice(0, 48) || 'Company'
  }

  if (crmSearch?.results?.length > 1) {
    card.crmStatus = `${crmSearch.results.length} matches in CRM`
  } else if (!crmSearch?.results?.length) {
    card.crmStatus = 'Not in CRM yet'
  }

  card.newsHeadline = extractNewsLines(webText)[0] || ''

  return card
}

export function processLeadGenerationReply({ message, webRaw, crmSearch, plan }) {
  const webText = webRaw?.text || ''
  const query = plan.crmCrossRefQuery || extractLeadGenQuery(message)

  if (webRaw?.error && !webText) {
    return {
      reply: buildStructuredReply({
        shortAnswer: webRaw.error,
        crmFindings: crmSearch?.results?.length
          ? crmSearch.results.slice(0, 4).map((r) => `**${r.title}**${r.subtitle ? ` — ${r.subtitle}` : ''}`)
          : ['No CRM match — try a different spelling'],
        nextStep: 'Refine company name or industry in your search.',
      }),
      source: 'web_error',
      sources: [
        { type: 'crm', label: 'CRM check' },
        { type: 'web', label: 'Web research' },
      ],
      confidence: 'low',
      suggestions: [],
      actions: [],
    }
  }

  const webBullets = bulletsFromText(webText, 8)
  const newsLines = extractNewsLines(webText)
  const crmLines =
    crmSearch?.results?.length > 0
      ? crmSearch.results.slice(0, 5).map((r) => {
          const id = r.leadId ? ` (CRM)` : ''
          return `**${r.title}**${r.subtitle ? ` — ${r.subtitle}` : ''}${id}`
        })
      : ['No existing CRM record — safe to add as new lead']

  const companyCard = buildCompanyCardFromMerge({ crmSearch, webText, query })

  const shortAnswer = plan.intents?.leadGeneration
    ? `Found market intelligence for **${companyCard.name}**${crmSearch?.results?.length ? ' — already in your CRM' : ' — not in CRM yet'}.`
    : `Researched **${companyCard.name}** — CRM checked first, then web sources.`

  const reply = buildStructuredReply({
    shortAnswer,
    crmFindings: crmLines,
    webFindings: webBullets.slice(0, 6),
    companyIntel: [
      companyCard.industry ? `Industry: ${companyCard.industry}` : null,
      companyCard.headquarters ? `HQ: ${companyCard.headquarters}` : null,
      companyCard.exportMarkets ? `Export markets: ${companyCard.exportMarkets}` : null,
      companyCard.products ? `Products: ${companyCard.products}` : null,
    ].filter(Boolean),
    recentNews: newsLines.slice(0, 2),
    nextStep: crmSearch?.results?.length
      ? 'Open the CRM record or draft outreach.'
      : 'Add to CRM and assign an owner.',
  })

  const actions = []
  if (companyCard.leadId) {
    actions.push({
      type: 'navigate',
      panel: 'pipeline',
      leadId: companyCard.leadId,
      label: 'Open CRM record',
    })
  } else {
    actions.push({
      type: 'create_lead',
      label: 'Add to CRM',
      payload: {
        company: companyCard.name,
        website: companyCard.website || '',
        industry: companyCard.industry || '',
      },
    })
  }
  actions.push({
    type: 'create_lead',
    label: 'Save lead',
    payload: {
      company: companyCard.name,
      website: companyCard.website || '',
      industry: companyCard.industry || '',
    },
  })
  if (companyCard.leadId) {
    actions.push({
      type: 'navigate',
      panel: 'pipeline',
      leadId: companyCard.leadId,
      leadTab: 'email',
      label: 'Draft outreach email',
    })
  }

  const cites = (webRaw?.citations || []).filter((u) => /^https:\/\//i.test(u)).slice(0, 4)
  for (const url of cites) {
    actions.push({ type: 'open_url', url, label: 'Source' })
  }

  return {
    reply,
    source: 'copilot',
    sources: [
      { type: 'crm', label: 'CRM first' },
      { type: 'web', label: 'Market intelligence' },
    ],
    confidence: webBullets.length >= 3 ? 'high' : 'medium',
    companyCard,
    suggestions: [
      `Find more exporters like ${companyCard.name}`,
      'Draft outreach email',
      'Assign lead owner',
    ],
    actions: actions.slice(0, 5),
  }
}
