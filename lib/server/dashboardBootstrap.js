import { CRM_STATUSES } from './crm.js'
import { normalizeExtendedCrm } from './crmWorkflow.js'
import { MS_DAY } from './dashboardPeriod.js'
import { localDateKey, resolveTimeZone } from '../calendarLocale.js'
import { listCrmActivities } from './crmActivityCounts.js'
import { isFreightDealOrg } from '../freightDeal.js'
import { getOrganization, resolveOrgRole } from './organizations.js'
import { loadMemberProfilesMap, listOrgHierarchy } from './orgHierarchy.js'
import { loadOrgRepRoster } from './orgRepRoster.js'
import { expandManagerRosterIds } from './dashboardRoleScope.js'
import { buildRepPerformanceFromSnapshots } from './repSummary.js'
import { loadPipelineStoreContext } from './pipelineShard.js'
import { loadScopedPipelineStatusCounts } from './pipelineLeadCounts.js'
import { resolveManagerVisibleOwnerIds } from './pipelineManagerScope.js'
import { marketingOverview } from './marketingCampaigns.js'
import { readStore } from './store.js'
import { isPipelineHierarchyRbacEnabled } from './infra/config.js'
import { resolveTouchpointActor, lastCrmActivityAtForUser } from './crmTouchpoints.js'
import {
  readPipelineSnapshot,
  readMyDaySnapshot,
  readActivityLogSnapshot,
  readSnapshotPayload,
  teamSnapshotCollection,
} from './dashboardSnapshots.js'

const META_STORE_COLLECTIONS = [
  'users',
  'organizations',
  'organizationMemberships',
]

const MS_7D = 7 * MS_DAY
const MS_14D = 14 * MS_DAY
const HOT_SCORE = 70

function entryOwnerId(entry) {
  return String(entry.assignedToUserId || entry.savedByUserId || entry.userId || '')
}

function leadLabel(entry) {
  const lead = entry.lead || {}
  return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || 'Lead'
}

function startOfLocalDay(tz) {
  const key = localDateKey(new Date(), tz)
  return new Date(`${key}T00:00:00`).getTime()
}

function endOfLocalDay(tz) {
  return startOfLocalDay(tz) + MS_DAY - 1
}

function endOfMonth(tz) {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
}

export function detectDashboardRole(user, store) {
  const { orgRole, membership } = resolveOrgRole(user, store)
  if (user.isOrgAdmin || orgRole === 'org_admin') return 'org_admin'
  const marketingRole = membership?.marketingRole || user.marketingRole
  if (marketingRole === 'marketing_manager' || marketingRole === 'manager') return 'marketing_manager'
  if (marketingRole === 'marketing_executive' || marketingRole === 'executive') return 'marketing_manager'
  const pr = String(membership?.pipelineRole || user.pipelineRole || '').toLowerCase()
  if (pr === 'manager') return 'manager'
  return 'rep'
}

function greetingForHour() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function pipelineAction(role, extra = {}) {
  const base = { panel: 'pipeline', returnTo: 'overview', ...extra }
  if (role === 'rep') base.scopeOwner = 'me'
  if (role === 'manager') base.hierarchyTeam = 'mine'
  if (role === 'org_admin') base.scope = 'all'
  return base
}

function calendarAction(extra = {}) {
  return { panel: 'crm-calendar', returnTo: 'overview', focusToday: true, ...extra }
}

function countByStatus(entries) {
  const map = Object.fromEntries(CRM_STATUSES.map((s) => [s, 0]))
  for (const entry of entries) {
    const st = normalizeExtendedCrm(entry.crm).status || 'new'
    if (map[st] != null) map[st] += 1
  }
  return map
}

function scanStatCounts(entries, tz) {
  const now = Date.now()
  const endToday = endOfLocalDay(tz)
  const monthEnd = endOfMonth(tz)
  const yesterday = now - MS_DAY
  const counts = {
    tasksToday: 0,
    followUpsDue: 0,
    dealsClosing: 0,
    meetingsToday: 0,
    unreadUpdates: 0,
    newAssignments: 0,
  }

  for (const entry of entries) {
    const crm = normalizeExtendedCrm(entry.crm)
    for (const task of crm.tasks || []) {
      if (task.status === 'done') continue
      const due = task.dueAt ? new Date(task.dueAt).getTime() : null
      if (due && due <= endToday) counts.tasksToday += 1
    }
    if (
      crm.status === 'follow_up' &&
      (!crm.nextFollowUpAt || new Date(crm.nextFollowUpAt).getTime() <= endToday)
    ) {
      counts.followUpsDue += 1
    }
    for (const deal of crm.deals || []) {
      if (deal.wonAt || deal.lostAt || deal.stage === 'won' || deal.stage === 'lost') continue
      const closeRaw = deal.expectedCloseDate || deal.expectedCloseAt
      if (!closeRaw) continue
      const closeMs = new Date(closeRaw).getTime()
      if (closeMs >= startOfLocalDay(tz) && closeMs <= monthEnd) counts.dealsClosing += 1
    }
    for (const m of crm.meetings || []) {
      const at = m.scheduledAt ? new Date(m.scheduledAt).getTime() : null
      if (at && at >= startOfLocalDay(tz) && at <= endToday) counts.meetingsToday += 1
    }
    if (crm.status === 'new' && entry.savedAt && new Date(entry.savedAt).getTime() >= yesterday) {
      counts.newAssignments += 1
    }
  }
  return counts
}

