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
import { normalizeDashboardPeriod, periodStart } from './dashboardPeriod.js'
import { readPipelineIndexDoc } from './pipelineIndex.js'
import { enqueueDashboardSnapshotRefresh } from './queue/producer.js'

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

async function readSnapshotPayload(collection) {
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

async function writeSnapshotPayload(collection, doc) {
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

    await writeSnapshotPayload(activitySnapshotCollection(organizationId, period, 'all'), {
      version: 1,
      period,
      organizationId,
      activityTimeline: timeline,
      recentActivities: recentActivities || [],
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

/** Instant fallback while snapshots build — pipeline index only, no contact scan. */
export async function buildTeamMetricsWarmFallback(user, store, period = 'week') {
  const kpiRow = await readDashboardKpi(user, store)
  const periodNorm = normalizeDashboardPeriod(period)
  return {
    personal: false,
    isAdmin: Boolean(user.isOrgAdmin || user.orgRole === 'org_admin'),
    period: periodNorm,
    memberUserId: null,
    summary: {
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
    },
    teamIntelligence: {
      rollup: {},
      members: [],
      periodLabel: periodNorm,
    },
    intelligenceV3: {
      commandBar: [],
      insights: [],
      pipelineHealth: null,
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
  if (memberUserId) {
    const mid = String(memberUserId)
    timeline = timeline.filter((item) => String(item.userId || item.memberUserId || '') === mid)
  }

  return {
    activityTimeline: timeline,
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
      pipelineSnapshot: bucket
        ? {
            total: bucket.total,
            byStatus: bucket.byStatus,
          }
        : { total: indexDoc?.total ?? 0, byStatus: [] },
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
