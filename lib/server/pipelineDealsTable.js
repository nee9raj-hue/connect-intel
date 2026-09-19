import { isClosedDealStage, tallyDealStages, dealStageIncludesClosed } from '../dealPipeline.js'
import { hydrateFreightDealCurrency, normalizeFreightDealStage } from '../freightDeal.js'
import { normalizeDealsList } from './crmWorkflow.js'
import { isPipelineLeadsTableEnabled } from './infra/config.js'
import { isSupabaseEnabled, supabaseRest, supabaseRestCount } from './supabaseClient.js'
import { resolvePipelineTableScopeAsync } from './pipelineTableScope.js'
import { readStore } from './store.js'
import { normalizeDealCustomerTypeFilter } from '../crmPipelineFlow.js'

const TABLE = 'pipeline_deals'
const META_STORE_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']
export const PIPELINE_DEALS_PAGE_MAX = 120

/** SQL filter for one deal stage. Empty string lists every stage (All Deals). */
export function pipelineDealsStageFilterSql(dealStage, { freightOrg = false } = {}) {
  const stage = String(dealStage || 'all').trim().toLowerCase() || 'all'
  if (stage === 'all') return ''
  const wanted = freightOrg ? normalizeFreightDealStage(stage) : stage
  if (!wanted) return ''
  const enc = encodeURIComponent(wanted)
  return `&or=(stage.eq.${enc},payload->deal->>stage.eq.${enc})`
}

export function pipelineDealsCustomerTypeFilterSql(customerType) {
  const wanted = normalizeDealCustomerTypeFilter(customerType)
  if (!wanted) return ''
  if (wanted === 'courier') {
    return `&payload->deal->freight->>customerType=eq.courier`
  }
  return `&or=(payload->deal->freight->>customerType.eq.spot_rfq,payload->deal->freight->>customerType.is.null)`
}

export function isPipelineDealsTableEnabled() {
  if (!isPipelineLeadsTableEnabled() || !isSupabaseEnabled()) return false
  return true
}

export function pipelineDealsTableActive() {
  return isPipelineDealsTableEnabled()
}

function leadMeta(entry) {
  const lead = entry?.lead || entry
  const leadId = lead?.id || entry?.id
  const leadName =
    [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.company || 'Lead'
  return {
    leadId: leadId ? String(leadId) : null,
    leadName,
    company: lead?.company || '',
  }
}

export function buildPipelineDealRow(organizationId, entry, deal) {
  if (!organizationId || !deal?.id) return null
  const { leadId, leadName, company } = leadMeta(entry)
  if (!leadId) return null

  const ownerId =
    entry.assignedToUserId || entry.savedByUserId || entry.userId || null

  return {
    organization_id: String(organizationId),
    lead_id: leadId,
    deal_id: String(deal.id),
    stage: String(deal.stage || 'new').trim().toLowerCase() || 'new',
    amount: deal.amount != null && deal.amount !== '' ? Number(deal.amount) : null,
    owner_id: ownerId ? String(ownerId) : null,
    payload: {
      deal,
      leadName,
      company,
    },
    updated_at: deal.updatedAt || deal.createdAt || new Date().toISOString(),
  }
}

export async function upsertPipelineDeals(rows) {
  if (!pipelineDealsTableActive() || !rows?.length) return { upserted: 0 }

  const chunkSize = 40
  let upserted = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    await supabaseRest(
      `${TABLE}?on_conflict=organization_id,deal_id`,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk),
      },
      { timeoutMs: 60_000 }
    )
    upserted += chunk.length
  }
  return { upserted }
}

export async function deletePipelineDealsNotInSet(organizationId, leadId, dealIds) {
  if (!pipelineDealsTableActive() || !organizationId || !leadId) return

  const keep = new Set((dealIds || []).map(String))
  const existing = await supabaseRest(
    `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}` +
      `&lead_id=eq.${encodeURIComponent(leadId)}&select=deal_id`,
    {},
    { timeoutMs: 20_000 }
  )
  if (!Array.isArray(existing)) return

  const toDelete = existing.map((r) => r.deal_id).filter((id) => id && !keep.has(String(id)))
  for (const dealId of toDelete) {
    await supabaseRest(
      `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}` +
        `&deal_id=eq.${encodeURIComponent(dealId)}`,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
      { timeoutMs: 15_000 }
    )
  }
}

export async function syncPipelineDealsForEntry({ organizationId, entry }) {
  if (!pipelineDealsTableActive() || !organizationId || !entry) return { synced: 0 }

  const deals = normalizeDealsList(entry.crm?.deals)
  const rows = deals
    .map((deal) => buildPipelineDealRow(organizationId, entry, deal))
    .filter(Boolean)

  await deletePipelineDealsNotInSet(
    organizationId,
    leadMeta(entry).leadId,
    deals.map((d) => d.id)
  )
  const result = await upsertPipelineDeals(rows)
  return { synced: result.upserted || 0 }
}