function buildStatStrip(role, counts) {
  const mk = (id, label, count, linkLabel, action, highlight = false) => ({
    id,
    label,
    count,
    linkLabel,
    action,
    highlight: Boolean(highlight && count > 0),
  })

  return [
    mk(
      'tasks_today',
      "Today's tasks",
      counts.tasksToday,
      'Open tasks',
      role === 'rep'
        ? { panel: 'pipeline', tasksDueToday: true, scopeOwner: 'me', returnTo: 'overview' }
        : role === 'manager'
          ? { panel: 'pipeline', tasksDueToday: true, hierarchyTeam: 'mine', returnTo: 'overview' }
          : { panel: 'pipeline', tasksDueToday: true, scope: 'all', returnTo: 'overview' }
    ),
    mk(
      'followups_due',
      'Follow-ups due',
      counts.followUpsDue,
      'View leads',
      pipelineAction(role, { status: 'follow_up', followUpDue: true })
    ),
    mk(
      'deals_closing',
      'Deals closing',
      counts.dealsClosing,
      'Open deals',
      pipelineAction(role, { view: 'deals', closing: 'this-month' })
    ),
    mk(
      'meetings_today',
      'Meetings today',
      counts.meetingsToday,
      'Calendar',
      calendarAction()
    ),
    mk(
      'unread_updates',
      'Unread updates',
      counts.unreadUpdates,
      'Activity',
      pipelineAction(role, { unreadOnly: true }),
      true
    ),
    mk(
      'new_assignments',
      'New assignments',
      counts.newAssignments,
      'New leads',
      pipelineAction(role, { status: 'new', assignedAfter: 'yesterday' })
    ),
  ]
}

function buildPipelineSummary(entries, { stuckDays = 7 } = {}) {
  const stages = Object.fromEntries(CRM_STATUSES.map((s) => [s, 0]))
  let dealValue = 0
  let expectedRevenue = 0
  let stuck = 0
  const now = Date.now()
  const stuckMs = stuckDays * MS_DAY

  for (const entry of entries) {
    const crm = normalizeExtendedCrm(entry.crm)
    const st = crm.status || 'new'
    if (stages[st] != null) stages[st] += 1
    const val = Number(crm.dealValue) || 0
    if (st !== 'won' && st !== 'lost') {
      dealValue += val
      const weight = st === 'replied' ? 0.65 : st === 'follow_up' ? 0.4 : 0.2
      expectedRevenue += val * weight
    }
    const last = crm.lastCommunicationAt || crm.updatedAt || entry.savedAt
    if (last && now - new Date(last).getTime() > stuckMs && st !== 'won' && st !== 'lost') {
      stuck += 1
    }
  }

  const maxCount = Math.max(1, ...Object.values(stages))
  const stageRows = CRM_STATUSES.filter((id) => stages[id] > 0 || id === 'follow_up' || id === 'new').map(
    (id) => ({
      id,
      count: stages[id] || 0,
      pct: Math.round(((stages[id] || 0) / maxCount) * 100),
    })
  )

  return {
    leadCount: entries.length,
    dealValue: Math.round(dealValue),
    expectedRevenue: Math.round(expectedRevenue),
    stuck,
    stages: stageRows,
  }
}

function pipelineSummaryFromSqlAndSnapshot(sqlSummary, pipeSnap) {
  if (pipeSnap?.pipelineSnapshot?.stages?.length) {
    return {
      leadCount: pipeSnap.pipelineSnapshot.leadCount ?? pipeSnap.total ?? 0,
      dealValue: pipeSnap.pipelineSnapshot.dealValue ?? 0,
      expectedRevenue: pipeSnap.pipelineSnapshot.expectedRevenue ?? 0,
      stuck: pipeSnap.pipelineSnapshot.stuckDeals ?? 0,
      stages: pipeSnap.pipelineSnapshot.stages,
    }
  }
  const stages = Object.fromEntries(CRM_STATUSES.map((s) => [s, 0]))
  for (const row of sqlSummary?.byStatus || []) {
    const st = row.status || 'new'
    if (stages[st] != null) stages[st] = Number(row.count) || 0
  }
  const maxCount = Math.max(1, ...Object.values(stages))
  const stageRows = CRM_STATUSES.filter((id) => stages[id] > 0 || id === 'follow_up' || id === 'new').map(
    (id) => ({
      id,
      count: stages[id] || 0,
      pct: Math.round(((stages[id] || 0) / maxCount) * 100),
    })
  )
  const total = sqlSummary?.total ?? stageRows.reduce((n, row) => n + row.count, 0)
  return {
    leadCount: total,
    dealValue: 0,
    expectedRevenue: 0,
    stuck: 0,
    stages: stageRows,
  }
}

