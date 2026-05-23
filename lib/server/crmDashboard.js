import { CRM_STATUSES } from './crm.js'
import { listTeamMembers } from './organizations.js'

const MS_DAY = 86400000

function periodStart(period) {
  const days = period === 'month' ? 30 : 7
  return Date.now() - days * MS_DAY
}

function inPeriod(iso, since) {
  if (!iso) return false
  return new Date(iso).getTime() >= since
}

export function buildTeamDashboard(store, user, { period = 'week', memberUserId = null } = {}) {
  const since = periodStart(period)
  const isAdmin = user.isOrgAdmin || user.orgRole === 'org_admin'
  const orgId = user.organizationId

  if (!orgId || user.accountType !== 'company') {
    return {
      personal: true,
      period,
      summary: emptySummary(),
      members: [],
      activityByDay: [],
      statusBreakdown: statusBreakdownFromEntries([]),
    }
  }

  let entries = store.savedLeads.filter((e) => e.organizationId === orgId)
  const members = listTeamMembers(store, orgId)

  if (memberUserId) {
    entries = entries.filter((e) => (e.assignedToUserId || e.savedByUserId) === memberUserId)
  } else if (!isAdmin) {
    entries = entries.filter(
      (e) => (e.assignedToUserId || e.savedByUserId) === user.id
    )
  }

  const activityByDay = buildActivityByDay(entries, since, period)
  const statusBreakdown = statusBreakdownFromEntries(entries)

  const memberStats = members.map((m) => {
    const mine = store.savedLeads.filter(
      (e) =>
        e.organizationId === orgId &&
        (e.assignedToUserId || e.savedByUserId) === m.userId
    )
    return {
      userId: m.userId,
      name: m.name,
      email: m.email,
      pipelineRole: m.pipelineRole,
      ...memberMetrics(mine, since),
      needsHelp: needsHelpLabel(mine, since),
    }
  })

  const summary = orgSummary(entries, since)

  return {
    personal: false,
    isAdmin,
    period,
    memberUserId: memberUserId || null,
    summary,
    members: memberStats,
    activityByDay,
    statusBreakdown,
    memberOptions: members.map((m) => ({ userId: m.userId, name: m.name })),
  }
}

function emptySummary() {
  return {
    totalLeads: 0,
    contacted: 0,
    emailsSent: 0,
    meetingsUpcoming: 0,
    activitiesInPeriod: 0,
    won: 0,
    needsFollowUp: 0,
  }
}

function orgSummary(entries, since) {
  let emailsSent = 0
  let activitiesInPeriod = 0
  let contacted = 0
  let won = 0
  let needsFollowUp = 0
  let meetingsUpcoming = 0
  const now = Date.now()

  for (const entry of entries) {
    const crm = entry.crm || {}
    if (crm.status !== 'new') contacted += 1
    if (crm.status === 'won') won += 1
    if (crm.status === 'follow_up') needsFollowUp += 1
    if (crm.lastEmailSentAt) emailsSent += 1
    for (const m of crm.meetings || []) {
      if (m.scheduledAt && new Date(m.scheduledAt).getTime() > now) meetingsUpcoming += 1
    }
    for (const act of crm.activities || []) {
      if (inPeriod(act.createdAt, since)) activitiesInPeriod += 1
    }
  }

  return {
    totalLeads: entries.length,
    contacted,
    emailsSent,
    meetingsUpcoming,
    activitiesInPeriod,
    won,
    needsFollowUp,
  }
}

function memberMetrics(entries, since) {
  const base = orgSummary(entries, since)
  return base
}

function needsHelpLabel(entries, since) {
  const overdue = entries.filter((e) => {
    const crm = e.crm || {}
    if (!crm.nextFollowUpAt) return false
    return new Date(crm.nextFollowUpAt).getTime() < Date.now()
  }).length
  if (overdue > 0) return `${overdue} overdue follow-up`
  const quiet = entries.filter((e) => {
    const crm = e.crm || {}
    const last = crm.lastCommunicationAt || crm.lastEmailSentAt
    if (!last) return true
    return !inPeriod(last, since)
  }).length
  if (quiet > 3) return `${quiet} quiet this period`
  return 'On track'
}

function statusBreakdownFromEntries(entries) {
  const counts = Object.fromEntries(CRM_STATUSES.map((s) => [s, 0]))
  for (const entry of entries) {
    const st = entry.crm?.status || 'new'
    if (counts[st] != null) counts[st] += 1
    else counts.new += 1
  }
  return CRM_STATUSES.map((id) => ({ status: id, count: counts[id] || 0 }))
}

function buildActivityByDay(entries, since, period) {
  const days = period === 'month' ? 30 : 7
  const buckets = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    buckets.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }),
      count: 0,
      email: 0,
      call: 0,
      whatsapp: 0,
    })
  }

  const bucketMap = Object.fromEntries(buckets.map((b) => [b.date, b]))

  for (const entry of entries) {
    for (const act of entry.crm?.activities || []) {
      if (!inPeriod(act.createdAt, since)) continue
      const day = String(act.createdAt).slice(0, 10)
      const bucket = bucketMap[day]
      if (!bucket) continue
      bucket.count += 1
      if (act.type === 'email') bucket.email += 1
      if (act.type === 'call') bucket.call += 1
      if (act.type === 'whatsapp') bucket.whatsapp += 1
    }
  }

  return buckets
}
