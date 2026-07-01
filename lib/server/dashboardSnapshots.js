/**
 * Materialized dashboard snapshots — dashboard NEVER reads full pipeline on hot path.
 * Refresh: async (worker, pipeline index refresh, cron) scans entries once and writes small JSON docs.
 */

import { fetchStoreCollectionJson, upsertCollection, isSupabaseEnabled } from './supabaseClient.js'
import { readStore } from './store.js'
import { pipelineShardNameForUser, readPipelineShardEntries } from './pipelineShard.js'
import { listTeamMembers, getOrganization } from './organizations.js'
import { buildTeamDashboard } from './crmDashboard.js'
import { buildMyDayDashboard } from './myDayDashboard.js'
import { buildTeamActivityTimeline } from './teamActivityTimeline.js'
import { isFreightDealOrg } from '../freightDeal.js'
import { resolveTimeZone } from '../calendarLocale.js'
import { normalizeDashboardPeriod, periodStart, previousPeriodStart } from './dashboardPeriod.js'
import { readPipelineIndexDoc } from './pipelineIndex.js'
import { enqueueDashboardSnapshotRefresh } from './queue/producer.js'
import { listCrmActivities } from './crmActivityCounts.js'
import { buildActivityRollupsForPeriods } from './crmTouchpoints.js'

export const SNAPSHOT_TTL_MS = 5 * 60 * 1000
const PERIODS = ['day', 'week', 'month']

const memorySnap = new Map()

export function dashboardSnapshotCollection(orgId) {
  return `dashboard_snapshot_${orgId}`
}

export function teamSnapshotCollection(orgId, period) {
  return `team_snapshot_${orgId}_${normalizeDashboardPeriod(period)}`
}

export function activitySnapshotCollection(orgId, period, memberKey = 'all') {
  return `activity_snapshot_${orgId}_${normalizeDashboardPeriod(period)}_${memberKey || 'all'}`
}

export function myDaySnapshotCollection(userId) {
  return `myday_snapshot_${userId}`
}

export function repSnapshotCollection(orgId, userId, period) {
  return `rep_snapshot_${orgId}_${String(userId)}_${normalizeDashboardPeriod(period)}`
}

export async function readSnapshotPayload(collection) {
  const cached = memorySnap.get(collection)
  if (cached && Date.now() - cached.at < 30_000) {
    return cached.doc
  }

  let doc = null
  if (isSupabaseEnabled()) {
    const rows = await fetchStoreCollectionJson(collection)
    doc = rows?.[0] && typeof rows[0] === 'object' && !Array.isArray(rows[0]) ? rows[0] : null
  } else {
    const store = await readStore({ only: [collection] })
    const rows = store[collection]
    doc = rows?.[0] && typeof rows[0] === 'object' ? rows[0] : null
  }

  if (doc) memorySnap.set(collection, { doc, at: Date.now() })
  return doc
}

export async function writeSnapshotPayload(collection, doc) {
  const payload = [{ ...doc, updatedAt: doc.updatedAt || new Date().toISOString() }]
  if (isSupabaseEnabled()) {
    await upsertCollection(collection, payload)
  } else {
    const { writeStoreCollections } = await import('./store.js')
    await writeStoreCollections({ [collection]: payload }, [collection])
  }
  memorySnap.set(collection, { doc: payload[0], at: Date.now() })
}

function snapshotAgeMs(doc) {
  if (!doc?.updatedAt) return Infinity
  const t = new Date(doc.updatedAt).getTime()
  return Number.isFinite(t) ? Date.now() - t : Infinity
}

export function isSnapshotFresh(doc) {
  return snapshotAgeMs(doc) < SNAPSHOT_TTL_MS
}

function kpiFromSummary(summary = {}, indexDoc = null) {
  const openDeals = indexDoc?.openDealCounts
    ? Object.values(indexDoc.openDealCounts).reduce((n, v) => n + (Number(v) || 0), 0)
    : 0
  return {
    totalLeads: summary.totalLeads ?? indexDoc?.total ?? 0,
    openDeals,
    pipelineValue: summary.pipelineValue ?? 0,
    weightedPipelineValue: summary.weightedPipelineValue ?? 0,
    activitiesInPeriod: summary.activitiesInPeriod ?? 0,
    won: summary.won ?? 0,
    needsFollowUp: summary.needsFollowUp ?? 0,
    contacted: summary.contacted ?? 0,
    emailsSent: summary.emailsSent ?? 0,
    meetingsUpcoming: summary.meetingsUpcoming ?? 0,
    wonValue: summary.wonValue ?? 0,
  }
}