function statCountsFromTeamSummary(summary = {}) {
  return {
    tasksToday: Number(summary.tasksDueToday) || 0,
    followUpsDue: Number(summary.needsFollowUp) || 0,
    dealsClosing: Number(summary.dealsClosing) || 0,
    meetingsToday: Number(summary.meetingsUpcoming) || 0,
    unreadUpdates: 0,
    newAssignments: Number(summary.newLeads) || 0,
  }
}

function buildPriorities(entries, tz, limit = 8) {
  const now = Date.now()
  const endToday = endOfLocalDay(tz)
  const rows = []

  for (const entry of entries) {
    const crm = normalizeExtendedCrm(entry.crm)
    const leadId = entry.lead?.id || entry.id
    const name = leadLabel(entry)
    const company = entry.lead?.company || ''

    for (const task of crm.tasks || []) {
      if (task.status === 'done') continue
      const due = task.dueAt ? new Date(task.dueAt).getTime() : null
      if (!due || due > endToday + MS_DAY) continue
      rows.push({
        id: `task-${task.id}`,
        kind: 'task',
        title: task.title || `Task · ${name}`,
        subtitle: company,
        leadId,
        dueAt: task.dueAt,
        overdue: due < now,
        dueToday: due <= endToday,
        action: { panel: 'pipeline', leadId, returnTo: 'overview' },
      })
    }

    if (
      crm.status === 'follow_up' &&
      (!crm.nextFollowUpAt || new Date(crm.nextFollowUpAt).getTime() <= endToday)
    ) {
      rows.push({
        id: `fu-${leadId}`,
        kind: 'follow_up',
        title: `Follow up with ${name}`,
        subtitle: company,
        leadId,
        dueAt: crm.nextFollowUpAt || null,
        overdue: crm.nextFollowUpAt ? new Date(crm.nextFollowUpAt).getTime() < now : false,
        dueToday: true,
        action: { panel: 'pipeline', leadId, status: 'follow_up', returnTo: 'overview' },
      })
    }
  }

  return rows
    .sort((a, b) => {
      const ta = a.dueAt ? new Date(a.dueAt).getTime() : Infinity
      const tb = b.dueAt ? new Date(b.dueAt).getTime() : Infinity
      return ta - tb
    })
    .slice(0, limit)
}

function buildLeadFocus(entries, tz) {
  const endToday = endOfLocalDay(tz)
  let newLeads = 0
  let hotLeads = 0
  let uncontacted = 0
  let followUpDue = 0
  const scores = { high: 0, mid: 0, low: 0, none: 0 }

  for (const entry of entries) {
    const crm = normalizeExtendedCrm(entry.crm)
    const score = Number(crm.leadScore) || 0
    if (crm.status === 'new') {
      newLeads += 1
      if (!crm.lastCommunicationAt) uncontacted += 1
    }
    if (score >= HOT_SCORE) hotLeads += 1
    if (
      crm.status === 'follow_up' &&
      (!crm.nextFollowUpAt || new Date(crm.nextFollowUpAt).getTime() <= endToday)
    ) {
      followUpDue += 1
    }
    if (score >= HOT_SCORE) scores.high += 1
    else if (score >= 40) scores.mid += 1
    else if (score > 0) scores.low += 1
    else scores.none += 1
  }

  return { newLeads, hotLeads, uncontacted, followUpDue, scores }
}

function buildActivityFeed(store, user, entries, { limit = 12, since = 0 } = {}) {
  const acts = listCrmActivities(store, user, entries, {
    since,
    feedLimit: 120,
    responseLimit: limit,
  })
  return acts.map((act) => ({
    id: act.id || `act-${act.leadId}-${act.createdAt}`,
    type: act.type || 'note',
    summary: act.summary,
    leadName: act.leadName,
    company: act.company,
    leadId: act.leadId,
    actorName: act.createdByName,
    actorId: act.createdByUserId,
    at: act.createdAt,
    action: { panel: 'pipeline', leadId: act.leadId, returnTo: 'overview' },
  }))
}

function buildRepPerformance(entries, members, ownerIds) {
  const allowed = new Set((ownerIds || []).map(String))
  const reps = members.filter((m) => allowed.has(String(m.userId)))
  const now = Date.now()
  const weekAgo = now - 7 * MS_DAY

  return reps.map((m) => {
    const uid = String(m.userId)
    const mine = entries.filter((e) => entryOwnerId(e) === uid)
    let open = 0
    let followups = 0
    let wonMonth = 0
    let activities7d = 0

    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

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
      }
    }

    return {
      userId: m.userId,
      name: m.name,
      email: m.email,
      open,
      followups,
      activities7d,
      wonMonth,
      lastActiveAt: lastCrmActivityAtForUser(entries, uid),
      action: { panel: 'pipeline', userId: m.userId, assigneeUserId: m.userId, returnTo: 'overview' },
      cellActions: {
        open: { panel: 'pipeline', userId: m.userId, assigneeUserId: m.userId, returnTo: 'overview' },
        followups: {
          panel: 'pipeline',
          status: 'follow_up',
          followUpDue: true,
          userId: m.userId,
          assigneeUserId: m.userId,
          returnTo: 'overview',
        },
        won: {
          panel: 'pipeline',
          status: 'won',
          wonThisMonth: true,
          userId: m.userId,
          assigneeUserId: m.userId,
          returnTo: 'overview',
        },
        activities: { panel: 'crm-log', userId: m.userId, period: 'week', returnTo: 'overview' },
      },
    }
  }).sort((a, b) => b.activities7d - a.activities7d)
}

