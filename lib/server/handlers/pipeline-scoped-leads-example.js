/**
 * Example controller — HubSpot-style scoped lead list (<50ms target).
 *
 * Flow:
 *   1. getScopedLeadsQuery(user, filters) → role-based WHERE (owner / team / department)
 *   2. Parallel PostgREST page + ci_count_pipeline_leads_scoped RPC
 *   3. No full shard download; sidebar counts use ci_pipeline_status_counts_scoped
 *
 * Production list views use the same path via loadScopedLeadsListView in saved-leads.js.
 */
import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadScopedLeadsListView } from '../pipelineListLoad.js'
import { timeAsync } from '../infra/metrics.js'

function parseScopedListQuery(url) {
  const minLeadScore = url.searchParams.has('minLeadScore')
    ? Number(url.searchParams.get('minLeadScore'))
    : null
  return {
    status: String(url.searchParams.get('status') || 'all').trim(),
    assigneeUserId: String(url.searchParams.get('assigneeUserId') || '').trim() || null,
    scope: String(url.searchParams.get('scope') || url.searchParams.get('hierarchyScope') || '').trim() || null,
    minLeadScore: Number.isFinite(minLeadScore) ? minLeadScore : null,
    offset: Math.max(0, Math.floor(Number(url.searchParams.get('offset') || 0)) || 0),
    limit: Math.min(100, Math.max(1, Math.floor(Number(url.searchParams.get('limit') || 50)) || 50)),
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  try {
    const url = new URL(req.url || '', 'http://local')
    const filters = parseScopedListQuery(url)
    const { offset, limit, ...filterOnly } = filters

    const list = await timeAsync('connectintel_scoped_leads_list', { role: user.pipelineRole }, () =>
      loadScopedLeadsListView(user, { offset, limit, filters: filterOnly, light: true })
    )

    if (!list) {
      return sendJson(res, 503, {
        error: 'Scoped SQL path unavailable (run team_hierarchy_rbac migration or enable USE_PIPELINE_HIERARCHY_RBAC)',
      })
    }

    return sendJson(res, 200, {
      leads: list.leads,
      total: list.total,
      limit: list.limit,
      offset: list.offset,
      hasMore: list.hasMore,
      scopeRole: list.scopeRole,
      pipelineSource: 'pipeline_leads_scoped_sql',
    })
  } catch (error) {
    console.error('pipeline/scoped-leads-example failed:', error)
    return sendJson(res, 500, { error: error.message || 'Scoped lead list failed' })
  }
}
