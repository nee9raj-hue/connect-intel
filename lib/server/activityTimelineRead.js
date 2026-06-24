import { readStore } from './store.js'
import { resolveTimeZone } from '../calendarLocale.js'
import { normalizeDashboardPeriod, periodStart, previousPeriodStart, MS_DAY } from './dashboardPeriod.js'
import { readActivityTimelineSnapshot } from './dashboardSnapshots.js'
import { enqueueDashboardSnapshotRefresh } from './queue/producer.js'
import { readActivityLogCached } from './activityLogRead.js'
import {
  isPipelineActivitiesTableEnabled,
  listPipelineActivities,
  newestPipelineActivityMs,
  orgHasPipelineActivities,
} from './pipelineActivitiesTable.js'
import {
  buildTeamActivityTimeline,
  mapCrmActivityToTimelineItem,
  mergeTimelineItems,
} from './teamActivityTimeline.js'
import { loadPipelineStoreContext } from './pipelineShard.js'
import { listPipelineSavedEntries } from './organizations.js'
import { entriesForActivityScanWindows } from './crmTouchpoints.js'
import { isFreightDealOrg } from '../freightDeal.js'
import { cacheGet, cacheSet, activityTimelineCacheKey } from './infra/cache.js'

const TIMELINE_LIMIT = 100
const CACHE_TTL = 30
const CACHE_STALE = 90

function filterActivitiesForMember(activities, memberUserId) {
  if (!memberUserId) return activities || []
  const mid = String(memberUserId)
  return (activities || []).filter(
    (act) => String(act.createdByUserId || act.userId || '') === mid
  )
}

function filterTimelineByTime(items, { since, until = Infinity } = {}) {
  if (since == null && until === Infinity) return items || []
  return (items || []).filter((item) => {
    const t = new Date(item.at || item.createdAt || 0).getTime()
    if (!Number.isFinite(t)) return false
    if (since != null && t < since) return false
    if (until !== Infinity && t >= until) return false
    return true
  })
}

function newestTimelineMs(items) {
  let max = 0
  for (const item of items || []) {
    const t = new Date(item.at || item.createdAt || 0).getTime()
    if (Number.isFinite(t) && t > max) max = t
  }
  return max
}

function isTimelineStale(items, since) {
  if (!items?.length) return true
  const newest = newestTimelineMs(items)
  if (!newest) return true
  if (since != null && newest < since) return true
  return Date.now() - newest > MS_DAY
}

function uniqueTimelineActors(items) {
  return new Set(
    (items || []).map((item) => String(item.actorUserId || item.actorId || '')).filter(Boolean)
  )
}

/**
 * Team Intelligence activity feed — same indexed source as CRM activity log when available.
 */
