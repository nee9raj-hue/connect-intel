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

const DEAL_STAGE_FORECAST_WEIGHT = {
  rfq: 0.12,
  quoted: 0.28,
  negotiation: 0.52,
  booked: 0.78,
  won: 1,
  lost: 0,
  new: 0.12,
  contacted: 0.28,
  follow_up: 0.52,
  replied: 0.52,
}

const DEAL_STALE_MS = 21 * 86_400_000

function dealRowAmount(row) {
  return Number(row?.deal?.amount) || 0
}

/** Weighted revenue forecast from flat deal rows (Pipeline deals view + API). */
export function buildDealsForecast(dealRows = [], { freightOrg = true } = {}) {
  const byStage = Object.fromEntries(
    FREIGHT_DEAL_STAGE_IDS.map((id) => [id, { count: 0, value: 0, weighted: 0 }])
  )

  let openCount = 0
  let openValue = 0
  let weightedOpen = 0
  let wonValue = 0
  let wonCount = 0
  let lostCount = 0
  let staleValue = 0
  const now = Date.now()

  for (const row of dealRows || []) {
    const deal = row?.deal
    if (!deal) continue

    const rawStage = deal.stage || (freightOrg ? 'rfq' : 'new')
    const stage = freightOrg ? normalizeFreightDealStage(rawStage) : rawStage
    const amount = dealRowAmount(row)
    const weight = DEAL_STAGE_FORECAST_WEIGHT[stage] ?? 0.15

    if (!byStage[stage]) byStage[stage] = { count: 0, value: 0, weighted: 0 }
    byStage[stage].count += 1
    byStage[stage].value += amount
    byStage[stage].weighted += Math.round(amount * weight)

    if (stage === 'won') {
      wonCount += 1
      wonValue += amount
      continue
    }
    if (stage === 'lost') {
      lostCount += 1
      continue
    }

    openCount += 1
    openValue += amount
    weightedOpen += amount * weight

    const updatedAt = new Date(deal.updatedAt || deal.createdAt || 0).getTime()
    if (updatedAt && now - updatedAt > DEAL_STALE_MS) staleValue += amount
  }

  const closedCount = wonCount + lostCount
  const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 1000) / 10 : 0
  const weightedPipeline = Math.round(weightedOpen)

  return {
    dealCount: (dealRows || []).length,
    openCount,
    openValue: Math.round(openValue),
    weightedPipeline,
    wonValue: Math.round(wonValue),
    wonCount,
    winRate,
    forecast30d: Math.round(weightedPipeline * 0.42),
    forecast90d: Math.round(weightedPipeline * 0.82),
    confidence:
      openValue > 0 ? (winRate >= 15 || openCount >= 5 ? 'medium' : 'low') : 'low',
    atRiskValue: Math.round(staleValue),
    byStage,
  }
}
