import { requireUser } from '../auth.js'
import { listPipelineSavedEntries, listTeamMembers, resolveOrgRole } from '../organizations.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { resolveTimeZone } from '../../calendarLocale.js'
import {
  normalizeDashboardPeriod,
  periodStart,
  previousPeriodStart,
  periodLabel,
} from '../dashboardPeriod.js'
import {
  listCrmActivities,
  countCrmActivities,
  ACTIVITY_FEED_LIMIT,
  emptyActivityRollup,
} from '../crmActivityCounts.js'
import { entriesForActivityScan } from '../crmTouchpoints.js'
import { buildActivityLogHub } from '../activityLogHub.js'

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
  const timeZone = resolveTimeZone(user, params.get('tz'))
  const since = periodStart(period, timeZone)
  const prevSince = previousPeriodStart(period, timeZone)
  const prevUntil = since
  const { orgRole } = resolveOrgRole(user, pipelineStore)
  const isAdmin = user.isOrgAdmin || orgRole === 'org_admin'
  if (memberUserId && !isAdmin && String(memberUserId) !== String(user.id)) {
    memberUserId = String(user.id)
  }

  const rows = listPipelineSavedEntries(pipelineStore, user)
  const scanned = entriesForActivityScan(rows, since)
  const prevScanned = entriesForActivityScan(rows, prevSince, prevUntil)

  const activities = listCrmActivities(pipelineStore, user, scanned, {
    since,
    memberUserId,
    activityType,
    feedLimit: ACTIVITY_FEED_LIMIT,
    responseLimit: 120,
  })

  const { org: rollup, perUser } = countCrmActivities(pipelineStore, user, scanned, {
    since,
    memberUserId,
    activityType,
    feedLimit: ACTIVITY_FEED_LIMIT,
    responseLimit: null,
  })

  const { org: prevOrg, perUser: prevPerUser } = countCrmActivities(pipelineStore, user, prevScanned, {
    since: prevSince,
    until: prevUntil,
    memberUserId,
    activityType,
    feedLimit: ACTIVITY_FEED_LIMIT,
    responseLimit: null,
  })
  const prevRollup = memberUserId
    ? prevPerUser.get(String(memberUserId)) || prevOrg
    : prevOrg

  const members = user.organizationId ? listTeamMembers(pipelineStore, user.organizationId) : []
  const usersById = new Map((pipelineStore.users || []).map((u) => [String(u.id), u]))
  const memberName = memberUserId
    ? members.find((m) => String(m.userId) === String(memberUserId))?.name ||
      usersById.get(String(memberUserId))?.name ||
      'Team member'
    : null

  const hub = buildActivityLogHub({
    activities,
    rollup: memberUserId ? perUser.get(String(memberUserId)) || rollup : rollup,
    prevRollup: prevRollup || emptyActivityRollup(),
    period,
    periodLabel: periodLabel(period),
    memberUserId,
    memberName,
    isAdmin,
    members,
    activityType,
    timeZone,
  })

  return sendJson(res, 200, {
    activities,
    hub,
    summary: rollup,
    isAdmin,
    memberOptions: members.map((m) => ({ userId: m.userId, name: m.name })),
  })
}
