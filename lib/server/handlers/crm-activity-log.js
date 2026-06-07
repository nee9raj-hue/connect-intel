import { requireUser } from '../auth.js'
import { buildActivityFeed } from '../crmWorkflow.js'
import { listPipelineSavedEntries, resolveOrgRole } from '../organizations.js'
import { sanitizeCrmForTenant } from '../tenantIsolation.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { normalizeDashboardPeriod, periodStart } from '../dashboardPeriod.js'

const ACTIVITY_FEED_LIMIT = 500

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const { pipelineStore } = await loadPipelineStoreContext(user)

  const params = new URL(req.url || '', 'http://localhost').searchParams
  let memberUserId = params.get('userId') || null
  const activityType = String(params.get('type') || '').trim().toLowerCase() || null
  const period = normalizeDashboardPeriod(params.get('period') || 'week')
  const since = periodStart(period)
  const { orgRole } = resolveOrgRole(user, pipelineStore)
  const isAdmin = user.isOrgAdmin || orgRole === 'org_admin'
  if (memberUserId && !isAdmin && String(memberUserId) !== String(user.id)) {
    memberUserId = String(user.id)
  }

  const rows = listPipelineSavedEntries(pipelineStore, user).map((entry) => ({
    ...entry,
    crm: sanitizeCrmForTenant(pipelineStore, user, entry.crm),
  }))

  let activities = buildActivityFeed(rows, { limit: ACTIVITY_FEED_LIMIT })
  activities = activities.filter((a) => {
    const t = new Date(a.createdAt).getTime()
    return !Number.isNaN(t) && t >= since
  })
  if (memberUserId) {
    const mid = String(memberUserId)
    activities = activities.filter(
      (a) => String(a.createdByUserId || a.userId || '') === mid
    )
  }
  if (activityType) {
    activities = activities.filter((a) => String(a.type || '').toLowerCase() === activityType)
  }

  return sendJson(res, 200, {
    activities: activities.slice(0, 80),
  })
}
