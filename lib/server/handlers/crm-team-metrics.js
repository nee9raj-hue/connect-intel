import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { cacheGet, cacheSet, teamMetricsCacheKey } from '../infra/cache.js'
import { readTeamMetricsSnapshot, buildTeamMetricsWarmFallback } from '../dashboardSnapshots.js'
import { computeTeamMetricsLegacy } from '../dashboardLegacy.js'
import { resolveTimeZone } from '../../calendarLocale.js'
import { timeAsync } from '../infra/metrics.js'
import { readStore } from '../store.js'
import { loadOrgTeamMembers, memberOptionsFromTeam } from '../teamMembersFresh.js'
import { resolveViewerScope } from '../dashboardRoleScope.js'
import {
  syncTeamIntelligenceMembers,
  memberOptionsFromIntel,
  loadPerUserRollupsFromCrm,
} from '../teamMetricsEnrich.js'
import { readActivityLogCached } from '../activityLogRead.js'
import {
  parseActivityLogFilters,
  resolveActivityLogLeadIds,
  resolveActivityLogTimeRange,
} from '../activityLogQuery.js'

const TTL = 60
const STALE = 180

function overlayActivityRollup(payload, rollup) {
  if (!rollup || !payload) return payload
  const intel = payload.teamIntelligence || {}
  const nextRollup = {
    ...(intel.rollup || {}),
    emails: rollup.emails,
    calls: rollup.calls,
    meetings: rollup.meetings,
    tasksCreated: rollup.tasksCreated,
    notes: rollup.notes,
    whatsapp: rollup.whatsapp,
    activitiesTotal: rollup.activitiesTotal,
    leadsTouched: rollup.leadsTouched,
    contactsOpened: rollup.contactsOpened ?? rollup.leadsTouched,
  }
  return {
    ...payload,
    teamIntelligence: {
      ...intel,
      rollup: nextRollup,
    },
    summary: {
      ...(payload.summary || {}),
      emailsSent: rollup.emails,
      callsLogged: rollup.calls,
      meetingsSet: rollup.meetings,
      tasksCreated: rollup.tasksCreated,
      contactsWorked: rollup.contactsOpened ?? rollup.leadsTouched,
    },
  }
}

/** Team intelligence summary — no activity timeline, no full pipeline read when snapshot exists. */
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
  const memberUserId = filters.memberUserId
  const period = range.period === 'custom' ? 'week' : range.period

  const metaForScope = user.organizationId
    ? await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
    : null
  const viewerScope = metaForScope
    ? await resolveViewerScope(user, metaForScope, { requestedMemberId: memberUserId })
    : null

  const fresh = params.get('fresh') === '1'
  const preferCrm = params.get('source') === 'crm' || fresh
  const cacheKey = teamMetricsCacheKey(user, period, viewerScope?.scopedMemberId ?? memberUserId)
  const cached = await cacheGet(cacheKey, { ttlSeconds: TTL, staleSeconds: STALE })
  if (
    cached.value &&
    !cached.stale &&
    !fresh &&
    !filters.status &&
    !filters.tagId &&
    !params.get('from')
  ) {
    let hit = { ...cached.value, _cache: { hit: true, source: cached.source } }
    if (
      !viewerScope?.scopedMemberId &&
      viewerScope?.rosterMembers?.length &&
      !cached.value._membersSynced
    ) {
      try {
        const perUserRollups = await loadPerUserRollupsFromCrm(user, {
          since: range.since,
          until: range.until,
          prevSince: range.prevSince,
          prevUntil: range.prevUntil,
        })
        if (perUserRollups?.current?.size) {
          hit = syncTeamIntelligenceMembers(hit, perUserRollups.current, viewerScope.rosterMembers)
          hit._membersSynced = true
          void cacheSet(cacheKey, hit, { ttlSeconds: TTL })
        }
      } catch {
        // keep cached members
      }
    }
    if (viewerScope?.rosterMembers?.length || hit.teamIntelligence?.members?.length) {
      hit.memberOptions = memberOptionsFromIntel(
        viewerScope?.rosterMembers,
        hit.teamIntelligence?.members
      )
    } else if (viewerScope?.memberOptions?.length) {
      hit.memberOptions = viewerScope.memberOptions
    } else if (!hit.memberOptions?.length && user.organizationId) {
      hit.memberOptions = memberOptionsFromTeam(await loadOrgTeamMembers(user.organizationId))
    }
    return sendJson(res, 200, hit)
  }

  const scopedMemberId = viewerScope?.scopedMemberId ?? memberUserId ?? null

  const row = await readTeamMetricsSnapshot(user, { period, memberUserId: scopedMemberId })

  let payload
  if (row?.payload) {
    payload = {
      ...row.payload,
      _snapshot: { fresh: row.fresh, source: row.source },
    }
  } else {
    try {
      payload = await timeAsync('connectintel_team_metrics_legacy', { period }, () =>
        computeTeamMetricsLegacy(user, { period, memberUserId: scopedMemberId, detailed: false, timeZone })
      )
      payload._snapshot = { fresh: false, source: 'legacy_compute' }
    } catch (error) {
      console.warn('team-metrics legacy fallback failed:', error?.message || error)
      const meta = await readStore({ only: ['organizations', 'organizationMemberships', 'users'] })
      payload = await buildTeamMetricsWarmFallback(user, { ...meta, savedLeads: [] }, period)
    }
  }

  let leadIds = null
  if (filters.status || filters.tagId) {
    leadIds = await resolveActivityLogLeadIds(user, {
      status: filters.status,
      tagId: filters.tagId,
    })
  }

  const activity = await readActivityLogCached(user, {
    period: range.period,
    since: range.since,
    until: range.until,
    prevSince: range.prevSince,
    prevUntil: range.prevUntil,
    memberUserId: scopedMemberId,
    leadIds,
    limit: 1,
    offset: 0,
    timeZone: range.timeZone,
    periodLabel: range.periodLabel,
    status: filters.status,
    tagId: filters.tagId,
    from: params.get('from'),
    to: params.get('to'),
    fresh,
    preferCrm,
  })

  payload = overlayActivityRollup(payload, activity.rollup)

  if (!scopedMemberId && viewerScope?.rosterMembers?.length) {
    try {
      const perUserRollups = await loadPerUserRollupsFromCrm(user, {
        since: range.since,
        until: range.until,
        prevSince: range.prevSince,
        prevUntil: range.prevUntil,
      })
      if (perUserRollups?.current?.size) {
        payload = syncTeamIntelligenceMembers(
          payload,
          perUserRollups.current,
          viewerScope.rosterMembers
        )
        payload._membersSynced = true
      }
    } catch (error) {
      console.warn('team-metrics per-user enrich:', error?.message || error)
    }
  }

  payload.period = range.period
  payload.periodLabel = range.periodLabel

  payload.memberOptions = memberOptionsFromIntel(
    viewerScope?.rosterMembers,
    payload.teamIntelligence?.members
  )
  if (!payload.memberOptions?.length) {
    payload.memberOptions =
      viewerScope?.memberOptions ||
      memberOptionsFromTeam(user.organizationId ? await loadOrgTeamMembers(user.organizationId) : [])
  }
  if (viewerScope) {
    payload.isManager = viewerScope.isManager
    payload.memberUserId = viewerScope.scopedMemberId
  }

  if (!filters.status && !filters.tagId && !params.get('from')) {
    void cacheSet(cacheKey, { ...payload, _membersSynced: Boolean(payload._membersSynced) }, { ttlSeconds: TTL })
  }

  return sendJson(res, 200, {
    ...payload,
    _cache: { hit: false, stale: cached.stale },
  })
}
