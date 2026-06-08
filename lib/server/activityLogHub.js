import { localDateKey, resolveTimeZone, formatLocalDateLabel } from '../calendarLocale.js'
import { MS_DAY, nextLocalDayMs, normalizeDashboardPeriod, periodStart, previousPeriodStart } from './dashboardPeriod.js'

const TYPE_LABELS = {
  call: 'Calls',
  email: 'Emails',
  email_inbound: 'Replies',
  note: 'Notes',
  meeting: 'Meetings',
  field_visit: 'Field visits',
  task: 'Tasks',
  whatsapp: 'WhatsApp',
  status: 'Status changes',
  assignment: 'Assignments',
  lead: 'New leads',
}

function deltaPct(current, previous) {
  if (!previous) return current ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function statusLevel(score) {
  if (score >= 70) return 'good'
  if (score >= 40) return 'warn'
  return 'risk'
}

function sparkFromTrend(trend) {
  return (trend || []).map((d) => ({ date: d.date, value: d.count }))
}

function buildTrendBuckets(activities, period, timeZone) {
  const tz = resolveTimeZone({}, timeZone)
  const normalized = normalizeDashboardPeriod(period)
  const start = periodStart(normalized, tz)
  const end = periodStart('day', tz)
  const buckets = new Map()

  if (normalized === 'day') {
    const key = localDateKey(new Date(), tz)
    buckets.set(key, { date: key, label: 'Today', count: 0, call: 0, email: 0, meeting: 0, note: 0 })
  } else {
    let cursor = start
    while (cursor <= end) {
      const key = localDateKey(new Date(cursor), tz)
      buckets.set(key, {
        date: key,
        label: formatLocalDateLabel(new Date(cursor), tz),
        count: 0,
        call: 0,
        email: 0,
        meeting: 0,
        note: 0,
      })
      if (cursor >= end) break
      cursor = nextLocalDayMs(tz, cursor)
    }
  }

  for (const act of activities) {
    const key = localDateKey(act.createdAt, tz)
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.count += 1
    const t = String(act.type || '').toLowerCase()
    if (t === 'call') bucket.call += 1
    else if (t === 'email' || t === 'email_inbound') bucket.email += 1
    else if (t === 'meeting' || t === 'field_visit') bucket.meeting += 1
    else if (t === 'note') bucket.note += 1
  }

  return [...buckets.values()]
}

function buildTypeBreakdown(activities) {
  const map = new Map()
  for (const act of activities) {
    const t = String(act.type || 'note').toLowerCase()
    map.set(t, (map.get(t) || 0) + 1)
  }
  return [...map.entries()]
    .map(([type, count]) => ({
      type,
      label: TYPE_LABELS[type] || type.replace(/_/g, ' '),
      count,
    }))
    .sort((a, b) => b.count - a.count)
}

function buildRepActivity(activities, membersById) {
  const map = new Map()
  for (const act of activities) {
    const uid = String(act.createdByUserId || act.userId || '')
    if (!uid) continue
    if (!map.has(uid)) {
      map.set(uid, {
        userId: uid,
        name: act.createdByName || membersById.get(uid)?.name || 'Rep',
        total: 0,
        calls: 0,
        emails: 0,
        meetings: 0,
        notes: 0,
      })
    }
    const row = map.get(uid)
    row.total += 1
    const t = String(act.type || '').toLowerCase()
    if (t === 'call') row.calls += 1
    else if (t === 'email') row.emails += 1
    else if (t === 'meeting' || t === 'field_visit') row.meetings += 1
    else if (t === 'note') row.notes += 1
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

function buildInsights(rollup, prevRollup, repActivity, typeBreakdown, periodLabel) {
  const insights = []

  const delta = deltaPct(rollup.activitiesTotal, prevRollup.activitiesTotal)
  if (delta > 10) {
    insights.push({
      kind: 'highlight',
      text: `Activity is up ${delta}% vs the previous ${periodLabel}.`,
    })
  } else if (delta < -10) {
    insights.push({
      kind: 'risk',
      text: `Activity dropped ${Math.abs(delta)}% vs the previous ${periodLabel} — check follow-up discipline.`,
    })
  }

  if (repActivity[0]?.total > 0) {
    insights.push({
      kind: 'highlight',
      text: `${repActivity[0].name} logged the most CRM actions (${repActivity[0].total}).`,
      userId: repActivity[0].userId,
    })
  }

  const topType = typeBreakdown[0]
  if (topType?.count > 0) {
    insights.push({
      kind: 'highlight',
      text: `${topType.label} lead the mix with ${topType.count} logged this period.`,
      filterType: topType.type,
    })
  }

  if (rollup.calls > 0 && rollup.meetings > 0) {
    const rate = Math.round((rollup.meetings / rollup.calls) * 100)
    insights.push({
      kind: rate >= 25 ? 'highlight' : 'risk',
      text: `Calls → meetings conversion is ${rate}% (${rollup.meetings} meetings from ${rollup.calls} calls).`,
    })
  }

  if (rollup.leadsTouched > 0) {
    insights.push({
      kind: 'highlight',
      text: `${rollup.leadsTouched} unique leads touched — open any row below to continue the thread.`,
      action: { panel: 'pipeline' },
    })
  }

  if (!insights.length) {
    insights.push({
      kind: 'highlight',
      text: 'Log calls, emails, and notes from Pipeline — they appear here as your team activity hub.',
      action: { panel: 'pipeline' },
    })
  }

  return insights.slice(0, 8)
}

function buildCommandBar(rollup, prevRollup, trend) {
  const spark = sparkFromTrend(trend)
  const delta = deltaPct(rollup.activitiesTotal, prevRollup.activitiesTotal)
  const intensity = Math.min(100, rollup.activitiesTotal * 2)

  return [
    {
      id: 'total',
      label: 'Total activity',
      value: rollup.activitiesTotal || 0,
      delta,
      spark,
      status: statusLevel(intensity),
    },
    {
      id: 'calls',
      label: 'Calls',
      value: rollup.calls || 0,
      delta: deltaPct(rollup.calls, prevRollup.calls),
      spark: trend.map((d) => ({ date: d.date, value: d.call })),
      status: (rollup.calls || 0) > 0 ? 'good' : 'warn',
    },
    {
      id: 'emails',
      label: 'Emails',
      value: rollup.emails || 0,
      delta: deltaPct(rollup.emails, prevRollup.emails),
      spark: trend.map((d) => ({ date: d.date, value: d.email })),
      status: (rollup.emails || 0) > 0 ? 'good' : 'warn',
    },
    {
      id: 'meetings',
      label: 'Meetings',
      value: rollup.meetings || 0,
      delta: deltaPct(rollup.meetings, prevRollup.meetings),
      spark: trend.map((d) => ({ date: d.date, value: d.meeting })),
      status: (rollup.meetings || 0) > 0 ? 'good' : 'warn',
    },
    {
      id: 'leads',
      label: 'Leads touched',
      value: rollup.leadsTouched || 0,
      delta: deltaPct(rollup.leadsTouched, prevRollup.leadsTouched),
      spark,
      status: (rollup.leadsTouched || 0) > 3 ? 'good' : 'warn',
      hint: `${rollup.notes || 0} notes`,
    },
    {
      id: 'tasks',
      label: 'Tasks logged',
      value: rollup.tasksCreated || 0,
      delta: deltaPct(rollup.tasksCreated, prevRollup.tasksCreated),
      spark,
      status: (rollup.tasksCreated || 0) > 0 ? 'good' : 'warn',
    },
  ]
}

function buildQuickLinks(isAdmin, activityType) {
  const links = [
    { id: 'pipeline', label: 'Pipeline', panel: 'pipeline', icon: 'pipeline' },
    { id: 'overview', label: 'Dashboard', panel: 'overview', icon: 'home' },
    { id: 'calendar', label: 'Calendar', panel: 'crm-calendar', icon: 'calendar' },
    { id: 'calls', label: 'Calls only', panel: 'crm-log', activityType: 'call' },
    { id: 'emails', label: 'Emails only', panel: 'crm-log', activityType: 'email' },
    { id: 'notes', label: 'Notes only', panel: 'crm-log', activityType: 'note' },
  ]
  if (isAdmin) {
    links.splice(2, 0, { id: 'team-intel', label: 'Team intelligence', panel: 'crm-dashboard', icon: 'team' })
  }
  if (activityType) {
    links.unshift({
      id: 'clear-filter',
      label: 'All activity',
      panel: 'crm-log',
      activityType: null,
      highlight: true,
    })
  }
  return links
}

function buildActionCenter(rollup, isAdmin, memberUserId) {
  const items = []

  items.push({
    id: 'open-pipeline',
    title: 'Open pipeline to log activity',
    priority: 1,
    severity: 'medium',
    actions: [
      { id: 'view', label: 'Pipeline', panel: 'pipeline' },
      { id: 'fix', label: 'Log note', panel: 'pipeline', status: 'all' },
    ],
  })

  if ((rollup.calls || 0) > 0) {
    items.push({
      id: 'review-calls',
      title: `${rollup.calls} calls logged — review outcomes`,
      priority: 2,
      severity: 'medium',
      filterType: 'call',
      actions: [
        { id: 'view', label: 'View', panel: 'crm-log', activityType: 'call' },
        { id: 'review', label: 'Review', panel: 'crm-log', activityType: 'call' },
      ],
    })
  }

  if (isAdmin && !memberUserId) {
    items.push({
      id: 'team-intel',
      title: 'Compare team activity in intelligence',
      priority: 3,
      severity: 'medium',
      actions: [
        { id: 'view', label: 'Team intel', panel: 'crm-dashboard' },
        { id: 'assign', label: 'By rep', panel: 'crm-dashboard' },
      ],
    })
  }

  if ((rollup.emails || 0) > 0) {
    items.push({
      id: 'review-emails',
      title: `${rollup.emails} outbound emails — trace replies`,
      priority: 4,
      severity: 'medium',
      filterType: 'email',
      actions: [
        { id: 'view', label: 'View', panel: 'crm-log', activityType: 'email' },
        { id: 'fix', label: 'Pipeline', panel: 'pipeline', status: 'follow_up' },
      ],
    })
  }

  return items.slice(0, 5)
}

/**
 * Activity Log command hub — linkage point for pipeline, dashboard, and team intel.
 */
export function buildActivityLogHub({
  activities = [],
  prevActivities = [],
  rollup = {},
  prevRollup = {},
  period = 'week',
  periodLabel = 'period',
  memberUserId = null,
  memberName = null,
  isAdmin = false,
  members = [],
  activityType = null,
  timeZone = null,
} = {}) {
  const trend = buildTrendBuckets(activities, period, timeZone)
  const typeBreakdown = buildTypeBreakdown(activities)
  const membersById = new Map(members.map((m) => [String(m.userId), m]))
  const repActivity = buildRepActivity(activities, membersById)

  const pulse =
    (rollup.activitiesTotal || 0) >= (prevRollup.activitiesTotal || 0) * 0.85
      ? 'active'
      : 'quiet'

  return {
    pulse,
    pulseLabel: pulse === 'active' ? 'Activity on track' : 'Quiet period',
    period,
    periodLabel,
    memberUserId: memberUserId ? String(memberUserId) : null,
    memberName,
    activityType,
    isAdmin,
    commandBar: buildCommandBar(rollup, prevRollup, trend),
    insights: buildInsights(rollup, prevRollup, repActivity, typeBreakdown, periodLabel),
    typeBreakdown,
    repActivity: isAdmin ? repActivity.slice(0, 12) : repActivity.filter((r) => !memberUserId || String(r.userId) === String(memberUserId)),
    trend,
    quickLinks: buildQuickLinks(isAdmin, activityType),
    actionCenter: buildActionCenter(rollup, isAdmin, memberUserId),
    filters: [
      { id: 'all', label: 'All' },
      { id: 'call', label: 'Calls' },
      { id: 'email', label: 'Emails' },
      { id: 'note', label: 'Notes' },
      { id: 'meeting', label: 'Meetings' },
      { id: 'task', label: 'Tasks' },
      { id: 'whatsapp', label: 'WhatsApp' },
    ],
  }
}
