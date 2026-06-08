import { MS_DAY } from './dashboardPeriod.js'

function statusLevel(score) {
  if (score >= 70) return 'good'
  if (score >= 45) return 'warn'
  return 'risk'
}

function buildDashboardCommandBar({ intelligenceV3, summary, comparison, rollup, personal, isAdmin }) {
  const v3Bar = intelligenceV3?.commandBar || []
  const byId = Object.fromEntries(v3Bar.map((m) => [m.id, m]))

  const pipelineScore = byId.pipeline?.value ?? 50
  const followUpScore = byId.followUp?.value ?? 0
  const activityMetric = byId.activity || { value: 0, delta: null, spark: [] }

  const responseRate =
    summary.totalLeads > 0 ? Math.round((summary.contacted / summary.totalLeads) * 100) : 0

  const dealScore = summary.weightedPipelineValue
    ? Math.min(100, Math.round(35 + (summary.won / Math.max(1, summary.totalLeads)) * 50))
    : summary.pipelineValue > 0
      ? 55
      : 30

  return [
    {
      id: 'pipeline',
      label: personal ? 'My pipeline' : 'Pipeline health',
      value: pipelineScore,
      format: 'score',
      delta: comparison?.activitiesTotal?.delta,
      spark: byId.pipeline?.spark || activityMetric.spark,
      status: statusLevel(pipelineScore),
      hint: summary.totalLeads ? `${summary.totalLeads.toLocaleString()} leads` : null,
    },
    {
      id: 'revenue',
      label: personal ? 'Deal value' : 'Revenue score',
      value: dealScore,
      format: 'score',
      delta: null,
      spark: byId.revenue?.spark || [],
      status: statusLevel(dealScore),
      hint: summary.weightedPipelineValue
        ? `₹${summary.weightedPipelineValue.toLocaleString('en-IN')} weighted`
        : null,
    },
    {
      id: 'followUp',
      label: 'Follow-ups due',
      value: summary.needsFollowUp || 0,
      delta: comparison?.tasksCreated?.delta,
      spark: byId.followUp?.spark || [],
      status: (summary.needsFollowUp || 0) > 10 ? 'risk' : (summary.needsFollowUp || 0) > 3 ? 'warn' : 'good',
      hint: followUpScore ? `${followUpScore}% discipline` : 'Next actions',
    },
    {
      id: 'response',
      label: 'Contact rate',
      value: responseRate,
      format: 'score',
      delta: null,
      spark: byId.adoption?.spark || [],
      status: statusLevel(responseRate),
      hint: `${summary.contacted || 0} contacted`,
    },
    {
      id: 'activity',
      label: personal ? 'My activity' : isAdmin ? 'Team activity' : 'My activity',
      value: activityMetric.value,
      delta: activityMetric.delta,
      spark: activityMetric.spark,
      status: activityMetric.status || statusLevel(Math.min(100, (activityMetric.value || 0) * 2)),
      hint: rollup.activitiesTotal ? `${rollup.activitiesTotal} actions` : null,
    },
    {
      id: 'health',
      label: personal ? 'CRM health' : 'Team health',
      value: byId.teamHealth?.value ?? intelligenceV3?.teamHealth?.overall ?? 0,
      format: 'score',
      delta: byId.teamHealth?.delta,
      spark: byId.teamHealth?.spark || activityMetric.spark,
      status: byId.teamHealth?.status || statusLevel(intelligenceV3?.teamHealth?.overall ?? 0),
    },
  ]
}

function buildDashboardInsights({ intelligenceV3, summary, personal, isAdmin, marketing }) {
  const insights = []

  if (summary.needsFollowUp > 0) {
    insights.push({
      kind: 'risk',
      text: `${summary.needsFollowUp.toLocaleString()} leads need follow-up — prioritize today.`,
      action: { panel: 'pipeline', status: 'follow_up' },
    })
  }

  if (summary.staleLeads > 0) {
    insights.push({
      kind: 'risk',
      text: `${summary.staleLeads} leads have gone quiet for 7+ days.`,
      action: { panel: 'pipeline', status: 'follow_up' },
    })
  }

  if (summary.meetingsUpcoming > 0) {
    insights.push({
      kind: 'highlight',
      text: `${summary.meetingsUpcoming} meeting${summary.meetingsUpcoming === 1 ? '' : 's'} scheduled — stay on calendar.`,
      action: { panel: 'crm-calendar' },
    })
  }

  if (summary.won > 0) {
    insights.push({
      kind: 'highlight',
      text: `${summary.won} deal${summary.won === 1 ? '' : 's'} won · ₹${(summary.wonValue || 0).toLocaleString('en-IN')} revenue.`,
      action: { panel: 'pipeline', status: 'won' },
    })
  }

  if (marketing?.sent > 0) {
    const openRate = Math.round(((marketing.opens || 0) / marketing.sent) * 100)
    insights.push({
      kind: openRate >= 20 ? 'highlight' : 'risk',
      text: `Marketing open rate is ${openRate}% across ${marketing.campaigns || 0} campaigns.`,
      action: { panel: 'marketing', tab: 'reports' },
    })
  }

  for (const ins of intelligenceV3?.insights || []) {
    if (insights.length >= 8) break
    if (!insights.some((x) => x.text === ins.text)) insights.push(ins)
  }

  if (!insights.length) {
    insights.push({
      kind: 'highlight',
      text: personal
        ? 'Pipeline is clear — log activity to keep momentum.'
        : isAdmin
          ? 'Team metrics are warming up — check back after CRM activity.'
          : 'Your workspace is ready — start with pipeline follow-ups.',
    })
  }

  return insights.slice(0, 8)
}

