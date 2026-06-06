import { CRM_STATUSES } from './crm.js'
import { normalizeExtendedCrm } from './crmWorkflow.js'
import { computeCrmLeadScore } from './crmLeadScore.js'
import { listPipelineSavedEntries, listTeamMembers, resolveOrgRole } from './organizations.js'
import { normalizeTradingProfile } from './activeTrading.js'
import { listOrgLeadTagDefinitions } from './orgLeadTags.js'
import { buildTeamIntelligence } from './teamIntelligence.js'

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
      meeting: 0,
      task: 0,
      note: 0,
    })
  }
  return buckets
}

/** Pipeline rows visible to this user (includes legacy rows without organizationId). */
function entriesForDashboard(store, user) {
  return listPipelineSavedEntries(store, user)
}

function entryAssigneeUserId(entry) {
  return String(entry.assignedToUserId || entry.savedByUserId || entry.userId || '')
}

function entryMatchesUserId(entry, userId) {
  if (!userId) return true
  return entryAssigneeUserId(entry) === String(userId)
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
    const teamIntelligence = buildTeamIntelligence(store, user, {
      period,
      entries,
      isAdmin: false,
      memberUserId: user.id,
    })
    return {
      personal: true,
      period,
      summary: orgSummary(entries, since),
      members: [],
      activityByDay: buildActivityByDay(entries, since, period),
      statusBreakdown: statusBreakdownFromEntries(entries),
      valueByStage: valueByStageFromEntries(entries),
      teamSnapshot: buildTeamSnapshot(store, user, entries, since, period),
      teamIntelligence,
    }
  }

  let entries = entriesForDashboard(store, user)

  let scopedMemberUserId = memberUserId
  if (
    scopedMemberUserId &&
    !isAdmin &&
    String(scopedMemberUserId) !== String(user.id)
  ) {
    scopedMemberUserId = null
  }

  const filterUserId = scopedMemberUserId || (!isAdmin ? user.id : null)
  if (filterUserId) {
    entries = entries.filter((e) => entryMatchesUserId(e, filterUserId))
  }

  const members = listTeamMembers(store, orgId)
  const allDashboardEntries = entriesForDashboard(store, user)
  let memberStats
  if (scopedMemberUserId) {
    const mid = String(scopedMemberUserId)
    const teamMember = members.find((m) => String(m.userId) === mid)
    memberStats = teamMember
      ? [
          {
            userId: teamMember.userId,
            name: teamMember.name,
            email: teamMember.email,
            pipelineRole: teamMember.pipelineRole,
            ...memberMetrics(entries, since),
            needsHelp: needsHelpLabel(entries, since),
          },
        ]
      : []
  } else {
    memberStats = members.map((m) => {
      const mine = allDashboardEntries.filter((e) => entryAssigneeUserId(e) === String(m.userId))
      return {
        userId: m.userId,
        name: m.name,
        email: m.email,
        pipelineRole: m.pipelineRole,
        ...memberMetrics(mine, since),
        needsHelp: needsHelpLabel(mine, since),
      }
    })
  }

  const teamIntelligence = buildTeamIntelligence(store, user, {
    period,
    entries: allDashboardEntries,
    isAdmin,
    memberUserId: scopedMemberUserId,
  })

  return {
    personal: false,
    isAdmin,
    period,
    memberUserId: scopedMemberUserId ? String(scopedMemberUserId) : null,
    summary: orgSummary(entries, since),
    members: memberStats,
    activityByDay: buildActivityByDay(entries, since, period),
    statusBreakdown: statusBreakdownFromEntries(entries),
    valueByStage: valueByStageFromEntries(entries),
    memberOptions: members.map((m) => ({ userId: m.userId, name: m.name })),
    teamSnapshot: buildTeamSnapshot(store, user, entries, since, period),
    teamIntelligence,
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
    bouncedEmails: 0,
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
  let bouncedEmails = 0
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
    if (entry.lead?.emailBouncedAt) bouncedEmails += 1
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
    bouncedEmails,
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
      const kind = bucketActivityType(point.type)
      if (kind === 'email') bucket.email += 1
      else if (kind === 'call') bucket.call += 1
      else if (kind === 'whatsapp') bucket.whatsapp += 1
      else if (kind === 'meeting') bucket.meeting += 1
      else if (kind === 'task') bucket.task += 1
      else if (kind === 'note') bucket.note += 1
    }
  }

  return buckets
}

function bucketActivityType(type) {
  const t = String(type || '').toLowerCase()
  if (t === 'email' || t === 'email_inbound') return 'email'
  if (t === 'call') return 'call'
  if (t === 'whatsapp') return 'whatsapp'
  if (t === 'meeting' || t === 'field_visit') return 'meeting'
  if (t === 'task') return 'task'
  if (t === 'note') return 'note'
  return 'other'
}

function mapTouchpointMode(type) {
  const t = String(type || '').toLowerCase()
  if (t === 'email' || t === 'email_inbound') return 'email'
  if (t === 'call') return 'call'
  if (t === 'whatsapp') return 'whatsapp'
  if (t === 'meeting' || t === 'field_visit') return 'meeting'
  return 'other'
}

