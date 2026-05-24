import { CRM_STATUSES } from './crm.js'
import { normalizeExtendedCrm } from './crmWorkflow.js'
import { computeCrmLeadScore } from './crmLeadScore.js'
import { listPipelineSavedEntries, listTeamMembers, resolveOrgRole } from './organizations.js'

const MS_DAY = 86400000

const STAGE_WEIGHT = {
  new: 0.1,
  contacted: 0.25,
  follow_up: 0.4,
  replied: 0.65,
  won: 1,
  lost: 0,
}

function periodStart(period) {
  const days = period === 'month' ? 30 : 7
  return Date.now() - days * MS_DAY
}

function inPeriod(iso, since) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return false
  return t >= since
}

function utcDateKey(iso) {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return new Date(t).toISOString().slice(0, 10)
}

function buildUtcDayBuckets(period) {
  const days = period === 'month' ? 30 : 7
  const buckets = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i)
    )
    buckets.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }),
      count: 0,
      email: 0,
      call: 0,
      whatsapp: 0,
    })
  }
  return buckets
}

/** Same visibility as pipeline, plus legacy rows saved before organizationId was set. */
function entriesForDashboard(store, user) {
  const orgId = user.organizationId
  let entries = listPipelineSavedEntries(store, user)

  if (!orgId) return entries

  const memberIds = new Set(listTeamMembers(store, orgId).map((m) => m.userId))
  const legacy = store.savedLeads.filter(
    (e) =>
      !e.organizationId &&
      (memberIds.has(e.userId) || memberIds.has(e.savedByUserId) || memberIds.has(e.assignedToUserId))
  )
  const seen = new Set(entries.map((e) => e.id))
  for (const row of legacy) {
    if (!seen.has(row.id)) {
      entries.push(row)
      seen.add(row.id)
    }
  }
  return entries
}

function hasEmailActivityNear(activities, sentAt) {
  const sentMs = new Date(sentAt).getTime()
  if (Number.isNaN(sentMs)) return false
  return (activities || []).some((a) => {
    if (a.type !== 'email') return false
    const actMs = new Date(a.createdAt).getTime()
    return !Number.isNaN(actMs) && Math.abs(actMs - sentMs) < 120000
  })
}

/** Touchpoints used for charts and activity counts — includes CRM activities, sent emails, and new pipeline adds. */
export function collectTouchpoints(entry, since) {
  const crm = normalizeExtendedCrm(entry.crm)
  const points = []

  for (const act of crm.activities || []) {
    if (!inPeriod(act.createdAt, since)) continue
    points.push({ at: act.createdAt, type: act.type || 'note' })
  }

  for (const em of crm.emails || []) {
    if (!em.sentAt || !inPeriod(em.sentAt, since)) continue
    if (hasEmailActivityNear(crm.activities, em.sentAt)) continue
    points.push({ at: em.sentAt, type: 'email' })
  }

  if (entry.savedAt && inPeriod(entry.savedAt, since)) {
    points.push({ at: entry.savedAt, type: 'lead' })
  }

  return points
}

function countEmailsInPeriod(crm, since) {
  const normalized = normalizeExtendedCrm(crm)
  let count = 0
  for (const em of normalized.emails || []) {
    if (em.sentAt && inPeriod(em.sentAt, since)) count += 1
  }
  if (count === 0 && normalized.lastEmailSentAt && inPeriod(normalized.lastEmailSentAt, since)) {
    count = 1
  }
  return count
}

