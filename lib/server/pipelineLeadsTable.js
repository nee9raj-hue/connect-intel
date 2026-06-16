import { CRM_STATUSES } from './crm.js'
import { getLeadCityFromFields, getLeadStateFromFields } from '../pipelineLeadLocation.js'
import {
  pipelineAssigneePostgrestFilter,
  pipelineRepVisibilityPostgrestFilter,
  pipelineUnassignedPostgrestFilter,
} from './pipelineQuery.js'
import { isPipelineLeadsTableEnabled } from './infra/config.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { pipelineShardNameForUser } from './pipelineShard.js'
import { resolvePipelineTableScope, resolvePipelineTableScopeAsync } from './pipelineTableScope.js'
import { isPipelineHierarchyRbacEnabled } from './infra/config.js'
import { appendPipelineFilterSqlParts } from './pipelineFilterSql.js'
import { readStore } from './store.js'
import {
  isPipelineEntryInUserOrg,
  isPipelineEntryVisibleAsync,
} from './pipelineVisibility.js'

const META_STORE_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']
const TABLE_READ_PAGE = 200

const TABLE = 'pipeline_leads'

/** Map a pipeline shard entry to a `pipeline_leads` table row. */
export function buildPipelineLeadRow(shardName, entry) {
  if (!entry || typeof entry !== 'object') return null
  const lead = entry.lead || entry
  const leadId = lead?.id || entry.leadId || entry.id
  if (!leadId) return null

  const updatedAt = entry.updatedAt || entry.savedAt || new Date().toISOString()
  const ownerId =
    entry.assignedToUserId || entry.savedByUserId || entry.userId || null
  const leadStatus = entry.crm?.status || 'new'

  return {
    lead_id: String(leadId),
    shard_name: shardName,
    organization_id: entry.organizationId || null,
    user_id: entry.userId || entry.savedByUserId || null,
    owner_id: ownerId ? String(ownerId) : null,
    team_id: entry.teamId ? String(entry.teamId) : null,
    department_id: entry.departmentId ? String(entry.departmentId) : null,
    lead_status: leadStatus,
    email: lead.email || null,
    phone: lead.phone || null,
    city: getLeadCityFromFields(lead) || null,
    state: getLeadStateFromFields(lead) || null,
    lead_score:
      entry.crm?.leadScore != null && entry.crm?.leadScore !== ''
        ? Math.floor(Number(entry.crm.leadScore)) || null
        : null,
    deal_count: Array.isArray(entry.crm?.deals) ? entry.crm.deals.length : 0,
    entry,
    updated_at: updatedAt,
  }
}

export function pipelineLeadsTableActive() {
  return isPipelineLeadsTableEnabled() && isSupabaseEnabled()
}

