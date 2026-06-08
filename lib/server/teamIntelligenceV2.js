import { normalizeExtendedCrm } from './crmWorkflow.js'
import { MS_DAY } from './dashboardPeriod.js'

const MS_14D = 14 * MS_DAY

function entryAssignee(entry) {
  return String(entry.assignedToUserId || entry.savedByUserId || entry.userId || '')
}

function deltaPct(current, previous) {
  if (!previous) return current ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function sparkFromDays(activityByDay, key) {
  return (activityByDay || []).map((d) => ({
    date: d.date,
    value: key === 'count' ? d.count : d[key] || 0,
  }))
}

function repDealStats(entries, userId) {
  let open = 0
  let won = 0
  let lost = 0
  let stuck = 0
  const now = Date.now()

  for (const entry of entries) {
    if (userId && entryAssignee(entry) !== String(userId)) continue
    const crm = normalizeExtendedCrm(entry.crm)
    for (const deal of crm.deals || []) {
      if (deal.wonAt) {
        won += 1
        continue
      }
      if (deal.lostAt) {
        lost += 1
        continue
      }
      open += 1
      const touched = deal.updatedAt || deal.createdAt || crm.updatedAt
      if (touched && now - new Date(touched).getTime() > MS_14D) stuck += 1
    }
    if (!crm.deals?.length && crm.dealValue > 0 && crm.status !== 'won' && crm.status !== 'lost') {
      open += 1
    }
  }

  const closed = won + lost
  const winRate = closed > 0 ? Math.round((won / closed) * 100) : null
  return { open, won, lost, stuck, winRate }
}

function crmAdoptionScore(member) {
  let score = 0
  if ((member.hoursInApp || 0) >= 0.5) score += 18
  if ((member.notes || 0) > 0) score += 14
  if ((member.calls || 0) > 0) score += 14
  if ((member.meetings || 0) > 0) score += 14
  if ((member.tasksCompleted || 0) > 0) score += 14
  if ((member.emails || 0) > 0) score += 12
  if ((member.statusChanges || 0) > 0) score += 8
  if (member.lastActiveAt) {
    const age = Date.now() - new Date(member.lastActiveAt).getTime()
    if (age < 2 * MS_DAY) score += 6
  }
  return Math.min(100, score)
}

function repHealthScore(member, dealStats, staleLeads = 0) {
  const activity = Math.min(40, (member.activitiesTotal || 0) * 2)
  const adoption = Math.round(crmAdoptionScore(member) * 0.25)
  const followUp =
    member.tasksCreated > 0
      ? Math.min(20, Math.round((member.tasksCompleted / member.tasksCreated) * 20))
      : member.tasksCompleted > 0
        ? 15
        : 0
  const deals = dealStats.open > 0 ? Math.min(15, 15 - dealStats.stuck * 3) : 5
  const stalePenalty = Math.min(15, staleLeads * 3)
  return Math.max(0, Math.min(100, Math.round(activity + adoption + followUp + deals - stalePenalty)))
}

function scanPipelineBottlenecks(entries, memberUserId) {
  const now = Date.now()
  const out = {
    notContacted: 0,
    stuckFollowUp: 0,
    stuckDeals: 0,
    inactiveOpportunities: 0,
    missingNextStep: 0,
    staleLeads: 0,
    overdueTasks: 0,
  }

  for (const entry of entries) {
    if (memberUserId && entryAssignee(entry) !== String(memberUserId)) continue
    const crm = normalizeExtendedCrm(entry.crm)
    const status = crm.status || 'new'

    if (status === 'new') out.notContacted += 1
    if (status === 'follow_up') {
      const last = crm.lastCommunicationAt || crm.lastEmailSentAt
      if (!last || now - new Date(last).getTime() > MS_14D) out.stuckFollowUp += 1
    }

    const lastComm = crm.lastCommunicationAt || crm.lastEmailSentAt || entry.savedAt
    if (lastComm && now - new Date(lastComm).getTime() > 7 * MS_DAY && status !== 'won' && status !== 'lost') {
      out.staleLeads += 1
    }

    if (!crm.nextFollowUpAt && status !== 'won' && status !== 'lost') out.missingNextStep += 1

    for (const t of crm.tasks || []) {
      if (t.status !== 'done' && t.dueAt && new Date(t.dueAt).getTime() < now) out.overdueTasks += 1
    }

    for (const deal of crm.deals || []) {
      if (deal.wonAt || deal.lostAt) continue
      const touched = deal.updatedAt || deal.createdAt
      if (!touched || now - new Date(touched).getTime() > MS_14D) {
        out.stuckDeals += 1
        out.inactiveOpportunities += 1
      }
    }
  }

  return out
}

function workloadByRep(entries, members) {
  const map = new Map()
  for (const m of members) {
    map.set(String(m.userId), {
      userId: m.userId,
      name: m.name,
      leads: 0,
      tasks: 0,
      activeDeals: 0,
    })
  }

  for (const entry of entries) {
    const uid = entryAssignee(entry)
    if (!uid || !map.has(uid)) continue
    const row = map.get(uid)
    row.leads += 1
    const crm = normalizeExtendedCrm(entry.crm)
    row.tasks += (crm.tasks || []).filter((t) => t.status !== 'done').length
    row.activeDeals += repDealStats([entry], uid).open
  }

  return [...map.values()].sort((a, b) => b.leads - a.leads)
}

function buildInsights(members, comparison, bottlenecks, rollup, prevByUser, entries = []) {
  const insights = []
  const sorted = [...members].sort((a, b) => (b.activitiesTotal || 0) - (a.activitiesTotal || 0))

  if (sorted[0]?.activitiesTotal > 0) {
    const top = sorted[0]
    const prev = prevByUser.get(String(top.userId))
    const prevActs = prev?.activitiesTotal || 0
    const pct =
      prevActs > 0 ? Math.round(((top.activitiesTotal - prevActs) / prevActs) * 100) : null
    insights.push({
      kind: 'highlight',
      text:
        pct != null && pct > 0
          ? `${top.name} completed ${pct}% more CRM actions than the previous period.`
          : `${top.name} leads the team with ${top.activitiesTotal} actions this period.`,
      userId: top.userId,
    })
  }

  for (const m of members) {
    const repBottleneck = scanPipelineBottlenecks(entries, m.userId)
    if (repBottleneck.staleLeads >= 5) {
      insights.push({
        kind: 'risk',
        text: `${m.name} has ${repBottleneck.staleLeads} stale leads requiring action.`,
        userId: m.userId,
      })
    }
  }

  const staleReps = members.filter((m) => {
    const daysSince =
      m.lastActiveAt && !Number.isNaN(new Date(m.lastActiveAt).getTime())
        ? (Date.now() - new Date(m.lastActiveAt).getTime()) / MS_DAY
        : 99
    return daysSince >= 3 && (m.activitiesTotal || 0) < 3
  })
  if (staleReps.length) {
    insights.push({
      kind: 'risk',
      text: `${staleReps[0].name} has not updated CRM activity in ${Math.floor(
        (Date.now() - new Date(staleReps[0].lastActiveAt || 0).getTime()) / MS_DAY
      )} days.`,
      userId: staleReps[0].userId,
    })
  }

  if (bottlenecks.staleLeads > 0) {
    insights.push({
      kind: 'risk',
      text: `${bottlenecks.staleLeads} lead${bottlenecks.staleLeads === 1 ? '' : 's'} have gone quiet — follow-up discipline needs attention.`,
    })
  }

  if (comparison?.activitiesTotal?.delta != null && comparison.activitiesTotal.delta < -5) {
    insights.push({
      kind: 'risk',
      text: `Team activity is down ${Math.abs(comparison.activitiesTotal.delta)}% vs the previous period.`,
    })
  } else if (comparison?.activitiesTotal?.delta != null && comparison.activitiesTotal.delta > 10) {
    insights.push({
      kind: 'highlight',
      text: `Team momentum is up ${comparison.activitiesTotal.delta}% — keep the pace.`,
    })
  }

  const responseLeader = [...members].sort((a, b) => (b.emails || 0) - (a.emails || 0))[0]
  if (responseLeader?.emails > 0) {
    insights.push({
      kind: 'highlight',
      text: `${responseLeader.name} sent the most outbound email this period (${responseLeader.emails}).`,
      userId: responseLeader.userId,
    })
  }

  if (rollup.tasksCreated > 0) {
    const rate = Math.round((rollup.tasksCompleted / rollup.tasksCreated) * 100)
    if (rate < 70) {
      insights.push({
        kind: 'risk',
        text: `Follow-up completion is at ${rate}% — ${rollup.tasksCreated - rollup.tasksCompleted} tasks still open.`,
      })
    }
  }

  return insights.slice(0, 6)
}

function teamHealthScore(members, rollup, bottlenecks, summary) {
  const activity = Math.min(100, Math.round((rollup.activitiesTotal || 0) * 3))
  const followUp =
    rollup.tasksCreated > 0
      ? Math.round((rollup.tasksCompleted / rollup.tasksCreated) * 100)
      : rollup.tasksCompleted > 0
        ? 70
        : 40
  const adoption =
    members.length > 0
      ? Math.round(members.reduce((s, m) => s + crmAdoptionScore(m), 0) / members.length)
      : 0
  const dealProgress = summary.weightedPipelineValue
    ? Math.min(100, Math.round((summary.won / Math.max(1, summary.totalLeads)) * 100 + 20))
    : 50
  const response = Math.max(0, 100 - bottlenecks.staleLeads * 4 - bottlenecks.overdueTasks * 2)

  const factors = [
    { id: 'activity', label: 'Activity', score: Math.min(100, activity), status: activity >= 60 ? 'good' : activity >= 35 ? 'warn' : 'risk' },
    { id: 'followup', label: 'Follow-up discipline', score: followUp, status: followUp >= 70 ? 'good' : followUp >= 45 ? 'warn' : 'risk' },
    { id: 'adoption', label: 'CRM adoption', score: adoption, status: adoption >= 65 ? 'good' : adoption >= 40 ? 'warn' : 'risk' },
    { id: 'deals', label: 'Deal progression', score: Math.min(100, dealProgress), status: dealProgress >= 55 ? 'good' : 'warn' },
    { id: 'response', label: 'Response time', score: Math.min(100, response), status: response >= 70 ? 'good' : 'warn' },
  ]

  const overall = Math.round(factors.reduce((s, f) => s + f.score, 0) / factors.length)
  return { overall, factors }
}

function buildLeaderboard(members, entries, comparison, prevByUser) {
  return members.map((m) => {
    const deals = repDealStats(entries, m.userId)
    const stale = scanPipelineBottlenecks(entries, m.userId).staleLeads
    const health = repHealthScore(m, deals, stale)
    const adoption = crmAdoptionScore(m)
    const prev = prevByUser.get(String(m.userId))
    const actDelta = deltaPct(m.activitiesTotal || 0, prev?.activitiesTotal || 0)

    let badge = null
    const maxActs = Math.max(...members.map((x) => x.activitiesTotal || 0))
    if ((m.activitiesTotal || 0) === maxActs && maxActs > 0) badge = 'top'
    else if (actDelta >= 25 && (m.activitiesTotal || 0) >= 3) badge = 'rising'
    else if (health < 45 || (m.activitiesTotal || 0) === 0) badge = 'attention'

    return {
      userId: m.userId,
      name: m.name,
      activityScore: Math.min(100, (m.activitiesTotal || 0) * 3),
      calls: m.calls || 0,
      emails: m.emails || 0,
      meetings: m.meetings || 0,
      newLeads: m.newLeads || 0,
      activeDeals: deals.open,
      winRate: deals.winRate,
      crmTimeHours: m.hoursInApp || 0,
      healthScore: health,
      adoptionScore: adoption,
      tasksCompleted: m.tasksCompleted || 0,
      badge,
      actDelta,
    }
  })
}

function buildActionCenter(bottlenecks, members, summary) {
  const actions = []
  if (bottlenecks.staleLeads > 0) {
    actions.push({
      id: 'follow-up',
      label: `${bottlenecks.staleLeads} leads need follow-up`,
      severity: 'high',
      action: 'pipeline',
      filter: 'follow_up',
    })
  }
  if (bottlenecks.notContacted > 0) {
    actions.push({
      id: 'contact',
      label: `${bottlenecks.notContacted} leads not contacted`,
      severity: 'medium',
      action: 'pipeline',
      filter: 'new',
    })
  }
  if (bottlenecks.overdueTasks > 0) {
    actions.push({
      id: 'tasks',
      label: `${bottlenecks.overdueTasks} overdue tasks`,
      severity: 'high',
      action: 'crm-log',
    })
  }
  if (bottlenecks.stuckDeals > 0) {
    actions.push({
      id: 'deals',
      label: `${bottlenecks.stuckDeals} deals at risk (>14d idle)`,
      severity: 'high',
      action: 'pipeline',
      view: 'deals',
    })
  }
  const lowActivity = members.filter((m) => (m.activitiesTotal || 0) < 2 && (m.hoursInApp || 0) < 0.25)
  if (lowActivity.length) {
    actions.push({
      id: 'coaching',
      label: `${lowActivity.length} rep${lowActivity.length === 1 ? '' : 's'} with low CRM activity`,
      severity: 'medium',
      action: 'coaching',
      userIds: lowActivity.map((m) => m.userId),
    })
  }
  if (summary.needsFollowUp > 0) {
    actions.push({
      id: 'pipeline-follow',
      label: `${summary.needsFollowUp} leads in follow-up stage`,
      severity: 'medium',
      action: 'pipeline',
      filter: 'follow_up',
    })
  }
  return actions.slice(0, 6)
}

/**
 * Executive intelligence layer — Performance → Risks → Insights → Actions
 */
export function buildIntelligenceV2({
  entries = [],
  members = [],
  rollup = {},
  comparison = {},
  summary = {},
  activityByDay = [],
  memberUserId = null,
  isAdmin = false,
  prevMemberProfiles = [],
} = {}) {
  const scopedEntries = memberUserId
    ? entries.filter((e) => entryAssignee(e) === String(memberUserId))
    : entries

  const bottlenecks = scanPipelineBottlenecks(scopedEntries, memberUserId)
  const dealOrg = repDealStats(scopedEntries, memberUserId)
  const health = teamHealthScore(members, rollup, bottlenecks, summary)

  const prevByUser = new Map(prevMemberProfiles.map((m) => [String(m.userId), m]))

  let emailResponses = 0
  for (const entry of scopedEntries) {
    const crm = normalizeExtendedCrm(entry.crm)
    if (crm.responseReceived) emailResponses += 1
  }
  const newLeads = rollup.newLeads ?? members.reduce((s, m) => s + (m.newLeads || 0), 0)

  const executiveKpis = [
    {
      id: 'revenue',
      label: 'Revenue influenced',
      value: summary.weightedPipelineValue || summary.pipelineValue || 0,
      format: 'currency',
      delta: null,
      spark: sparkFromDays(activityByDay, 'count'),
    },
    {
      id: 'newLeads',
      label: 'New leads',
      value: newLeads,
      delta: comparison?.activitiesTotal?.delta,
      spark: sparkFromDays(activityByDay, 'count'),
    },
    {
      id: 'followUps',
      label: 'Follow-ups done',
      value: rollup.tasksCompleted || 0,
      delta: comparison?.tasksCreated?.delta,
      spark: sparkFromDays(activityByDay, 'task'),
    },
    {
      id: 'activeDeals',
      label: 'Active deals',
      value: dealOrg.open,
      delta: null,
      spark: [],
    },
    {
      id: 'calls',
      label: 'Calls made',
      value: rollup.calls || 0,
      delta: comparison?.calls?.delta,
      spark: sparkFromDays(activityByDay, 'call'),
    },
    {
      id: 'meetings',
      label: 'Meetings booked',
      value: rollup.meetings || 0,
      delta: null,
      spark: sparkFromDays(activityByDay, 'meeting'),
    },
    {
      id: 'responses',
      label: 'Email responses',
      value: emailResponses,
      delta: comparison?.emails?.delta,
      spark: sparkFromDays(activityByDay, 'email'),
    },
    {
      id: 'activityScore',
      label: 'Team activity score',
      value: health.overall,
      format: 'score',
      delta: comparison?.activitiesTotal?.delta,
      spark: sparkFromDays(activityByDay, 'count'),
    },
  ]

  const trends = {
    calls: sparkFromDays(activityByDay, 'call'),
    emails: sparkFromDays(activityByDay, 'email'),
    followUps: sparkFromDays(activityByDay, 'task'),
    leads: sparkFromDays(activityByDay, 'count'),
  }

  return {
    executiveKpis,
    teamHealth: health,
    leaderboard: buildLeaderboard(members, scopedEntries, comparison, prevByUser),
    trends,
    insights: buildInsights(members, comparison, bottlenecks, rollup, prevByUser, scopedEntries),
    bottlenecks: {
      ...bottlenecks,
      funnel: [
        { id: 'not_contacted', label: 'Not contacted', count: bottlenecks.notContacted },
        { id: 'stuck_followup', label: 'Stuck in follow-up', count: bottlenecks.stuckFollowUp },
        { id: 'stuck_deals', label: 'Deals idle 14d+', count: bottlenecks.stuckDeals },
        { id: 'missing_step', label: 'Missing next step', count: bottlenecks.missingNextStep },
        { id: 'overdue_tasks', label: 'Overdue tasks', count: bottlenecks.overdueTasks },
      ].filter((r) => r.count > 0),
    },
    workload: workloadByRep(entries, members),
    actionCenter: buildActionCenter(bottlenecks, members, summary),
    isManagerView: isAdmin && !memberUserId,
  }
}
