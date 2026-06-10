import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { resolveTimeZone } from '../../calendarLocale.js'
import {
  normalizeDashboardPeriod,
  periodStart,
  previousPeriodStart,
  periodLabel,
} from '../dashboardPeriod.js'
import { emptyActivityRollup } from '../crmActivityCounts.js'
import { buildActivityLogHub } from '../activityLogHub.js'
import { readActivityLogCached, ACTIVITY_LOG_FEED_LIMIT } from '../activityLogRead.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const memberUserId = params.get('userId') || null
  const activityType = String(params.get('type') || '').trim().toLowerCase() || null
  const period = normalizeDashboardPeriod(params.get('period') || 'week')
  const timeZone = resolveTimeZone(user, params.get('tz'))
  const since = periodStart(period, timeZone)
  const prevSince = previousPeriodStart(period, timeZone)
  const prevUntil = since
  const limit = Math.max(1, Math.min(200, Number(params.get('limit')) || ACTIVITY_LOG_FEED_LIMIT))
  const offset = Math.max(0, Number(params.get('offset')) || 0)

  const result = await readActivityLogCached(user, {
    period,
    since,
    prevSince,
    prevUntil,
    memberUserId,
    activityType,
    limit,
    offset,
    timeZone,
  })

  const {
    activities,
    rollup,
    prevRollup,
    isAdmin,
    members,
    memberName,
    pagination,
    warming,
    _source,
    _cache,
  } = result

  const hub = buildActivityLogHub({
    activities,
    rollup: rollup || emptyActivityRollup(),
    prevRollup: prevRollup || emptyActivityRollup(),
    period,
    periodLabel: periodLabel(period),
    memberUserId: result.memberUserId,
    memberName,
    isAdmin,
    members,
    activityType,
    timeZone,
  })

  return sendJson(res, 200, {
    activities,
    hub,
    summary: rollup || emptyActivityRollup(),
    isAdmin,
    memberOptions: members.map((m) => ({ userId: m.userId, name: m.name })),
    pagination,
    warming: Boolean(warming),
    _source,
    _cache,
  })
}
