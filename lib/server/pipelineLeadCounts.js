import { CRM_STATUSES } from './crm.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { isPipelineHierarchyRbacEnabled } from './infra/config.js'
import { getScopedLeadsQuery } from './pipelineScopedQuery.js'
import { pipelineLeadsTableActive } from './pipelineLeadsTable.js'
import { readPipelineIndexDoc } from './pipelineIndex.js'
import { pipelineShardNameForUser } from './pipelineShard.js'

function emptyByStatus() {
  return CRM_STATUSES.map((status) => ({ status, count: 0 }))
}

function scopeNeedsPostgrestCount(scoped) {
  return Boolean(
    scoped.scope?.repOwnAndUnassigned ||
      scoped.scope?.managerWithUnassigned ||
      scoped.scope?.unassigned
  )
}

async function countScopedLeadsViaPostgrest(scoped, status) {
  if (!isSupabaseEnabled()) return null
  const parts = [...(scoped.postgrestParts || [])]
  parts.push('select=lead_id')
  if (status) parts.push(`lead_status=eq.${encodeURIComponent(status)}`)
  const path = `pipeline_leads?${parts.join('&')}`
  const base = String(process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/$/, '')
  const serviceKey = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      ''
  ).trim()
  if (!base || !serviceKey) return null
  try {
    const response = await fetch(`${base}/rest/v1/${path}`, {
      method: 'HEAD',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'count=exact',
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return null
    const range = response.headers.get('content-range') || ''
    const total = Number(range.split('/')[1])
    return Number.isFinite(total) ? total : null
  } catch {
    return null
  }
}

/**
 * Indexed COUNT per CRM status for sidebar / pipeline summary (<50ms target).
 * Uses ci_pipeline_status_counts_scoped RPC — no entry JSON download.
 */
export async function loadScopedPipelineStatusCounts(user, metaStore, filters = {}) {
  if (!pipelineLeadsTableActive() || !isPipelineHierarchyRbacEnabled()) {
    return null
  }
  if (!isSupabaseEnabled()) return null

  const scoped = await getScopedLeadsQuery(user, filters, metaStore)
  if (scopeNeedsPostgrestCount(scoped)) return null

  const rows = await supabaseRest(
    'rpc/ci_pipeline_status_counts_scoped',
    {
      method: 'POST',
      body: JSON.stringify({
        p_shard_name: scoped.rpc.p_shard_name,
        p_organization_id: scoped.rpc.p_organization_id,
        p_owner_id: scoped.rpc.p_owner_id,
        p_team_id: scoped.rpc.p_team_id,
        p_department_id: scoped.rpc.p_department_id,
      }),
    },
    { timeoutMs: 8_000, attempts: 2 }
  )

  if (!Array.isArray(rows)) return null

  const byStatusMap = Object.fromEntries(rows.map((r) => [r.status, Number(r.cnt) || 0]))
  const byStatus = CRM_STATUSES.map((status) => ({
    status,
    count: byStatusMap[status] || 0,
  }))
  const total = byStatus.reduce((sum, row) => sum + row.count, 0)

  return {
    total,
    byStatus,
    ready: true,
    fromSqlScope: true,
    scopeRole: scoped.role,
    updatedAt: new Date().toISOString(),
  }
}

async function readAssigneeIndexCount(shardName, assignee, status) {
  const doc = await readPipelineIndexDoc(shardName)
  const bucket = doc?.byAssignee?.[assignee]
  if (!bucket) return null
  if (status && status !== 'all' && CRM_STATUSES.includes(status)) {
    return bucket.byStatus?.find((row) => row.status === status)?.count ?? 0
  }
  return bucket.total ?? 0
}

/** Single-status COUNT via RPC. */
export async function countScopedPipelineLeads(user, metaStore, filters = {}) {
  if (!pipelineLeadsTableActive() || !isPipelineHierarchyRbacEnabled()) return null

  const scoped = await getScopedLeadsQuery(user, filters, metaStore)
  const status = scoped.status && scoped.status !== 'all' ? scoped.status : null
  const assignee = String(filters.assigneeUserId || '').trim()
  const shardName = pipelineShardNameForUser(user)

  const hasFollowUpFilter = Boolean(filters.followUpDue || filters.overdueFollowUp)

  // List queries match assignee via owner_id OR entry assignee fields — use the same PostgREST filters for COUNT.
  if (
    scopeNeedsPostgrestCount(scoped) ||
    (assignee && assignee !== '__unassigned__') ||
    hasFollowUpFilter
  ) {
    const postgrestCount = await countScopedLeadsViaPostgrest(scoped, null)
    if (postgrestCount != null) return postgrestCount
  }

  if (assignee && assignee !== '__unassigned__') {
    const indexCount = await readAssigneeIndexCount(shardName, assignee, status)
    if (indexCount != null) return indexCount
  }

  const count = await supabaseRest(
    'rpc/ci_count_pipeline_leads_scoped',
    {
      method: 'POST',
      body: JSON.stringify({
        p_shard_name: scoped.rpc.p_shard_name,
        p_organization_id: scoped.rpc.p_organization_id,
        p_owner_id: scoped.rpc.p_owner_id,
        p_team_id: scoped.rpc.p_team_id,
        p_department_id: scoped.rpc.p_department_id,
        p_status: status,
      }),
    },
    { timeoutMs: 8_000, attempts: 2 }
  )

  const sqlCount = Number(count) || 0
  if (!assignee || assignee === '__unassigned__' || sqlCount > 0) return sqlCount

  const fallback = await readAssigneeIndexCount(shardName, assignee, status)
  return fallback ?? 0
}
