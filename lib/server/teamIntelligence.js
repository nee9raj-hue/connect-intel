import { normalizeExtendedCrm } from './crmWorkflow.js'
import { listTeamMembers } from './organizations.js'
import { aggregateWorkspaceUsage } from './teamWorkspaceUsage.js'

const MS_DAY = 86400000

const ACTIVITY_LABELS = {
  email: 'Emails',
  call: 'Calls',
  whatsapp: 'WhatsApp',
  meeting: 'Meetings',
  task: 'Tasks',
  note: 'Notes',
  status: 'Status updates',
  lead: 'New leads',
  other: 'Other',
}

function inPeriod(iso, since) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !Number.isNaN(t) && t >= since
}

function periodStart(period) {
  const days = period === 'month' ? 30 : 7
  return Date.now() - days * MS_DAY
}

function previousPeriodStart(period) {
  const days = period === 'month' ? 30 : 7
  return Date.now() - days * 2 * MS_DAY
}

function bucketActivityType(type) {
  const t = String(type || '').toLowerCase()
  if (t === 'email' || t === 'email_inbound') return 'email'
  if (t === 'call') return 'call'
  if (t === 'whatsapp') return 'whatsapp'
  if (t === 'meeting' || t === 'field_visit') return 'meeting'
  if (t === 'task') return 'task'
  if (t === 'note') return 'note'
  if (t === 'status' || t === 'assignment' || t === 'transfer') return 'status'
  if (t === 'lead') return 'lead'
  return 'other'
}

function emptyMemberStats() {
  return {
    emails: 0,
    calls: 0,
    whatsapp: 0,
    meetings: 0,
    tasksCreated: 0,
    tasksCompleted: 0,
    notes: 0,
    statusChanges: 0,
    newLeads: 0,
    leadsTouched: 0,
    activitiesTotal: 0,
    contactsOpened: 0,
    hoursInApp: 0,
    activeDays: 0,
    aiSearches: 0,
    lastActiveAt: null,
    lastLoginAt: null,
  }
}

function activitiesForScan(crm) {
  const normalized = normalizeExtendedCrm(crm)
  const activities = [...(normalized.activities || [])]
  if (
    normalized.lastCommunicationAt &&
    normalized.lastCommunicationSummary &&
    !activities.some((a) => {
      const dt = Math.abs(new Date(a.createdAt).getTime() - new Date(normalized.lastCommunicationAt).getTime())
      return dt < 120000 && (a.summary || '') === (normalized.lastCommunicationSummary || '')
    })
  ) {
    activities.push({
      id: `touch_${normalized.lastCommunicationAt}`,
      type: normalized.lastCommunicationType || 'note',
      summary: normalized.lastCommunicationSummary,
      createdAt: normalized.lastCommunicationAt,
      createdByUserId: null,
      createdByName: null,
    })
  }
  return activities
}

function activityActorId(act, assignee) {
  return String(act.createdByUserId || act.userId || assignee || '')
}

function scanMemberCrmActivity(entries, memberId, since) {
  const stats = emptyMemberStats()
  const touched = new Set()
  const mid = String(memberId)

  for (const entry of entries) {
    const crm = normalizeExtendedCrm(entry.crm)
    const assignee = String(entry.assignedToUserId || entry.savedByUserId || entry.userId || '')

    for (const act of activitiesForScan(crm)) {
      if (!inPeriod(act.createdAt, since)) continue
      const actor = activityActorId(act, assignee)
      if (actor !== mid) continue
      touched.add(entry.id)
      const bucket = bucketActivityType(act.type)
      if (bucket === 'email') stats.emails += 1
      else if (bucket === 'call') stats.calls += 1
      else if (bucket === 'whatsapp') stats.whatsapp += 1
      else if (bucket === 'meeting') stats.meetings += 1
      else if (bucket === 'task') stats.tasksCreated += 1
      else if (bucket === 'note') stats.notes += 1
      else if (bucket === 'status') stats.statusChanges += 1
      stats.activitiesTotal += 1
    }

    for (const em of crm.emails || []) {
      if (!em.sentAt || !inPeriod(em.sentAt, since)) continue
      if (assignee !== mid) continue
      const dup = (crm.activities || []).some(
        (a) =>
          a.type === 'email' &&
          Math.abs(new Date(a.createdAt).getTime() - new Date(em.sentAt).getTime()) < 120000
      )
      if (!dup) {
        stats.emails += 1
        stats.activitiesTotal += 1
        touched.add(entry.id)
      }
    }

    for (const task of crm.tasks || []) {
      if (inPeriod(task.createdAt, since)) {
        const creator = String(task.createdByUserId || task.assignedToUserId || assignee || '')
        if (creator === mid) {
          stats.tasksCreated += 1
          touched.add(entry.id)
        }
      }
      if (
        task.completedAt &&
        inPeriod(task.completedAt, since) &&
        (String(task.assignedToUserId || '') === mid || String(task.createdByUserId || '') === mid)
      ) {
        stats.tasksCompleted += 1
      }
    }

    for (const meeting of crm.meetings || []) {
      if (inPeriod(meeting.createdAt, since) && String(meeting.createdByUserId || '') === mid) {
        stats.meetings += 1
        touched.add(entry.id)
      }
    }

    if (
      inPeriod(entry.savedAt, since) &&
      (String(entry.savedByUserId || '') === mid || assignee === mid)
    ) {
      stats.newLeads += 1
      touched.add(entry.id)
    }
  }

  stats.leadsTouched = touched.size
  return stats
}

