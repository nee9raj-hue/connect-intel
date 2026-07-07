/**
 * Entity Research Agent — TV shows, trade shows, marketplaces (semantic, not keyword).
 */

import { discoverLeadsWithPerplexity, isPerplexityConfigured } from '../perplexity.js'
import { listPipelineSavedEntries } from '../organizations.js'
import { isDisplayableLead, normalizeLeadContact } from '../leadQuality.js'
import { discoveryCountForDepth } from './salesIntent.js'
import { buildV4Reply } from './structuredResponse.js'
import { buildNBSA } from './nbsa.js'
import { saveDiscoverySession, buildDiscoveryActions } from './discoveryMemory.js'
import { rankDiscoveryCompanies } from './companyRanker.js'
import {
  isPollutedDiscoveryResult,
  buildUnderstandingFromQue,
  buildExecutionPlan,
} from './queryUnderstanding.js'
import { buildApproachNarrative } from './businessGoal.js'

const ASSOCIATION_RE =
  /\b(association|federation|council|chamber of commerce|directory|fieo|epch|wikipedia|news article)\b/i

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
      byKey.set(key, { leadId: entry.lead?.id || entry.id, company, status: entry.crm?.status || 'new' })
    }
  }
  return byKey
}

function shapeCompany(lead, index, crmIndex, understanding) {
  const normalized = normalizeLeadContact(lead)
  const company = String(normalized.company || '').trim()
  const key = normCompanyKey(company)
  const crm = crmIndex.get(key)
  const website = normalized.companyDomain || normalized.website || ''

  return {
    id: normalized.id || `ent-${index}`,
    name: company,
    company,
    contactName: [normalized.firstName, normalized.lastName].filter(Boolean).join(' '),
    title: normalized.title || '',
    email: normalized.email || '',
    phone: normalized.phone || '',
    website: website && !website.includes('://') ? `https://${website}` : website,
    industry: normalized.industry || understanding.filters?.industry || '',
    products: normalized.products || '',
    exportMarkets: normalized.exportMarkets || '',
    linkedinUrl: normalized.linkedin || '',
    city: normalized.city || '',
    state: normalized.state || '',
    crmStatus: crm ? `In CRM · ${crm.status}` : 'New lead',
    leadId: crm?.leadId || null,
    inCrm: Boolean(crm),
    selectionReason: `Featured on ${understanding.entity}`,
  }
}

export async function runEntityResearchAgent({ store, user, message, understanding, salesIntent, thread }) {
  const u = understanding
  const count = discoveryCountForDepth(salesIntent?.researchDepth || 'standard')
  const planSteps = buildExecutionPlan(u)
  const explanation = buildUnderstandingFromQue(u)

  if (!isPerplexityConfigured()) {
    return emptyResult({
      explanation,
      planSteps,
      message: 'Market Intelligence needs web search configured on the server.',
    })
  }

  const discovery = await discoverLeadsWithPerplexity(
    { keywords: u.semanticQuery, cities: [], states: [] },
    count,
    {
      naturalQuery: u.semanticQuery,
      semanticQuery: u.semanticQuery,
      intent: 'find_companies',
      copilotFast: salesIntent?.researchDepth !== 'deep',
    }
  ).catch(() => ({ leads: [], error: 'Research timed out' }))

  const crmIndex = buildCrmIndex(store, user)
  let companies = (discovery.leads || [])
    .filter((lead) => isDisplayableLead(lead))
    .filter((lead) => !ASSOCIATION_RE.test(String(lead.company || lead.name || '')))
    .filter((lead) => !isPollutedDiscoveryResult(lead, u))
    .slice(0, count)
    .map((lead, i) => shapeCompany(lead, i, crmIndex, u))

  companies = rankDiscoveryCompanies(companies, { exportCountries: salesIntent?.exportCountries || [] })

  if (!companies.length) {
    return {
      reply: buildV4Reply({
        approach: `I understand you're looking for ${explanation}. I resolved **${u.entity}** as a **${u.entityType?.replace('_', ' ')}** — not as separate keywords.`,
        whatIFound: `No verified **${u.target?.toLowerCase() || 'results'}** yet for **${u.entity}**${u.filters?.exporter ? ' that export' : ''}.`,
        whyItMatters:
          'I deliberately avoided junk matches like random "Shark Exports" companies — only entities linked to your request count.',
        nbsa: 'Try narrowing — e.g. add an industry, or ask for a specific season of the show.',
      }),
      source: 'entity_research',
      sources: [{ type: 'web', label: 'Semantic research' }],
      confidence: 'low',
      companies: [],
      planSteps,
      suggestions: [`${u.entity} founders list`, `${u.entity} exporters only`, 'Add top match to CRM'],
      actions: [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }],
    }
  }

  const inCrm = companies.filter((c) => c.inCrm).length
  const nbsa = buildNBSA({
    plan: { intentCategory: 'entity_research' },
    companies,
    discoveryMeta: { total: companies.length, inCrm, newLeads: companies.length - inCrm },
  })

  const reply = buildV4Reply({
    approach: `${buildApproachNarrative('entity_research')} ${explanation}. I treated **${u.entity}** as a single named entity — not keyword fragments.`,
    whatIFound: `**${companies.length}** ${u.target?.toLowerCase() || 'companies'} linked to **${u.entity}**${u.filters?.exporter ? ' with export activity' : ''}.`,
    whyItMatters:
      inCrm > 0
        ? `**${companies.length - inCrm}** are new to your CRM · **${inCrm}** already saved — prioritize net-new outreach.`
        : 'These are curated from the show/context you named — not generic keyword matches.',
    crmFindings: [
      inCrm > 0
        ? `**${inCrm}** in CRM · **${companies.length - inCrm}** new`
        : `**${companies.length}** new prospects`,
    ],
    externalFindings: [
      `Semantic search: ${u.semanticQuery}`,
      'Keyword pollution filtered (e.g. unrelated "Shark Exports")',
    ],
    nbsa,
  })

  saveDiscoverySession(thread, {
    query: u.semanticQuery,
    intent: 'entity_research',
    companies,
    totalFound: companies.length,
    researchDepth: salesIntent?.researchDepth,
  })

  return {
    reply,
    understanding: explanation,
    nbsa,
    source: 'entity_research',
    sources: [
      { type: 'crm', label: 'CRM checked' },
      { type: 'web', label: 'Semantic research' },
    ],
    confidence: companies.length >= 3 ? 'high' : 'medium',
    companies: companies.slice(0, 20),
    planSteps,
    suggestions: [
      'Only exporters',
      'Only companies with public email',
      'Find founder at top company',
      'Add top 3 to CRM',
    ],
    actions: buildDiscoveryActions(companies),
    discoveryMeta: {
      total: companies.length,
      inCrm,
      newLeads: companies.length - inCrm,
      query: u.semanticQuery,
      entity: u.entity,
      entityType: u.entityType,
    },
  }
}

function emptyResult({ explanation, planSteps, message }) {
  return {
    reply: buildV4Reply({
      approach: `I understand you're looking for ${explanation}.`,
      whatIFound: message,
      whyItMatters: 'Semantic understanding is ready — web search needs to be enabled.',
    }),
    source: 'entity_research',
    confidence: 'low',
    companies: [],
    planSteps,
    actions: [],
  }
}
