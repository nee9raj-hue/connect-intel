import { normalizeExtendedCrm } from './crmWorkflow.js'
import { MS_DAY } from './dashboardPeriod.js'
import { localDateKey, resolveTimeZone } from '../calendarLocale.js'
import { listCrmActivities } from './crmActivityCounts.js'
import { isFreightDealOrg } from '../freightDeal.js'
import { isTeamIntelligenceHubEnabled } from './crmProductFlags.js'

const MS_14D = 14 * MS_DAY
const HOT_SCORE = 70

function entryMine(entry, userId) {
  const uid = String(userId)
  if (entry.assignedToUserId) return String(entry.assignedToUserId) === uid
  return [entry.savedByUserId, entry.userId].filter(Boolean).some((v) => String(v) === uid)
}

function leadLabel(entry) {
  const lead = entry.lead || {}
  return (
    [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || 'Lead'
  )
}

function startOfLocalDay(tz) {
  const key = localDateKey(new Date(), tz)
  return new Date(`${key}T00:00:00`).getTime()
}

function endOfLocalDay(tz) {
  return startOfLocalDay(tz) + MS_DAY - 1
}

function endOfWeek(tz) {
  return Date.now() + 7 * MS_DAY
}

function detectRole(user) {
  if (user.isPlatformAdmin) return 'admin'
  if (user.isOrgAdmin || user.orgRole === 'org_admin') return 'manager'
  if (user.pipelineRole === 'sales') return 'sales_rep'
  return 'sales_rep'
}

function isDealClosed(deal) {
  return Boolean(
    deal?.wonAt ||
      deal?.lostAt ||
      deal?.stage === 'won' ||
      deal?.stage === 'lost'
  )
}

function dealCloseMs(deal) {
  const raw = deal?.expectedCloseDate || deal?.expectedCloseAt
  if (!raw) return null
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? t : null
}

function crmLegacyCloseMs(crm) {
  const raw = crm?.expectedCloseDate || crm?.expectedCloseAt
  if (!raw) return null
  const t = new Date(raw).getTime()
  return Number.isFinite(t) ? t : null
}

function buildCommandBarDetails(mine, userId, tz) {
  const now = Date.now()
  const endToday = endOfLocalDay(tz)
  const dayStart = startOfLocalDay(tz)
  const weekEnd = endOfWeek(tz)
  const details = {
    tasks: [],
    followups: [],
    deals: [],
    meetings: [],
    assignments: [],
  }

  for (const entry of mine) {
    if (!entryMine(entry, userId)) continue
    const crm = normalizeExtendedCrm(entry.crm)
    const leadId = entry.lead?.id || entry.id
    const name = leadLabel(entry)
    const company = entry.lead?.company || ''

    for (const task of crm.tasks || []) {
      if (task.status === 'done') continue
      const due = task.dueAt ? new Date(task.dueAt).getTime() : null
      if (due && due <= endToday) {
        details.tasks.push({
          id: `task-${task.id}`,
          title: task.title || `Task · ${name}`,
          subtitle: company || (due < now ? 'Overdue' : 'Due today'),
          leadId,
          dueAt: task.dueAt,
          action: { panel: 'pipeline', leadId, leadTab: 'tasks' },
        })
      }
    }

    const followDue =
      crm.status === 'follow_up' &&
      (!crm.nextFollowUpAt || new Date(crm.nextFollowUpAt).getTime() <= endToday)
    if (followDue) {
      details.followups.push({
        id: `fu-${leadId}`,
        title: `Follow up · ${name}`,
        subtitle: company || crm.status,
        leadId,
        dueAt: crm.nextFollowUpAt || null,
        action: { panel: 'pipeline', leadId, status: 'follow_up' },
      })
    }

    for (const deal of crm.deals || []) {
      if (isDealClosed(deal)) continue
      const closeMs = dealCloseMs(deal)
      if (closeMs != null && closeMs >= dayStart && closeMs <= weekEnd) {
        details.deals.push({
          id: `deal-${deal.id}`,
          title: deal.name || `Deal · ${name}`,
          subtitle: `${deal.stage || 'open'} · ${company}`,
          leadId,
          dueAt: deal.expectedCloseDate || deal.expectedCloseAt,
          action: { panel: 'pipeline', leadId, leadTab: 'deals' },
        })
      }
    }
    if (!details.deals.some((d) => d.leadId === leadId)) {
      const legacyClose = crmLegacyCloseMs(crm)
      if (legacyClose != null && legacyClose >= dayStart && legacyClose <= weekEnd) {
        details.deals.push({
          id: `deal-legacy-${leadId}`,
          title: `Closing · ${name}`,
          subtitle: company,
          leadId,
          dueAt: crm.expectedCloseDate || crm.expectedCloseAt,
          action: { panel: 'pipeline', leadId, leadTab: 'deals' },
        })
      }
    }

    for (const m of crm.meetings || []) {
      const at = m.scheduledAt ? new Date(m.scheduledAt).getTime() : null
      if (at && at >= dayStart && at <= endToday) {
        details.meetings.push({
          id: `meet-${m.id}`,
          title: m.title || `Meeting · ${name}`,
          subtitle: company,
          leadId,
          dueAt: m.scheduledAt,
          action: { panel: 'crm-calendar', focusToday: true },
        })
      }
    }

    if (crm.status === 'new' && entry.savedAt && now - new Date(entry.savedAt).getTime() < 7 * MS_DAY) {
      details.assignments.push({
        id: `new-${leadId}`,
        title: name,
        subtitle: company || 'New assignment',
        leadId,
        dueAt: entry.savedAt,
        action: { panel: 'pipeline', leadId, status: 'new' },
      })
    }
  }

  for (const key of Object.keys(details)) {
    details[key] = details[key]
      .sort((a, b) => {
        const ta = a.dueAt ? new Date(a.dueAt).getTime() : Infinity
        const tb = b.dueAt ? new Date(b.dueAt).getTime() : Infinity
        return ta - tb
      })
      .slice(0, 30)
  }

  return details
}

function buildCommandBar(counts, details, { freightOrg = false } = {}) {
  const dealsAction = freightOrg
    ? { panel: 'pipeline', view: 'deals' }
    : { panel: 'pipeline', closingThisWeek: true }

  const items = [
    {
      id: 'tasks',
      label: "Today's tasks",
      count: counts.tasksToday,
      status: counts.tasksToday > 5 ? 'warn' : counts.tasksToday > 0 ? 'good' : 'neutral',
      trend: counts.tasksDelta,
      subtitle: 'Assigned to you · due today or overdue',
      action: { panel: 'crm-calendar', focusToday: true, upcomingOnly: true },
      details: details.tasks,
      viewAllLabel: 'Open calendar',
    },
    {
      id: 'followups',
      label: 'Follow-ups due',
      count: counts.followUpsDue,
      status: counts.followUpsDue > 0 ? 'risk' : 'good',
      trend: null,
      subtitle: 'Your leads in follow-up needing action',
      action: { panel: 'pipeline', status: 'follow_up', followUpDue: true },
      details: details.followups,
      viewAllLabel: 'Open follow-ups in pipeline',
    },
    {
      id: 'deals',
      label: 'Deals closing',
      count: counts.dealsClosing,
      status: counts.dealsClosing > 0 ? 'good' : 'neutral',
      trend: null,
      subtitle: 'Expected close this week',
      action: dealsAction,
      details: details.deals,
      viewAllLabel: 'View deals in pipeline',
    },
    {
      id: 'meetings',
      label: 'Meetings today',
      count: counts.meetingsToday,
      status: counts.meetingsToday > 0 ? 'good' : 'neutral',
      trend: null,
      subtitle: 'Scheduled for today',
      action: { panel: 'crm-calendar', focusToday: true },
      details: details.meetings,
      viewAllLabel: 'Open calendar',
    },
    {
      id: 'unread',
      label: 'Unread updates',
      count: counts.unreadPlaceholder,
      status: counts.unreadPlaceholder > 0 ? 'warn' : 'good',
      trend: null,
      subtitle: 'Notifications and activity',
      action: { panel: 'notifications' },
      details: [],
      viewAllLabel: 'Open notifications',
    },
    {
      id: 'assignments',
      label: 'New assignments',
      count: counts.newAssignments,
      status: counts.newAssignments > 0 ? 'warn' : 'good',
      trend: null,
      subtitle: 'New leads assigned to you (7 days)',
      action: { panel: 'pipeline', status: 'new' },
      details: details.assignments,
      viewAllLabel: 'Open new leads',
    },
  ]
  return items
}

function buildPriorities(scanned, userId, tz) {
  const now = Date.now()
  const endToday = endOfLocalDay(tz)
  const priorities = []

  for (const entry of scanned) {
    if (!entryMine(entry, userId)) continue
    const crm = normalizeExtendedCrm(entry.crm)
    const leadId = entry.lead?.id || entry.id
    const name = leadLabel(entry)
    const company = entry.lead?.company || ''

    for (const task of crm.tasks || []) {
      if (task.status === 'done') continue
      const due = task.dueAt ? new Date(task.dueAt).getTime() : null
      if (due && due < now) {
        priorities.push({
          id: `task-overdue-${task.id}`,
          score: 100,
          kind: 'task',
          title: task.title || `Task · ${name}`,
          subtitle: company || 'Overdue',
          leadId,
          dueAt: task.dueAt,
          action: { panel: 'pipeline', leadId },
        })
      } else if (due && due <= endToday) {
        priorities.push({
          id: `task-today-${task.id}`,
          score: 85,
          kind: 'task',
          title: task.title || `Task today · ${name}`,
          subtitle: company,
          leadId,
          dueAt: task.dueAt,
          action: { panel: 'pipeline', leadId },
        })
      }
    }

    if (crm.nextFollowUpAt) {
      const fu = new Date(crm.nextFollowUpAt).getTime()
      if (fu <= endToday) {
        priorities.push({
          id: `follow-${leadId}`,
          score: fu < now ? 95 : 80,
          kind: 'follow_up',
          title: `Follow up with ${name}`,
          subtitle: company,
          leadId,
          dueAt: crm.nextFollowUpAt,
          action: { panel: 'pipeline', leadId, status: 'follow_up' },
        })
      }
    }

    for (const m of crm.meetings || []) {
      const at = m.scheduledAt ? new Date(m.scheduledAt).getTime() : null
      if (!at || at < now - 3600000) continue
      if (at <= endToday) {
        const mins = Math.round((at - now) / 60000)
        priorities.push({
          id: `meet-${m.id}`,
          score: mins <= 60 ? 98 : 75,
          kind: 'meeting',
          title: m.title || `Meeting · ${name}`,
          subtitle: mins > 0 && mins <= 120 ? `Starts in ${mins} min` : company,
          leadId,
          dueAt: m.scheduledAt,
          action: { panel: 'crm-calendar' },
        })
      }
    }

    if (crm.responseReceived && crm.lastResponseAt) {
      const age = now - new Date(crm.lastResponseAt).getTime()
      if (age < 3 * MS_DAY) {
        priorities.push({
          id: `reply-${leadId}`,
          score: 88,
          kind: 'reply',
          title: `Customer replied · ${name}`,
          subtitle: company,
          leadId,
          dueAt: crm.lastResponseAt,
          action: { panel: 'pipeline', leadId },
        })
      }
    }

    if (crm.status === 'replied') {
      const touched = crm.updatedAt || crm.lastCommunicationAt
      if (touched && now - new Date(touched).getTime() > 3 * MS_DAY) {
        priorities.push({
          id: `proposal-${leadId}`,
          score: 82,
          kind: 'deal',
          title: `Proposal pending · ${name}`,
          subtitle: '3+ days without update',
          leadId,
          action: { panel: 'pipeline', leadId },
        })
      }
    }

    if (crm.status === 'new') {
      const saved = entry.savedAt ? new Date(entry.savedAt).getTime() : null
      if (saved && now - saved < 7 * MS_DAY) {
        priorities.push({
          id: `new-${leadId}`,
          score: 70,
          kind: 'lead',
          title: `Contact ${name}`,
          subtitle: 'Not yet reached',
          leadId,
          action: { panel: 'pipeline', leadId, status: 'new' },
        })
      }
    }
  }

  return priorities.sort((a, b) => b.score - a.score).slice(0, 12)
}

function buildPipelineSnapshot(scanned, userId) {
  const stages = {
    new: 0,
    contacted: 0,
    follow_up: 0,
    replied: 0,
    won: 0,
    lost: 0,
  }
  let dealValue = 0
  let expectedRevenue = 0
  let stuckDeals = 0
  const now = Date.now()

  for (const entry of scanned) {
    if (!entryMine(entry, userId)) continue
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
    if (last && now - new Date(last).getTime() > MS_14D && st !== 'won' && st !== 'lost') {
      stuckDeals += 1
    }
  }

  const leadCount = Object.values(stages).reduce((s, n) => s + n, 0)

  return {
    stages: Object.entries(stages).map(([id, count]) => ({ id, count })).filter((s) => s.count > 0),
    leadCount,
    dealValue: Math.round(dealValue),
    expectedRevenue: Math.round(expectedRevenue),
    stuckDeals,
  }
}

function buildTodayTimeline(priorities) {
  return priorities
    .filter((p) => p.dueAt)
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      kind: p.kind,
      title: p.title,
      subtitle: p.subtitle,
      at: p.dueAt,
      leadId: p.leadId,
    }))
}

