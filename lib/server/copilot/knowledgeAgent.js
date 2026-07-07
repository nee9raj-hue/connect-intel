/**
 * Knowledge Agent — general knowledge & named-entity research (NOT lead discovery).
 * TV show contestants, brand profiles, structured factual lookup.
 */

import { fetchKnowledgeEntities, isPerplexityConfigured } from '../perplexity.js'
import { listPipelineSavedEntries } from '../organizations.js'
import { normalizeLeadContact } from '../leadQuality.js'
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

function shapeKnowledgeRow(lead, index, crmIndex, understanding) {
  const normalized = normalizeLeadContact(lead)
  const company = String(normalized.company || '').trim()
  const key = normCompanyKey(company)
  const crm = crmIndex.get(key)
  const website = normalized.companyDomain || normalized.website || ''

  return {
    id: normalized.id || `know-${index}`,
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
    season: normalized.season || understanding.season || '',
    crmStatus: crm ? `In CRM · ${crm.status}` : 'New',
    leadId: crm?.leadId || null,
    inCrm: Boolean(crm),
    selectionReason: `Featured on ${understanding.entity}`,
  }
}

export async function runKnowledgeAgent({ store, user, understanding, salesIntent, thread }) {
  const u = understanding
  const count = discoveryCountForDepth(salesIntent?.researchDepth || 'standard')
  const planSteps = buildExecutionPlan(u)
  const explanation = buildUnderstandingFromQue(u)

  if (!isPerplexityConfigured()) {
    return emptyResult(explanation, planSteps, 'Web knowledge search is not configured.')
  }

  const result = await fetchKnowledgeEntities(u.semanticQuery, {
    count: Math.min(count + 5, 25),
    entity: u.entity,
    target: u.target,
  }).catch(() => ({ leads: [], error: 'Knowledge search timed out' }))

  const crmIndex = buildCrmIndex(store, user)
  let companies = (result.leads || [])
    .filter((row) => String(row.company || row.name || '').trim().length > 2)
    .filter((row) => !isPollutedDiscoveryResult(row, u))
    .slice(0, count)
    .map((row, i) => shapeKnowledgeRow(row, i, crmIndex, u))

  if (u.filters?.exporter) {
    companies = companies.filter(
      (c) =>
        c.exportMarkets ||
        /\bexport/i.test([c.products, c.industry, c.selectionReason].join(' '))
    )
  }

  companies = rankDiscoveryCompanies(companies)

  if (!companies.length) {
    return {
      reply: buildV4Reply({
        approach: `I understand you're looking for ${explanation}. This is a **knowledge lookup** on **${u.entity}** — I did not run a generic exporter keyword search.`,
        whatIFound: `No verified contestants yet${u.season === 'all' ? ' across all seasons' : ''}.`,
        whyItMatters:
          'I searched for the show and its startups — not fragmented words like "shark" or "tank".',
        nbsa: 'Try a specific season, or ask me to add LinkedIn profiles for contestants found.',
      }),
      source: 'knowledge_lookup',
      sources: [{ type: 'web', label: 'Knowledge research' }],
      confidence: 'low',
      companies: [],
      planSteps,
      suggestions: [`${u.entity} season 1 contestants`, 'Add LinkedIn profiles', 'Which ones export?'],
      actions: [],
      queryUnderstanding: u,
    }
  }

  const inCrm = companies.filter((c) => c.inCrm).length
  const nbsa = buildNBSA({
    plan: { intentCategory: 'knowledge_lookup' },
    companies,
    discoveryMeta: { total: companies.length, inCrm, newLeads: companies.length - inCrm },
  })

  const reply = buildV4Reply({
    approach: `This is a **knowledge lookup** — **${u.entity}** (${u.entityType?.replace('_', ' ')})${u.season === 'all' ? ', all seasons' : ''}. ${explanation}.`,
    whatIFound: `**${companies.length}** contestants / startups from **${u.entity}**${u.filters?.linkedin ? ' with LinkedIn where public' : ''}.`,
    whyItMatters:
      'These are show-linked companies — not random matches from keyword search like "Shark Exports".',
    crmFindings: [`**${inCrm}** in CRM · **${companies.length - inCrm}** new`],
    externalFindings: [`Knowledge query: ${u.semanticQuery}`, 'Keyword pollution filtered'],
    nbsa,
  })

  saveDiscoverySession(thread, {
    query: u.semanticQuery,
    intent: 'knowledge_lookup',
    companies,
    totalFound: companies.length,
    researchDepth: salesIntent?.researchDepth,
    entity: u.entity,
    entityType: u.entityType,
    season: u.season,
  })

  return {
    reply,
    understanding: explanation,
    nbsa,
    source: 'knowledge_lookup',
    sources: [
      { type: 'crm', label: 'CRM checked' },
      { type: 'web', label: 'Knowledge research' },
    ],
    confidence: companies.length >= 3 ? 'high' : 'medium',
    companies: companies.slice(0, 25),
    planSteps,
    suggestions: [
      'Only exporters among these',
      'Only companies with LinkedIn',
      'Add top 3 to CRM',
      'Find founder at top company',
    ],
    actions: buildDiscoveryActions(companies),
    discoveryMeta: {
      total: companies.length,
      inCrm,
      newLeads: companies.length - inCrm,
      query: u.semanticQuery,
      entity: u.entity,
      entityType: u.entityType,
      season: u.season,
    },
    queryUnderstanding: u,
  }
}

function emptyResult(explanation, planSteps, message) {
  return {
    reply: buildV4Reply({
      approach: `I understand you're looking for ${explanation}.`,
      whatIFound: message,
      whyItMatters: 'Knowledge pipeline is ready — web search needs to be enabled.',
    }),
    source: 'knowledge_lookup',
    confidence: 'low',
    companies: [],
    planSteps,
    actions: [],
  }
}