/** Build all snapshots from in-memory entries (one scan — refresh path only). */
export async function refreshDashboardSnapshotsFromEntries(entries, { shardName, organizationId, store, user }) {
  if (!shardName || !organizationId || !user) return null

  const org = getOrganization(store, organizationId)
  const freightOrg = isFreightDealOrg(org, user)
  const scopedStore = { ...store, savedLeads: entries }

  const indexTotals = {
    total: entries.length,
    entryCount: entries.length,
    organizationId,
  }

  const dashboardDoc = {
    version: 1,
    organizationId,
    shardName,
    ...indexTotals,
    updatedAt: new Date().toISOString(),
  }

  await writeSnapshotPayload(dashboardSnapshotCollection(organizationId), dashboardDoc)

  for (const period of PERIODS) {
    const tz = resolveTimeZone(user, null)
    const since = periodStart(period, tz)
    const teamPayload = buildTeamDashboard(scopedStore, user, {
      period,
      light: true,
      detailed: false,
      timeZone: tz,
    })

    const { activityTimeline, memberUsage, recentActivities, ...teamCore } = teamPayload

    await writeSnapshotPayload(teamSnapshotCollection(organizationId, period), {
      version: 1,
      period,
      organizationId,
      ...teamCore,
      updatedAt: new Date().toISOString(),
    })

    const timeline = buildTeamActivityTimeline(scopedStore, user, entries, {
      since,
      memberUserId: null,
      limit: 100,
      freightOrg,
    })

    const prevSince = previousPeriodStart(period, tz)
    const { current: activityRollup, previous: prevActivityRollup } = buildActivityRollupsForPeriods(
      scopedStore,
      user,
      entries,
      since,
      prevSince,
      since
    )
    const activityLogFeed = listCrmActivities(scopedStore, user, entries, {
      since,
      feedLimit: 500,
      responseLimit: 500,
    })

    await writeSnapshotPayload(activitySnapshotCollection(organizationId, period, 'all'), {
      version: 2,
      period,
      organizationId,
      activityTimeline: timeline,
      recentActivities: recentActivities || [],
      activityLog: {
        rollup: activityRollup.org,
        prevRollup: prevActivityRollup.org,
        perUserRollups: Object.fromEntries(activityRollup.perUser || []),
        prevPerUserRollups: Object.fromEntries(prevActivityRollup.perUser || []),
        activities: activityLogFeed,
      },
      updatedAt: new Date().toISOString(),
    })
  }

  const members = listTeamMembers(store, organizationId)
  const tz = resolveTimeZone(user, null)
  const since = periodStart('week', tz)

  for (const member of members) {
    const memberUser = (store.users || []).find((u) => String(u.id) === String(member.userId))
    if (!memberUser) continue
    const myDay = buildMyDayDashboard(scopedStore, memberUser, entries, { timeZone: tz, since })
    await writeSnapshotPayload(myDaySnapshotCollection(member.userId), {
      version: 1,
      userId: member.userId,
      myDay,
      updatedAt: new Date().toISOString(),
    })
  }

  const { refreshRepSnapshotsFromEntries } = await import('./repSummary.js')
  await refreshRepSnapshotsFromEntries(entries, { organizationId })

  return { organizationId, entryCount: entries.length, periods: PERIODS.length }
}

export async function refreshDashboardSnapshotsForUser(user, period = 'week') {
  const shardName = pipelineShardNameForUser(user)
  const orgId = user.organizationId
  if (!shardName || !orgId) return null

  const { loadPipelineStoreContext } = await import('./pipelineShard.js')
  const [{ pipelineStore, visible }, meta] = await Promise.all([
    loadPipelineStoreContext(user, { mergeMonolithCrm: true }),
    readStore({
      only: ['users', 'organizations', 'organizationMemberships', 'searches', 'marketingCampaigns'],
    }),
  ])
  const store = { ...pipelineStore, ...meta, savedLeads: visible }
  const entries = visible || []

  return refreshDashboardSnapshotsFromEntries(entries, {
    shardName,
    organizationId: orgId,
    store,
    user,
  })
}

