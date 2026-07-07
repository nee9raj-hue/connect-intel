/**
 * Lead Discovery Agent — companies, not articles or associations.
 */

import { discoverLeadsWithPerplexity, isPerplexityConfigured } from '../perplexity.js'
import { listPipelineSavedEntries } from '../organizations.js'
import { isDisplayableLead, normalizeLeadContact } from '../leadQuality.js'
import { inferSalesIntent, discoveryCountForDepth } from './salesIntent.js'
import { buildUnderstandingLine } from './entityExtractor.js'
import { buildV4Reply } from './structuredResponse.js'
import { buildNBSA } from './nbsa.js'
import { buildApproachNarrative } from './businessGoal.js'
import {
  rankDiscoveryCompanies,
  summarizeRankedCompanies,
  topProspectSummary,
} from './companyRanker.js'
import { isPollutedDiscoveryResult } from './queryUnderstanding.js'
import {
  buildDiscoveryActions,
  buildPlanSteps,
  saveDiscoverySession,
} from './discoveryMemory.js'

const ASSOCIATION_RE =
  /\b(association|federation|council|chamber of commerce|directory|exporters?\s+india|fieo|epch|cepc|fiie|trade\s+body|confederation|all india|government of|ministry)\b/i

const COPILOT_DISCOVERY_TIMEOUT_MS = 52_000

function withDiscoveryTimeout(promise, ms = COPILOT_DISCOVERY_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('discovery_timeout')), ms)
    }),
  ])
}

const ARTICLE_RE =
  /^(top\s+\d+|best\s+\d+|list of|how to|what is|guide to|complete guide)/i

function isRealCompany(lead) {
  const company = String(lead.company || lead.name || '').trim()
  if (!company || company.length < 3) return false
  if (ASSOCIATION_RE.test(company)) return false
  if (ARTICLE_RE.test(company)) return false
  if (/\b(wikipedia|linkedin\.com\/posts|blog|news)\b/i.test(company)) return false
  return isDisplayableLead(lead)
}

function normCompanyKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(pvt|ltd|limited|llp|inc|corp|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function buildCrmIndex(store, user) {
  const entries = listPipelineSavedEntries(store, user)
  const byKey = new Map()
  for (const entry of entries) {
    const company = entry.lead?.company || ''
    const key = normCompanyKey(company)
    if (!key) continue
    if (!byKey.has(key)) {
      byKey.set(key, {
        leadId: entry.lead?.id || entry.id,
        company,
        status: entry.crm?.status || 'new',
      })
    }
  }
  return byKey
}

function shapeDiscoveryCompany(lead, index, crmIndex) {
  const normalized = normalizeLeadContact(lead)
  const company = String(normalized.company || '').trim()
  const key = normCompanyKey(company)
  const crm = crmIndex.get(key)

  const website = normalized.companyDomain || normalized.website || ''
  const linkedin = normalized.linkedin || ''

  return {
    id: normalized.id || `disc-${index}`,
    name: company,
    company,
    firstName: normalized.firstName || '',
    lastName: normalized.lastName || '',
    contactName: [normalized.firstName, normalized.lastName].filter(Boolean).join(' '),
    title: normalized.title || '',
    email: normalized.email || '',
    phone: normalized.phone || '',
    website: website && !website.includes('://') ? `https://${website}` : website,
    companyDomain: normalized.companyDomain || '',
    linkedinUrl: linkedin,
    city: normalized.city || '',
    state: normalized.state || '',
    location: normalized.location || [normalized.city, normalized.state].filter(Boolean).join(', '),
    industry: normalized.industry || '',
    products: normalized.products || '',
    exportMarkets: normalized.exportMarkets || '',
    score: normalized.score || Math.max(70, 95 - index),
    crmStatus: crm ? `In CRM · ${crm.status}` : 'New lead',
    leadId: crm?.leadId || null,
    inCrm: Boolean(crm),
  }
}

function crossRefWithCrm(companies, crmIndex) {
  return companies.map((c) => {
    const key = normCompanyKey(c.company || c.name)
    const crm = crmIndex.get(key)
    if (!crm) return c
    return {
      ...c,
      crmStatus: `In CRM · ${crm.status}`,
      leadId: crm.leadId,
      inCrm: true,
    }
  })
}

export async function runLeadDiscoveryAgent({ store, user, message, salesIntent, thread }) {
  const intent = salesIntent || inferSalesIntent(message)
  const count = discoveryCountForDepth(intent.researchDepth)

  if (!isPerplexityConfigured()) {
    return {
      reply:
        '**Answer:** Market Intelligence needs web search configured.\n\n**Next step:** Use the **CRM** tab for pipeline queries, or ask your admin to enable web search.',
      source: 'discovery_error',
      sources: [{ type: 'copilot', label: 'Market Intelligence' }],
      confidence: 'low',
      companies: [],
      planSteps: buildPlanSteps(),
      suggestions: ['Who needs follow-up today?', 'How many leads in my pipeline?'],
      actions: [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }],
    }
  }

  const discovery = await withDiscoveryTimeout(
    discoverLeadsWithPerplexity(intent.filters, count, {
      naturalQuery: intent.naturalQuery,
      intent: intent.isDecisionMaker ? 'find_people' : 'find_companies',
      targetCompany: intent.targetCompany,
      targetRole: intent.targetRole,
      copilotFast: intent.researchDepth !== 'deep',
    })
  ).catch((err) => {
    if (err?.message === 'discovery_timeout') {
      return {
        leads: [],
        error:
          'Company search timed out. Try **quick** mode — e.g. "quick toy exporters in Delhi" — or narrow to one city.',
      }
    }
    throw err
  })

  const rawLeads = (discovery.leads || [])
    .filter(isRealCompany)
    .filter((lead) => !isPollutedDiscoveryResult(lead, salesIntent?.queryUnderstanding))
  const crmIndex = buildCrmIndex(store, user)

  let companies = rawLeads
    .slice(0, count)
    .map((lead, i) => shapeDiscoveryCompany(lead, i, crmIndex))

  companies = crossRefWithCrm(companies, crmIndex)
  companies = rankDiscoveryCompanies(companies, { exportCountries: intent.exportCountries })

  const inCrm = companies.filter((c) => c.inCrm).length
  const location =
    intent.filters.cities?.[0] ||
    intent.filters.states?.[0] ||
    extractLocationLabel(intent.naturalQuery)

  const product = intent.filters.keywords || intent.naturalQuery

  if (!companies.length) {
    return {
      reply: `**Answer:** No qualified **companies** found for **${product}**${location ? ` in **${location}**` : ''}.\n\n**Next step:** Try a more specific product + city — e.g. "toy manufacturers in Noida exporting to USA".`,
      source: 'discovery',
      sources: [{ type: 'web', label: 'Market Intelligence' }],
      confidence: 'low',
      companies: [],
      planSteps: buildPlanSteps(),
      suggestions: [
        'Toy exporters in Delhi NCR',
        'Plastic manufacturers in Gujarat',
        'Textile exporters in Ludhiana',
      ],
      actions: [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }],
      discoveryMeta: { total: 0, query: intent.naturalQuery },
    }
  }

  const topCard = companies[0]
  const understanding = buildUnderstandingLine({
    intentCategory: 'lead_generation',
    entities: intent.entities,
    message,
  })
  const nbsa = buildNBSA({
    plan: { intentCategory: 'lead_generation' },
    companies,
    discoveryMeta: { total: companies.length, inCrm, newLeads: companies.length - inCrm },
  })
  const topSummaries = topProspectSummary(companies, 3)
  const reply = buildV4Reply({
    approach: `${buildApproachNarrative('lead_generation')} ${understanding}.`,
    whatIFound: buildDiscoveryWhatIFound({ companies, product, location, intent }),
    whyItMatters: buildDiscoveryWhyItMatters({ companies, topSummaries, inCrm }),
    crmFindings: [
      inCrm > 0
        ? `**${inCrm}** already in CRM · **${companies.length - inCrm}** new prospects`
        : `**${companies.length}** new prospects — none in CRM yet`,
    ],
    externalFindings: [
      `${companies.length} verified companies (associations & directories excluded)`,
      summarizeRankedCompanies(companies),
      'Public websites, contacts, and export signals where available',
    ],
    nbsa,
  })

  saveDiscoverySession(thread, {
    query: intent.naturalQuery,
    intent: intent.category,
    companies,
    totalFound: companies.length,
    researchDepth: intent.researchDepth,
  })

  return {
    reply,
    understanding: `I understand you're looking for ${understanding}.`,
    nbsa,
    source: 'discovery',
    sources: [
      { type: 'crm', label: 'CRM checked' },
      { type: 'web', label: 'Market Intelligence' },
    ],
    confidence: companies.length >= 5 ? 'high' : 'medium',
    companies: companies.slice(0, 20),
    companyCard: topCard,
    planSteps: buildPlanSteps(),
    suggestions: [
      'Only exporting to USA',
      'Only Delhi NCR',
      'Find decision makers at top company',
      'Draft outreach email',
    ],
    actions: buildDiscoveryActions(companies),
    discoveryMeta: {
      total: companies.length,
      inCrm,
      newLeads: companies.length - inCrm,
      query: intent.naturalQuery,
      researchDepth: intent.researchDepth,
      method: discovery.method,
    },
  }
}

