/**
 * Knowledge Agent — general knowledge & named-entity research (NOT lead discovery).
 */

import { fetchKnowledgeEntities, isPerplexityConfigured, discoverLinkedinForContact } from '../perplexity.js'
import { listPipelineSavedEntries } from '../organizations.js'
import { normalizeLeadContact } from '../leadQuality.js'
import { saveDiscoverySession } from './discoveryMemory.js'
import { isPollutedDiscoveryResult, buildUnderstandingFromQue } from './queryUnderstanding.js'

const KNOWLEDGE_TIMEOUT_MS = 55_000
const LINKEDIN_LOOKUP_LIMIT = 6

function normCompanyKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(pvt|ltd|limited|llp|inc|corp|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function knowledgeResultCount(u, salesIntent) {
  if (u.entityType === 'TV_SHOW' && u.season === 'all') return 25
  if (salesIntent?.researchDepth === 'deep') return 20
  return 15
}

function parseContactName(name) {
  const primary = String(name || '')
    .split('·')[0]
    .trim()
  const parts = primary.split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export function dedupeKnowledgeCompanies(rows) {
  const byKey = new Map()

  for (const row of rows) {
    const key = normCompanyKey(row.company)
    if (!key) continue

    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        ...row,
        founders: row.contactName ? [row.contactName] : [],
      })
      continue
    }

    if (row.contactName && !existing.founders.includes(row.contactName)) {
      existing.founders.push(row.contactName)
      existing.contactName = existing.founders.join(' · ')
    }
    if (!existing.linkedinUrl && row.linkedinUrl) existing.linkedinUrl = row.linkedinUrl
    if (!existing.exportMarkets && row.exportMarkets) existing.exportMarkets = row.exportMarkets
    if (!existing.season && row.season) existing.season = row.season
    if (!existing.website && row.website) existing.website = row.website
    if (!existing.products && row.products) existing.products = row.products
  }

  return Array.from(byKey.values()).map((c, i) => ({
    ...c,
    id: c.id || `know-${i}`,
    contactName: c.founders?.length ? c.founders.join(' · ') : c.contactName,
  }))
}

export function buildCompactKnowledgeReply(u, companies, { linkedinCount = 0, exportCount = 0 } = {}) {
  const season =
    u.season === 'all' ? 'all seasons' : u.season ? `season ${u.season}` : ''
  const head = `**${companies.length}** ${u.entity} contestants${season ? ` (${season})` : ''}.`
  const bits = []
  if (u.filters?.linkedin) bits.push(`**${linkedinCount}** LinkedIn profiles`)
  if (u.filters?.preferExport || u.filters?.exporter) {
    bits.push(`**${exportCount}** with export activity`)
  }
  if (!bits.length) return head
  return `${head} ${bits.join(' · ')}.`
}

function buildKnowledgePlanSteps(u, count, linkedinCount) {
  const steps = [
    {
      id: 'search',
      label: `${u.entity}${u.season === 'all' ? ' · all seasons' : ''}`,
      status: 'done',
    },
  ]
  if (u.filters?.linkedin) {
    steps.push({ id: 'linkedin', label: `LinkedIn · ${linkedinCount} found`, status: 'done' })
  }
  steps.push({ id: 'ready', label: `${count} contestants`, status: 'done' })
  return steps
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
    title: normalized.title || 'Founder',
    email: normalized.email || '',
    phone: normalized.phone || '',
    website: website && !website.includes('://') ? `https://${website}` : website,
    industry: normalized.industry || understanding.filters?.industry || '',
    products: normalized.products || '',
    exportMarkets: normalized.exportMarkets || '',
    linkedinUrl: normalized.linkedin || '',
    city: normalized.city || '',
    state: normalized.state || '',
    season: normalized.season || '',
    crmStatus: crm ? `In CRM` : 'New',
    leadId: crm?.leadId || null,
    inCrm: Boolean(crm),
  }
}

function rankKnowledgeCompanies(companies, { preferExport } = {}) {
  const score = (c) => {
    let s = 0
    if (c.linkedinUrl) s += 3
    if (c.exportMarkets) s += 2
    if (preferExport && /\bexport/i.test([c.products, c.industry, c.exportMarkets].join(' '))) s += 2
    if (c.website) s += 1
    if (c.season) s += 1
    return s
  }
  return [...companies].sort((a, b) => score(b) - score(a))
}

function countExportSignals(companies) {
  return companies.filter(
    (c) =>
      c.exportMarkets || /\bexport/i.test([c.products, c.industry].join(' '))
  ).length
}