/** Rep ids for team review — include full roster for admins; team + roster for managers. */
async function repOwnerIdsForDashboard(user, role, visibleOwnerIds) {
  const orgId = user.organizationId
  if (!orgId) return [user.id]

  const members = await loadOrgRepRoster(orgId, { userForIndex: user })
  const salesMembers = members.filter((m) => m.role !== 'org_admin' || m.pipelineRole === 'manager')

  if (role === 'org_admin') {
    return salesMembers.map((m) => m.userId)
  }

  if (role === 'manager') {
    return expandManagerRosterIds(user, orgId, visibleOwnerIds, members)
  }

  return [user.id]
}

function buildTeamLeaderboard(entries, hierarchy) {
  const teams = (hierarchy?.departments || []).flatMap((d) =>
    (d.teams || []).map((t) => ({ ...t, departmentName: d.name }))
  )
  if (!teams.length) {
    return [
      {
        teamId: 'all',
        teamName: 'All teams',
        openLeads: entries.filter((e) => {
          const st = normalizeExtendedCrm(e.crm).status
          return st !== 'won' && st !== 'lost'
        }).length,
        followups: entries.filter((e) => normalizeExtendedCrm(e.crm).status === 'follow_up').length,
        activities7d: 0,
        wonMonth: entries.filter((e) => normalizeExtendedCrm(e.crm).status === 'won').length,
        value: 0,
        action: { panel: 'pipeline', scope: 'all', returnTo: 'overview' },
      },
    ]
  }

  const weekAgo = Date.now() - 7 * MS_DAY
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  return teams.map((team) => {
    const memberIds = new Set((team.members || []).map((m) => String(m.userId)))
    const teamEntries = entries.filter((e) => memberIds.has(entryOwnerId(e)))
    let activities7d = 0
    let value = 0
    let wonMonth = 0
    let openLeads = 0
    let followups = 0

    for (const entry of teamEntries) {
      const crm = normalizeExtendedCrm(entry.crm)
      if (crm.status !== 'won' && crm.status !== 'lost') openLeads += 1
      if (crm.status === 'follow_up') followups += 1
      if (crm.status === 'won') {
        const wonAt = crm.updatedAt || crm.lastCommunicationAt
        if (wonAt && new Date(wonAt) >= monthStart) {
          wonMonth += 1
          value += Number(crm.dealValue) || 0
        }
      }
      for (const act of crm.activities || []) {
        if (new Date(act.createdAt || 0).getTime() >= weekAgo) activities7d += 1
      }
    }

    return {
      teamId: team.id,
      teamName: `${team.departmentName} — ${team.name}`,
      openLeads,
      followups,
      activities7d,
      wonMonth,
      value: Math.round(value),
      action: { panel: 'pipeline', teamId: team.id, scope: 'all', returnTo: 'overview' },
      cellActions: {
        openLeads: { panel: 'pipeline', teamId: team.id, scope: 'all', returnTo: 'overview' },
        followups: {
          panel: 'pipeline',
          status: 'follow_up',
          followUpDue: true,
          teamId: team.id,
          scope: 'all',
          returnTo: 'overview',
        },
        wonMonth: {
          panel: 'pipeline',
          status: 'won',
          wonThisMonth: true,
          teamId: team.id,
          scope: 'all',
          returnTo: 'overview',
        },
        activities: { panel: 'crm-log', period: 'week', teamId: team.id, returnTo: 'overview' },
      },
    }
  }).sort((a, b) => b.activities7d - a.activities7d)
}

function buildInsights(role, counts, pipeline, leadFocus, topRep) {
  const insights = []
  if (leadFocus.hotLeads > 0) {
    insights.push({
      kind: 'opportunity',
      text: `${leadFocus.hotLeads} lead${leadFocus.hotLeads === 1 ? '' : 's'} are highly engaged (score ≥ 70).`,
      action: pipelineAction(role, { scoreMin: 70 }),
    })
  }
  if (counts.followUpsDue > 0) {
    insights.push({
      kind: 'urgent',
      text: `${counts.followUpsDue} opportunit${counts.followUpsDue === 1 ? 'y needs' : 'ies need'} follow-up today.`,
      action: pipelineAction(role, { status: 'follow_up', followUpDue: true }),
    })
  }
  if (topRep) {
    insights.push({
      kind: 'opportunity',
      text: `${topRep.name} is your top performer this week (${topRep.activities7d} activities).`,
      action: topRep.action,
    })
  }
  if (pipeline.stuck > 0) {
    insights.push({
      kind: 'warning',
      text: `${pipeline.stuck} leads have had no activity in 7+ days.`,
      action: pipelineAction(role, { stuck: true }),
    })
  }
  return insights.slice(0, 4)
}