function buildLeadFocus(scanned, userId) {
  const now = Date.now()
  let newLeads = 0
  let hotLeads = 0
  let uncontacted = 0
  let followUpDue = 0
  const scores = { high: 0, mid: 0, low: 0, none: 0 }

  for (const entry of scanned) {
    if (!entryMine(entry, userId)) continue
    const crm = normalizeExtendedCrm(entry.crm)
    const score = Number(crm.leadScore) || 0

    if (crm.status === 'new') {
      newLeads += 1
      uncontacted += 1
    }
    if (score >= HOT_SCORE) hotLeads += 1
    if (
      crm.status === 'follow_up' &&
      (!crm.nextFollowUpAt || new Date(crm.nextFollowUpAt).getTime() <= now + MS_DAY)
    ) {
      followUpDue += 1
    }

    if (score >= HOT_SCORE) scores.high += 1
    else if (score >= 40) scores.mid += 1
    else if (score > 0) scores.low += 1
    else scores.none += 1
  }

  return {
    newLeads,
    hotLeads,
    uncontacted,
    followUpDue,
    scoreDistribution: [
      { id: 'high', label: 'Hot (70+)', count: scores.high },
      { id: 'mid', label: 'Warm', count: scores.mid },
      { id: 'low', label: 'Cool', count: scores.low },
      { id: 'none', label: 'Unscored', count: scores.none },
    ].filter((r) => r.count > 0),
  }
}