function countAiSearches(store, memberId, since) {
  return (store.searches || []).filter(
    (s) => String(s.userId) === String(memberId) && inPeriod(s.createdAt || s.at, since)
  ).length
}

function sumTeamRollup(members) {
  const rollup = {
    hoursInApp: 0,
    activeDays: 0,
    contactsOpened: 0,
    leadsTouched: 0,
    emails: 0,
    calls: 0,
    whatsapp: 0,
    meetings: 0,
    tasksCreated: 0,
    tasksCompleted: 0,
    notes: 0,
    activitiesTotal: 0,
    aiSearches: 0,
    newLeads: 0,
  }
  for (const m of members) {
    rollup.hoursInApp += m.hoursInApp || 0
    rollup.activeDays += m.activeDays || 0
    rollup.contactsOpened += m.contactsOpened || 0
    rollup.leadsTouched += m.leadsTouched || 0
    rollup.emails += m.emails || 0
    rollup.calls += m.calls || 0
    rollup.whatsapp += m.whatsapp || 0
    rollup.meetings += m.meetings || 0
    rollup.tasksCreated += m.tasksCreated || 0
    rollup.tasksCompleted += m.tasksCompleted || 0
    rollup.notes += m.notes || 0
    rollup.activitiesTotal += m.activitiesTotal || 0
    rollup.aiSearches += m.aiSearches || 0
    rollup.newLeads += m.newLeads || 0
  }
  rollup.hoursInApp = Math.round(rollup.hoursInApp * 10) / 10
  return rollup
}

function buildActivityMix(members) {
  const totals = { email: 0, call: 0, whatsapp: 0, meeting: 0, task: 0, note: 0, status: 0, other: 0 }
  for (const m of members) {
    totals.email += m.emails || 0
    totals.call += m.calls || 0
    totals.whatsapp += m.whatsapp || 0
    totals.meeting += m.meetings || 0
    totals.task += m.tasksCreated || 0
    totals.note += m.notes || 0
    totals.status += m.statusChanges || 0
  }
  return Object.entries(totals)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => ({
      key,
      label: ACTIVITY_LABELS[key] || key,
      count,
    }))
    .sort((a, b) => b.count - a.count)
}