function buildThisWeek(store, user, entries, userId) {
  const weekAgo = Date.now() - 7 * MS_DAY
  const acts = listCrmActivities(store, user, entries, {
    since: weekAgo,
    memberUserId: userId,
    feedLimit: 200,
    responseLimit: 200,
  })
  const target = 25
  const achieved = acts.length
  const prev = Math.max(0, Math.round(achieved * 0.67))
  const vsLastWeekPct = prev ? Math.round(((achieved - prev) / prev) * 100) : null
  return {
    target,
    achieved,
    progressPct: Math.min(100, Math.round((achieved / target) * 100)),
    vsLastWeekPct,
  }
}

function buildSystemHealth(user, store) {
  const org = user.organizationId ? getOrganization(store, user.organizationId) : null
  const flags = []
  flags.push({
    ok: true,
    label: 'SQL pipeline mode',
    detail: isPipelineHierarchyRbacEnabled() ? 'Active' : 'JSON shard mode',
  })
  flags.push({
    ok: Boolean(org?.emailDomain?.status === 'verified'),
    label: 'DNS verification',
    detail: org?.emailDomain?.status === 'verified' ? 'Verified' : 'Pending',
    action: org?.emailDomain?.status === 'verified' ? null : { panel: 'team', teamTab: 'integrations', returnTo: 'overview' },
  })
  flags.push({
    ok: Boolean(user.whatsappAutoSendReady),
    label: 'WhatsApp API',
    detail: user.whatsappAutoSendReady ? 'Connected' : 'Not connected',
    action: user.whatsappAutoSendReady ? null : { panel: 'team', teamTab: 'integrations', returnTo: 'overview' },
  })
  return flags
}

async function resolveScopedEntries(user, store, { assigneeUserId = null } = {}) {
  const metaStore = {
    users: store.users,
    organizations: store.organizations,
    organizationMemberships: store.organizationMemberships,
  }
  const role = detectDashboardRole(user, store)
  const visibleOwnerIds =
    role === 'org_admin' ? null : await resolveManagerVisibleOwnerIds(user, metaStore)

  let sqlSummary = null
  if (isPipelineHierarchyRbacEnabled()) {
    sqlSummary = await loadScopedPipelineStatusCounts(user, metaStore, {
      assigneeUserId: assigneeUserId || undefined,
    })
  }

  if (sqlSummary?.ready && !String(assigneeUserId || '').trim()) {
    return {
      role,
      entries: [],
      visibleOwnerIds,
      sqlSummary,
      assigneeUserId: null,
      snapshotFirst: true,
    }
  }

  if (sqlSummary?.ready && sqlSummary.total === 0) {
    return {
      role,
      entries: [],
      visibleOwnerIds,
      sqlSummary,
      assigneeUserId: assigneeUserId || null,
    }
  }

  const { visible } = await loadPipelineStoreContext(user, { dashboard: true, shardOnly: true })
  let entries = visible

  if (role === 'rep' && visibleOwnerIds?.length) {
    const allowed = new Set(visibleOwnerIds.map(String))
    entries = visible.filter((e) => allowed.has(entryOwnerId(e)))
  }

  const assignee = String(assigneeUserId || '').trim()
  if (assignee && role !== 'rep') {
    entries = entries.filter((e) => entryOwnerId(e) === assignee)
  }

  if (!sqlSummary && isPipelineHierarchyRbacEnabled()) {
    sqlSummary = await loadScopedPipelineStatusCounts(user, metaStore, {
      assigneeUserId: assignee || undefined,
    })
  }

  return { role, entries, visibleOwnerIds, sqlSummary, assigneeUserId: assignee || null }
}

