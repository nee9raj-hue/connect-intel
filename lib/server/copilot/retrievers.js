import { tryGroundedWorkspaceReply, tryHighConfidenceFaq } from '../assistantCrmFacts.js'
import { crmAssistantWebResearch } from '../perplexity.js'
import { searchPlatformFast } from '../meilisearch/search.js'
import { findPipelineEntryAsync } from '../pipelineVisibility.js'
import { mergeLeadForTenant } from '../tenantIsolation.js'
import { getCachedWebResearch, setCachedWebResearch } from './cache.js'

export async function retrieveCrmFacts(store, user, message, uiContext) {
  return tryGroundedWorkspaceReply(message, store, user, uiContext)
}

export function retrieveKnowledge(message) {
  return tryHighConfidenceFaq(message)
}

export async function retrieveCrmSearch(store, user, query, { limit = 6 } = {}) {
  const q = String(query || '').trim()
  if (q.length < 2) return { results: [], query: q }

  const { results } = await searchPlatformFast(store, user, { q, limit })
  return {
    query: q,
    results: (results || []).slice(0, limit).map((r) => ({
      type: r.type,
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      panel: r.panel,
      leadId: r.leadId,
    })),
  }
}

export async function retrieveLeadContext(store, user, leadId, metaStore) {
  if (!leadId) return null
  const entry = await findPipelineEntryAsync(store, user, leadId, metaStore)
  if (!entry) return null

  const lead = mergeLeadForTenant(store, user, entry)
  const crm = lead.crm || {}
  const deals = crm.deals || []
  const openDeals = deals.filter((d) => !['won', 'lost'].includes(d.status))

  return {
    id: lead.id,
    name: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company,
    company: lead.company || '',
    email: lead.email || '',
    phone: lead.phone || '',
    city: lead.city || '',
    state: lead.state || '',
    industry: lead.industry || '',
    status: crm.status || 'new',
    leadScore: crm.leadScore ?? null,
    overdueFollowUp: Boolean(crm.followUpAt && new Date(crm.followUpAt) < new Date()),
    openDeals: openDeals.length,
    dealValue: openDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0),
    lastActivity:
      crm.lastCommunicationAt || crm.lastEmailSentAt || crm.lastCallAt || lead.savedAt || null,
    website: lead.website || lead.companyDomain || '',
  }
}

export async function retrieveWebResearch(userId, query, { news = false } = {}) {
  const q = String(query || '').trim()
  if (!q) return { error: 'Empty query', text: null, citations: [] }

  const cached = await getCachedWebResearch(userId, q)
  if (cached?.text) {
    return { ...cached, fromCache: true }
  }

  const focus = news ? 'news' : undefined
  const result = await crmAssistantWebResearch(q, { focus })
  if (result.text) {
    await setCachedWebResearch(userId, q, {
      text: result.text,
      citations: result.citations || [],
      focus: result.focus,
    })
  }
  return result
}

export function formatCrmSearchForPrompt(searchResult) {
  if (!searchResult?.results?.length) return ''
  const lines = searchResult.results.map((r, i) => {
    const id = r.leadId || r.id
    return `${i + 1}. [${r.type}] ${r.title}${r.subtitle ? ` — ${r.subtitle}` : ''} (id: ${id})`
  })
  return `CRM SEARCH (${searchResult.query}):\n${lines.join('\n')}`
}

export function formatLeadContextForPrompt(lead) {
  if (!lead) return ''
  return `CURRENT LEAD:
Name: ${lead.name}
Company: ${lead.company}
Email: ${lead.email || '—'}
Phone: ${lead.phone || '—'}
Location: ${[lead.city, lead.state].filter(Boolean).join(', ') || '—'}
Status: ${lead.status}
Lead score: ${lead.leadScore ?? '—'}
Open deals: ${lead.openDeals} (₹${lead.dealValue || 0})
Overdue follow-up: ${lead.overdueFollowUp ? 'yes' : 'no'}
Last activity: ${lead.lastActivity || '—'}`
}