function buildRevenueProgress(scanned, userId, tz) {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthMs = monthStart.getTime()
  let achieved = 0
  let openPipeline = 0
  let forecast = 0

  for (const entry of scanned) {
    if (!entryMine(entry, userId)) continue
    const crm = normalizeExtendedCrm(entry.crm)
    const val = Number(crm.dealValue) || 0
    if (crm.status === 'won') {
      const wonAt = crm.updatedAt || crm.lastCommunicationAt
      if (wonAt && new Date(wonAt).getTime() >= monthMs) achieved += val
    }
    if (crm.status !== 'won' && crm.status !== 'lost') {
      openPipeline += val
      if (crm.status === 'replied' || crm.status === 'follow_up') forecast += val * 0.35
    }
  }

  const monthlyTarget = Math.max(achieved + openPipeline * 0.2, achieved || 100000)
  const remaining = Math.max(0, monthlyTarget - achieved)

  return {
    monthlyTarget: Math.round(monthlyTarget),
    achieved: Math.round(achieved),
    remaining: Math.round(remaining),
    forecast: Math.round(forecast + achieved),
    progressPct: monthlyTarget ? Math.min(100, Math.round((achieved / monthlyTarget) * 100)) : 0,
  }
}

function buildSmartInsights(counts, pipeline, leadFocus, role, freightOrg = false) {
  const insights = []
  const dealsAction = freightOrg
    ? { panel: 'pipeline', view: 'deals' }
    : { panel: 'pipeline', closingThisWeek: true }

  if (leadFocus.hotLeads > 0) {
    insights.push({
      kind: 'highlight',
      text: `${leadFocus.hotLeads} lead${leadFocus.hotLeads === 1 ? '' : 's'} ${leadFocus.hotLeads === 1 ? 'is' : 'are'} highly engaged.`,
      action: { panel: 'pipeline', smartTags: ['hot_score'] },
    })
  }

  if (counts.dealsClosing > 0) {
    insights.push({
      kind: 'highlight',
      text: `${counts.dealsClosing} deal${counts.dealsClosing === 1 ? '' : 's'} may close this week.`,
      action: dealsAction,
    })
  }

  if (counts.followUpsDue > 0) {
    insights.push({
      kind: 'risk',
      text: `${counts.followUpsDue} opportunit${counts.followUpsDue === 1 ? 'y needs' : 'ies need'} follow-up today.`,
      action: { panel: 'pipeline', status: 'follow_up' },
    })
  }

  if (pipeline.stuckDeals > 0) {
    insights.push({
      kind: 'risk',
      text: `${pipeline.stuckDeals} deal${pipeline.stuckDeals === 1 ? '' : 's'} stuck 14+ days — nudge them forward.`,
      action: { panel: 'pipeline' },
    })
  }

  if (role === 'manager' && isTeamIntelligenceHubEnabled()) {
    insights.push({
      kind: 'highlight',
      text: 'Open Team Intelligence for revenue and team performance.',
      action: { panel: 'crm-dashboard' },
    })
  }

  if (!insights.length) {
    insights.push({
      kind: 'highlight',
      text: 'Your day is clear — log activity in Pipeline to build momentum.',
      action: { panel: 'pipeline' },
    })
  }

  return insights.slice(0, 6)
}

