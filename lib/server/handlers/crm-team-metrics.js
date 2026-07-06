import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { assertOrgPermission, permissionDeniedResponse } from '../permissionEnforce.js'
import { cacheGet, cacheSet, teamMetricsCacheKey } from '../infra/cache.js'
import { readTeamMetricsSnapshot, buildTeamMetricsWarmFallback } from '../dashboardSnapshots.js'
import { enqueueDashboardSnapshotRefresh } from '../queue/producer.js'
import { computeTeamMetricsLegacy } from '../dashboardLegacy.js'
import { resolveTimeZone } from '../../calendarLocale.js'
import { timeAsync } from '../infra/metrics.js'
import { readStore } from '../store.js'
import { loadOrgTeamMembers, memberOptionsFromTeam } from '../teamMembersFresh.js'
import { resolveViewerScope, resolveViewerRoleFlags } from '../dashboardRoleScope.js'
import { enrichIntelMembersLastActive } from '../memberLastCrmActivity.js'
import { aggregateWorkspaceUsage } from '../teamWorkspaceUsage.js'
import { canonicalActivityPeriod } from '../crmActivityScope.js'
import { readActivityLogCached } from '../activityLogRead.js'
import {
  syncTeamIntelligenceMembers,
  memberOptionsFromIntel,
  loadPerUserRollupsFromCrm,
  overlayScopedMemberIntelligence,
} from '../teamMetricsEnrich.js'
import {
  parseActivityLogFilters,
  resolveActivityLogLeadIds,
  resolveActivityLogTimeRange,
} from '../activityLogQuery.js'

const TTL = 60
const STALE = 180

async function applyMemberLastActive(payload, user, { force = false } = {}) {
  if (!payload?.teamIntelligence?.members?.length || !user?.organizationId) return payload
  if (payload._lastActiveEnriched && !force) return payload
  const members = await enrichIntelMembersLastActive(payload.teamIntelligence.members, {
    orgId: user.organizationId,
    user,
  })
  return {
    ...payload,
    _lastActiveEnriched: true,
    teamIntelligence: {
      ...payload.teamIntelligence,
      members,
    },
  }
}

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
  const period = canonicalActivityPeriod(range.period === 'custom' ? '7d' : range.period)

  const fresh = params.get('fresh') === '1'
  const preferCrm = params.get('source') === 'crm' || fresh
  const summaryOnly = params.get('summary') === '1'
  const cacheKey = teamMetricsCacheKey(user, period, memberUserId || 'all')
  const cached = await cacheGet(cacheKey, { ttlSeconds: TTL, staleSeconds: STALE })

  if (cached.value && !fresh && !filters.status && !filters.tagId && !params.get('from')) {
    if (summaryOnly) {
      return sendJson(res, 200, {
        ...cached.value,
        _cache: { hit: true, stale: Boolean(cached.stale), source: cached.source },
      })
    }
    let hit = {
      ...cached.value,
      _cache: { hit: true, stale: Boolean(cached.stale), source: cached.source },
    }
    if (!cached.stale && !memberUserId && !hit._membersSynced) {
      const metaForScope = user.organizationId
        ? await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
        : null
      const viewerScope = metaForScope
        ? await resolveViewerScope(user, metaForScope, { requestedMemberId: memberUserId })
        : null
      if (viewerScope?.rosterMembers?.length) {
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
    }
    hit = await applyMemberLastActive(hit, user)
    return sendJson(res, 200, hit)
  }

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
  }

  const metaForScope = user.organizationId
    ? await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
    : null
  const viewerScope = metaForScope
    ? await resolveViewerScope(user, metaForScope, { requestedMemberId: memberUserId })
    : null

  const scopedMemberId = viewerScope?.scopedMemberId ?? memberUserId ?? null

  const row = await readTeamMetricsSnapshot(user, { period, memberUserId: scopedMemberId })

  let payload
  if (row?.payload) {
    payload = {
      ...row.payload,
      _snapshot: { fresh: row.fresh, source: row.source },
    }
  } else {
    const meta = await readStore({
      only: ['organizations', 'organizationMemberships', 'users', 'searches', 'marketingCampaigns'],
    })
    const LEGACY_BUDGET_MS = 12_000
    try {
      payload = await Promise.race([
        timeAsync('connectintel_team_metrics_legacy', { period }, () =>
          computeTeamMetricsLegacy(user, {
            period,
            memberUserId: scopedMemberId,
            detailed: false,
            timeZone,
          })
        ),
        new Promise((resolve) => setTimeout(() => resolve(null), LEGACY_BUDGET_MS)),
      ])
      if (payload) {
        payload._snapshot = { fresh: false, source: 'legacy_compute' }
      }
    } catch (error) {
      console.warn('team-metrics legacy fallback failed:', error?.message || error)
      payload = null
    }
    if (!payload) {
      payload = await buildTeamMetricsWarmFallback(user, { ...meta, savedLeads: [] }, period)
      if (user.organizationId) {
        void enqueueDashboardSnapshotRefresh(user.organizationId, user.id, period)
      }
    }
  }

  let leadIds = null
  if (filters.status || filters.tagId) {
    leadIds = await resolveActivityLogLeadIds(user, {
      status: filters.status,
      tagId: filters.tagId,
    })
  }

  const snapshotReady = Boolean(row?.payload && row.source === 'snapshot')

  const needsLiveRollup =
    !summaryOnly && (fresh || preferCrm || filters.status || filters.tagId || !snapshotReady)

  if (needsLiveRollup) {
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
      rollupOnly: true,
    })

    payload = overlayActivityRollup(payload, activity.rollup)
  }

  if (
    needsLiveRollup &&
    !scopedMemberId &&
    viewerScope?.rosterMembers?.length &&
    !payload._membersSynced
  ) {
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

  if (scopedMemberId) {
    try {
      const activityScoped = await readActivityLogCached(user, {
        period: range.period,
        since: range.since,
        until: range.until,
        prevSince: range.prevSince,
        prevUntil: range.prevUntil,
        memberUserId: scopedMemberId,
        limit: 1,
        offset: 0,
        timeZone: range.timeZone,
        periodLabel: range.periodLabel,
        preferCrm: true,
        rollupOnly: true,
      })
      const scopedUser = metaForScope?.users?.find((u) => String(u.id) === String(scopedMemberId))
      const usage = scopedUser ? aggregateWorkspaceUsage(scopedUser, range.since) : {}
      payload = overlayScopedMemberIntelligence(payload, scopedMemberId, activityScoped, usage)
      payload._lastActiveEnriched = true
    } catch (error) {
      console.warn('team-metrics scoped member sync:', error?.message || error)
    }
  } else if (!summaryOnly) {
    payload = await applyMemberLastActive(payload, user)
  }

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
    void cacheSet(
      cacheKey,
      { ...payload, _membersSynced: Boolean(payload._membersSynced), _lastActiveEnriched: Boolean(payload._lastActiveEnriched) },
      { ttlSeconds: TTL }
    )
  }

  return sendJson(res, 200, {
    ...payload,
    _cache: { hit: false, stale: cached.stale },
  })
}
