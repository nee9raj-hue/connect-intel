import { isClosedDealStage } from '../dealPipeline.js'
import { normalizeFreightDealStage } from '../freightDeal.js'
import { normalizeDealsList } from './crmWorkflow.js'
import { isPipelineLeadsTableEnabled } from './infra/config.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { resolvePipelineTableScopeAsync } from './pipelineTableScope.js'
import { readStore } from './store.js'

const TABLE = 'pipeline_deals'
const META_STORE_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

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
    stage: deal.stage || 'new',
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
  const stage = freightOrg ? normalizeFreightDealStage(rawDeal.stage || row.stage) : rawDeal.stage || row.stage
  const deal = freightOrg ? { ...rawDeal, stage: rawDeal.stage || row.stage } : rawDeal

  return {
    deal,
    leadId: row.lead_id,
    leadName: payload.leadName || 'Lead',
    company: payload.company || '',
    assigneeUserId: row.owner_id || null,
    savedAt: row.updated_at || null,
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
  } = {}
) {
  if (!pipelineDealsTableActive() || !user?.organizationId) return null

  const metaStore =
    metaStoreHint || (await readStore({ only: META_STORE_COLLECTIONS }))
  const scope = await resolvePipelineTableScopeAsync(user, metaStore, filters)
  const parts = buildScopeParts(scope)
  if (!parts.length) return null

  const stage = String(dealStage || 'all').trim() || 'all'
  const includeClosed = stage === 'won' || stage === 'lost'
  if (stage !== 'all') {
    const filterStage = freightOrg ? normalizeFreightDealStage(stage) : stage
    parts.push(`stage=eq.${encodeURIComponent(filterStage)}`)
  }

  const off = Math.max(0, Math.floor(Number(offset) || 0))
  const lim = Math.min(500, Math.max(1, Math.floor(Number(limit) || 100)))

  const baseQuery = parts.join('&')
  let total = 0
  try {
    const countRows = await supabaseRest(
      `${TABLE}?${baseQuery}&select=deal_id`,
      {},
      { timeoutMs: 20_000 }
    )
    total = Array.isArray(countRows) ? countRows.length : 0
    if (total > 5000) total = 5000
  } catch {
    return null
  }

  const rows = await supabaseRest(
    `${TABLE}?${baseQuery}` +
      `&select=lead_id,deal_id,stage,amount,owner_id,updated_at,payload` +
      `&order=updated_at.desc&offset=${off}&limit=${lim}`,
    {},
    { timeoutMs: 30_000 }
  )
  if (!Array.isArray(rows)) return null

  let deals = rows.map((row) => mapRowToFlatten(row, { freightOrg }))
  if (!includeClosed && stage === 'all') {
    deals = deals.filter((row) => !isClosedDealStage(row.deal?.stage || row._stageNorm))
  }
  deals = deals.map(({ _stageNorm, ...rest }) => rest)

  return {
    deals,
    total: total || deals.length,
    limit: lim,
    offset: off,
    hasMore: off + deals.length < total,
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