function buildGoals(store, user, mine, userId, since) {
  const weeklyTarget = 25
  const acts = listCrmActivities(store, user, mine, {
    since,
    memberUserId: userId,
    feedLimit: 500,
    responseLimit: 500,
  })
  const achievement = acts.length
  const prev = Math.max(0, Math.round(achievement * 0.7))
  const delta = prev ? Math.round(((achievement - prev) / prev) * 100) : null

  return {
    weeklyTarget,
    achievement,
    progressPct: Math.min(100, Math.round((achievement / weeklyTarget) * 100)),
    ranking: null,
    weeklyPerformance: delta,
    label: 'CRM actions this week',
  }
}

function buildQuickActions(role) {
  const base = [
    { id: 'lead', label: 'New lead', panel: 'pipeline', icon: 'people' },
    { id: 'task', label: 'New task', panel: 'pipeline', icon: 'task' },
    { id: 'meeting', label: 'Schedule meeting', panel: 'crm-calendar', icon: 'calendar' },
    { id: 'email', label: 'Send email', panel: 'pipeline', icon: 'mail' },
    { id: 'search', label: 'Find leads', panel: 'search', icon: 'spark' },
  ]
  if ((role === 'manager' || role === 'admin') && isTeamIntelligenceHubEnabled()) {
    base.push({ id: 'team', label: 'Team intelligence', panel: 'crm-dashboard', icon: 'team' })
  } else {
    base.push({ id: 'campaign', label: 'Create campaign', panel: 'marketing', icon: 'bolt' })
  }
  return base
}

