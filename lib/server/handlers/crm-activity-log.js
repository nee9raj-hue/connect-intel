import { requireUser } from '../auth.js'
import { listPipelineSavedEntries, resolveOrgRole } from '../organizations.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { normalizeDashboardPeriod, periodStart } from '../dashboardPeriod.js'
import { listCrmActivities, ACTIVITY_FEED_LIMIT } from '../crmActivityCounts.js'
import { entriesForActivityScan } from '../crmTouchpoints.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const { pipelineStore } = await loadPipelineStoreContext(user, { mergeMonolithCrm: true })

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

  const rows = listPipelineSavedEntries(pipelineStore, user)
  const scanned = entriesForActivityScan(rows, since)
  const activities = listCrmActivities(pipelineStore, user, scanned, {
    since,
    memberUserId,
    activityType,
    feedLimit: ACTIVITY_FEED_LIMIT,
    responseLimit: 80,
  })

  return sendJson(res, 200, { activities })
}
