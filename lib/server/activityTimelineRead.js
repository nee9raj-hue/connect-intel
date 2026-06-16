import { readStore } from './store.js'
import { resolveTimeZone } from '../calendarLocale.js'
import { normalizeDashboardPeriod, periodStart } from './dashboardPeriod.js'
import { readActivityTimelineSnapshot } from './dashboardSnapshots.js'
import { enqueueDashboardSnapshotRefresh } from './queue/producer.js'
import {
  isPipelineActivitiesTableEnabled,
  listPipelineActivities,
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

/**
 * Team Intelligence activity feed — same indexed source as CRM activity log when available.
 */
export async function readActivityTimeline(
  user,
  { period = 'week', memberUserId = null, allowLegacyScan = true } = {}
) {
  const dashboardPeriod = normalizeDashboardPeriod(period)
  const tz = resolveTimeZone(user, null)
  const since = periodStart(dashboardPeriod, tz)
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

  const tableReady =
    orgId && isPipelineActivitiesTableEnabled() && (await orgHasPipelineActivities(orgId))

  if (tableReady) {
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
    activityTimeline = snapshot.activityTimeline
    source = snapshot.source || 'snapshot'
    warming = !snapshotFresh
  }

  if (!activityTimeline.length && snapshot?.activityLogActivities?.length) {
    activityTimeline = filterActivitiesForMember(snapshot.activityLogActivities, scopedMemberId).map(
      mapCrmActivityToTimelineItem
    )
    if (activityTimeline.length) {
      source = 'snapshot_feed'
      warming = !snapshotFresh
    }
  }

  if (activityTimeline.length && snapshotExtras.length) {
    activityTimeline = mergeTimelineItems(activityTimeline, snapshotExtras, TIMELINE_LIMIT)
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
  const period = normalizeDashboardPeriod(options.period)
  const memberUserId = options.memberUserId || null
  const cacheKey = activityTimelineCacheKey(user, period, memberUserId)
  const cached = await cacheGet(cacheKey, { ttlSeconds: CACHE_TTL, staleSeconds: CACHE_STALE })
  if (cached.value && !cached.stale) {
    return { ...cached.value, _cache: { hit: true, source: cached.source } }
  }

  const payload = await readActivityTimeline(user, { ...options, period, memberUserId })
  void cacheSet(cacheKey, payload, { ttlSeconds: CACHE_TTL })
  return { ...payload, _cache: { hit: false, stale: cached.stale } }
}