function buildRecentActivity(store, user, scanned, userId, since) {
  const acts = listCrmActivities(store, user, scanned, {
    since,
    memberUserId: userId,
    feedLimit: 200,
    responseLimit: 15,
  })

  return acts.map((act) => ({
    id: act.id || `act-${act.leadId}-${act.createdAt}`,
    kind: act.type || 'note',
    title: act.leadName || 'Lead',
    company: act.company,
    summary: act.summary,
    at: act.createdAt,
    leadId: act.leadId,
    actorName: act.createdByName,
  }))
}

function scanCounts(scanned, userId, tz) {
  const now = Date.now()
  const endToday = endOfLocalDay(tz)
  const weekEnd = endOfWeek(tz)
  const counts = {
    tasksToday: 0,
    tasksOverdue: 0,
    followUpsDue: 0,
    dealsClosing: 0,
    meetingsToday: 0,
    newAssignments: 0,
    unreadPlaceholder: 0,
    tasksDelta: null,
  }

  for (const entry of scanned) {
    if (!entryMine(entry, userId)) continue
    const crm = normalizeExtendedCrm(entry.crm)

    for (const task of crm.tasks || []) {
      if (task.status === 'done') continue
      const due = task.dueAt ? new Date(task.dueAt).getTime() : null
      if (due && due <= endToday) counts.tasksToday += 1
      if (due && due < now) counts.tasksOverdue += 1
    }

    if (
      crm.status === 'follow_up' &&
      (!crm.nextFollowUpAt || new Date(crm.nextFollowUpAt).getTime() <= endToday)
    ) {
      counts.followUpsDue += 1
    }

    for (const deal of crm.deals || []) {
      if (isDealClosed(deal)) continue
      const closeMs = dealCloseMs(deal)
      if (closeMs != null && closeMs >= startOfLocalDay(tz) && closeMs <= weekEnd) {
        counts.dealsClosing += 1
      }
    }
    if (!crm.deals?.length) {
      const legacyClose = crmLegacyCloseMs(crm)
      if (legacyClose != null && legacyClose >= startOfLocalDay(tz) && legacyClose <= weekEnd) {
        counts.dealsClosing += 1
      }
    }

    for (const m of crm.meetings || []) {
      const at = m.scheduledAt ? new Date(m.scheduledAt).getTime() : null
      if (at && at >= startOfLocalDay(tz) && at <= endToday) counts.meetingsToday += 1
    }

    if (crm.status === 'new' && entry.savedAt && now - new Date(entry.savedAt).getTime() < 7 * MS_DAY) {
      counts.newAssignments += 1
    }
  }

  return counts
}