export async function readDashboardKpi(user, store) {
  const orgId = user.organizationId
  const shardName = pipelineShardNameForUser(user)

  if (orgId) {
    const snap = await readSnapshotPayload(dashboardSnapshotCollection(orgId))
    const teamSnap = await readSnapshotPayload(teamSnapshotCollection(orgId, 'week'))
    if (snap && teamSnap?.summary) {
      const indexDoc = shardName ? await readPipelineIndexDoc(shardName) : null
      const kpi = kpiFromSummary(teamSnap.summary, indexDoc || snap)
      return {
        kpi,
        fresh: isSnapshotFresh(teamSnap),
        source: 'snapshot',
        updatedAt: teamSnap.updatedAt,
      }
    }
  }

  const indexDoc = shardName ? await readPipelineIndexDoc(shardName) : null
  if (indexDoc) {
    return {
      kpi: kpiFromSummary({}, indexDoc),
      fresh: false,
      source: 'pipeline_index',
      updatedAt: indexDoc.updatedAt,
    }
  }

  return { kpi: kpiFromSummary({}), fresh: false, source: 'empty' }
}

function pipelineSnapshotFromIndex(bucket, indexDoc) {
  const byStatus = bucket?.byStatus || indexDoc?.byStatus || []
  const stages = (Array.isArray(byStatus) ? byStatus : [])
    .map((s) => ({ id: s.status, count: s.count || 0 }))
    .filter((s) => s.count > 0)
  const leadCount = bucket?.total ?? indexDoc?.total ?? 0
  return {
    stages,
    leadCount,
    dealValue: 0,
    expectedRevenue: 0,
    stuckDeals: 0,
  }
}

function pipelineHealthFromIndex(bucket, indexDoc) {
  const byStatus = bucket?.byStatus || indexDoc?.byStatus || []
  return {
    stages: (Array.isArray(byStatus) ? byStatus : []).map((s) => ({
      id: s.status,
      label: String(s.status || '').replace(/_/g, ' '),
      volume: s.count || 0,
      conversionPct: null,
      avgDays: null,
      dropOffPct: null,
    })),
    bottleneckStage: null,
  }
}

/** Instant fallback while snapshots build — pipeline index only, no contact scan. */
export async function buildTeamMetricsWarmFallback(user, store, period = 'week') {
  const kpiRow = await readDashboardKpi(user, store)
  const periodNorm = normalizeDashboardPeriod(period)
  const shardName = pipelineShardNameForUser(user)
  const indexDoc = shardName ? await readPipelineIndexDoc(shardName) : null
  const summary = {
    totalLeads: kpiRow.kpi.totalLeads,
    pipelineValue: kpiRow.kpi.pipelineValue,
    activitiesInPeriod: kpiRow.kpi.activitiesInPeriod,
    won: kpiRow.kpi.won,
    needsFollowUp: kpiRow.kpi.needsFollowUp,
    contacted: kpiRow.kpi.contacted,
    emailsSent: kpiRow.kpi.emailsSent,
    meetingsUpcoming: kpiRow.kpi.meetingsUpcoming,
    weightedPipelineValue: kpiRow.kpi.weightedPipelineValue,
    wonValue: kpiRow.kpi.wonValue,
  }
  const pipelineHealth = pipelineHealthFromIndex(null, indexDoc)

  return {
    personal: false,
    isAdmin: Boolean(user.isOrgAdmin || user.orgRole === 'org_admin'),
    period: periodNorm,
    memberUserId: null,
    summary,
    teamIntelligence: {
      rollup: {},
      members: [],
      periodLabel: periodNorm,
    },
    intelligenceV3: {
      commandBar: [],
      insights: [],
      pipelineHealth,
      performanceMatrix: [],
      revenueLeaks: [],
      capacity: [],
      adoption: { overall: 0, reps: [], trend: [] },
      activityEffectiveness: [],
      actionCenter: [],
      isManagerView: Boolean(user.isOrgAdmin),
    },
    dashboardV3: {},
    memberOptions: [],
    warming: true,
    _snapshot: { fresh: false, source: kpiRow.source },
  }
}

