/** Flatten and count CRM deals across pipeline entries (shared client + server). */

import {
  FREIGHT_DEAL_STAGE_IDS,
  isFreightDealStageClosed,
  normalizeFreightDealStage,
} from './freightDeal.js'

export function isClosedDealStage(stage) {
  return stage === 'won' || stage === 'lost' || isFreightDealStageClosed(stage)
}

function stageCountKeys() {
  const counts = { all: 0 }
  for (const id of FREIGHT_DEAL_STAGE_IDS) counts[id] = 0
  counts.new = 0
  counts.contacted = 0
  counts.follow_up = 0
  counts.replied = 0
  return counts
}

export function flattenDealsFromEntries(entries, { dealStage = null, includeClosed = false, freightOrg = false } = {}) {
  const rows = []
  for (const entry of entries || []) {
    const deals = Array.isArray(entry?.crm?.deals) ? entry.crm.deals : []
    if (!deals.length) continue
    const lead = entry.lead || entry
    const leadId = lead.id || entry.id
    const leadName =
      [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || 'Lead'
    for (const deal of deals) {
      const rawStage = deal.stage || (freightOrg ? 'rfq' : 'new')
      const stage = freightOrg ? normalizeFreightDealStage(rawStage) : rawStage
      if (!includeClosed && isClosedDealStage(rawStage)) continue
      if (dealStage && dealStage !== 'all') {
        const filterStage = freightOrg ? normalizeFreightDealStage(dealStage) : dealStage
        if (stage !== filterStage) continue
      }
      rows.push({
        deal: freightOrg ? { ...deal, stage: rawStage } : deal,
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

export function countDealsByStage(entries, { openOnly = false, freightOrg = false } = {}) {
  const counts = stageCountKeys()
  for (const entry of entries || []) {
    for (const deal of entry?.crm?.deals || []) {
      const rawStage = deal.stage || (freightOrg ? 'rfq' : 'new')
      const stage = freightOrg ? normalizeFreightDealStage(rawStage) : rawStage
      if (openOnly && isClosedDealStage(rawStage)) continue
      counts.all += 1
      if (counts[stage] != null) counts[stage] += 1
      else if (counts[rawStage] != null) counts[rawStage] += 1
      else counts.new += 1
    }
  }
  return counts
}
