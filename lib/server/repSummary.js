import { normalizeExtendedCrm } from './crmWorkflow.js'
import { resolveTouchpointActor } from './crmTouchpoints.js'
import { MS_DAY } from './dashboardPeriod.js'
import { resolveViewerScope } from './dashboardRoleScope.js'
import { normalizeDashboardPeriod } from './dashboardPeriod.js'
import { loadScopedPipelineStatusCounts } from './pipelineLeadCounts.js'
import { readPipelineIndexDoc } from './pipelineIndex.js'
import { pipelineShardNameForUser } from './pipelineShard.js'
import { readStore } from './store.js'
import {
  isSnapshotFresh,
  readSnapshotPayload,
  repSnapshotCollection,
  writeSnapshotPayload,
} from './dashboardSnapshots.js'
import { loadOrgRepRoster } from './orgRepRoster.js'
import { resolveRepLastCrmActivityAt } from './memberLastCrmActivity.js'

const META = ['users', 'organizations', 'organizationMemberships']

function entryOwnerId(entry) {
  return String(entry.assignedToUserId || entry.savedByUserId || entry.userId || '')
}

/** Pipeline stats for one rep from in-memory entries (snapshot refresh path only). */
export function computeRepLeadStats(entries, userId) {
  const uid = String(userId)
  const mine = (entries || []).filter((e) => entryOwnerId(e) === uid)
  const now = Date.now()
  const weekAgo = now - 7 * MS_DAY
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  let open = 0
  let followups = 0
  let wonMonth = 0
  let activities7d = 0
  let lastActive = 0

  for (const entry of mine) {
    const crm = normalizeExtendedCrm(entry.crm)
    if (crm.status !== 'won' && crm.status !== 'lost') open += 1
    if (crm.status === 'follow_up') followups += 1
    if (crm.status === 'won') {
      const wonAt = crm.updatedAt || crm.lastCommunicationAt
      if (wonAt && new Date(wonAt) >= monthStart) wonMonth += 1
    }
    for (const act of crm.activities || []) {
      const actor = resolveTouchpointActor(act, entry, { strict: true })
      const t = new Date(act.createdAt || 0).getTime()
      if (actor === uid && t >= weekAgo) activities7d += 1
      if (actor === uid && !Number.isNaN(t) && t > lastActive) lastActive = t
    }
  }

  return {
    userId: uid,
    open,
    followups,
    wonMonth,
    activities7d,
    lastActiveAt: lastActive ? new Date(lastActive).toISOString() : null,
  }
}

function countsFromSql(byStatus = []) {
  let open = 0
  let followups = 0
  let won = 0
  for (const row of byStatus) {
    const st = row.status
    const n = Number(row.count) || 0
    if (st === 'follow_up') followups += n
    if (st === 'won') won += n
    if (st !== 'won' && st !== 'lost') open += n
  }
  return { open, followups, wonMonth: won }
}

function countsFromIndex(bucket) {
  if (!bucket) return null
  const byStatus = bucket.byStatus || []
  let open = 0
  let followups = 0
  for (const row of byStatus) {
    const st = row.status
    const n = Number(row.count) || 0
    if (st === 'follow_up') followups += n
    if (st !== 'won' && st !== 'lost') open += n
  }
  return { open, followups, total: bucket.total ?? open }
}

/** Fast rep header stats — SQL / index / materialized snapshot; no org bootstrap scan. */
export async function buildRepSummary(viewer, repUserId, { period = 'week' } = {}) {
  const uid = String(repUserId || '').trim()
  if (!uid) throw new Error('userId is required')

  const metaStore = await readStore({ only: META })
  const scope = await resolveViewerScope(viewer, metaStore, { requestedMemberId: uid })
  const allowedId = scope.scopedMemberId || (scope.isAdmin ? uid : viewer.id)
  if (String(allowedId) !== uid) {
    throw new Error('You cannot view this rep')
  }

  const periodNorm = normalizeDashboardPeriod(period)
  const orgId = viewer.organizationId

  if (orgId) {
    const snap = await readSnapshotPayload(repSnapshotCollection(orgId, uid, periodNorm))
    if (snap?.userId && isSnapshotFresh(snap)) {
      return { ...snap, source: 'rep_snapshot', fresh: true }
    }
  }

  const roster = orgId ? await loadOrgRepRoster(orgId, { userForIndex: viewer }) : []
  const member = roster.find((m) => String(m.userId) === uid)

  const sqlCounts = await loadScopedPipelineStatusCounts(viewer, metaStore, {
    assigneeUserId: uid,
  })
  let { open, followups, wonMonth } = sqlCounts?.byStatus
    ? countsFromSql(sqlCounts.byStatus)
    : { open: 0, followups: 0, wonMonth: 0 }

  if (!sqlCounts?.ready) {
    const shardName = pipelineShardNameForUser(viewer)
    const indexDoc = shardName ? await readPipelineIndexDoc(shardName) : null
    const fromIndex = countsFromIndex(indexDoc?.byAssignee?.[uid])
    if (fromIndex) {
      open = fromIndex.open
      followups = fromIndex.followups
    }
  }

  const payload = {
    userId: uid,
    name: member?.name || null,
    email: member?.email || null,
    open,
    followups,
    wonMonth,
    activities7d: 0,
    lastActiveAt: await resolveRepLastCrmActivityAt(uid, { user: viewer, orgId }),
    period: periodNorm,
    organizationId: orgId,
    source: sqlCounts?.ready ? 'pipeline_leads_sql' : 'pipeline_index',
    updatedAt: new Date().toISOString(),
  }

  if (orgId) {
    void writeSnapshotPayload(repSnapshotCollection(orgId, uid, periodNorm), payload).catch(() => {})
  }

  return payload
}