export async function readActivityTimeline(
  user,
  {
    period = 'week',
    memberUserId = null,
    allowLegacyScan = true,
    preferCrm = false,
    fresh = false,
    since: sinceOverride = null,
    until: untilOverride = Infinity,
  } = {}
) {
  const dashboardPeriod = normalizeDashboardPeriod(period)
  const tz = resolveTimeZone(user, null)
  const since = sinceOverride ?? periodStart(dashboardPeriod, tz)
  const until = untilOverride ?? Infinity
  const prevSince = previousPeriodStart(dashboardPeriod, tz)
  const orgId = user.organizationId
  const scopedMemberId = memberUserId ? String(memberUserId) : null

  let activityTimeline = []
  let source = 'empty'
  let warming = true
  let snapshotFresh = false

  const meta = await readStore({ only: ['users', 'organizations'] })
  const usersById = new Map((meta.users || []).map((u) => [String(u.id), u]))

  const snapshot = orgId
    ? await readActivityTimelineSnapshot(user, { period: dashboardPeriod, memberUserId: scopedMemberId })
    : null

  snapshotFresh = Boolean(snapshot?.fresh)
  const snapshotExtras = (snapshot?.activityTimeline || []).filter((item) => item.kind !== 'activity')

  let tableReady =
    orgId && isPipelineActivitiesTableEnabled() && (await orgHasPipelineActivities(orgId))

  if (tableReady && since != null) {
    const newestIdx = await newestPipelineActivityMs(orgId)
    if (newestIdx > 0 && newestIdx < since) {
      tableReady = false
    }
  }

  // Live CRM first — old clients still call this endpoint for Team review.
  if (preferCrm || fresh || !scopedMemberId) {
    try {
      const log = await readActivityLogCached(user, {
        period: dashboardPeriod,
        since,
        until,
        prevSince,
        prevUntil: since,
        memberUserId: scopedMemberId,
        limit: TIMELINE_LIMIT,
        offset: 0,
        preferCrm: true,
        fresh: true,
      })
      const crmTimeline = (log.activities || []).map(mapCrmActivityToTimelineItem)
      if (crmTimeline.length) {
        activityTimeline = crmTimeline
        source = log._source || 'crm_via_activity_log'
        warming = false
      }
    } catch (error) {
      console.warn('activity-timeline CRM-first read:', error?.message || error)
    }
  }

  if (!activityTimeline.length && tableReady) {
    try {
      const feed = await listPipelineActivities(orgId, {
        since,
        actorId: scopedMemberId,
        limit: TIMELINE_LIMIT,
        offset: 0,
        usersById,
      })
      if (feed.rows.length) {
        activityTimeline = feed.rows.map(mapCrmActivityToTimelineItem)
        source = 'pipeline_activities'
        warming = false
      }
    } catch (error) {
      console.warn('activity-timeline table read:', error?.message || error)
    }
  }

  if (!activityTimeline.length && snapshot?.activityTimeline?.length) {
    activityTimeline = filterTimelineByTime(snapshot.activityTimeline, { since, until })
    if (activityTimeline.length) {
      source = snapshot.source || 'snapshot'
      warming = !snapshotFresh
    }
  }

  if (!activityTimeline.length && snapshot?.activityLogActivities?.length) {
    activityTimeline = filterTimelineByTime(
      filterActivitiesForMember(snapshot.activityLogActivities, scopedMemberId).map(
        mapCrmActivityToTimelineItem
      ),
      { since, until }
    )
    if (activityTimeline.length) {
      source = 'snapshot_feed'
      warming = !snapshotFresh
    }
  }

  activityTimeline = filterTimelineByTime(activityTimeline, { since, until })

  const timelineStale = isTimelineStale(activityTimeline, since)
  const singleRepDominated =
    !scopedMemberId && uniqueTimelineActors(activityTimeline).size <= 1 && activityTimeline.length > 0

  if (preferCrm || timelineStale || singleRepDominated || !activityTimeline.length) {
    try {
      const log = await readActivityLogCached(user, {
        period: dashboardPeriod,
        since,
        until,
        prevSince,
        prevUntil: since,
        memberUserId: scopedMemberId,
        limit: TIMELINE_LIMIT,
        offset: 0,
        preferCrm: true,
        fresh,
      })
      const crmTimeline = (log.activities || []).map(mapCrmActivityToTimelineItem)
      const crmNewer = newestTimelineMs(crmTimeline) > newestTimelineMs(activityTimeline)
      if (
        crmTimeline.length &&
        (preferCrm || timelineStale || crmNewer || singleRepDominated || !activityTimeline.length)
      ) {
        activityTimeline = crmTimeline
        source = log._source || 'crm_via_activity_log'
        warming = false
      }
    } catch (error) {
      console.warn('activity-timeline CRM read:', error?.message || error)
    }
  }

  if (activityTimeline.length && snapshotExtras.length) {
    const filteredExtras = filterTimelineByTime(snapshotExtras, { since, until })
    activityTimeline = mergeTimelineItems(activityTimeline, filteredExtras, TIMELINE_LIMIT)
  }

  if (!activityTimeline.length && allowLegacyScan) {
    const { pipelineStore, visible } = await loadPipelineStoreContext(user, { mergeMonolithCrm: true })
    const store = { ...pipelineStore, savedLeads: visible }
    const allEntries = listPipelineSavedEntries(store, user)
    const entries = entriesForActivityScanWindows(
      allEntries,
      [{ since, until: Infinity }],
      1500
    )
    const org = (meta.organizations || []).find((o) => o.id === orgId)
    activityTimeline = buildTeamActivityTimeline(store, user, entries, {
      since,
      memberUserId: scopedMemberId,
      limit: TIMELINE_LIMIT,
      freightOrg: isFreightDealOrg(org, user),
    })
    if (activityTimeline.length) {
      source = 'legacy_scan'
      warming = false
    }
  }

  if (!snapshot && orgId) {
    void enqueueDashboardSnapshotRefresh(orgId, user.id, dashboardPeriod)
  } else if (snapshot && !snapshotFresh && orgId) {
    void enqueueDashboardSnapshotRefresh(orgId, user.id, dashboardPeriod)
  }

  return {
    period: dashboardPeriod,
    memberUserId: scopedMemberId,
    activityTimeline,
    recentActivities: activityTimeline.slice(0, 25),
    _snapshot: { source, fresh: snapshotFresh },
    warming: warming && !activityTimeline.length,
  }
}

export async function readActivityTimelineCached(user, options = {}) {
  const { fresh = false, ...rest } = options
  const period = normalizeDashboardPeriod(rest.period)
  const memberUserId = rest.memberUserId || null
  const tz = resolveTimeZone(user, null)
  const since = rest.since ?? periodStart(period, tz)

  if (!fresh) {
    const cacheKey = activityTimelineCacheKey(user, period, memberUserId)
    const cached = await cacheGet(cacheKey, { ttlSeconds: CACHE_TTL, staleSeconds: CACHE_STALE })
    if (cached.value && !cached.stale) {
      const cachedTimeline = cached.value.activityTimeline || []
      if (!isTimelineStale(cachedTimeline, since)) {
        return { ...cached.value, _cache: { hit: true, source: cached.source } }
      }
    }
  }

  const payload = await readActivityTimeline(user, { ...rest, period, memberUserId, fresh })
  if (!fresh) {
    const cacheKey = activityTimelineCacheKey(user, period, memberUserId)
    void cacheSet(cacheKey, payload, { ttlSeconds: CACHE_TTL })
  }
  return { ...payload, _cache: { hit: false, stale: false } }
}