export function buildTeamDashboard(store, user, { period = 'week', memberUserId = null } = {}) {
  const since = periodStart(period)
  const { accountType, orgRole } = resolveOrgRole(user, store)
  const orgId = user.organizationId
  const isAdmin = user.isOrgAdmin || orgRole === 'org_admin'

  if (accountType !== 'company' || !orgId) {
    const entries = listPipelineSavedEntries(store, user)
    return {
      personal: true,
      period,
      summary: orgSummary(entries, since),
      members: [],
      activityByDay: buildActivityByDay(entries, since, period),
      statusBreakdown: statusBreakdownFromEntries(entries),
      valueByStage: valueByStageFromEntries(entries),
    }
  }

  let entries = entriesForDashboard(store, user)

  if (memberUserId) {
    entries = entries.filter(
      (e) => (e.assignedToUserId || e.savedByUserId || e.userId) === memberUserId
    )
  } else if (!isAdmin) {
    entries = entries.filter(
      (e) => (e.assignedToUserId || e.savedByUserId || e.userId) === user.id
    )
  }

  const members = listTeamMembers(store, orgId)
  const memberStats = members.map((m) => {
    const mine = entriesForDashboard(store, user).filter(
      (e) => (e.assignedToUserId || e.savedByUserId || e.userId) === m.userId
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

  return {
    personal: false,
    isAdmin,
    period,
    memberUserId: memberUserId || null,
    summary: orgSummary(entries, since),
    members: memberStats,
    activityByDay: buildActivityByDay(entries, since, period),
    statusBreakdown: statusBreakdownFromEntries(entries),
    valueByStage: valueByStageFromEntries(entries),
    memberOptions: members.map((m) => ({ userId: m.userId, name: m.name })),
  }
}

function valueByStageFromEntries(entries) {
  const totals = Object.fromEntries(CRM_STATUSES.map((s) => [s, { count: 0, value: 0 }]))
  for (const entry of entries) {
    const crm = normalizeExtendedCrm(entry.crm)
    const st = crm.status || 'new'
    if (totals[st]) {
      totals[st].count += 1
      totals[st].value += Number(crm.dealValue) || 0
    }
  }
  return CRM_STATUSES.map((status) => ({
    status,
    count: totals[status]?.count || 0,
    value: Math.round(totals[status]?.value || 0),
  })).filter((row) => row.count > 0 || row.value > 0)
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
    pipelineValue: 0,
    weightedPipelineValue: 0,
    wonValue: 0,
    avgLeadScore: 0,
    staleLeads: 0,
  }
}

function orgSummary(entries, since) {
  let emailsSent = 0
  let activitiesInPeriod = 0
  let contacted = 0
  let won = 0
  let needsFollowUp = 0
  let meetingsUpcoming = 0
  let pipelineValue = 0
  let weightedPipelineValue = 0
  let wonValue = 0
  let scoreSum = 0
  let staleLeads = 0
  const now = Date.now()

  for (const entry of entries) {
    const crm = normalizeExtendedCrm(entry.crm)
    const deal = Number(crm.dealValue) || 0
    const weight = STAGE_WEIGHT[crm.status] ?? 0.15
    const score = crm.leadScore ?? computeCrmLeadScore(entry)

    if (crm.status !== 'new') contacted += 1
    if (crm.status === 'won') {
      won += 1
      wonValue += deal
    }
    if (crm.status === 'follow_up') needsFollowUp += 1
    if (crm.status !== 'won' && crm.status !== 'lost') {
      pipelineValue += deal
      weightedPipelineValue += deal * weight
    }

    scoreSum += score
    const last = crm.lastCommunicationAt || crm.lastEmailSentAt || entry.savedAt
    if (last && now - new Date(last).getTime() > 7 * MS_DAY && crm.status !== 'won' && crm.status !== 'lost') {
      staleLeads += 1
    }

    emailsSent += countEmailsInPeriod(crm, since)
    activitiesInPeriod += collectTouchpoints(entry, since).length
    for (const m of crm.meetings || []) {
      if (m.scheduledAt && new Date(m.scheduledAt).getTime() > now) meetingsUpcoming += 1
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
    pipelineValue: Math.round(pipelineValue),
    weightedPipelineValue: Math.round(weightedPipelineValue),
    wonValue: Math.round(wonValue),
    avgLeadScore: entries.length ? Math.round(scoreSum / entries.length) : 0,
    staleLeads,
  }
}

function memberMetrics(entries, since) {
  return orgSummary(entries, since)
}

function needsHelpLabel(entries, since) {
  const overdue = entries.filter((e) => {
    const crm = e.crm || {}
    if (!crm.nextFollowUpAt) return false
    return new Date(crm.nextFollowUpAt).getTime() < Date.now()
  }).length
  if (overdue > 0) return `${overdue} overdue follow-up`
  const quiet = entries.filter((e) => {
    const crm = normalizeExtendedCrm(e.crm)
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
  const buckets = buildUtcDayBuckets(period)
  const bucketMap = Object.fromEntries(buckets.map((b) => [b.date, b]))

  for (const entry of entries) {
    for (const point of collectTouchpoints(entry, since)) {
      const day = utcDateKey(point.at)
      const bucket = bucketMap[day]
      if (!bucket) continue
      bucket.count += 1
      if (point.type === 'email') bucket.email += 1
      if (point.type === 'call') bucket.call += 1
      if (point.type === 'whatsapp') bucket.whatsapp += 1
    }
  }

  return buckets
}