/** Batch-patch CRM fields without reading the full org shard (when table is enabled). */
export async function patchPipelineLeadsTable(user, patches, options = {}) {
  if (!pipelineLeadsTableActive()) return { patched: 0, mode: 'disabled' }
  const { trustOrgScope = false, metaStore: metaStoreHint = null } = options
  const shardName = pipelineShardNameForUser(user)
  const list = Array.isArray(patches) ? patches.filter((p) => p?.leadId) : []
  if (!list.length) return { patched: 0 }

  const metaStore =
    metaStoreHint || (await readStore({ only: META_STORE_COLLECTIONS }))

  let patched = 0
  let skipped = 0
  for (const { leadId, updateCrm } of list) {
    const rows = await supabaseRest(
      `${TABLE}?shard_name=eq.${encodeURIComponent(shardName)}&lead_id=eq.${encodeURIComponent(leadId)}&select=entry`,
      {},
      { timeoutMs: 15_000 }
    )
    const existing = Array.isArray(rows) && rows[0]?.entry ? rows[0].entry : null
    if (!existing) {
      skipped += 1
      continue
    }

    const allowed = trustOrgScope
      ? isPipelineEntryInUserOrg(user, existing)
      : await isPipelineEntryVisibleAsync(user, existing, metaStore)
    if (!allowed) {
      skipped += 1
      continue
    }

    const nextEntry = {
      ...existing,
      crm: updateCrm(existing.crm || {}),
      updatedAt: new Date().toISOString(),
    }
    await supabaseRest(
      `${TABLE}?shard_name=eq.${encodeURIComponent(shardName)}&lead_id=eq.${encodeURIComponent(leadId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          entry: nextEntry,
          updated_at: new Date().toISOString(),
        }),
      },
      { timeoutMs: 15_000 }
    )
    patched += 1
  }
  return { patched, skipped, mode: 'table' }
}

/** Remove one row from pipeline_leads (after shard/mirror delete). */
export async function deletePipelineLeadRow(shardName, leadId) {
  if (!pipelineLeadsTableActive() || !leadId) return { deleted: false, mode: 'disabled' }
  await supabaseRest(
    `${TABLE}?shard_name=eq.${encodeURIComponent(shardName)}&lead_id=eq.${encodeURIComponent(leadId)}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
    { timeoutMs: 15_000 }
  )
  return { deleted: true, mode: 'table' }
}

/** Upsert rows into pipeline_leads (backfill or runtime). Skips feature flag when force=true. */
export async function upsertPipelineLeadRows(shardName, entries, { batchSize = 50, force = false } = {}) {
  if (!force && !pipelineLeadsTableActive()) return { upserted: 0, skipped: 0, mode: 'disabled' }
  if (!isSupabaseEnabled()) throw new Error('Supabase is not configured')

  const rows = (entries || [])
    .map((entry) => buildPipelineLeadRow(shardName, entry))
    .filter(Boolean)

  if (!rows.length) return { upserted: 0, skipped: entries?.length || 0, mode: force ? 'backfill' : 'table' }

  let upserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize)
    await supabaseRest(
      `${TABLE}?on_conflict=shard_name,lead_id`,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk),
      },
      { timeoutMs: 60_000 }
    )
    upserted += chunk.length
  }

  if (upserted > 0 && entries?.length) {
    void import('./enterpriseLeadsTable.js')
      .then(({ syncEnterpriseLeadsFromEntries }) =>
        syncEnterpriseLeadsFromEntries(entries, { batchSize })
      )
      .catch((err) => {
        console.warn('enterprise leads sync:', err?.message || err)
      })
  }

  return {
    upserted,
    skipped: (entries?.length || 0) - rows.length,
    mode: force ? 'backfill' : 'table',
  }
}

export async function upsertPipelineLeadRow(shardName, entry, options = {}) {
  if (!entry) return null
  const result = await upsertPipelineLeadRows(shardName, [entry], {
    batchSize: 1,
    force: options.force,
  })
  if (!result.upserted) return null
  return buildPipelineLeadRow(shardName, entry)
}

export function buildPipelineLeadsScopedQuery(
  shardName,
  scope = {},
  options = {}
) {
  const { offset = 0, limit = 100, status = 'all' } = options
  const parts = [
    `shard_name=eq.${encodeURIComponent(shardName)}`,
    'select=entry',
    'order=updated_at.desc',
  ]
  if (scope.organizationId) {
    parts.push(`organization_id=eq.${encodeURIComponent(scope.organizationId)}`)
  }
  if (scope.userId) {
    parts.push(`user_id=eq.${encodeURIComponent(scope.userId)}`)
  }
  if (scope.unassigned) {
    parts.push(pipelineUnassignedPostgrestFilter())
  } else if (scope.includeUnassigned && scope.ownerId) {
    parts.push(pipelineRepVisibilityPostgrestFilter(scope.ownerId))
  } else if (scope.ownerId || scope.assigneeUserId) {
    const ownerFilter = pipelineAssigneePostgrestFilter(scope.ownerId || scope.assigneeUserId)
    if (ownerFilter) parts.push(ownerFilter)
  }
  const st = String(status || 'all').trim()
  if (st && st !== 'all' && CRM_STATUSES.includes(st)) {
    if (isPipelineHierarchyRbacEnabled()) {
      parts.push(`lead_status=eq.${encodeURIComponent(st)}`)
    } else {
      parts.push(`entry->crm->>status=eq.${encodeURIComponent(st)}`)
    }
  }
  if (isPipelineHierarchyRbacEnabled()) {
    if (scope.teamId) parts.push(`team_id=eq.${encodeURIComponent(scope.teamId)}`)
    if (scope.departmentId) parts.push(`department_id=eq.${encodeURIComponent(scope.departmentId)}`)
  }
  appendPipelineFilterSqlParts(parts, options)
  parts.push(`offset=${Math.max(0, Math.floor(Number(offset) || 0))}`)
  parts.push(`limit=${Math.max(1, Math.floor(Number(limit) || 100))}`)
  return parts.join('&')
}