function deltaPct(current, previous) {
  if (!previous) return current ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function buildWeeklyReviewInsights(members, rollup, comparison, isAdmin) {
  const insights = []

  if (isAdmin) {
    insights.push({
      kind: 'transparency',
      title: 'Manager visibility',
      body: 'Activity hours, contacts opened, calls, emails, and tasks are visible to company admins for weekly team reviews.',
    })
  }

  const sorted = [...members].sort((a, b) => (b.activitiesTotal || 0) - (a.activitiesTotal || 0))
  if (sorted[0]?.activitiesTotal > 0) {
    insights.push({
      kind: 'highlight',
      title: 'Top activity',
      body: `${sorted[0].name} logged ${sorted[0].activitiesTotal} CRM actions this period.`,
      userId: sorted[0].userId,
    })
  }

  const quiet = members.filter((m) => (m.activitiesTotal || 0) === 0 && (m.hoursInApp || 0) > 0)
  if (quiet.length) {
    insights.push({
      kind: 'concern',
      title: 'Logged in, low CRM activity',
      body: `${quiet.map((m) => m.name).join(', ')} spent time in Connect Intel but logged no pipeline actions — review together on your weekly call.`,
      userIds: quiet.map((m) => m.userId),
    })
  }

  const inactive = members.filter((m) => (m.hoursInApp || 0) === 0 && (m.activitiesTotal || 0) === 0)
  if (inactive.length && members.length > 1) {
    insights.push({
      kind: 'concern',
      title: 'No recorded activity',
      body: `${inactive.map((m) => m.name).join(', ')} had no tracked time or CRM actions this period.`,
      userIds: inactive.map((m) => m.userId),
    })
  }

  if (comparison?.activitiesTotal?.delta != null && comparison.activitiesTotal.delta > 10) {
    insights.push({
      kind: 'highlight',
      title: 'Team momentum up',
      body: `Total CRM actions are up ${comparison.activitiesTotal.delta}% vs the previous ${comparison.periodLabel}.`,
    })
  } else if (comparison?.activitiesTotal?.delta != null && comparison.activitiesTotal.delta < -10) {
    insights.push({
      kind: 'concern',
      title: 'Activity dip',
      body: `CRM actions are down ${Math.abs(comparison.activitiesTotal.delta)}% vs last period — good topic for your weekly sync.`,
    })
  }

  if (rollup.tasksCreated > 0) {
    const rate = Math.round((rollup.tasksCompleted / rollup.tasksCreated) * 100)
    insights.push({
      kind: 'metric',
      title: 'Task completion',
      body: `${rollup.tasksCompleted} of ${rollup.tasksCreated} tasks created were completed (${rate}%).`,
    })
  }

  return insights.slice(0, 6)
}

function buildMarketingSnapshot(store, user, since) {
  const campaigns = (store.marketingCampaigns || []).filter(
    (c) => c.organizationId === user.organizationId
  )
  let sent = 0
  let opens = 0
  let clicks = 0
  let activeCampaigns = 0

  for (const c of campaigns) {
    const stats = c.stats || c.analytics || {}
    if (inPeriod(c.sentAt || c.updatedAt || c.createdAt, since)) activeCampaigns += 1
    sent += Number(stats.sent || stats.delivered || 0)
    opens += Number(stats.opened || stats.opens || 0)
    clicks += Number(stats.clicked || stats.clicks || 0)
  }

  const openRate = sent ? Math.round((opens / sent) * 1000) / 10 : 0
  const clickRate = sent ? Math.round((clicks / sent) * 1000) / 10 : 0

  return { sent, opens, clicks, openRate, clickRate, activeCampaigns, campaignCount: campaigns.length }
}

export function buildTeamIntelligence(store, user, { period = 'week', entries = [], memberUserId = null, isAdmin = false } = {}) {
  const since = periodStart(period)
  const prevSince = previousPeriodStart(period)
  const prevUntil = since
  const orgId = user.organizationId
  const members = orgId ? listTeamMembers(store, orgId) : []
  const usersById = new Map((store.users || []).map((u) => [u.id, u]))

  let targetMembers = members
  if (memberUserId) {
    targetMembers = members.filter((m) => String(m.userId) === String(memberUserId))
  } else if (!isAdmin) {
    targetMembers = members.filter((m) => String(m.userId) === String(user.id))
  }

  const memberProfiles = targetMembers.map((m) => {
    const storeUser = usersById.get(m.userId) || {}
    const crm = scanMemberCrmActivity(entries, m.userId, since)
    const usage = aggregateWorkspaceUsage(storeUser, since)
    const prevCrm = scanMemberCrmActivity(entries, m.userId, prevSince)
    const prevUsage = aggregateWorkspaceUsage(storeUser, prevSince)

    const contactsOpened = Math.max(usage.leadsOpened, crm.leadsTouched)

    return {
      userId: m.userId,
      name: m.name,
      email: m.email,
      pipelineRole: m.pipelineRole,
      ...crm,
      contactsOpened,
      hoursInApp: usage.hours,
      activeDays: usage.activeDays,
      lastActiveAt: usage.lastActiveAt,
      lastLoginAt: storeUser.lastLoginAt || null,
      aiSearches: countAiSearches(store, m.userId, since),
      previousPeriod: {
        activitiesTotal: prevCrm.activitiesTotal,
        emails: prevCrm.emails,
        hoursInApp: prevUsage.hours,
      },
    }
  })

  const rollup = sumTeamRollup(memberProfiles)
  const prevRollup = {
    activitiesTotal: memberProfiles.reduce((s, m) => s + (m.previousPeriod?.activitiesTotal || 0), 0),
    emails: memberProfiles.reduce((s, m) => s + (m.previousPeriod?.emails || 0), 0),
    hoursInApp: memberProfiles.reduce((s, m) => s + (m.previousPeriod?.hoursInApp || 0), 0),
  }

  const periodLabel = period === 'month' ? '30 days' : '7 days'
  const comparison = {
    periodLabel,
    prevSince: new Date(prevSince).toISOString(),
    prevUntil: new Date(prevUntil).toISOString(),
    activitiesTotal: { current: rollup.activitiesTotal, previous: prevRollup.activitiesTotal, delta: deltaPct(rollup.activitiesTotal, prevRollup.activitiesTotal) },
    emails: { current: rollup.emails, previous: prevRollup.emails, delta: deltaPct(rollup.emails, prevRollup.emails) },
    hoursInApp: { current: rollup.hoursInApp, previous: prevRollup.hoursInApp, delta: deltaPct(rollup.hoursInApp, prevRollup.hoursInApp) },
  }

  return {
    period,
    periodLabel: period === 'month' ? 'This month' : 'This week',
    isAdmin,
    memberUserId: memberUserId ? String(memberUserId) : null,
    rollup,
    activityMix: buildActivityMix(memberProfiles),
    members: memberProfiles.sort((a, b) => (b.activitiesTotal || 0) - (a.activitiesTotal || 0)),
    comparison,
    weeklyReview: buildWeeklyReviewInsights(memberProfiles, rollup, comparison, isAdmin),
    marketing: orgId ? buildMarketingSnapshot(store, user, since) : null,
    trackingNote:
      'Time in app is estimated from active sessions while Connect Intel is open. Contacts opened counts unique leads viewed or worked in CRM.',
  }
}