function buildScopeParts(scope) {
  const parts = []
  if (scope.organizationId) {
    parts.push(`organization_id=eq.${encodeURIComponent(scope.organizationId)}`)
  }
  if (scope.userId) {
    parts.push(`owner_id=eq.${encodeURIComponent(scope.userId)}`)
    return parts
  }
  if (scope.unassigned) {
    parts.push('owner_id=is.null')
    return parts
  }
  if (scope.ownerId && scope.includeUnassigned) {
    parts.push(
      `or=(owner_id.eq.${encodeURIComponent(scope.ownerId)},owner_id.is.null)`
    )
    return parts
  }
  if (scope.ownerId) {
    parts.push(`owner_id=eq.${encodeURIComponent(scope.ownerId)}`)
  }
  return parts
}

function stageParts(row) {
  const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {}
  const payloadStage = payload.deal?.stage || row?.deal?.stage
  const columnStage = row?.deal_stage || row?.stage
  return { payloadStage, columnStage }
}

/** One stage per deal for badges and lists. Closed SQL/payload wins so Lost/Won are not dropped. */
export function canonicalDealStageFromRow(row, { freightOrg = false } = {}) {
  const { payloadStage, columnStage } = stageParts(row)
  if (!freightOrg) return String(payloadStage || columnStage || '')
  const payload = payloadStage ? normalizeFreightDealStage(payloadStage) : ''
  const col = columnStage ? normalizeFreightDealStage(columnStage) : ''
  if (payload === 'lost' || col === 'lost') return 'lost'
  if (payload === 'won' || col === 'won') return 'won'
  return payload || col || 'rfq'
}

/** Same stage identity as sidebar badges — payload and SQL column, including Lost vs lost. */
export function filterMappedDealRowsByStage(
  deals,
  { stage = 'all', freightOrg = false, includeClosed = false } = {}
) {
  const filterStage = String(stage || 'all').trim().toLowerCase() || 'all'
  const wanted = filterStage !== 'all'
    ? freightOrg
      ? normalizeFreightDealStage(filterStage)
      : filterStage
    : null

  return (deals || []).filter((row) => {
    const norm = canonicalDealStageFromRow(row, { freightOrg })
    if (wanted) return norm === wanted
    if (!includeClosed && isClosedDealStage(norm)) return false
    return true
  })
}

function mapRowToFlatten(row, { freightOrg = false } = {}) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  const rawDeal =
    payload.deal && typeof payload.deal === 'object'
      ? payload.deal
      : {
          id: row.deal_id,
          stage: row.stage,
          amount: row.amount,
        }
  const combinedStage = rawDeal.stage || row.stage
  const stage = freightOrg ? normalizeFreightDealStage(combinedStage) : combinedStage
  const deal = hydrateFreightDealCurrency(freightOrg ? { ...rawDeal, stage: combinedStage } : rawDeal)

  return {
    deal,
    leadId: row.lead_id,
    leadName: payload.leadName || 'Lead',
    company: payload.company || '',
    assigneeUserId: row.owner_id || null,
    savedAt: row.updated_at || null,
    stage: row.stage,
    _stageNorm: stage,
  }
}

export async function orgHasPipelineDeals(organizationId) {
  if (!organizationId || !pipelineDealsTableActive()) return false
  try {
    const rows = await supabaseRest(
      `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}&select=deal_id&limit=1`,
      {},
      { timeoutMs: 10_000, attempts: 1 }
    )
    return Array.isArray(rows) && rows.length > 0
  } catch {
    return false
  }
}

/**
 * Paginated deals from pipeline_deals (Deploy 5 — SQL-first deals view).
 */
