import { filterMarketingCampaignsVisible } from './marketingAccess.js'
import { listPipelineSavedEntries } from './organizations.js'
import { listContactsForUser } from './pipelineContact.js'

function leadHaystack(entry) {
  const lead = entry?.lead || {}
  const crm = entry?.crm || {}
  return [
    lead.name,
    lead.email,
    lead.phone,
    lead.company,
    lead.city,
    lead.state,
    crm.assigneeName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/**
 * Fast unified search across pipeline, contacts, campaigns, and nested deals.
 */
export function searchPlatform(store, user, { q = '', limit = 20 } = {}) {
  const query = String(q || '').trim().toLowerCase()
  if (query.length < 2) {
    return { results: [], query }
  }

  const cap = Math.min(40, Math.max(5, Number(limit) || 20))
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