export async function readPipelineLeadsScopedPage(shardName, scope, options = {}, user = null, metaStore = null) {
  if (!pipelineLeadsTableActive()) return null

  let effectiveScope = scope
  if (user && metaStore && isPipelineHierarchyRbacEnabled()) {
    effectiveScope = await resolvePipelineTableScopeAsync(user, metaStore, {
      ...options,
      assigneeUserId: options.assigneeUserId || scope.assigneeUserId,
      scope: options.scope || options.hierarchyScope,
    })
  }

  const rows = await supabaseRest(
    `${TABLE}?${buildPipelineLeadsScopedQuery(shardName, effectiveScope, options)}`,
    {},
    { timeoutMs: 30_000 }
  )
  if (!Array.isArray(rows)) return []
  return rows.map((r) => r.entry).filter(Boolean)
}

/** Unscoped page (all rows in shard) — prefer readPipelineLeadsScopedPage for list/bootstrap. */
export async function readPipelineLeadsPage(shardName, { offset = 0, limit = 100 } = {}) {
  return readPipelineLeadsScopedPage(shardName, {}, { offset, limit })
}

/** Walk scoped table pages until exhausted (replaces single blob shard download). */
export async function readAllPipelineLeadsScoped(shardName, scope = {}, { pageSize = TABLE_READ_PAGE } = {}) {
  if (!pipelineLeadsTableActive()) return null
  const all = []
  let offset = 0
  const size = Math.max(50, Math.floor(Number(pageSize) || TABLE_READ_PAGE))

  while (true) {
    const page = await readPipelineLeadsScopedPage(shardName, scope, { offset, limit: size })
    if (!page?.length) break
    all.push(...page)
    if (page.length < size) break
    offset += page.length
  }

  return all
}

/** All pipeline rows visible to this user from pipeline_leads; null when table off or empty. */
export async function readPipelineLeadsForUser(user, metaStore, shardName, filters = {}) {
  if (!pipelineLeadsTableActive()) return null
  const scope = await resolvePipelineTableScopeAsync(user, metaStore, filters)
  const entries = await readAllPipelineLeadsScoped(shardName, scope)
  return entries?.length ? entries : null
}

const LEAD_IDS_QUERY_BATCH = 40

/** Load only specific pipeline rows by lead_id (no full shard download). */
export async function readPipelineLeadsByIds(shardName, leadIds) {
  if (!pipelineLeadsTableActive()) return null
  const ids = [...new Set((leadIds || []).filter(Boolean))]
  if (!ids.length) return []

  const entries = []
  for (let i = 0; i < ids.length; i += LEAD_IDS_QUERY_BATCH) {
    const chunk = ids.slice(i, i + LEAD_IDS_QUERY_BATCH)
    const inList = chunk.map((id) => encodeURIComponent(id)).join(',')
    const rows = await supabaseRest(
      `${TABLE}?shard_name=eq.${encodeURIComponent(shardName)}&lead_id=in.(${inList})&select=entry`,
      {},
      { timeoutMs: 25_000 }
    )
    if (!Array.isArray(rows)) continue
    entries.push(...rows.map((r) => r.entry).filter(Boolean))
  }
  return entries
}

export async function readPipelineLeadById(shardName, leadId) {
  if (!leadId) return null
  const rows = await readPipelineLeadsByIds(shardName, [leadId])
  return rows[0] || null
}