function buildDashboardActions({ intelligenceV3, summary, personal }) {
  const base = intelligenceV3?.actionCenter || []
  const actions = []

  if (summary.needsFollowUp > 0) {
    actions.push({
      id: 'dash-followup',
      title: `${summary.needsFollowUp.toLocaleString()} leads require follow-up`,
      priority: 1,
      severity: 'high',
      filter: 'follow_up',
      actions: [
        { id: 'view', label: 'View', panel: 'pipeline', status: 'follow_up' },
        { id: 'fix', label: 'Fix', panel: 'pipeline', status: 'follow_up' },
        { id: 'review', label: 'Review', panel: personal ? 'overview' : 'crm-dashboard' },
      ],
    })
  }

  if (summary.staleLeads > 0) {
    actions.push({
      id: 'dash-stale',
      title: `${summary.staleLeads} stale leads need attention`,
      priority: 2,
      severity: 'high',
      filter: 'follow_up',
      actions: [
        { id: 'view', label: 'View', panel: 'pipeline', status: 'follow_up' },
        { id: 'assign', label: 'Assign', panel: 'pipeline' },
        { id: 'fix', label: 'Fix', panel: 'crm-log' },
      ],
    })
  }

  for (const item of base) {
    if (actions.length >= 6) break
    if (!actions.some((a) => a.id === item.id)) actions.push(item)
  }

  return actions.sort((a, b) => (a.priority || 99) - (b.priority || 99)).slice(0, 6)
}

/**
 * Home dashboard intelligence — same flow as Team Intelligence V3, scoped for Overview.
 */
export function buildDashboardIntelligenceV3({
  intelligenceV3 = null,
  summary = {},
  comparison = {},
  rollup = {},
  personal = false,
  isAdmin = false,
  marketing = null,
} = {}) {
  const intel = intelligenceV3 || {
    teamHealth: { overall: 50 },
    commandBar: [],
    insights: [],
    performanceMatrix: [],
    pipelineHealth: { stages: [] },
    revenueLeaks: [],
    capacity: [],
    adoption: { overall: 0, reps: [], trend: [] },
    activityEffectiveness: [],
    actionCenter: [],
  }

  const winning =
    (intel.teamHealth?.overall ?? 0) >= 55 &&
    (summary.needsFollowUp || 0) < Math.max(5, summary.totalLeads * 0.15)

  return {
    pulse: winning ? 'on_target' : 'needs_attention',
    pulseLabel: winning ? 'On target' : 'Needs attention',
    commandBar: buildDashboardCommandBar({
      intelligenceV3: intel,
      summary,
      comparison,
      rollup,
      personal,
      isAdmin,
    }),
    insights: buildDashboardInsights({ intelligenceV3: intel, summary, personal, isAdmin, marketing }),
    performanceMatrix: personal
      ? (intel.performanceMatrix || []).filter((r) => r.status)
      : isAdmin
        ? (intel.performanceMatrix || []).slice(0, 6)
        : (intel.performanceMatrix || []).slice(0, 1),
    pipelineHealth: intel.pipelineHealth,
    revenueLeaks: intel.revenueLeaks,
    capacity: isAdmin && !personal ? (intel.capacity || []).slice(0, 6) : [],
    adoption: intel.adoption,
    activityEffectiveness: intel.activityEffectiveness,
    actionCenter: buildDashboardActions({ intelligenceV3: intel, summary, personal }),
    showFullIntelligence: isAdmin && !personal,
    personal,
    isAdmin,
  }
}
