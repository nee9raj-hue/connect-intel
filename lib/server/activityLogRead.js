import { readStore } from './store.js'
import { fetchStoreCollectionJson, isSupabaseEnabled } from './supabaseClient.js'
import { loadViewerRoster, clampScopedMemberId, resolveViewerRoleFlags } from './dashboardRoleScope.js'
import { memberOptionsFromIntel } from './teamMetricsEnrich.js'
import { resolveManagerVisibleOwnerIds } from './pipelineManagerScope.js'
import { MS_DAY } from './dashboardPeriod.js'
import { emptyActivityRollup } from './crmActivityCounts.js'
import {
  countActivityRollup,
  listPipelineActivities,
  newestPipelineActivityMs,
  orgHasPipelineActivities,
  isPipelineActivitiesTableEnabled,
  countLeadsTouched,
  rollupFromActivityRows,
} from './pipelineActivitiesTable.js'
import { readActivityLogSnapshot } from './dashboardSnapshots.js'
import { enqueueDashboardSnapshotRefresh } from './queue/producer.js'
import { cacheGet, cacheSet, activityLogCacheKey } from './infra/cache.js'

const DEFAULT_FEED_LIMIT = 50
const CACHE_TTL = 30
const CACHE_STALE = 90

async function loadOrgMeta(user) {
  if (isSupabaseEnabled()) {
    const [users, organizations, organizationMemberships] = await Promise.all([
      fetchStoreCollectionJson('users'),
      fetchStoreCollectionJson('organizations'),
      fetchStoreCollectionJson('organizationMemberships'),
    ])
    return { users, organizations, organizationMemberships }
  }
  return readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
}

function usersByIdFromStore(store) {
  return new Map((store.users || []).map((u) => [String(u.id), u]))
}

function rollupForMember(rollup, perUser, memberUserId) {
  if (!memberUserId) return rollup
  const row = perUser?.get?.(String(memberUserId)) || perUser?.[String(memberUserId)]
  return row || emptyActivityRollup()
}

function paginateArray(items, limit, offset) {
  const list = items || []
  const start = Math.max(0, Number(offset) || 0)
  const end = start + Math.max(1, Math.min(200, Number(limit) || DEFAULT_FEED_LIMIT))
  return {
    rows: list.slice(start, end),
    total: list.length,
  }
}

function filterActivitiesByTime(activities, { since, until = Infinity } = {}) {
  if (since == null && until === Infinity) return activities || []
  return (activities || []).filter((a) => {
    const t = new Date(a.createdAt || 0).getTime()
    if (!Number.isFinite(t)) return false
    if (since != null && t < since) return false
    if (until !== Infinity && t >= until) return false
    return true
  })
}

function rollupFromSnapshotActivities(snapshot, {
  scopedMemberId,
  activityType,
  leadIds,
  since,
  until,
} = {}) {
  if (!snapshot?.activities?.length) return null
  let rows = filterActivities(snapshot.activities, {
    memberUserId: scopedMemberId,
    activityType,
  })
  rows = filterActivitiesByTime(rows, { since, until })
  if (Array.isArray(leadIds)) {
    const allowed = new Set(leadIds.map(String))
    rows = rows.filter((a) => allowed.has(String(a.leadId || '')))
  }
  if (!rows.length) return null
  return rollupFromActivityRows(rows)
}

function filterActivities(activities, { memberUserId, activityType } = {}) {
  let rows = activities || []
  if (memberUserId) {
    const mid = String(memberUserId)
    rows = rows.filter(
      (a) => String(a.createdByUserId || a.userId || '') === mid
    )
  }
  if (activityType) {
    const t = String(activityType).toLowerCase()
    rows = rows.filter((a) => String(a.type || '').toLowerCase() === t)
  }
  return rows
}

function shouldPreferCrmFeed(feedActivities, memberId, off) {
  if (memberId || off > 0) return false
  if (!feedActivities?.length) return true
  const actors = new Set(
    feedActivities.map((a) => String(a.createdByUserId || a.userId || '')).filter(Boolean)
  )
  return actors.size <= 1 && feedActivities.length >= 3
}

function uniqueFeedActors(feedActivities) {
  return new Set(
    (feedActivities || []).map((a) => String(a.createdByUserId || a.userId || '')).filter(Boolean)
  )
}

