import { normalizeExtendedCrm } from './crmWorkflow.js'
import { MS_DAY } from './dashboardPeriod.js'
import { buildIntelligenceV2 } from './teamIntelligenceV2.js'

const MS_14D = 14 * MS_DAY

const FUNNEL_STAGES = [
  { id: 'new', label: 'New', statuses: ['new'] },
  { id: 'contacted', label: 'Contacted', statuses: ['contacted'] },
  { id: 'follow_up', label: 'Follow-up', statuses: ['follow_up'] },
  { id: 'proposal', label: 'Proposal', statuses: ['replied'] },
  { id: 'negotiation', label: 'Negotiation', statuses: ['active_trading'] },
  { id: 'won', label: 'Won', statuses: ['won'] },
  { id: 'lost', label: 'Lost', statuses: ['lost'] },
]

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

function statusLevel(score) {
  if (score >= 70) return 'good'
  if (score >= 45) return 'warn'
  return 'risk'
}

function repRevenueInfluence(entries, userId) {
  let total = 0
  for (const entry of entries) {
    if (userId && entryAssignee(entry) !== String(userId)) continue
    const crm = normalizeExtendedCrm(entry.crm)
    total += Number(crm.dealValue) || 0
    for (const deal of crm.deals || []) {
      if (!deal.lostAt) total += Number(deal.amount) || 0
    }
  }
  return Math.round(total)
}

function repMeetingsScheduled(entries, userId) {
  const now = Date.now()
  let count = 0
  for (const entry of entries) {
    if (userId && entryAssignee(entry) !== String(userId)) continue
    const crm = normalizeExtendedCrm(entry.crm)
    for (const m of crm.meetings || []) {
      if (m.scheduledAt && new Date(m.scheduledAt).getTime() > now) count += 1
    }
  }
  return count
}

function buildPipelineHealth(entries) {
  const now = Date.now()
  const stageData = FUNNEL_STAGES.map((stage) => {
    let volume = 0
    let daysSum = 0
    let daysCount = 0

    for (const entry of entries) {
      const crm = normalizeExtendedCrm(entry.crm)
      const status = crm.status || 'new'
      if (!stage.statuses.includes(status)) continue
      volume += 1
      const anchor = crm.updatedAt || crm.lastCommunicationAt || entry.savedAt
      if (anchor) {
        const days = (now - new Date(anchor).getTime()) / MS_DAY
        if (days >= 0 && days < 365) {
          daysSum += days
          daysCount += 1
        }
      }
    }

    return {
      id: stage.id,
      label: stage.label,
      volume,
      avgDays: daysCount ? Math.round(daysSum / daysCount) : null,
    }
  })

  const total = stageData.reduce((s, st) => s + st.volume, 0) || 1
  let prevVol = total
  for (let i = 0; i < stageData.length; i++) {
    const st = stageData[i]
    st.sharePct = Math.round((st.volume / total) * 1000) / 10
    if (i < stageData.length - 1) {
      const next = stageData[i + 1]
      st.conversionPct = st.volume > 0 ? Math.round((next.volume / st.volume) * 1000) / 10 : 0
      st.dropOffPct = Math.max(0, Math.round((100 - st.conversionPct) * 10) / 10)
    } else {
      st.conversionPct = null
      st.dropOffPct = null
    }
    prevVol = st.volume || prevVol
  }

  const bottleneck = [...stageData]
    .filter((s) => s.id !== 'won' && s.id !== 'lost')
    .sort((a, b) => b.volume - a.volume)[0]

  return { stages: stageData, bottleneckStage: bottleneck?.id || null, bottleneckLabel: bottleneck?.label || null }
}

