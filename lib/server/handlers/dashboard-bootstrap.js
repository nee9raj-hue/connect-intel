import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildDashboardBootstrap } from '../dashboardBootstrap.js'
import { cacheGet, cacheSet } from '../infra/cache.js'
import { resolveViewerScope, resolveViewerRoleFlags } from '../dashboardRoleScope.js'
import { assertOrgPermission, permissionDeniedResponse } from '../permissionEnforce.js'
import { readStore } from '../store.js'

const TTL = 120
const STALE = 300

function cacheKey(user, assigneeUserId) {
  const scope = assigneeUserId ? String(assigneeUserId) : 'all'
  return `dashboard:bootstrap:${user.id}:${user.organizationId || 'solo'}:${scope}`
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const requestedAssignee = String(params.get('assigneeUserId') || params.get('userId') || '').trim() || null

  let scopedAssignee = requestedAssignee
  if (user.organizationId && user.accountType === 'company') {
    const meta = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
    const { isAdmin, isManager } = resolveViewerRoleFlags(user, meta)
    if (isAdmin || isManager) {
      try {
        await assertOrgPermission(user, 'view_analytics', meta)
      } catch (permError) {
        const denied = permissionDeniedResponse(permError)
        return sendJson(res, denied.status, denied.body)
      }
    }
    const scope = await resolveViewerScope(user, meta, { requestedMemberId: requestedAssignee })
    scopedAssignee = scope.scopedMemberId
  }

  const key = cacheKey(user, scopedAssignee)
  const cached = await cacheGet(key, { ttlSeconds: TTL, staleSeconds: STALE })
  if (cached.value && !cached.stale) {
    return sendJson(res, 200, { ...cached.value, _cache: { hit: true } })
  }

  try {
    const dashboard = await buildDashboardBootstrap(user, { assigneeUserId: scopedAssignee })
    const payload = { dashboard, lastUpdated: dashboard.lastUpdated }
    void cacheSet(key, payload, { ttlSeconds: TTL })
    return sendJson(res, 200, { ...payload, _cache: { hit: false, stale: cached.stale } })
  } catch (error) {
    console.error('dashboard/bootstrap failed:', error)
    return sendJson(res, 500, { error: error.message || 'Could not load dashboard' })
  }
}