function extractLocationLabel(query) {
  const m = String(query || '').match(
    /\b(delhi ncr|noida|gurugram|gurgaon|mumbai|ludhiana|surat|chennai|hyderabad|pune|jaipur)\b/i
  )
  return m?.[1] || ''
}

function buildDiscoveryWhatIFound({ companies, product, location, intent }) {
  const total = companies.length
  const locPart = location ? ` in **${location}**` : ''
  const depthLabel =
    intent.researchDepth === 'deep' ? ' (deep scan)' : intent.researchDepth === 'quick' ? ' (quick)' : ''
  return `I found **${total}** qualified companies${locPart} for **${product}**${depthLabel}. ${summarizeRankedCompanies(companies)}.`
}

function buildDiscoveryWhyItMatters({ companies, topSummaries, inCrm }) {
  const newCount = companies.length - inCrm
  if (topSummaries.length) {
    return `I'd contact these first: ${topSummaries.join('; ')}. ${newCount > 0 ? `**${newCount}** are not in CRM yet.` : ''}`
  }
  return newCount > 0
    ? `**${newCount}** prospects are not in CRM — good candidates for outbound.`
    : 'Most matches are already in CRM — open those records before duplicate outreach.'
}

function buildDiscoveryAnswer({ companies, product, location, inCrm, intent }) {
  const total = companies.length
  const locPart = location ? ` in **${location}**` : ''
  const depthLabel =
    intent.researchDepth === 'deep' ? ' (deep scan)' : intent.researchDepth === 'quick' ? ' (quick)' : ''
  return `I found **${total}** qualified companies${locPart} for **${product}**${depthLabel}.`
}

function buildDiscoveryReply({ companies, product, location, inCrm, intent }) {
  const total = companies.length
  const locPart = location ? ` in **${location}**` : ''
  const depthLabel =
    intent.researchDepth === 'deep' ? ' (deep scan)' : intent.researchDepth === 'quick' ? ' (quick)' : ''

  const newCount = total - inCrm
  const crmLine =
    inCrm > 0
      ? `**${inCrm}** already in CRM · **${newCount}** new prospects`
      : `**${newCount}** new prospects — none in CRM yet`

  return `**Answer:** Found **${total}** qualified companies${locPart} for **${product}**${depthLabel}.\n\n**CRM findings:**\n- ${crmLine}\n\n**Web findings:**\n- ${total} companies with websites, contacts, and export signals\n- Associations and directories excluded\n\n**Next step:** Review cards below → **Save** to CRM or **Draft outreach**.`
}