function buildPerformanceMatrix(members, entries, prevByUser, v2Leaderboard) {
  const lbMap = new Map((v2Leaderboard || []).map((r) => [String(r.userId), r]))

  return members.map((m) => {
    const prev = prevByUser.get(String(m.userId))
    const actDelta = deltaPct(m.activitiesTotal || 0, prev?.activitiesTotal || 0)
    const followUpRate =
      m.tasksCreated > 0 ? Math.round((m.tasksCompleted / m.tasksCreated) * 100) : m.tasksCompleted > 0 ? 100 : 0
    const responseRate =
      m.emails > 0
        ? Math.round(((m.emailsReplied || m.responses || 0) / m.emails) * 100)
        : m.responseReceived
          ? 100
          : 0
    const revenueInfluence = repRevenueInfluence(entries, m.userId)
    const lb = lbMap.get(String(m.userId)) || {}
    const health = lb.healthScore ?? 50
    const activityScore = lb.activityScore ?? Math.min(100, (m.activitiesTotal || 0) * 3)

    let status = 'watch'
    if (health >= 70 && activityScore >= 50) status = 'strong'
    else if (health < 45 || activityScore < 15) status = 'attention'

    let badge = lb.badge || null
    if (badge === 'rising') badge = 'improved'
    if (badge === 'attention') badge = 'coaching'

    const maxActs = Math.max(...members.map((x) => x.activitiesTotal || 0))
    if ((m.activitiesTotal || 0) === maxActs && maxActs > 0) badge = 'top'
    else if (actDelta >= 20 && (m.activitiesTotal || 0) >= 3 && badge !== 'top') badge = 'improved'
    else if (status === 'attention' && !badge) badge = 'coaching'

    return {
      userId: m.userId,
      name: m.name,
      healthScore: health,
      activityScore,
      calls: m.calls || 0,
      meetings: m.meetings || 0,
      emails: m.emails || 0,
      deals: lb.activeDeals || 0,
      followUpRate,
      responseRate,
      revenueInfluence,
      status,
      badge,
      adoptionScore: lb.adoptionScore || 0,
    }
  })
}

function buildV3Insights(members, comparison, summary, pipeline, bottlenecks, rollup, entries) {
  const insights = []

  if (rollup.tasksCreated > 0) {
    const rate = Math.round((rollup.tasksCompleted / rollup.tasksCreated) * 100)
    const prevRate = comparison?.tasksCreated?.previous
      ? Math.round(
          ((comparison.tasksCreated.previous * (rate / 100)) / comparison.tasksCreated.previous) * 100
        )
      : null
    if (comparison?.tasksCreated?.delta != null && comparison.tasksCreated.delta > 0) {
      insights.push({
        kind: 'highlight',
        text: `Follow-up completion increased ${Math.abs(comparison.tasksCreated.delta)}% vs last period.`,
      })
    } else if (rate < 70) {
      insights.push({
        kind: 'risk',
        text: `Follow-up completion is at ${rate}% — discipline needs attention.`,
      })
    }
  }

  if (bottlenecks.notContacted > 0) {
    insights.push({
      kind: 'risk',
      text: `${bottlenecks.notContacted.toLocaleString()} leads have never been contacted.`,
      action: { panel: 'pipeline', status: 'new' },
    })
  }

  const engagementLeader = [...members].sort((a, b) => (b.activitiesTotal || 0) - (a.activitiesTotal || 0))[0]
  if (engagementLeader?.activitiesTotal > 0) {
    insights.push({
      kind: 'highlight',
      text: `${engagementLeader.name} generated the highest engagement this period.`,
      userId: engagementLeader.userId,
    })
  }

  const lowAdoption = members.filter((m) => {
    const daysSince = m.lastActiveAt ? (Date.now() - new Date(m.lastActiveAt).getTime()) / MS_DAY : 99
    return daysSince >= 3 && (m.activitiesTotal || 0) < 3
  })
  if (lowAdoption.length >= 2) {
    insights.push({
      kind: 'risk',
      text: `${lowAdoption.length} reps show declining CRM adoption.`,
      userIds: lowAdoption.map((m) => m.userId),
    })
  }

  if (pipeline.bottleneckLabel) {
    insights.push({
      kind: 'risk',
      text: `Pipeline progression is slowing at ${pipeline.bottleneckLabel} stage (${pipeline.stages.find((s) => s.id === pipeline.bottleneckStage)?.volume || 0} leads).`,
      action: { panel: 'pipeline', status: pipeline.bottleneckStage },
    })
  }

  if (summary.staleLeads > 0) {
    insights.push({
      kind: 'risk',
      text: `${summary.staleLeads} leads have gone quiet — follow-up required.`,
    })
  }

  if (comparison?.activitiesTotal?.delta > 10) {
    insights.push({
      kind: 'highlight',
      text: `Team momentum is up ${comparison.activitiesTotal.delta}% — on target.`,
    })
  }

  return insights.slice(0, 8)
}