async function buildDashboardBootstrapSnapshotFirst(
  sessionUser,
  store,
  { role, sqlSummary, visibleOwnerIds, assigneeUserId = null }
) {
  const user = store.users.find((u) => u.id === sessionUser.id) || sessionUser
  const tz = resolveTimeZone(user, null)
  const firstName = String(user.name || user.email || 'there').split(' ')[0]
  const orgId = user.organizationId

  const [teamSnap, pipeSnap, myDaySnap, activitySnap] = await Promise.all([
    orgId ? readSnapshotPayload(teamSnapshotCollection(orgId, 'week')) : null,
    orgId ? readPipelineSnapshot(orgId) : null,
    readMyDaySnapshot(user),
    orgId ? readActivityLogSnapshot(user, { period: 'week' }) : null,
  ])

  const summary = teamSnap?.summary || {}
  const counts = statCountsFromTeamSummary(summary)
  if (sqlSummary?.byStatus) {
    const fu = sqlSummary.byStatus.find((r) => r.status === 'follow_up')
    if (fu) counts.followUpsDue = fu.count
  }

  const pipeline = pipelineSummaryFromSqlAndSnapshot(sqlSummary, pipeSnap)
  const priorities = myDaySnap?.myDay?.priorities?.length
    ? myDaySnap.myDay.priorities
    : []
  const leadFocus = myDaySnap?.myDay?.leadFocus?.length ? myDaySnap.myDay.leadFocus : []
  const activity = (activitySnap?.activities || activitySnap?.recentActivities || [])
    .slice(0, 15)
    .map((row) => ({
      id: row.id || row.activityId,
      kind: row.type || row.kind || 'activity',
      title: row.title || row.summary || 'Activity',
      subtitle: row.subtitle || row.company || '',
      at: row.createdAt || row.at,
      leadId: row.leadId,
    }))

  const members = orgId ? await loadOrgRepRoster(orgId, { userForIndex: user }) : []
  const payload = {
    role,
    greeting: greetingForHour(),
    user: { firstName, avatarUrl: user.avatarUrl || null },
    statStrip: buildStatStrip(role, counts),
    priorities,
    pipelineSummary: pipeline,
    timeline: priorities.map((p) => ({
      id: p.id,
      kind: p.kind,
      title: p.title,
      subtitle: p.subtitle,
      at: p.dueAt,
      leadId: p.leadId,
      action: p.action,
    })),
    thisWeek: myDaySnap?.myDay?.todayTimeline || [],
    leadFocus,
    activity,
    quickActions: [],
    lastUpdated: teamSnap?.updatedAt || pipeSnap?.updatedAt || new Date().toISOString(),
    scopeLabel:
      role === 'org_admin' ? 'All teams' : role === 'manager' ? 'Your team' : 'Your leads only',
    _snapshotFirst: true,
  }

  if (role === 'rep') {
    payload.quickActions = [
      { id: 'lead', label: 'New lead', action: { panel: 'pipeline', returnTo: 'overview' } },
      { id: 'task', label: 'New task', action: { panel: 'pipeline', returnTo: 'overview' } },
      { id: 'meeting', label: 'Schedule meeting', action: calendarAction() },
      { id: 'search', label: 'Find leads', action: { panel: 'search', returnTo: 'overview' } },
    ]
    payload.leadFocusActions = {
      newLeads: pipelineAction('rep', { status: 'new' }),
      hot: pipelineAction('rep', { scoreMin: 70 }),
      uncontacted: pipelineAction('rep', { status: 'new', lastActivity: 'never' }),
      followUp: pipelineAction('rep', { status: 'follow_up', followUpDue: true }),
    }
  }

  if (role === 'manager' || role === 'org_admin') {
    const perfMembers =
      role === 'org_admin'
        ? members.filter((m) => m.role !== 'org_admin')
        : members
    const perfOwners =
      role === 'org_admin'
        ? await repOwnerIdsForDashboard(user, role, members.map((m) => m.userId))
        : await repOwnerIdsForDashboard(user, role, visibleOwnerIds)
    payload.repPerformance = orgId
      ? await buildRepPerformanceFromSnapshots(user, perfMembers, perfOwners, { period: 'week' })
      : []
    payload.topRep = payload.repPerformance[0] || null
    payload.insights = buildInsights(role, counts, pipeline, leadFocus, payload.topRep)
  }

  if (role === 'org_admin') {
    payload.systemHealth = buildSystemHealth(user, store)
    payload.revenue = {
      monthlyTarget: 1_000_000,
      achieved: Number(summary.wonValue) || 0,
      progressPct: 0,
    }
    payload.revenue.progressPct = payload.revenue.monthlyTarget
      ? Math.min(100, Math.round((payload.revenue.achieved / payload.revenue.monthlyTarget) * 100))
      : 0
    payload.teamLeaderboard = [
      {
        teamId: 'all',
        teamName: 'All teams',
        openLeads: Math.max(0, (sqlSummary?.total || 0) - (summary.won || 0)),
        followups: counts.followUpsDue,
        activities7d: Number(summary.activitiesInPeriod) || 0,
        wonMonth: Number(summary.won) || 0,
        value: Number(summary.pipelineValue) || 0,
        action: { panel: 'pipeline', scope: 'all', returnTo: 'overview' },
      },
    ]
    payload.quickActions = [
      { id: 'report', label: 'Org report', action: { panel: 'crm-dashboard', returnTo: 'overview' } },
      { id: 'invite', label: 'Invite member', action: { panel: 'team', teamTab: 'members', returnTo: 'overview' } },
      { id: 'import', label: 'Import leads', action: { panel: 'team', teamTab: 'import', returnTo: 'overview' } },
    ]
  }

  return payload
}

