import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { resolveTimeZone } from '../../calendarLocale.js'
import { periodStart } from '../dashboardPeriod.js'
import { resolveActivityLogTimeRange } from '../activityLogQuery.js'
import { readActivityTimelineCached } from '../activityTimelineRead.js'

/** Activity feed / timeline — lazy-loaded after team summary. */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const timeZone = resolveTimeZone(user, params.get('tz'))
  const rawPeriod = String(params.get('period') || '').trim()
  const range = resolveActivityLogTimeRange(user, params, timeZone)
  let period = range.period === 'custom' ? 'week' : range.period
  let since = range.since
  let until = range.until
  // Legacy dashboard sent period=week for the "Last 7 days" pill — use rolling 7d for the feed window.
  if (!params.get('from') && (rawPeriod === 'week' || rawPeriod === '7d')) {
    period = '7d'
    since = periodStart('7d', timeZone)
    until = Infinity
  }
  const memberUserId = params.get('userId') || null
  const fresh = params.get('fresh') === '1'
  const preferCrm = params.get('source') === 'crm'

  const payload = await readActivityTimelineCached(user, {
    period,
    memberUserId,
    fresh,
    preferCrm,
    since: range.since,
    until: range.until,
  })

  return sendJson(res, 200, payload)
}