function buildCommandBar({ teamHealth, summary, comparison, rollup, members, activityByDay, bottlenecks, adoptionOverall }) {
  const followUpScore =
    rollup.tasksCreated > 0 ? Math.round((rollup.tasksCompleted / rollup.tasksCreated) * 100) : rollup.tasksCompleted > 0 ? 75 : 40
  const revenueScore = summary.weightedPipelineValue
    ? Math.min(100, Math.round(40 + (summary.won / Math.max(1, summary.totalLeads)) * 60))
    : 35
  const pipelineScore = Math.max(
    0,
    Math.min(100, 100 - bottlenecks.stuckDeals * 3 - bottlenecks.notContacted * 0.5 - bottlenecks.overdueTasks * 2)
  )
  const activitySpark = sparkFromDays(activityByDay, 'count')
  const activityTotal = activitySpark.reduce((s, d) => s + d.value, 0)

  return [
    {
      id: 'teamHealth',
      label: 'Team health',
      value: teamHealth.overall,
      format: 'score',
      delta: comparison?.activitiesTotal?.delta,
      spark: activitySpark,
      status: statusLevel(teamHealth.overall),
    },
    {
      id: 'revenue',
      label: 'Revenue score',
      value: revenueScore,
      format: 'score',
      delta: null,
      spark: sparkFromDays(activityByDay, 'count'),
      status: statusLevel(revenueScore),
      hint: formatCurrencyHint(summary.weightedPipelineValue),
    },
    {
      id: 'pipeline',
      label: 'Pipeline health',
      value: pipelineScore,
      format: 'score',
      delta: null,
      spark: [],
      status: statusLevel(pipelineScore),
    },
    {
      id: 'followUp',
      label: 'Follow-up discipline',
      value: followUpScore,
      format: 'score',
      delta: comparison?.tasksCreated?.delta,
      spark: sparkFromDays(activityByDay, 'task'),
      status: statusLevel(followUpScore),
    },
    {
      id: 'adoption',
      label: 'CRM adoption',
      value: adoptionOverall,
      format: 'score',
      delta: comparison?.hoursInApp?.delta,
      spark: sparkFromDays(activityByDay, 'note'),
      status: statusLevel(adoptionOverall),
    },
    {
      id: 'activity',
      label: 'Activity trend',
      value: activityTotal,
      delta: comparison?.activitiesTotal?.delta,
      spark: activitySpark,
      status: statusLevel(Math.min(100, activityTotal * 2)),
    },
  ]
}

function formatCurrencyHint(n) {
  if (!n) return null
  return `₹${Math.round(n).toLocaleString('en-IN')} influenced`
}

function buildRevenueLeaks(bottlenecks, members) {
  const inactiveReps = members.filter((m) => {
    const days = m.lastActiveAt ? (Date.now() - new Date(m.lastActiveAt).getTime()) / MS_DAY : 99
    return days >= 3 && (m.activitiesTotal || 0) < 2
  }).length

  return [
    { id: 'not_contacted', label: 'Leads never contacted', count: bottlenecks.notContacted, severity: 'high' },
    { id: 'inactive_deals', label: 'Deals inactive 14d+', count: bottlenecks.stuckDeals, severity: 'high' },
    { id: 'missing_step', label: 'Missing next steps', count: bottlenecks.missingNextStep, severity: 'medium' },
    { id: 'overdue_tasks', label: 'Overdue tasks', count: bottlenecks.overdueTasks, severity: 'high' },
    { id: 'inactive_reps', label: 'No-activity accounts', count: inactiveReps, severity: 'medium' },
  ].filter((r) => r.count > 0)
}

function buildCapacity(entries, members) {
  const rows = members.map((m) => {
    const uid = String(m.userId)
    let leads = 0
    let tasks = 0
    let deals = 0
    let meetings = repMeetingsScheduled(entries, m.userId)

    for (const entry of entries) {
      if (entryAssignee(entry) !== uid) continue
      leads += 1
      const crm = normalizeExtendedCrm(entry.crm)
      tasks += (crm.tasks || []).filter((t) => t.status !== 'done').length
      deals += (crm.deals || []).filter((d) => !d.wonAt && !d.lostAt).length
      if (!deals && crm.dealValue > 0 && crm.status !== 'won' && crm.status !== 'lost') deals += 1
    }

    const loadScore = leads + tasks * 0.5 + deals * 2
    return {
      userId: m.userId,
      name: m.name,
      leads,
      tasks,
      activeDeals: deals,
      meetings,
      loadScore,
    }
  })

  const sorted = [...rows].sort((a, b) => b.loadScore - a.loadScore)
  const avg = sorted.length ? sorted.reduce((s, r) => s + r.loadScore, 0) / sorted.length : 0

  return sorted.map((r) => ({
    ...r,
    capacity: r.loadScore > avg * 1.35 ? 'overloaded' : r.loadScore < avg * 0.5 ? 'underutilized' : 'balanced',
  }))
}

