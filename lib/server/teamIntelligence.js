import { listTeamMembers } from './organizations.js'
import { aggregateWorkspaceUsage } from './teamWorkspaceUsage.js'
import { buildActivityRollup } from './crmTouchpoints.js'

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

function inPeriod(iso, since, until = Infinity) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return !Number.isNaN(t) && t >= since && t < until
}

function periodStart(period) {
  const days = period === 'month' ? 30 : 7
  return Date.now() - days * MS_DAY
}

function previousPeriodStart(period) {
  const days = period === 'month' ? 30 : 7
  return Date.now() - days * 2 * MS_DAY
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

export function buildTeamIntelligence(store, user, {
  period = 'week',
  entries = [],
  memberUserId = null,
  isAdmin = false,
  activityRollup = null,
  prevActivityRollup = null,
} = {}) {
  const since = periodStart(period)
  const prevSince = previousPeriodStart(period)
  const prevUntil = since
  const orgId = user.organizationId
  const currentRollup = activityRollup || buildActivityRollup(entries, since)
  const previousRollup = prevActivityRollup || buildActivityRollup(entries, prevSince, prevUntil)
  const { perUser: activityByUser, org: orgRollup } = currentRollup
  const { perUser: prevActivityByUser, org: prevOrgRollup } = previousRollup

  let members = orgId ? listTeamMembers(store, orgId) : []
  const usersById = new Map((store.users || []).map((u) => [String(u.id), u]))

  if (orgId && isAdmin && !members.some((m) => String(m.userId) === String(user.id))) {
    members = [
      {
        userId: user.id,
        name: user.name || user.email || 'You',
        email: user.email,
        pipelineRole: 'org_admin',
      },
      ...members,
    ]
  }

  for (const uid of activityByUser.keys()) {
    if (members.some((m) => String(m.userId) === uid)) continue
    const u = usersById.get(uid) || {}
    members.push({
      userId: uid,
      name: u.name || u.email || 'Team member',
      email: u.email,
      pipelineRole: 'member',
    })
  }

  let targetMembers = members
  if (memberUserId) {
    targetMembers = members.filter((m) => String(m.userId) === String(memberUserId))
    if (!targetMembers.length) {
      const u = usersById.get(String(memberUserId)) || {}
      targetMembers = [
        {
          userId: memberUserId,
          name: u.name || u.email || 'Team member',
          email: u.email,
          pipelineRole: 'member',
        },
      ]
    }
  } else if (!isAdmin) {
    targetMembers = members.filter((m) => String(m.userId) === String(user.id))
    if (!targetMembers.length) {
      targetMembers = [
        {
          userId: user.id,
          name: user.name || user.email || 'You',
          email: user.email,
          pipelineRole: 'member',
        },
      ]
    }
  }

  function profileForMember(m) {
    const uid = String(m.userId)
    const storeUser = usersById.get(uid) || {}
    const crm = activityByUser.get(uid) || emptyMemberStats()
    const usage = aggregateWorkspaceUsage(storeUser, since)
    const prevCrm = prevActivityByUser.get(uid) || emptyMemberStats()
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
        calls: prevCrm.calls,
        hoursInApp: prevUsage.hours,
      },
    }
  }

  function rollupForUser(uid) {
    const stats = activityByUser.get(String(uid)) || emptyMemberStats()
    const storeUser = usersById.get(String(uid)) || {}
    const usage = aggregateWorkspaceUsage(storeUser, since)
    return {
      ...stats,
      contactsOpened: Math.max(stats.contactsOpened, usage.leadsOpened),
      hoursInApp: usage.hours,
      aiSearches: countAiSearches(store, uid, since),
    }
  }

  function prevRollupForUser(uid) {
    const stats = prevActivityByUser.get(String(uid)) || emptyMemberStats()
    const storeUser = usersById.get(String(uid)) || {}
    const usage = aggregateWorkspaceUsage(storeUser, prevSince)
    return {
      activitiesTotal: stats.activitiesTotal,
      emails: stats.emails,
      calls: stats.calls,
      hoursInApp: usage.hours,
    }
  }

  const memberProfiles = targetMembers.map(profileForMember)

  const rollup = memberUserId
    ? rollupForUser(memberUserId)
    : {
        ...orgRollup,
        hoursInApp: sumTeamRollup(
          members.map((m) => ({
            hoursInApp: aggregateWorkspaceUsage(usersById.get(String(m.userId)) || {}, since).hours,
          }))
        ).hoursInApp,
        aiSearches: members.reduce((sum, m) => sum + countAiSearches(store, m.userId, since), 0),
      }

  const prevRollup = memberUserId
    ? prevRollupForUser(memberUserId)
    : {
        activitiesTotal: prevOrgRollup.activitiesTotal,
        emails: prevOrgRollup.emails,
        calls: prevOrgRollup.calls,
        hoursInApp: sumTeamRollup(
          members.map((m) => ({
            hoursInApp: aggregateWorkspaceUsage(usersById.get(String(m.userId)) || {}, prevSince).hours,
          }))
        ).hoursInApp,
      }

  const periodLabel = period === 'month' ? '30 days' : '7 days'
  const comparison = {
    periodLabel,
    prevSince: new Date(prevSince).toISOString(),
    prevUntil: new Date(prevUntil).toISOString(),
    activitiesTotal: { current: rollup.activitiesTotal, previous: prevRollup.activitiesTotal, delta: deltaPct(rollup.activitiesTotal, prevRollup.activitiesTotal) },
    emails: { current: rollup.emails, previous: prevRollup.emails, delta: deltaPct(rollup.emails, prevRollup.emails) },
    calls: { current: rollup.calls, previous: prevRollup.calls, delta: deltaPct(rollup.calls, prevRollup.calls) },
    tasksCreated: { current: rollup.tasksCreated, previous: prevOrgRollup.tasksCreated, delta: deltaPct(rollup.tasksCreated, prevOrgRollup.tasksCreated) },
    contactsOpened: { current: rollup.contactsOpened, previous: prevOrgRollup.contactsOpened, delta: deltaPct(rollup.contactsOpened, prevOrgRollup.contactsOpened) },
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