/** Materialize per-rep snapshot during async dashboard refresh (P2). */
export async function refreshRepSnapshotsFromEntries(entries, { organizationId, period = null } = {}) {
  if (!organizationId || !entries?.length) return 0
  const roster = await loadOrgRepRoster(organizationId)
  const periods =
    period != null
      ? [normalizeDashboardPeriod(period)]
      : ['day', 'week', 'month', '7d'].map(normalizeDashboardPeriod)
  let written = 0

  for (const periodNorm of periods) {
    for (const member of roster) {
      const uid = String(member.userId)
      const stats = computeRepLeadStats(entries, uid)
      await writeSnapshotPayload(repSnapshotCollection(organizationId, uid, periodNorm), {
        version: 1,
        ...stats,
        name: member.name,
        email: member.email,
        period: periodNorm,
        organizationId,
        source: 'refresh_scan',
        updatedAt: new Date().toISOString(),
      })
      written += 1
    }
  }

  return written
}

function repPerformanceCellActions(uid) {
  return {
    open: { panel: 'pipeline', userId: uid, assigneeUserId: uid, returnTo: 'overview' },
    followups: {
      panel: 'pipeline',
      status: 'follow_up',
      followUpDue: true,
      userId: uid,
      assigneeUserId: uid,
      returnTo: 'overview',
    },
    won: {
      panel: 'pipeline',
      status: 'won',
      wonThisMonth: true,
      userId: uid,
      assigneeUserId: uid,
      returnTo: 'overview',
    },
    activities: { panel: 'crm-log', userId: uid, period: 'week', returnTo: 'overview' },
  }
}

export function shapeRepPerformanceRow(member, stats = {}) {
  const uid = String(member.userId)
  return {
    userId: member.userId,
    name: member.name || stats.name || 'Rep',
    email: member.email || stats.email || null,
    open: Number(stats.open) || 0,
    followups: Number(stats.followups) || 0,
    activities7d: Number(stats.activities7d) || 0,
    wonMonth: Number(stats.wonMonth) || 0,
    lastActiveAt: stats.lastActiveAt || null,
    source: stats.source || 'rep_snapshot',
    action: { panel: 'pipeline', userId: uid, assigneeUserId: uid, returnTo: 'overview' },
    cellActions: repPerformanceCellActions(uid),
  }
}

/** Manager team table — reads materialized rep_snapshot docs (not raw CRM activity blobs). */
export async function buildRepPerformanceFromSnapshots(
  viewer,
  members,
  ownerIds,
  { period = 'week' } = {}
) {
  const allowed = new Set((ownerIds || []).map(String))
  const reps = (members || []).filter((m) => allowed.has(String(m.userId)))
  const periodNorm = normalizeDashboardPeriod(period)
  const orgId = viewer.organizationId

  const rows = await Promise.all(
    reps.map(async (member) => {
      const uid = String(member.userId)
      if (orgId) {
        const snap = await readSnapshotPayload(repSnapshotCollection(orgId, uid, periodNorm))
        if (snap?.userId && isSnapshotFresh(snap)) {
          return shapeRepPerformanceRow(member, snap)
        }
      }
      try {
        const live = await buildRepSummary(viewer, uid, { period: periodNorm })
        return shapeRepPerformanceRow(member, live)
      } catch {
        return shapeRepPerformanceRow(member, {})
      }
    })
  )

  return rows.sort((a, b) => b.activities7d - a.activities7d)
}