function buildAdoptionIntelligence(members, v2Leaderboard, activityByDay) {
  const scores = (v2Leaderboard || []).map((r) => r.adoptionScore || 0)
  const overall = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : 0
  const trend = sparkFromDays(activityByDay, 'count').map((d, i, arr) => ({
    date: d.date,
    value: arr.length ? Math.min(100, Math.round((d.value / Math.max(1, ...arr.map((x) => x.value))) * overall)) : 0,
  }))

  return {
    overall,
    trend,
    reps: (v2Leaderboard || []).map((r) => ({
      userId: r.userId,
      name: r.name,
      score: r.adoptionScore || 0,
      components: {
        logins: r.crmTimeHours > 0,
        notes: (members.find((m) => String(m.userId) === String(r.userId))?.notes || 0) > 0,
        calls: r.calls > 0,
        meetings: r.meetings > 0,
        tasks: r.tasksCompleted > 0,
        deals: r.activeDeals > 0,
      },
    })),
  }
}

function buildActivityEffectiveness(rollup, entries, summary) {
  let responses = 0
  let opportunities = 0
  for (const entry of entries) {
    const crm = normalizeExtendedCrm(entry.crm)
    if (crm.responseReceived) responses += 1
    if ((crm.deals || []).length > 0 || crm.dealValue > 0) opportunities += 1
  }

  const calls = rollup.calls || 0
  const emails = rollup.emails || 0
  const followUps = rollup.tasksCompleted || 0
  const meetings = rollup.meetings || 0

  return [
    {
      id: 'calls',
      type: 'Calls',
      volume: calls,
      outcome: 'Meetings',
      outcomeCount: meetings,
      conversionRate: calls > 0 ? Math.round((meetings / calls) * 100) : 0,
      revenueInfluence: Math.round(summary.weightedPipelineValue * 0.3),
    },
    {
      id: 'emails',
      type: 'Emails',
      volume: emails,
      outcome: 'Replies',
      outcomeCount: responses,
      conversionRate: emails > 0 ? Math.round((responses / emails) * 100) : 0,
      revenueInfluence: Math.round(summary.weightedPipelineValue * 0.25),
    },
    {
      id: 'followups',
      type: 'Follow-ups',
      volume: followUps,
      outcome: 'Opportunities',
      outcomeCount: opportunities,
      conversionRate: followUps > 0 ? Math.round((opportunities / followUps) * 100) : 0,
      revenueInfluence: Math.round(summary.weightedPipelineValue * 0.45),
    },
  ]
}

function buildActionCenterV3(bottlenecks, members, summary) {
  const inactiveReps = members.filter((m) => {
    const days = m.lastActiveAt ? (Date.now() - new Date(m.lastActiveAt).getTime()) / MS_DAY : 99
    return days >= 3 && (m.activitiesTotal || 0) < 2
  })

  const items = [
    {
      id: 'follow-up',
      label: 'leads require follow-up',
      count: summary.needsFollowUp || bottlenecks.staleLeads,
      priority: 1,
      severity: 'high',
      filter: 'follow_up',
      userIds: null,
    },
    {
      id: 'not-contacted',
      label: 'leads never contacted',
      count: bottlenecks.notContacted,
      priority: 2,
      severity: 'high',
      filter: 'new',
      userIds: null,
    },
    {
      id: 'overdue',
      label: 'overdue tasks',
      count: bottlenecks.overdueTasks,
      priority: 3,
      severity: 'high',
      panel: 'crm-log',
      userIds: null,
    },
    {
      id: 'inactive-reps',
      label: 'inactive reps',
      count: inactiveReps.length,
      priority: 4,
      severity: 'medium',
      panel: 'coaching',
      userIds: inactiveReps.map((m) => m.userId),
    },
    {
      id: 'deals-risk',
      label: 'deals at risk',
      count: bottlenecks.stuckDeals,
      priority: 5,
      severity: 'high',
      filter: 'all',
      view: 'deals',
      userIds: null,
    },
  ]
    .filter((i) => i.count > 0)
    .sort((a, b) => a.priority - b.priority)
    .map((item) => ({
      ...item,
      title: `${item.count.toLocaleString()} ${item.label}`,
      actions: [
        { id: 'view', label: 'View', panel: item.panel || 'pipeline', status: item.filter, view: item.view },
        { id: 'assign', label: 'Assign', panel: 'pipeline', status: item.filter },
        { id: 'fix', label: 'Fix', panel: item.panel === 'crm-log' ? 'crm-log' : 'pipeline', status: item.filter },
        { id: 'review', label: 'Review', panel: 'crm-dashboard' },
      ],
    }))

  return items
}