export async function listPipelineDealsPage(
  user,
  {
    filters = {},
    dealStage = 'all',
    offset = 0,
    limit = 100,
    freightOrg = false,
    metaStore: metaStoreHint = null,
    customerType = '',
  } = {}
) {
  if (!pipelineDealsTableActive() || !user?.organizationId) return null

  const metaStore =
    metaStoreHint || (await readStore({ only: META_STORE_COLLECTIONS }))
  const scope = await resolvePipelineTableScopeAsync(user, metaStore, filters)
  const parts = buildScopeParts(scope)
  if (!parts.length) return null

  const stage = String(dealStage || 'all').trim() || 'all'
  const includeClosed = dealStageIncludesClosed(stage)

  const off = Math.max(0, Math.floor(Number(offset) || 0))
  const lim = Math.min(PIPELINE_DEALS_PAGE_MAX, Math.max(1, Math.floor(Number(limit) || 80)))

  const baseQuery = parts.join('&')
  const stageSql = pipelineDealsStageFilterSql(stage, { freightOrg })
  const typeSql = pipelineDealsCustomerTypeFilterSql(customerType || filters.dealCustomerType || filters.customerType)
  const select =
    'select=lead_id,deal_id,stage,amount,owner_id,updated_at,payload'
  const listPath =
    `${TABLE}?${baseQuery}${stageSql}${typeSql}&${select}` +
    `&order=updated_at.desc&limit=${lim}&offset=${off}`

  const countPromise = supabaseRestCount(
    `${TABLE}?${baseQuery}${stageSql}${typeSql}&select=deal_id`,
    { timeoutMs: 8_000 }
  )
  const rows = await supabaseRest(listPath, {}, { timeoutMs: 12_000, attempts: 1 })
  if (!Array.isArray(rows)) return null

  let deals = filterMappedDealRowsByStage(
    rows.map((row) => mapRowToFlatten(row, { freightOrg })),
    { stage, freightOrg, includeClosed }
  ).map(({ _stageNorm, stage: _columnStage, ...rest }) => rest)

  const counted = await countPromise
  const total = Number.isFinite(counted) ? counted : off + deals.length
  const hasMore = Number.isFinite(counted)
    ? off + deals.length < counted
    : rows.length >= lim

  return {
    deals,
    total,
    limit: lim,
    offset: off,
    hasMore,
    dealStage: stage,
    fromDealsTable: true,
  }
}

export async function getPipelineDealById(organizationId, dealId) {
  if (!organizationId || !dealId || !pipelineDealsTableActive()) return null

  const rows = await supabaseRest(
    `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}` +
      `&deal_id=eq.${encodeURIComponent(dealId)}` +
      `&select=lead_id,deal_id,stage,amount,owner_id,updated_at,payload&limit=1`,
    {},
    { timeoutMs: 15_000 }
  )
  if (!Array.isArray(rows) || !rows[0]) return null
  return mapRowToFlatten(rows[0], { freightOrg: false })
}

/** Sidebar badges — same pipeline_deals rows the deals view lists. */
export async function countScopedPipelineDealsByStage(
  user,
  { freightOrg = true, filters = {}, metaStore: metaStoreHint = null } = {}
) {
  if (!pipelineDealsTableActive() || !user?.organizationId) return null

  const metaStore =
    metaStoreHint || (await readStore({ only: META_STORE_COLLECTIONS }))
  const scope = await resolvePipelineTableScopeAsync(user, metaStore, filters)
  const parts = buildScopeParts(scope)
  if (!parts.length) return null

  let rows
  try {
    rows = await supabaseRest(
      `${TABLE}?${parts.join('&')}&select=stage&limit=2500`,
      {},
      { timeoutMs: 8_000, attempts: 1 }
    )
  } catch {
    return null
  }
  if (!Array.isArray(rows)) return null

  const stages = rows.map((row) => canonicalDealStageFromRow(row, { freightOrg }))
  const dealCounts = tallyDealStages(stages, { openOnly: false, freightOrg })
  const openDealCounts = tallyDealStages(stages, { openOnly: true, freightOrg })
  return { dealCounts, openDealCounts }
}

export async function listPipelineDealRowsForOrg(organizationId, { limit = 2000 } = {}) {
  if (!organizationId || !pipelineDealsTableActive()) return []
  const cap = Math.min(4000, Math.max(1, Number(limit) || 2000))
  try {
    const rows = await supabaseRest(
      `${TABLE}?organization_id=eq.${encodeURIComponent(organizationId)}` +
        `&select=deal_id,lead_id,stage,amount,payload,updated_at&limit=${cap}`,
      {},
      { timeoutMs: 20_000, attempts: 2 }
    )
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

export async function existingPipelineLeadIds(organizationId, leadIds) {
  const ids = [...new Set((leadIds || []).map(String).filter(Boolean))]
  const live = new Set()
  if (!organizationId || !ids.length || !isSupabaseEnabled()) return live
  const { pipelineLeadsTableActive } = await import('./pipelineLeadsTable.js')
  if (!pipelineLeadsTableActive()) return live

  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80)
    const inn = chunk.map(encodeURIComponent).join(',')
    try {
      const rows = await supabaseRest(
        `pipeline_leads?organization_id=eq.${encodeURIComponent(organizationId)}` +
          `&lead_id=in.(${inn})&select=lead_id`,
        {},
        { timeoutMs: 12_000, attempts: 2 }
      )
      for (const row of rows || []) {
        if (row?.lead_id) live.add(String(row.lead_id))
      }
    } catch {
      /* ignore chunk */
    }
  }
  return live
}
