import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { resolveTimeZone } from '../../calendarLocale.js'
import { emptyActivityRollup } from '../crmActivityCounts.js'
import { buildActivityLogHub } from '../activityLogHub.js'
import { readActivityLogCached, ACTIVITY_LOG_FEED_LIMIT } from '../activityLogRead.js'
import {
  parseActivityLogFilters,
  resolveActivityLogLeadIds,
  resolveActivityLogTimeRange,
} from '../activityLogQuery.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const filters = parseActivityLogFilters(params)
  const timeZone = resolveTimeZone(user, params.get('tz'))
  const range = resolveActivityLogTimeRange(user, params, timeZone)
  const limit = Math.max(1, Math.min(200, Number(params.get('limit')) || ACTIVITY_LOG_FEED_LIMIT))
  const offset = Math.max(0, Number(params.get('offset')) || 0)

  let leadIds = null
  if (filters.status || filters.tagId) {
    leadIds = await resolveActivityLogLeadIds(user, {
      status: filters.status,
      tagId: filters.tagId,
    })
  }

  const fresh = params.get('fresh') === '1'
  const preferCrm = params.get('source') === 'crm'

  const result = await readActivityLogCached(user, {
    period: range.period,
    since: range.since,
    until: range.until,
    prevSince: range.prevSince,
    prevUntil: range.prevUntil,
    memberUserId: filters.memberUserId,
    activityType: filters.activityType,
    leadIds,
    limit,
    offset,
    timeZone: range.timeZone,
    periodLabel: range.periodLabel,
    status: filters.status,
    tagId: filters.tagId,
    from: params.get('from'),
    to: params.get('to'),
    fresh,
    preferCrm,
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
    periodLabel: periodLabelOverride,
  } = result

  const hub = buildActivityLogHub({
    activities,
    prevActivities: [],
    rollup: rollup || emptyActivityRollup(),
    prevRollup: prevRollup || emptyActivityRollup(),
    period: range.period,
    periodLabel: periodLabelOverride || range.periodLabel,
    memberUserId: result.memberUserId,
    memberName,
    isAdmin,
    members,
    activityType: filters.activityType,
    timeZone: range.timeZone,
  })

  return sendJson(res, 200, {
    activities,
    hub,
    summary: rollup || emptyActivityRollup(),
    isAdmin,
    memberOptions: result.memberOptions || members.map((m) => ({ userId: m.userId, name: m.name })),
    pagination,
    warming: Boolean(warming),
    filters: {
      status: filters.status,
      tagId: filters.tagId,
      from: params.get('from') || null,
      to: params.get('to') || null,
      leadScopeCount: Array.isArray(leadIds) ? leadIds.length : null,
    },
    _source,
    _cache,
  })
}
