/** Flatten and count CRM deals across pipeline entries (shared client + server). */

import {
  FREIGHT_DEAL_STAGE_IDS,
  hydrateFreightDealCurrency,
  isFreightDealStageClosed,
  normalizeFreightDealStage,
  estimatedFreightRevenueInr,
} from './freightDeal.js'

export function isClosedDealStage(stage) {
  const id = normalizeFreightDealStage(stage)
  return id === 'won' || id === 'lost' || isFreightDealStageClosed(stage)
}

/** `all` lists every stage including won/lost; single-stage won/lost also include closed. */
export function dealStageIncludesClosed(dealStage) {
  const stage = String(dealStage || 'all')
    .trim()
    .toLowerCase() || 'all'
  return stage === 'all' || stage === 'won' || stage === 'lost'
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
      if (!includeClosed && isClosedDealStage(stage)) continue
      if (dealStage && dealStage !== 'all') {
        const filterStage = freightOrg ? normalizeFreightDealStage(dealStage) : dealStage
        if (stage !== filterStage) continue
      }
      rows.push({
        deal: hydrateFreightDealCurrency(freightOrg ? { ...deal, stage: rawStage } : deal),
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

export function tallyDealStages(stageValues, { openOnly = false, freightOrg = false } = {}) {
  const counts = stageCountKeys()
  for (const raw of stageValues || []) {
    const rawStage = raw || (freightOrg ? 'rfq' : 'new')
    const stage = freightOrg ? normalizeFreightDealStage(rawStage) : String(rawStage || '')
    if (openOnly && isClosedDealStage(stage)) continue
    counts.all += 1
    if (counts[stage] != null) counts[stage] += 1
    else if (counts[String(rawStage)] != null) counts[String(rawStage)] += 1
    else counts.new += 1
  }
  return counts
}

export function countDealsByStage(entries, { openOnly = false, freightOrg = false } = {}) {
  const stages = []
  for (const entry of entries || []) {
    for (const deal of entry?.crm?.deals || []) {
      stages.push(deal.stage || (freightOrg ? 'rfq' : 'new'))
    }
  }
  return tallyDealStages(stages, { openOnly, freightOrg })
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

function dealRowRevenue(row, usdInrRate) {
  const deal = row?.deal || row
  const estimated = estimatedFreightRevenueInr(deal, usdInrRate)
  if (estimated != null && Number.isFinite(estimated)) return estimated
  if (deal?.freight) return 0
  return dealRowAmount(row)
}

function dealCustomerKey(row) {
  const company = String(row?.company || '').trim().toLowerCase()
  if (company) return `c:${company}`
  const leadName = String(row?.leadName || '').trim().toLowerCase()
  if (leadName) return `l:${leadName}`
  const leadId = String(row?.leadId || '').trim()
  if (leadId) return `id:${leadId}`
  return `deal:${row?.deal?.id || ''}`
}

/** Filter-aware totals for the Pipeline deals KPI pills. */
export function summarizePipelineDealRows(dealRows = [], { usdInrRate = null } = {}) {
  const customers = new Set()
  let openCount = 0
  let openRevenue = 0
  let bookedCount = 0
  let bookedRevenue = 0
  let wonCount = 0
  let wonRevenue = 0
  let lostCount = 0
  let lostRevenue = 0
  let totalRevenue = 0

  for (const row of dealRows || []) {
    const deal = row?.deal
    if (!deal) continue
    customers.add(dealCustomerKey(row))
    const stage = normalizeFreightDealStage(deal.stage || 'rfq')
    const revenue = dealRowRevenue(row, usdInrRate)
    totalRevenue += revenue
    if (stage === 'lost') {
      lostCount += 1
      lostRevenue += revenue
    } else if (stage === 'booked') {
      bookedCount += 1
      bookedRevenue += revenue
    } else if (stage === 'won') {
      wonCount += 1
      wonRevenue += revenue
    } else {
      openCount += 1
      openRevenue += revenue
    }
  }

  const finals = bookedCount + lostCount
  const bookRate = finals > 0 ? Math.round((bookedCount / finals) * 1000) / 10 : null

  return {
    dealCount: (dealRows || []).filter((row) => row?.deal).length,
    customerCount: customers.size,
    openCount,
    openRevenue: Math.round(openRevenue),
    bookedCount,
    bookedRevenue: Math.round(bookedRevenue),
    wonCount,
    wonRevenue: Math.round(wonRevenue),
    lostCount,
    lostRevenue: Math.round(lostRevenue),
    totalRevenue: Math.round(totalRevenue),
    bookRate,
  }
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