function buildTeamSnapshot(store, user, entries, since, period) {
  const orgId = user.organizationId
  const now = Date.now()
  const days60 = 60 * MS_DAY
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
  const prevMonthStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1)
  ).toISOString()
  const prevMonthEnd = monthStart

  const communicationByMode = { email: 0, call: 0, meeting: 0, whatsapp: 0, other: 0 }
  let orgLatestCommAt = null
  let orgLatestCommType = null
  let orgLatestCommSummary = ''
  let orgLatestLeadName = ''

  let activeCustomers = 0
  let activeNewThisMonth = 0
  let withMultipleShipments = 0
  let latestLastShipmentAt = null
  let shipmentsLast30Days = 0
  let noTrade60Days = 0
  let churnCandidates = 0

  const tagDefs = orgId ? listOrgLeadTagDefinitions(store, orgId) : []
  const tagNameById = new Map(tagDefs.map((t) => [t.id, t.name]))
  const valueByTagId = new Map()
  let taggedDealValueTotal = 0

  const recentCommunications = []

  for (const entry of entries) {
    const crm = normalizeExtendedCrm(entry.crm)
    const lead = entry.lead || {}
    const leadName =
      [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || lead.name || 'Lead'

    for (const point of collectTouchpoints(entry, since)) {
      const mode = mapTouchpointMode(point.type)
      communicationByMode[mode] = (communicationByMode[mode] || 0) + 1
    }

    const lastComm = crm.lastCommunicationAt || crm.lastEmailSentAt
    if (lastComm) {
      if (!orgLatestCommAt || lastComm > orgLatestCommAt) {
        orgLatestCommAt = lastComm
        orgLatestCommType = crm.lastCommunicationType || (crm.lastEmailSentAt ? 'email' : null)
        orgLatestCommSummary = crm.lastCommunicationSummary || ''
        orgLatestLeadName = leadName
      }
      recentCommunications.push({
        leadId: lead.id,
        leadName,
        at: lastComm,
        type: crm.lastCommunicationType || 'email',
        summary: crm.lastCommunicationSummary || '',
      })
    }

    const profile = normalizeTradingProfile(entry.tradingProfile)
    const isActiveCustomer =
      profile?.active || crm.status === 'active_trading' || Boolean(profile?.firstShipmentAt)
    if (isActiveCustomer || crm.status === 'active_trading') {
      activeCustomers += 1
      const firstShip = profile?.firstShipmentAt
      if (firstShip && firstShip >= monthStart) activeNewThisMonth += 1
      if ((profile?.shipmentCount || 0) > 1) withMultipleShipments += 1

      const lastShip = profile?.lastShipmentAt
      if (lastShip) {
        if (!latestLastShipmentAt || lastShip > latestLastShipmentAt) {
          latestLastShipmentAt = lastShip
        }
        if (now - new Date(lastShip).getTime() <= 30 * MS_DAY) shipmentsLast30Days += 1
        if (now - new Date(lastShip).getTime() > days60 && crm.status !== 'new') {
          churnCandidates += 1
        }
      } else if (crm.status !== 'new' && crm.status !== 'lost') {
        noTrade60Days += 1
        churnCandidates += 1
      }
    }

    const deal = Number(crm.dealValue) || 0
    if (deal > 0 && (crm.tagIds || []).length) {
      const share = deal / crm.tagIds.length
      for (const tagId of crm.tagIds) {
        if (!tagNameById.has(tagId)) continue
        valueByTagId.set(tagId, (valueByTagId.get(tagId) || 0) + share)
        taggedDealValueTotal += share
      }
    }
  }

  recentCommunications.sort((a, b) => String(b.at).localeCompare(String(a.at)))

  const tagMixByValue = [...valueByTagId.entries()]
    .map(([tagId, value]) => ({
      tagId,
      name: tagNameById.get(tagId) || tagId,
      value: Math.round(value),
      percent: taggedDealValueTotal
        ? Math.round((value / taggedDealValueTotal) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12)

  return {
    period,
    periodLabel: period === 'month' ? 'This month' : 'This week',
    pipeline: {
      totalLeads: entries.length,
      statusBreakdown: statusBreakdownFromEntries(entries),
    },
    activeCustomers: {
      total: activeCustomers,
      newThisMonth: activeNewThisMonth,
      withMultipleShipments,
      shipmentsLast30Days,
      latestLastShipmentAt,
      noTrade60Days,
      churnCandidates,
    },
    communication: {
      byMode: communicationByMode,
      latest: orgLatestCommAt
        ? {
            at: orgLatestCommAt,
            type: orgLatestCommType,
            summary: orgLatestCommSummary,
            leadName: orgLatestLeadName,
          }
        : null,
      recent: recentCommunications.slice(0, 8),
    },
    revenue: {
      available: false,
      currentMonth: null,
      lastMonth: null,
      periodStart: monthStart,
      previousPeriodStart: prevMonthStart,
      previousPeriodEnd: prevMonthEnd,
      note: 'Revenue import (last 60 days) and auto-tag rules (e.g. Churn) will be added in a dedicated admin upload page.',
    },
    tagMixByValue,
    taggedDealValueTotal: Math.round(taggedDealValueTotal),
  }
}
