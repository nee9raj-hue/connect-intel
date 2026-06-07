/** Flatten and count CRM deals across pipeline entries (shared client + server). */

export function isClosedDealStage(stage) {
  return stage === 'won' || stage === 'lost'
}

export function flattenDealsFromEntries(entries, { dealStage = null, includeClosed = false } = {}) {
  const rows = []
  for (const entry of entries || []) {
    const deals = Array.isArray(entry?.crm?.deals) ? entry.crm.deals : []
    if (!deals.length) continue
    const lead = entry.lead || entry
    const leadId = lead.id || entry.id
    const leadName =
      [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || 'Lead'
    for (const deal of deals) {
      const stage = deal.stage || 'new'
      if (!includeClosed && isClosedDealStage(stage)) continue
      if (dealStage && dealStage !== 'all' && stage !== dealStage) continue
      rows.push({
        deal,
        leadId,
        leadName,
        company: lead.company || '',
        assigneeUserId: entry.assignedToUserId || null,
        savedAt: entry.savedAt || null,
      })
    }
  }
  rows.sort(
    (a, b) =>
      new Date(b.deal?.updatedAt || b.deal?.createdAt || 0) -
      new Date(a.deal?.updatedAt || a.deal?.createdAt || 0)
  )
  return rows
}

export function countDealsByStage(entries, { openOnly = false } = {}) {
  const counts = {
    all: 0,
    rfq: 0,
    new: 0,
    contacted: 0,
    follow_up: 0,
    replied: 0,
    won: 0,
    lost: 0,
  }
  for (const entry of entries || []) {
    for (const deal of entry?.crm?.deals || []) {
      const stage = deal.stage || 'new'
      if (openOnly && isClosedDealStage(stage)) continue
      counts.all += 1
      if (counts[stage] != null) counts[stage] += 1
      else counts.new += 1
    }
  }
  return counts
}