/**
 * My Day dashboard — personal execution OS (not team analytics).
 */
export function buildMyDayDashboard(store, user, entries, { timeZone = null, since = 0 } = {}) {
  const tz = resolveTimeZone(user, timeZone)
  const userId = user.id
  const role = detectRole(user)
  const mine = (entries || []).filter((e) => entryMine(e, userId))
  const freightOrg = isFreightDealOrg(user)
  const counts = scanCounts(mine, userId, tz)
  const barDetails = buildCommandBarDetails(mine, userId, tz)

  const priorities = buildPriorities(mine, userId, tz)
  const pipeline = buildPipelineSnapshot(mine, userId)
  const leadFocus = buildLeadFocus(mine, userId)
  const revenue = buildRevenueProgress(mine, userId, tz)
  const insights = buildSmartInsights(counts, pipeline, leadFocus, role, freightOrg)

  return {
    role,
    greeting: 'What should you do next?',
    commandBar: buildCommandBar(counts, barDetails, { freightOrg }),
    priorities,
    pipelineSnapshot: pipeline,
    todayTimeline: buildTodayTimeline(priorities),
    recentActivity: buildRecentActivity(store, user, mine, userId, since),
    revenueProgress: role === 'manager' || role === 'sales_rep' ? revenue : null,
    leadFocus,
    quickActions: buildQuickActions(role),
    smartInsights: insights,
    goals: buildGoals(store, user, mine, userId, since),
    teamIntelLink: isTeamIntelligenceHubEnabled() && (role === 'manager' || role === 'admin'),
  }
}
