import { CRM_STATUSES } from './crm.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { isPipelineHierarchyRbacEnabled } from './infra/config.js'
import { getScopedLeadsQuery } from './pipelineScopedQuery.js'
import { pipelineLeadsTableActive } from './pipelineLeadsTable.js'

function emptyByStatus() {
  return CRM_STATUSES.map((status) => ({ status, count: 0 }))
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

/** Single-status COUNT via RPC. */
export async function countScopedPipelineLeads(user, metaStore, filters = {}) {
  if (!pipelineLeadsTableActive() || !isPipelineHierarchyRbacEnabled()) return null

  const scoped = await getScopedLeadsQuery(user, filters, metaStore)
  const status = scoped.status && scoped.status !== 'all' ? scoped.status : null

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

  return Number(count) || 0
}
