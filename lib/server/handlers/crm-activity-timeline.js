import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { normalizeDashboardPeriod } from '../dashboardPeriod.js'
import { readActivityTimelineCached } from '../activityTimelineRead.js'

/** Activity feed / timeline — lazy-loaded after team summary. */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const period = normalizeDashboardPeriod(params.get('period'))
  const memberUserId = params.get('userId') || null

  const payload = await readActivityTimelineCached(user, { period, memberUserId })

  return sendJson(res, 200, payload)
}