function buildCoachingQueue(performanceMatrix = []) {
  return performanceMatrix
    .filter((r) => r.badge === 'coaching' || r.status === 'attention')
    .map((r) => ({
      userId: r.userId,
      name: r.name,
      healthScore: r.healthScore,
      activityScore: r.activityScore,
      followUpRate: r.followUpRate,
      responseRate: r.responseRate,
      focus:
        r.followUpRate < 50
          ? 'Follow-up discipline'
          : r.responseRate < 30
            ? 'Response rate'
            : 'Activity volume',
      badge: r.badge || 'coaching',
    }))
    .sort((a, b) => (a.healthScore || 0) - (b.healthScore || 0))
}

const STAGE_FORECAST_WEIGHT = {
  contacted: 0.12,
  follow_up: 0.22,
  proposal: 0.35,
  negotiation: 0.55,
  new: 0.08,
}

export function buildRevenueForecast(summary = {}, pipeline = {}) {
  const weighted = summary.weightedPipelineValue || summary.pipelineValue || 0
  const wonValue = summary.wonValue || 0
  const totalLeads = summary.totalLeads || 0
  const wonCount = summary.won || 0
  const winRate = totalLeads > 0 ? Math.round((wonCount / totalLeads) * 1000) / 10 : 0

  let stageWeighted = 0
  for (const stage of pipeline?.stages || []) {
    if (stage.id === 'won' || stage.id === 'lost') continue
    const unit = weighted > 0 && totalLeads > 0 ? weighted / totalLeads : 5000
    stageWeighted += (stage.volume || 0) * unit * (STAGE_FORECAST_WEIGHT[stage.id] ?? 0.15)
  }

  const forecast30d = stageWeighted
    ? Math.round(stageWeighted * 0.45)
    : Math.round(weighted * 0.35)
  const forecast90d = stageWeighted
    ? Math.round(stageWeighted * 0.85)
    : Math.round(weighted * 0.55)

  return {
    weightedPipeline: Math.round(weighted),
    wonValue: Math.round(wonValue),
    winRate,
    forecast30d,
    forecast90d,
    confidence: weighted > 0 ? (winRate >= 8 ? 'medium' : 'low') : 'low',
    atRiskValue: Math.round((summary.staleLeads || 0) * (weighted > 0 && totalLeads > 0 ? weighted / totalLeads : 0)),
  }
}

/**
 * V3 Revenue Command Center — Executive Summary → Insights → Actions
 */
export function buildIntelligenceV3(ctx) {
  const v2 = buildIntelligenceV2(ctx)
  const {
    entries = [],
    members = [],
    rollup = {},
    comparison = {},
    summary = {},
    activityByDay = [],
    memberUserId = null,
    isAdmin = false,
    isManager = false,
    prevMemberProfiles = [],
  } = ctx

  const scopedEntries = memberUserId
    ? entries.filter((e) => entryAssignee(e) === String(memberUserId))
    : entries

  const prevByUser = new Map(prevMemberProfiles.map((m) => [String(m.userId), m]))
  const bottlenecks = v2.bottlenecks || {}
  const pipeline = buildPipelineHealth(scopedEntries)
  const adoptionScores = (v2.leaderboard || []).map((r) => r.adoptionScore || 0)
  const adoptionOverall = adoptionScores.length
    ? Math.round(adoptionScores.reduce((s, n) => s + n, 0) / adoptionScores.length)
    : 0
  const performanceMatrix = buildPerformanceMatrix(members, scopedEntries, prevByUser, v2.leaderboard)

  return {
    ...v2,
    commandBar: buildCommandBar({
      teamHealth: v2.teamHealth,
      summary,
      comparison,
      rollup,
      members,
      activityByDay,
      bottlenecks,
      adoptionOverall,
    }),
    insights: buildV3Insights(members, comparison, summary, pipeline, bottlenecks, rollup, scopedEntries),
    performanceMatrix,
    pipelineHealth: pipeline,
    revenueLeaks: buildRevenueLeaks(bottlenecks, members),
    capacity: buildCapacity(entries, members),
    adoption: buildAdoptionIntelligence(members, v2.leaderboard, activityByDay),
    activityEffectiveness: buildActivityEffectiveness(rollup, scopedEntries, summary),
    actionCenter: buildActionCenterV3(bottlenecks, members, summary),
    forecast: buildRevenueForecast(summary, pipeline),
    coaching: buildCoachingQueue(performanceMatrix),
    isManagerView: (isAdmin || isManager) && !memberUserId,
  }
}
