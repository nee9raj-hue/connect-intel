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

function incrementBucket(stats, bucket) {
  if (bucket === 'email') stats.emails += 1
  else if (bucket === 'call') stats.calls += 1
  else if (bucket === 'whatsapp') stats.whatsapp += 1
  else if (bucket === 'meeting') stats.meetings += 1
  else if (bucket === 'task') stats.tasksCreated += 1
  else if (bucket === 'note') stats.notes += 1
  else if (bucket === 'status') stats.statusChanges += 1
  else if (bucket === 'lead') stats.newLeads += 1
  stats.activitiesTotal += 1
}

/** Fast pre-filter — avoids normalizing thousands of idle pipeline rows. */
function entriesActiveInPeriod(entries, since, until = Infinity) {
  const active = []
  for (const entry of entries) {
    const raw = entry?.crm && typeof entry.crm === 'object' ? entry.crm : {}
    if (raw.lastCommunicationAt && inPeriod(raw.lastCommunicationAt, since, until)) {
      active.push(entry)
      continue
    }
    if (entry.savedAt && inPeriod(entry.savedAt, since, until)) {
      active.push(entry)
      continue
    }
    let hit = false
    for (const act of raw.activities || []) {
      if (inPeriod(act.createdAt, since, until)) {
        hit = true
        break
      }
    }
    if (!hit) {
      for (const task of raw.tasks || []) {
        if (
          inPeriod(task.createdAt, since, until) ||
          inPeriod(task.completedAt, since, until)
        ) {
          hit = true
          break
        }
      }
    }
    if (!hit) {
      for (const meeting of raw.meetings || []) {
        if (
          inPeriod(meeting.createdAt, since, until) ||
          inPeriod(meeting.scheduledAt, since, until)
        ) {
          hit = true
          break
        }
      }
    }
    if (hit) active.push(entry)
  }
  return active
}

/** Attribute CRM touchpoints to users + org totals (matches activity log). */
function scanActivityByUser(entries, since, until = Infinity) {
  const byUser = new Map()
  const org = emptyMemberStats()
  const orgTouched = new Set()

  const touch = (uid, entryId, bucket) => {
    if (uid) {
      if (!byUser.has(uid)) byUser.set(uid, { stats: emptyMemberStats(), touched: new Set() })
      const row = byUser.get(uid)
      incrementBucket(row.stats, bucket)
      row.touched.add(entryId)
    }
    incrementBucket(org, bucket)
    if (entryId) orgTouched.add(entryId)
  }

  for (const entry of entries) {
    const crm = normalizeExtendedCrm(entry.crm)
    const assignee = String(entry.assignedToUserId || entry.savedByUserId || entry.userId || '')
    const entryId = entry.id

    for (const act of activitiesForScan(crm)) {
      if (!inPeriod(act.createdAt, since, until)) continue
      touch(activityActorId(act, assignee), entryId, bucketActivityType(act.type))
    }

    for (const em of crm.emails || []) {
      if (!em.sentAt || !inPeriod(em.sentAt, since, until)) continue
      const dup = (crm.activities || []).some(
        (a) =>
          a.type === 'email' &&
          Math.abs(new Date(a.createdAt).getTime() - new Date(em.sentAt).getTime()) < 120000
      )
      if (!dup) touch(assignee, entryId, 'email')
    }

    for (const task of crm.tasks || []) {
      if (inPeriod(task.createdAt, since, until)) {
        touch(String(task.createdByUserId || task.assignedToUserId || assignee || ''), entryId, 'task')
      }
      if (task.completedAt && inPeriod(task.completedAt, since, until)) {
        const uid = String(task.assignedToUserId || task.createdByUserId || assignee || '')
        if (uid && byUser.has(uid)) {
          byUser.get(uid).stats.tasksCompleted += 1
        }
      }
    }

    for (const meeting of crm.meetings || []) {
      if (inPeriod(meeting.createdAt, since, until)) {
        touch(String(meeting.createdByUserId || assignee || ''), entryId, 'meeting')
      }
    }

    if (inPeriod(entry.savedAt, since, until)) {
      touch(String(entry.savedByUserId || assignee || ''), entryId, 'lead')
    }
  }

  org.leadsTouched = orgTouched.size
  org.contactsOpened = orgTouched.size

  const perUser = new Map()
  for (const [uid, row] of byUser.entries()) {
    row.stats.leadsTouched = row.touched.size
    perUser.set(uid, row.stats)
  }
  return { perUser, org }
}

function scanMemberCrmActivity(entries, memberId, since, until = Infinity) {
  const { perUser } = scanActivityByUser(entriesActiveInPeriod(entries, since, until), since, until)
  return perUser.get(String(memberId)) || emptyMemberStats()
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
  const activeEntries = entriesActiveInPeriod(entries, since)
  const prevActiveEntries = entriesActiveInPeriod(entries, prevSince, since)
  const { perUser: activityByUser, org: orgRollup } = scanActivityByUser(activeEntries, since)
  const { perUser: prevActivityByUser, org: prevOrgRollup } = scanActivityByUser(
    prevActiveEntries,
    prevSince,
    since
  )

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

  const memberProfiles = targetMembers.map((m) => {
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
  })

  const rollup =
    memberUserId && targetMembers.length === 1
      ? { ...sumTeamRollup(memberProfiles), contactsOpened: memberProfiles[0]?.contactsOpened || 0 }
      : isAdmin
        ? {
            ...orgRollup,
            hoursInApp: sumTeamRollup(
              members.map((m) => ({
                hoursInApp: aggregateWorkspaceUsage(usersById.get(String(m.userId)) || {}, since).hours,
              }))
            ).hoursInApp,
            aiSearches: members.reduce(
              (sum, m) => sum + countAiSearches(store, m.userId, since),
              0
            ),
          }
        : sumTeamRollup(memberProfiles)

  const prevRollup = memberUserId
    ? {
        activitiesTotal: memberProfiles.reduce((s, m) => s + (m.previousPeriod?.activitiesTotal || 0), 0),
        emails: memberProfiles.reduce((s, m) => s + (m.previousPeriod?.emails || 0), 0),
        calls: memberProfiles.reduce((s, m) => s + (m.previousPeriod?.calls || 0), 0),
        hoursInApp: memberProfiles.reduce((s, m) => s + (m.previousPeriod?.hoursInApp || 0), 0),
      }
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