export async function readTeamMetricsSnapshot(user, { period = 'week', memberUserId = null } = {}) {
  const orgId = user.organizationId
  if (!orgId) return null

  const collection = teamSnapshotCollection(orgId, period)
  let doc = await readSnapshotPayload(collection)
  const fresh = doc ? isSnapshotFresh(doc) : false

  if (!doc || !fresh) {
    void enqueueDashboardSnapshotRefresh(user.organizationId, user.id, period)
  }

  if (!doc) return null

  let payload = { ...doc }
  if (memberUserId) {
    payload = {
      ...payload,
      memberUserId: String(memberUserId),
    }
  }

  return {
    payload,
    fresh,
    source: 'snapshot',
  }
}

export async function readActivityLogSnapshot(user, { period = 'week', memberUserId = null } = {}) {
  const orgId = user.organizationId
  if (!orgId) return null

  const memberKey = memberUserId ? String(memberUserId) : 'all'
  let doc = await readSnapshotPayload(activitySnapshotCollection(orgId, period, memberKey))

  if (!doc?.activityLog && memberKey !== 'all') {
    doc = await readSnapshotPayload(activitySnapshotCollection(orgId, period, 'all'))
  }

  const fresh = doc ? isSnapshotFresh(doc) : false
  if (!doc || !fresh) {
    void enqueueDashboardSnapshotRefresh(orgId, user.id, period)
  }

  if (!doc?.activityLog) return null

  const log = doc.activityLog
  return {
    rollup: log.rollup || null,
    prevRollup: log.prevRollup || null,
    perUserRollups: log.perUserRollups || {},
    prevPerUserRollups: log.prevPerUserRollups || {},
    activities: Array.isArray(log.activities) ? log.activities : [],
    fresh,
    source: 'snapshot',
    updatedAt: doc.updatedAt,
  }
}

export async function readActivityTimelineSnapshot(user, { period = 'week', memberUserId = null } = {}) {
  const orgId = user.organizationId
  if (!orgId) return null

  const memberKey = memberUserId ? String(memberUserId) : 'all'
  const collection = activitySnapshotCollection(orgId, period, memberKey)
  let doc = await readSnapshotPayload(collection)

  if (!doc && memberKey !== 'all') {
    doc = await readSnapshotPayload(activitySnapshotCollection(orgId, period, 'all'))
  }

  const fresh = doc ? isSnapshotFresh(doc) : false
  if (!doc || !fresh) {
    void enqueueDashboardSnapshotRefresh(user.organizationId, user.id, period)
  }

  if (!doc) return null

  let timeline = doc.activityTimeline || []
  let activityLogActivities = Array.isArray(doc.activityLog?.activities) ? doc.activityLog.activities : []
  if (memberUserId) {
    const mid = String(memberUserId)
    timeline = timeline.filter((item) => String(item.actorUserId || item.userId || item.memberUserId || '') === mid)
    activityLogActivities = activityLogActivities.filter(
      (act) => String(act.createdByUserId || act.userId || '') === mid
    )
  }

  return {
    activityTimeline: timeline,
    activityLogActivities,
    recentActivities: doc.recentActivities || [],
    fresh,
    source: 'snapshot',
    updatedAt: doc.updatedAt,
  }
}

export async function readMyDaySnapshot(user) {
  const doc = await readSnapshotPayload(myDaySnapshotCollection(user.id))
  const fresh = doc ? isSnapshotFresh(doc) : false

  if (!doc || !fresh) {
    void enqueueDashboardSnapshotRefresh(user.organizationId, user.id, 'week')
  }

  if (doc?.myDay) {
    return { myDay: doc.myDay, fresh, source: 'snapshot', updatedAt: doc.updatedAt }
  }

  const shardName = pipelineShardNameForUser(user)
  const indexDoc = shardName ? await readPipelineIndexDoc(shardName) : null
  const meta = await readStore({ only: ['organizations', 'organizationMemberships', 'users'] })
  const bucket = indexDoc?.byAssignee?.[user.id]

  return {
    myDay: {
      role: user.isOrgAdmin ? 'manager' : 'sales_rep',
      greeting: 'Warming up your dashboard…',
      commandBar: [],
      priorities: [],
      pipelineSnapshot: pipelineSnapshotFromIndex(bucket, indexDoc),
      todayTimeline: [],
      recentActivity: [],
      leadFocus: [],
      quickActions: [],
      smartInsights: [],
      goals: [],
      teamIntelLink: Boolean(user.organizationId && user.isOrgAdmin),
      _warming: true,
    },
    fresh: false,
    source: 'pipeline_index',
    updatedAt: indexDoc?.updatedAt,
  }
}
