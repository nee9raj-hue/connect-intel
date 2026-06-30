import { filterMarketingCampaignsVisible } from './marketingAccess.js'
import { buildCompaniesHub } from './companiesHub.js'
import { listPipelineSavedEntries } from './organizations.js'
import { listContactsForUser } from './pipelineContact.js'
import {
  pipelineEntryMatchesAssignee,
  pipelineLeadSearchHaystack,
} from './pipelineQuery.js'
import { isPipelineLeadUnassigned } from '../pipelineOwner.js'

function leadHaystack(entry) {
  const lead = entry?.lead || {}
  const crm = entry?.crm || {}
  return pipelineLeadSearchHaystack(lead, crm)
}

/**
 * Fast unified search across pipeline, contacts, campaigns, and nested deals.
 */
export function searchPlatform(store, user, { q = '', limit = 50 } = {}) {
  const query = String(q || '').trim().toLowerCase()
  if (query.length < 2) {
    return { results: [], query }
  }

  const cap = Math.min(50, Math.max(5, Number(limit) || 50))
  const results = []
  const seen = new Set()

  const push = (row) => {
    const key = `${row.type}:${row.id}`
    if (seen.has(key)) return
    seen.add(key)
    results.push(row)
  }

  const entries = listPipelineSavedEntries(store, user)

  for (const entry of entries) {
    if (results.length >= cap) break
    if (isPipelineLeadUnassigned(entry)) continue
    if (!leadHaystack(entry).includes(query)) continue
    const lead = entry.lead || {}
    push({
      type: 'lead',
      id: lead.id,
      title: lead.name || lead.email || 'Lead',
      subtitle: [lead.company, lead.email].filter(Boolean).join(' · '),
      panel: 'pipeline',
      leadId: lead.id,
    })
  }

  if (results.length < cap) {
    const { contacts = [] } = listContactsForUser(store, user, {
      search: query,
      limit: Math.min(8, cap - results.length),
    })
    for (const contact of contacts) {
      push({
        type: 'contact',
        id: contact.id,
        title: contact.fullName || contact.email || 'Contact',
        subtitle: [contact.company, contact.title].filter(Boolean).join(' · '),
        panel: 'contacts',
      })
    }
  }

  if (results.length < cap) {
    const campaigns = filterMarketingCampaignsVisible(store.marketingCampaigns || [], user)
    for (const campaign of campaigns) {
      if (results.length >= cap) break
      if (!String(campaign.name || '').toLowerCase().includes(query)) continue
      push({
        type: 'campaign',
        id: campaign.id,
        title: campaign.name,
        subtitle: `Campaign · ${campaign.status || 'draft'}`,
        panel: 'marketing',
        tab: 'reports',
        campaignId: campaign.id,
      })
    }
  }

  if (results.length < cap && query.length >= 2) {
    const { companies = [] } = buildCompaniesHub(store, user, { search: query, limit: 5 })
    for (const company of companies) {
      if (results.length >= cap) break
      push({
        type: 'company',
        id: company.id,
        title: company.name,
        subtitle: `${company.leadCount} contacts`,
        panel: 'companies',
      })
    }
  }

  if (results.length < cap) {
    for (const entry of entries) {
      if (results.length >= cap) break
      const deals = entry.crm?.deals || []
      for (const deal of deals) {
        if (results.length >= cap) break
        if (!String(deal.name || '').toLowerCase().includes(query)) continue
        push({
          type: 'deal',
          id: deal.id,
          title: deal.name,
          subtitle: [entry.lead?.company, deal.stage].filter(Boolean).join(' · '),
          panel: 'pipeline',
          leadId: entry.lead?.id,
          view: 'deals',
          dealStage: deal.stage || 'all',
        })
      }
    }
  }

  return { results: results.slice(0, cap), query }
}