function newestActivityMs(feedActivities) {
  let max = 0
  for (const a of feedActivities || []) {
    const t = new Date(a.createdAt || 0).getTime()
    if (Number.isFinite(t) && t > max) max = t
  }
  return max
}

/** Table/index feed is stale when the newest row is older than the rolling window expects. */
function isActivityFeedStale(feedActivities, since) {
  if (!feedActivities?.length) return true
  const newest = newestActivityMs(feedActivities)
  if (!newest) return true
  if (since != null && newest < since) return true
  return Date.now() - newest > MS_DAY
}

function sortActivitiesDesc(feedActivities = []) {
  return [...feedActivities].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  )
}

/**
 * Activity log read path — pipeline_activities table and/or materialized snapshot.
 * Never loads the monolithic pipeline shard.
 */
export async function readActivityLog(
  user,
  {
    period,
    since,
    until = Infinity,
    prevSince,
    prevUntil,
    memberUserId = null,
    activityType = null,
    leadIds = null,
    limit = DEFAULT_FEED_LIMIT,
    offset = 0,
    timeZone = null,
    periodLabel: periodLabelOverride = null,
    preferCrm = false,
  } = {}
) {
  const meta = await loadOrgMeta(user)
  const { isAdmin, isManager } = resolveViewerRoleFlags(user, meta)
  const visibleOwnerIds = isAdmin
    ? null
    : await resolveManagerVisibleOwnerIds(user, meta)
  const scopedMemberId = clampScopedMemberId(user, meta, memberUserId, visibleOwnerIds)

  const orgId = user.organizationId
  const usersById = usersByIdFromStore(meta)
  const { rosterMembers: members, memberOptions: rosterMemberOptions } = await loadViewerRoster(user, meta, {
    visibleOwnerIds,
  })
  let memberOptions = rosterMemberOptions
  const memberName = scopedMemberId
    ? members.find((m) => String(m.userId) === scopedMemberId)?.name ||
      usersById.get(scopedMemberId)?.name ||
      'Team member'
    : null

  const buildResult = (activities, rollup, prevRollup, source, warming, totalOverride = null) => {
    const rows = filterActivitiesByTime(sortActivitiesDesc(activities), { since, until })
    const page = paginateArray(rows, limit, offset)
    return {
      activities: page.rows,
      rollup,
      prevRollup,
      isAdmin,
      members,
      memberName,
      memberUserId: scopedMemberId,
      memberOptions,
      pagination: {
        limit: Math.max(1, Math.min(200, Number(limit) || DEFAULT_FEED_LIMIT)),
        offset: Math.max(0, Number(offset) || 0),
        total: totalOverride ?? rows.length,
        hasMore: (Number(offset) || 0) + page.rows.length < (totalOverride ?? rows.length),
      },
      _source: source,
      warming,
      timeZone,
      periodLabel: periodLabelOverride,
    }
  }

  async function loadCrmFeed() {
    const { readBalancedOrgActivityFromCrm, readActivityLogFromCrmEntries } = await import(
      './activityLogCrmFallback.js'
    )
    const common = { since, until, prevSince, prevUntil, activityType, limit, offset }
    if (!scopedMemberId && !(Array.isArray(leadIds) && leadIds.length)) {
      const ids = members.map((m) => m.userId).filter(Boolean)
      if (ids.length > 1) {
        return readBalancedOrgActivityFromCrm(user, { rosterMemberIds: ids, ...common })
      }
    }
    return readActivityLogFromCrmEntries(user, {
      scopedMemberId,
      leadIds,
      ...common,
    })
  }

  if (preferCrm) {
    try {
      const crm = await loadCrmFeed()
      if (crm) {
        const crmActors = crm.perUser ? [...crm.perUser.keys()] : []
        if (crmActors.length && !scopedMemberId) {
          memberOptions = memberOptionsFromIntel(members, [
            ...crmActors.map((uid) => ({
              userId: uid,
              name:
                members.find((m) => String(m.userId) === String(uid))?.name ||
                usersById.get(String(uid))?.name ||
                'Member',
            })),
          ])
        }
        const inRange = filterActivitiesByTime(sortActivitiesDesc(crm.activities || []), { since, until })
        if (inRange.length || (crm.rollup?.activitiesTotal || 0) > 0) {
          return buildResult(
            crm.activities || [],
            crm.rollup || emptyActivityRollup(),
            crm.prevRollup || emptyActivityRollup(),
            crm.source || 'crm_only',
            false,
            crm.total
          )
        }
      }
    } catch (error) {
      console.warn('activity-log CRM-only read:', error?.message || error)
    }
  }

  let source = 'warming'
  let activities = []
  let total = 0
  let rollup = emptyActivityRollup()
  let prevRollup = emptyActivityRollup()
  let warming = true
  let snapshotFresh = false

  const snapshot = orgId
    ? await readActivityLogSnapshot(user, { period, memberUserId: scopedMemberId })
    : null

  if (snapshot?.rollup) {
    rollup = rollupForMember(snapshot.rollup, snapshot.perUserRollups, scopedMemberId)
    prevRollup = rollupForMember(
      snapshot.prevRollup || emptyActivityRollup(),
      snapshot.prevPerUserRollups,
      scopedMemberId
    )
    snapshotFresh = Boolean(snapshot.fresh)
    source = 'snapshot'
    warming = !snapshotFresh
  }

  let tableReady =
    orgId && isPipelineActivitiesTableEnabled() && (await orgHasPipelineActivities(orgId))

  if (tableReady && since != null && !preferCrm) {
    const newestIdx = await newestPipelineActivityMs(orgId)
    if (newestIdx > 0 && newestIdx < since) {
      tableReady = false
    }
  }

  const countOpts = {
    since,
    until,
    actorId: scopedMemberId,
    leadIds: Array.isArray(leadIds) ? leadIds : undefined,
  }
  const prevCountOpts = {
    since: prevSince,
    until: prevUntil,
    actorId: scopedMemberId,
    leadIds: Array.isArray(leadIds) ? leadIds : undefined,
  }

  if (tableReady) {
    try {
      const feed = await listPipelineActivities(orgId, {
        since,
        until,
        actorId: scopedMemberId,
        type: activityType,
        leadIds: Array.isArray(leadIds) ? leadIds : undefined,
        limit,
        offset,
        usersById,
      })

      const [currentCounts, prevCounts, leadsTouched] = await Promise.all([
        countActivityRollup(orgId, countOpts),
        countActivityRollup(orgId, prevCountOpts),
        countLeadsTouched(orgId, countOpts),
      ])

      activities = feed.rows
      total = feed.total
      rollup = {
        ...currentCounts.org,
        leadsTouched,
        contactsOpened: leadsTouched,
      }
      prevRollup = prevCounts.org
      source = snapshot?.rollup ? 'table+snapshot' : 'pipeline_activities'
      warming = false
    } catch (error) {
      console.warn('activity-log table read:', error?.message || error)
    }
  } else if (Array.isArray(leadIds) && leadIds.length === 0) {
    activities = []
    total = 0
    rollup = emptyActivityRollup()
    prevRollup = emptyActivityRollup()
    warming = false
    source = 'filtered_empty'
  }

  const snapshotRollup = rollupFromSnapshotActivities(snapshot, {
    scopedMemberId,
    activityType,
    leadIds,
    since,
    until,
  })
  const snapshotPrevRollup = rollupFromSnapshotActivities(snapshot, {
    scopedMemberId,
    activityType,
    leadIds,
    since: prevSince,
    until: prevUntil,
  })

  if (
    snapshotRollup &&
    (!rollup.activitiesTotal || snapshotRollup.activitiesTotal > rollup.activitiesTotal)
  ) {
    rollup = snapshotRollup
    prevRollup = snapshotPrevRollup || prevRollup
    source = tableReady ? 'table+snapshot_fallback' : source === 'warming' ? 'snapshot' : source
    warming = false
  }

  if (!activities.length && snapshot?.activities?.length) {
    let rows = filterActivities(snapshot.activities, {
      memberUserId: scopedMemberId,
      activityType,
    })
    rows = filterActivitiesByTime(rows, { since, until })
    if (Array.isArray(leadIds)) {
      const allowed = new Set(leadIds.map(String))
      rows = rows.filter((a) => allowed.has(String(a.leadId || '')))
    }
    const page = paginateArray(sortActivitiesDesc(rows), limit, offset)
    activities = page.rows
    total = page.total
    if (source === 'warming') source = 'snapshot'
    warming = !snapshotFresh && !tableReady
  }

  const preferCrmOrgFeed =
    !scopedMemberId && !leadIds?.length && (isAdmin || isManager) && offset === 0
  const feedStale = isActivityFeedStale(activities, since)

  const shouldTryCrmFallback =
    !(Array.isArray(leadIds) && leadIds.length === 0) &&
    (preferCrmOrgFeed ||
      feedStale ||
      (rollup.activitiesTotal || 0) === 0 ||
      shouldPreferCrmFeed(activities, scopedMemberId, offset) ||
      (!scopedMemberId && uniqueFeedActors(activities).size <= 1 && activities.length > 0))

  if (shouldTryCrmFallback) {
    try {
      const { readBalancedOrgActivityFromCrm, readActivityLogFromCrmEntries } = await import(
        './activityLogCrmFallback.js'
      )
      const useBalancedOrg = !scopedMemberId && !leadIds?.length && members.length > 1
      const crm = useBalancedOrg
        ? await readBalancedOrgActivityFromCrm(user, {
            rosterMemberIds: members.map((m) => m.userId),
            since,
            until,
            prevSince,
            prevUntil,
            activityType,
            limit,
            offset,
          })
        : await readActivityLogFromCrmEntries(user, {
            scopedMemberId,
            leadIds,
            since,
            until,
            prevSince,
            prevUntil,
            activityType,
            limit,
            offset,
          })
      const crmActors = crm?.perUser ? [...crm.perUser.keys()] : []
      const enrichedMemberOptions =
        crmActors.length && !scopedMemberId
          ? memberOptionsFromIntel(members, [
              ...crmActors.map((uid) => ({
                userId: uid,
                name:
                  members.find((m) => String(m.userId) === String(uid))?.name ||
                  usersById.get(String(uid))?.name ||
                  'Member',
              })),
            ])
          : memberOptions

      if (
        crm &&
        (preferCrmOrgFeed ||
          feedStale ||
          newestActivityMs(crm.activities) > newestActivityMs(activities) ||
          (crm.rollup?.activitiesTotal || 0) > (rollup.activitiesTotal || 0) ||
          (!activities.length && (crm.activities?.length || crm.total)) ||
          shouldPreferCrmFeed(activities, scopedMemberId, offset))
      ) {
        activities = sortActivitiesDesc(crm.activities)
        total = crm.total
        rollup = crm.rollup
        prevRollup = crm.prevRollup
        source =
          source === 'warming' || source === 'filtered_empty'
            ? crm.source
            : `${source}+${crm.source}`
        warming = false
      }

      if (enrichedMemberOptions.length > (memberOptions?.length || 0)) {
        memberOptions = enrichedMemberOptions
      }
    } catch (error) {
      console.warn('activity-log CRM fallback:', error?.message || error)
    }
  }

  if (!snapshot && orgId) {
    void enqueueDashboardSnapshotRefresh(orgId, user.id, period)
  } else if (snapshot && !snapshotFresh && orgId) {
    void enqueueDashboardSnapshotRefresh(orgId, user.id, period)
  }

  return buildResult(activities, rollup, prevRollup, source, warming, total)
}

export async function readActivityLogCached(user, options = {}) {
  const { fresh = false, ...rest } = options
  if (!fresh) {
    const cacheKey = activityLogCacheKey(user, rest)
    const cached = await cacheGet(cacheKey, { ttlSeconds: CACHE_TTL, staleSeconds: CACHE_STALE })
    if (cached.value && !cached.stale) {
      return { ...cached.value, _cache: { hit: true, source: cached.source } }
    }
  }

  const payload = await readActivityLog(user, options)
  if (!fresh) {
    void cacheSet(activityLogCacheKey(user, rest), payload, { ttlSeconds: CACHE_TTL })
  }
  return { ...payload, _cache: { hit: false, stale: false } }
}

export { DEFAULT_FEED_LIMIT as ACTIVITY_LOG_FEED_LIMIT }