async function enrichKnowledgeLinkedin(companies, maxLookups = LINKEDIN_LOOKUP_LIMIT) {
  const targets = companies
    .map((c, index) => ({ c, index }))
    .filter(({ c }) => !c.linkedinUrl && parseContactName(c.contactName))
    .slice(0, maxLookups)

  if (!targets.length) return companies

  const updated = [...companies]
  await Promise.all(
    targets.map(async ({ c, index }) => {
      const { firstName, lastName } = parseContactName(c.contactName)
      const { matches } = await discoverLinkedinForContact({
        firstName,
        lastName,
        company: c.company,
        title: c.title || 'Founder',
      }).catch(() => ({ matches: [] }))
      const url = matches?.[0]?.linkedin
      if (url) updated[index] = { ...updated[index], linkedinUrl: url }
    })
  )
  return updated
}

function withKnowledgeTimeout(promise, ms = KNOWLEDGE_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('knowledge_timeout')), ms)
    }),
  ])
}

export async function runKnowledgeAgent({ store, user, understanding, salesIntent, thread }) {
  const u = understanding
  const count = knowledgeResultCount(u, salesIntent)
  const explanation = buildUnderstandingFromQue(u)

  if (!isPerplexityConfigured()) {
    return emptyResult(explanation, 'Web knowledge search is not configured.')
  }

  const result = await withKnowledgeTimeout(
    fetchKnowledgeEntities(u.semanticQuery, {
      count: Math.min(count + 8, 30),
      entity: u.entity,
      entityType: u.entityType,
      preferExport: u.filters?.preferExport,
      wantLinkedIn: u.filters?.linkedin,
    })
  ).catch(() => ({ leads: [], error: 'Knowledge search timed out' }))

  const crmIndex = buildCrmIndex(store, user)
  let companies = (result.leads || [])
    .filter((row) => String(row.company || row.name || '').trim().length > 2)
    .filter((row) => !isPollutedDiscoveryResult(row, u))
    .map((row, i) => shapeKnowledgeRow(row, i, crmIndex, u))

  companies = dedupeKnowledgeCompanies(companies)

  if (u.filters?.exporter && !u.filters?.preferExport) {
    companies = companies.filter(
      (c) =>
        c.exportMarkets ||
        /\bexport/i.test([c.products, c.industry].join(' '))
    )
  }

  companies = rankKnowledgeCompanies(companies, { preferExport: u.filters?.preferExport })
  companies = companies.slice(0, count)

  if (u.filters?.linkedin) {
    companies = await enrichKnowledgeLinkedin(companies)
    companies = rankKnowledgeCompanies(companies, { preferExport: u.filters?.preferExport })
  }

  const linkedinCount = companies.filter((c) => c.linkedinUrl).length
  const exportCount = countExportSignals(companies)
  const planSteps = buildKnowledgePlanSteps(u, companies.length, linkedinCount)

  if (!companies.length) {
    const detail = result.error || result.notice || ''
    return {
      reply: `No **${u.entity}** contestants found yet.${detail ? ` ${detail}` : ''} Try a specific season.`,
      source: 'knowledge_lookup',
      sources: [{ type: 'web', label: 'Knowledge research' }],
      confidence: 'low',
      companies: [],
      planSteps,
      suggestions: [`${u.entity} season 1`, `${u.entity} season 2`],
      actions: [],
      nbsa: null,
      queryUnderstanding: u,
    }
  }

  const inCrm = companies.filter((c) => c.inCrm).length
  const reply = buildCompactKnowledgeReply(u, companies, { linkedinCount, exportCount })

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
    nbsa: null,
    source: 'knowledge_lookup',
    sources: [{ type: 'web', label: 'Knowledge research' }],
    confidence: companies.length >= 5 ? 'high' : 'medium',
    companies,
    planSteps,
    suggestions: [
      u.season === 'all' ? `${u.entity} season 1 only` : 'All seasons',
      'Only exporters',
      'Add top 3 to CRM',
    ],
    actions: buildKnowledgeActions(companies),
    discoveryMeta: {
      total: companies.length,
      inCrm,
      newLeads: companies.length - inCrm,
      intent: 'knowledge_lookup',
      entity: u.entity,
      season: u.season,
      linkedinCount,
    },
    queryUnderstanding: u,
  }
}

function buildKnowledgeActions(companies) {
  const actions = [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }]
  const firstNew = companies.find((c) => !c.leadId && c.company)
  if (firstNew) {
    actions.unshift({
      type: 'create_lead',
      label: 'Add to CRM',
      payload: {
        company: firstNew.company,
        website: firstNew.website || '',
        industry: firstNew.industry || '',
        linkedin: firstNew.linkedinUrl || '',
        firstName: parseContactName(firstNew.contactName)?.firstName || '',
        lastName: parseContactName(firstNew.contactName)?.lastName || '',
      },
    })
  }
  return actions.slice(0, 3)
}

function emptyResult(explanation, message) {
  return {
    reply: message,
    source: 'knowledge_lookup',
    confidence: 'low',
    companies: [],
    planSteps: [],
    actions: [],
    nbsa: null,
  }
}
