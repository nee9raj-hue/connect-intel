import { readStore } from './store.js'
import { fetchStoreCollectionJson, isSupabaseEnabled } from './supabaseClient.js'
import { listTeamMembers, resolveOrgRole } from './organizations.js'
import { emptyActivityRollup } from './crmActivityCounts.js'
import {
  countActivityRollup,
  listPipelineActivities,
  orgHasPipelineActivities,
  isPipelineActivitiesTableEnabled,
  countLeadsTouched,
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
  } = {}
) {
  const meta = await loadOrgMeta(user)
  const { orgRole } = resolveOrgRole(user, meta)
  const isAdmin = user.isOrgAdmin || orgRole === 'org_admin'
  let scopedMemberId = memberUserId ? String(memberUserId) : null
  if (scopedMemberId && !isAdmin && scopedMemberId !== String(user.id)) {
    scopedMemberId = String(user.id)
  }

  const orgId = user.organizationId
  const usersById = usersByIdFromStore(meta)
  const members = orgId ? listTeamMembers(meta, orgId) : []
  const memberName = scopedMemberId
    ? members.find((m) => String(m.userId) === scopedMemberId)?.name ||
      usersById.get(scopedMemberId)?.name ||
      'Team member'
    : null

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

  const tableReady =
    orgId && isPipelineActivitiesTableEnabled() && (await orgHasPipelineActivities(orgId))

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

  if (!activities.length && snapshot?.activities?.length && !tableReady) {
    const filtered = filterActivities(snapshot.activities, {
      memberUserId: scopedMemberId,
      activityType,
    })
    let rows = filtered
    if (Array.isArray(leadIds)) {
      const allowed = new Set(leadIds.map(String))
      rows = rows.filter((a) => allowed.has(String(a.leadId || '')))
    }
    const page = paginateArray(rows, limit, offset)
    activities = page.rows
    total = page.total
    if (source === 'warming') source = 'snapshot'
    warming = !snapshotFresh
  }

  if (!snapshot && orgId) {
    void enqueueDashboardSnapshotRefresh(orgId, user.id, period)
  } else if (snapshot && !snapshotFresh && orgId) {
    void enqueueDashboardSnapshotRefresh(orgId, user.id, period)
  }

  return {
    activities,
    rollup,
    prevRollup,
    isAdmin,
    members,
    memberName,
    memberUserId: scopedMemberId,
    pagination: {
      limit: Math.max(1, Math.min(200, Number(limit) || DEFAULT_FEED_LIMIT)),
      offset: Math.max(0, Number(offset) || 0),
      total,
      hasMore: (Number(offset) || 0) + activities.length < total,
    },
    _source: source,
    warming,
    timeZone,
    periodLabel: periodLabelOverride,
  }
}

export async function readActivityLogCached(user, options) {
  const cacheKey = activityLogCacheKey(user, options)
  const cached = await cacheGet(cacheKey, { ttlSeconds: CACHE_TTL, staleSeconds: CACHE_STALE })
  if (cached.value && !cached.stale) {
    return { ...cached.value, _cache: { hit: true, source: cached.source } }
  }

  const payload = await readActivityLog(user, options)
  void cacheSet(cacheKey, payload, { ttlSeconds: CACHE_TTL })
  return { ...payload, _cache: { hit: false, stale: cached.stale } }
}

export { DEFAULT_FEED_LIMIT as ACTIVITY_LOG_FEED_LIMIT }
