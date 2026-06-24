import { resolveTimeZone } from '../calendarLocale.js'
import { emptyActivityRollup } from './crmActivityCounts.js'
import { resolveActivityLogTimeRange } from './activityLogQuery.js'
import { readActivityLogCached } from './activityLogRead.js'
import { resolveViewerScope } from './dashboardRoleScope.js'
import { readStore } from './store.js'
import { buildRepSummary } from './repSummary.js'
import { resolveRepLastCrmActivityAt } from './memberLastCrmActivity.js'
import { aggregateWorkspaceUsage } from './teamWorkspaceUsage.js'
import { canonicalActivityPeriod } from './crmActivityScope.js'
import { comparisonPeriodLabel } from './dashboardPeriod.js'
import { pickLatestCrmActivityAt } from './memberLastCrmActivity.js'

const META = ['users', 'organizations', 'organizationMemberships']

function comparisonDelta(current, previous, key) {
  const cur = Number(current?.[key]) || 0
  const prev = Number(previous?.[key]) || 0
  if (prev === 0) return cur > 0 ? 100 : null
  return Math.round(((cur - prev) / prev) * 1000) / 10
}

function buildComparison(current, previous) {
  if (!current || !previous) return null
  return {
    activitiesTotal: { delta: comparisonDelta(current, previous, 'activitiesTotal') },
    emails: { delta: comparisonDelta(current, previous, 'emails') },
    calls: { delta: comparisonDelta(current, previous, 'calls') },
    contactsOpened: { delta: comparisonDelta(current, previous, 'contactsOpened') },
    tasksCreated: { delta: comparisonDelta(current, previous, 'tasksCreated') },
    hoursInApp: { delta: comparisonDelta(current, previous, 'hoursInApp') },
    label: comparisonPeriodLabel(current.period || '7d'),
  }
}

function rollupToMemberRow(rollup, prevRollup, { hoursInApp = 0, prevHoursInApp = 0 } = {}) {
  const r = rollup || emptyActivityRollup()
  const p = prevRollup || emptyActivityRollup()
  return {
    emails: r.emails ?? 0,
    calls: r.calls ?? 0,
    meetings: r.meetings ?? 0,
    tasksCreated: r.tasksCreated ?? 0,
    notes: r.notes ?? 0,
    whatsapp: r.whatsapp ?? 0,
    activitiesTotal: r.activitiesTotal ?? 0,
    leadsTouched: r.leadsTouched ?? r.contactsOpened ?? 0,
    contactsOpened: r.contactsOpened ?? r.leadsTouched ?? 0,
    hoursInApp,
    prevHoursInApp,
    comparison: buildComparison(
      { ...r, hoursInApp, period: 'scoped' },
      { ...p, hoursInApp: prevHoursInApp }
    ),
  }
}

/**
 * Single source of truth for rep review — pipeline counts + activity log + rollup share one scope.
 */
export async function buildRepReviewPayload(viewer, repUserId, { period = '7d', timeZone = null } = {}) {
  const uid = String(repUserId || '').trim()
  if (!uid) throw new Error('userId is required')

  const metaStore = await readStore({ only: META })
  const scope = await resolveViewerScope(viewer, metaStore, { requestedMemberId: uid })
  const allowedId = scope.scopedMemberId || (scope.isAdmin ? uid : viewer.id)
  if (String(allowedId) !== uid) {
    throw new Error('You cannot view this rep')
  }

  const periodNorm = canonicalActivityPeriod(period)
  const tz = resolveTimeZone(viewer, timeZone)
  const rangeParams = new URLSearchParams({ period: periodNorm })
  const range = resolveActivityLogTimeRange(viewer, rangeParams, tz)

  const storeUser = (metaStore.users || []).find((u) => String(u.id) === uid) || {}
  const usage = aggregateWorkspaceUsage(storeUser, range.since)
  const prevUsage = aggregateWorkspaceUsage(storeUser, range.prevSince)

  const [pipelineSummary, activity] = await Promise.all([
    buildRepSummary(viewer, uid, { period: periodNorm }),
    readActivityLogCached(viewer, {
      period: periodNorm,
      since: range.since,
      until: range.until,
      prevSince: range.prevSince,
      prevUntil: range.prevUntil,
      memberUserId: uid,
      limit: 200,
      offset: 0,
      timeZone: tz,
      periodLabel: range.periodLabel,
      preferCrm: true,
    }),
  ])

  const activities = activity.activities || []
  const lastActiveAt =
    pickLatestCrmActivityAt(...activities.map((a) => a.createdAt)) ||
    (await resolveRepLastCrmActivityAt(uid, { user: viewer, orgId: viewer.organizationId }))

  const rollup = rollupToMemberRow(activity.rollup, activity.prevRollup, {
    hoursInApp: usage.hours,
    prevHoursInApp: prevUsage.hours,
  })

  const repName =
    scope.rosterMembers?.find((m) => String(m.userId) === uid)?.name ||
    storeUser.name ||
    storeUser.email ||
    'Team member'

  return {
    rep: {
      userId: uid,
      name: repName,
      email: storeUser.email || null,
      open: pipelineSummary.open ?? 0,
      followups: pipelineSummary.followups ?? 0,
      wonMonth: pipelineSummary.wonMonth ?? 0,
      lastActiveAt,
    },
    period: periodNorm,
    periodLabel: range.periodLabel,
    rollup,
    comparison: rollup.comparison,
    activities,
    activityTotal: activity.pagination?.total ?? activities.length,
    memberOptions: scope.memberOptions || [],
    _scope: {
      since: range.since,
      until: range.until,
      source: activity._source,
    },
    updatedAt: new Date().toISOString(),
  }
}