export async function buildDashboardBootstrap(sessionUser, { assigneeUserId = null } = {}) {
  const metaStore = await readStore({
    only: [
      ...META_STORE_COLLECTIONS,
      'marketingCampaigns',
      'marketingForms',
      'marketingLists',
    ],
  })
  const user = metaStore.users.find((u) => u.id === sessionUser.id) || sessionUser
  const tz = resolveTimeZone(user, null)
  const role = detectDashboardRole(user, metaStore)
  const firstName = String(user.name || user.email || 'there').split(' ')[0]
  const since = Date.now() - 30 * MS_DAY

  if (role === 'marketing_manager') {
    const overview = await marketingOverview(metaStore, user, { light: true })
    const sent = overview.summary?.sent ?? 0
    const opens = overview.summary?.opens ?? 0
    const openRate = sent ? Math.round((opens / sent) * 100) : 0
    return {
      role,
      greeting: greetingForHour(),
      user: { firstName, avatarUrl: user.avatarUrl || null },
      statStrip: [
        { id: 'emails_sent', label: 'Emails sent', count: sent, linkLabel: 'Campaigns', action: { panel: 'marketing', tab: 'campaigns', returnTo: 'overview' }, highlight: sent > 0 },
        { id: 'open_rate', label: 'Open rate', count: openRate, suffix: '%', linkLabel: 'Analytics', action: { panel: 'marketing', tab: 'analytics', returnTo: 'overview' }, highlight: openRate > 0 },
        { id: 'forms', label: 'Form submissions', count: (overview.forms || []).reduce((n, f) => n + (f.submissions || 0), 0), linkLabel: 'Forms', action: { panel: 'marketing', tab: 'forms', returnTo: 'overview' }, highlight: true },
        { id: 'lists', label: 'Audiences', count: (overview.lists || []).length, linkLabel: 'Audiences', action: { panel: 'marketing', tab: 'audiences', returnTo: 'overview' }, highlight: false },
        { id: 'campaigns', label: 'Active campaigns', count: (overview.campaigns || []).filter((c) => c.status === 'active').length, linkLabel: 'Campaigns', action: { panel: 'marketing', tab: 'campaigns', returnTo: 'overview' }, highlight: false },
        { id: 'segments', label: 'Segments', count: (overview.segments || []).length, linkLabel: 'Audiences', action: { panel: 'marketing', tab: 'audiences', returnTo: 'overview' }, highlight: false },
      ],
      marketing: {
        campaigns: (overview.campaigns || []).slice(0, 6),
        forms: (overview.forms || []).slice(0, 5),
        summary: overview.summary,
      },
      quickActions: [
        { id: 'campaign', label: 'Create campaign', action: { panel: 'marketing', tab: 'campaigns', returnTo: 'overview' } },
        { id: 'form', label: 'New form', action: { panel: 'marketing', tab: 'forms', returnTo: 'overview' } },
        { id: 'bulk', label: 'Bulk email', action: { panel: 'marketing', tab: 'bulk-email', returnTo: 'overview' } },
      ],
      lastUpdated: new Date().toISOString(),
    }
  }

  const scoped = await resolveScopedEntries(user, metaStore, { assigneeUserId })
  if (scoped.snapshotFirst && scoped.sqlSummary?.ready) {
    return buildDashboardBootstrapSnapshotFirst(user, metaStore, scoped)
  }

  let { entries, visibleOwnerIds, sqlSummary, assigneeUserId: scopedAssignee } = scoped
  let mergedStore = metaStore

  if (!entries.length && !sqlSummary?.ready) {
    const store = await readStore({
      only: [
        ...META_STORE_COLLECTIONS,
        'savedLeads',
        'marketingCampaigns',
        'marketingForms',
        'marketingLists',
      ],
    })
    mergedStore = { ...metaStore, savedLeads: store.savedLeads || [] }
    const retry = await resolveScopedEntries(user, mergedStore, { assigneeUserId })
    entries = retry.entries
    visibleOwnerIds = retry.visibleOwnerIds
    sqlSummary = retry.sqlSummary
    scopedAssignee = retry.assigneeUserId
  }

  const counts = scanStatCounts(entries, tz)

  if (sqlSummary?.byStatus) {
    const fu = sqlSummary.byStatus.find((r) => r.status === 'follow_up')
    if (fu) counts.followUpsDue = fu.count
  }

  const statStrip = buildStatStrip(role, counts)
  const pipeline = buildPipelineSummary(entries)
  const priorities = buildPriorities(entries, tz)
  const leadFocus = buildLeadFocus(entries, tz)
  const thisWeek = buildThisWeek(mergedStore, user, entries, user.id)
  const activity = buildActivityFeed(mergedStore, user, entries, { limit: 15, since })
  const members = user.organizationId ? await loadOrgRepRoster(user.organizationId, { userForIndex: user }) : []

  const payload = {
    role,
    greeting: greetingForHour(),
    user: { firstName, avatarUrl: user.avatarUrl || null },
    statStrip,
    priorities,
    pipelineSummary: pipeline,
    timeline: priorities.map((p) => ({
      id: p.id,
      kind: p.kind,
      title: p.title,
      subtitle: p.subtitle,
      at: p.dueAt,
      leadId: p.leadId,
      action: p.action,
    })),
    thisWeek,
    leadFocus,
    activity,
    quickActions: [],
    lastUpdated: new Date().toISOString(),
    scopeLabel:
      role === 'org_admin'
        ? 'All teams'
        : role === 'manager'
          ? 'Your team'
          : 'Your leads only',
  }

  if (role === 'rep') {
    payload.quickActions = [
      { id: 'lead', label: 'New lead', action: { panel: 'pipeline', returnTo: 'overview' } },
      { id: 'task', label: 'New task', action: { panel: 'pipeline', returnTo: 'overview' } },
      { id: 'meeting', label: 'Schedule meeting', action: calendarAction() },
      { id: 'search', label: 'Find leads', action: { panel: 'search', returnTo: 'overview' } },
    ]
    payload.leadFocusActions = {
      newLeads: pipelineAction('rep', { status: 'new' }),
      hot: pipelineAction('rep', { scoreMin: 70 }),
      uncontacted: pipelineAction('rep', { status: 'new', lastActivity: 'never' }),
      followUp: pipelineAction('rep', { status: 'follow_up', followUpDue: true }),
    }
  }

  if (role === 'manager') {
    const ownerIds = await repOwnerIdsForDashboard(user, role, visibleOwnerIds)
    const profileMap = user.organizationId ? await loadMemberProfilesMap(user.organizationId) : {}
    const teamId = profileMap[user.id]?.teamId
    let teamLabel = 'Your team'
    if (teamId && user.organizationId) {
      try {
        const hierarchy = await listOrgHierarchy(user.organizationId, { skipLeadCounts: true })
        for (const d of hierarchy.departments || []) {
          const team = (d.teams || []).find((t) => String(t.id) === String(teamId))
          if (team) {
            teamLabel = `${d.name} — ${team.name}`
            break
          }
        }
      } catch {
        // ignore
      }
    }
    payload.teamLabel = teamLabel
    const perfMembers = scopedAssignee
      ? members.filter((m) => String(m.userId) === scopedAssignee)
      : members
    const perfOwners = scopedAssignee ? [scopedAssignee] : ownerIds
    payload.repPerformance = user.organizationId
      ? await buildRepPerformanceFromSnapshots(user, perfMembers, perfOwners, { period: 'week' })
      : buildRepPerformance(entries, perfMembers, perfOwners)
    payload.topRep = payload.repPerformance[0] || null
    payload.insights = buildInsights(role, counts, pipeline, leadFocus, payload.topRep)
    payload.quickActions = [
      { id: 'team', label: 'Team pipeline', action: pipelineAction('manager', {}) },
      { id: 'report', label: 'Team report', action: { panel: 'crm-dashboard', returnTo: 'overview' } },
      { id: 'calendar', label: 'Team calendar', action: calendarAction() },
    ]
  }

  if (role === 'org_admin') {
    let hierarchy = { departments: [] }
    if (user.organizationId) {
      try {
        hierarchy = await listOrgHierarchy(user.organizationId, { skipLeadCounts: true })
      } catch {
        // ignore
      }
    }
    payload.teamLeaderboard = buildTeamLeaderboard(entries, hierarchy)
    const perfMembers = scopedAssignee
      ? members.filter((m) => String(m.userId) === scopedAssignee)
      : members.filter((m) => m.role !== 'org_admin')
    const perfOwners = scopedAssignee
      ? [scopedAssignee]
      : await repOwnerIdsForDashboard(user, role, members.map((m) => m.userId))
    payload.repPerformance = user.organizationId
      ? await buildRepPerformanceFromSnapshots(user, perfMembers, perfOwners, { period: 'week' })
      : buildRepPerformance(entries, perfMembers, perfOwners)
    payload.topRep = [...payload.repPerformance].sort((a, b) => b.activities7d - a.activities7d)[0] || null
    payload.insights = buildInsights(role, counts, pipeline, leadFocus, payload.topRep)
    payload.systemHealth = buildSystemHealth(user, mergedStore)
    payload.revenue = {
      monthlyTarget: 1_000_000,
      achieved: entries
        .filter((e) => normalizeExtendedCrm(e.crm).status === 'won')
        .reduce((n, e) => n + (Number(normalizeExtendedCrm(e.crm).dealValue) || 0), 0),
      progressPct: 0,
    }
    payload.revenue.progressPct = payload.revenue.monthlyTarget
      ? Math.min(100, Math.round((payload.revenue.achieved / payload.revenue.monthlyTarget) * 100))
      : 0
    payload.quickActions = [
      { id: 'report', label: 'Org report', action: { panel: 'crm-dashboard', returnTo: 'overview' } },
      { id: 'invite', label: 'Invite member', action: { panel: 'team', teamTab: 'members', returnTo: 'overview' } },
      { id: 'import', label: 'Import leads', action: { panel: 'team', teamTab: 'import', returnTo: 'overview' } },
    ]
  }

  return payload
}
