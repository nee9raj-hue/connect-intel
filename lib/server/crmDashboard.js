import { CRM_STATUSES } from './crm.js'
import { normalizeExtendedCrm } from './crmWorkflow.js'
import { listPipelineSavedEntries, listTeamMembers, resolveOrgRole } from './organizations.js'
import { tenantUserIds } from './tenantIsolation.js'
import { normalizeTradingProfile } from './activeTrading.js'
import { listOrgLeadTagDefinitions } from './orgLeadTags.js'
import { buildTeamIntelligence } from './teamIntelligence.js'
import { collectTouchpoints, buildActivityRollup, buildActivityRollupsForPeriods } from './crmTouchpoints.js'
import {
  normalizeDashboardPeriod,
  periodStart,
  periodWindowDays,
  previousPeriodStart,
} from './dashboardPeriod.js'

const MS_DAY = 86400000

const STAGE_WEIGHT = {
  new: 0.1,
  contacted: 0.25,
  follow_up: 0.4,
  replied: 0.65,
  won: 1,
  lost: 0,
}

function periodStartForDashboard(period) {
  return periodStart(normalizeDashboardPeriod(period))
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
  const normalized = normalizeDashboardPeriod(period)
  if (normalized === 'day') {
    const now = new Date()
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    return [
      {
        date: d.toISOString().slice(0, 10),
        label: 'Today',
        count: 0,
        email: 0,
        call: 0,
        whatsapp: 0,
        meeting: 0,
        task: 0,
        note: 0,
      },
    ]
  }
  const days = periodWindowDays(normalized)
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

export { collectTouchpoints } from './crmTouchpoints.js'

export function buildTeamDashboard(store, user, { period = 'week', memberUserId = null, light = false } = {}) {
  const dashboardPeriod = normalizeDashboardPeriod(period)
  const since = periodStartForDashboard(dashboardPeriod)
  const { accountType, orgRole } = resolveOrgRole(user, store)
  const orgId = user.organizationId
  const isAdmin = user.isOrgAdmin || orgRole === 'org_admin'

  if (accountType !== 'company' || !orgId) {
    const entries = listPipelineSavedEntries(store, user)
    const activityRollup = buildActivityRollup(store, user, entries, since)
    const teamIntelligence = buildTeamIntelligence(store, user, {
      period: dashboardPeriod,
      entries,
      isAdmin: false,
      memberUserId: user.id,
      activityRollup,
    })
    return {
      personal: true,
      period: dashboardPeriod,
      summary: orgSummary(entries, since, activityRollup.org),
      members: [],
      activityByDay: buildActivityByDay(entries, since, dashboardPeriod),
      statusBreakdown: statusBreakdownFromEntries(entries),
      valueByStage: valueByStageFromEntries(entries),
      teamSnapshot: light ? null : buildTeamSnapshot(store, user, entries, since, period),
      teamIntelligence,
    }
  }

  let scopedMemberUserId = memberUserId ? String(memberUserId) : null
  if (
    scopedMemberUserId &&
    !isAdmin &&
    scopedMemberUserId !== String(user.id)
  ) {
    scopedMemberUserId = null
  }

  const allowedUserIds = tenantUserIds(store, user)
  if (scopedMemberUserId && !allowedUserIds.has(scopedMemberUserId)) {
    scopedMemberUserId = null
  }

  const members = listTeamMembers(store, orgId)

  const allDashboardEntries = entriesForDashboard(store, user)
  let entries = allDashboardEntries

  const filterUserId = scopedMemberUserId || (!isAdmin ? user.id : null)
  if (filterUserId) {
    entries = entries.filter((e) => entryMatchesUserId(e, filterUserId))
  }

  const { current: orgActivityRollup, previous: prevOrgActivityRollup } = buildActivityRollupsForPeriods(
    store,
    user,
    allDashboardEntries,
    since,
    previousPeriodStart(dashboardPeriod),
    since
  )

  const summaryEntries = scopedMemberUserId ? entries : allDashboardEntries
  const summaryActivity =
    scopedMemberUserId && orgActivityRollup.perUser.has(scopedMemberUserId)
      ? orgActivityRollup.perUser.get(scopedMemberUserId)
      : orgActivityRollup.org

  let memberStats = []
  if (!light) {
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
  }

  const teamIntelligence = buildTeamIntelligence(store, user, {
    period: dashboardPeriod,
    entries: allDashboardEntries,
    isAdmin,
    memberUserId: scopedMemberUserId,
    activityRollup: orgActivityRollup,
    prevActivityRollup: prevOrgActivityRollup,
  })

  return {
    personal: false,
    isAdmin,
    period: dashboardPeriod,
    memberUserId: scopedMemberUserId ? String(scopedMemberUserId) : null,
    summary: orgSummary(summaryEntries, since, summaryActivity),
    members: memberStats,
    activityByDay: buildActivityByDay(allDashboardEntries, since, dashboardPeriod, scopedMemberUserId),
    statusBreakdown: statusBreakdownFromEntries(entries),
    valueByStage: valueByStageFromEntries(entries),
    memberOptions: members.map((m) => ({ userId: m.userId, name: m.name })),
    teamSnapshot: light ? null : buildTeamSnapshot(store, user, entries, since, period),
    teamIntelligence,
  }
}

function valueByStageFromEntries(entries) {
  const totals = Object.fromEntries(CRM_STATUSES.map((s) => [s, { count: 0, value: 0 }]))
  for (const entry of entries) {
    const raw = entry?.crm && typeof entry.crm === 'object' ? entry.crm : {}
    const st = CRM_STATUSES.includes(raw.status) ? raw.status : 'new'
    if (totals[st]) {
      totals[st].count += 1
      totals[st].value += Number(raw.dealValue) || 0
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

function orgSummary(entries, since, activityOrg = null) {
  let emailsSent = 0
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
    const raw = entry?.crm && typeof entry.crm === 'object' ? entry.crm : {}
    const status = CRM_STATUSES.includes(raw.status) ? raw.status : 'new'
    const deal = Number(raw.dealValue) || 0
    const weight = STAGE_WEIGHT[status] ?? 0.15
    const score = Number(raw.leadScore) || 0

    if (status !== 'new') contacted += 1
    if (status === 'won') {
      won += 1
      wonValue += deal
    }
    if (status === 'follow_up') needsFollowUp += 1
    if (status !== 'won' && status !== 'lost') {
      pipelineValue += deal
      weightedPipelineValue += deal * weight
    }

    scoreSum += score
    const last = raw.lastCommunicationAt || raw.lastEmailSentAt || entry.savedAt
    if (last && now - new Date(last).getTime() > 7 * MS_DAY && status !== 'won' && status !== 'lost') {
      staleLeads += 1
    }

    for (const em of raw.emails || []) {
      if (em.sentAt && inPeriod(em.sentAt, since)) emailsSent += 1
    }
    if (entry.lead?.emailBouncedAt) bouncedEmails += 1
    for (const m of raw.meetings || []) {
      if (m.scheduledAt && new Date(m.scheduledAt).getTime() > now) meetingsUpcoming += 1
    }
  }

  return {
    totalLeads: entries.length,
    contacted,
    emailsSent: activityOrg?.emails ?? emailsSent,
    meetingsUpcoming,
    activitiesInPeriod: activityOrg?.activitiesTotal ?? 0,
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

function buildActivityByDay(entries, since, period, actorUserId = null) {
  const buckets = buildUtcDayBuckets(period)
  const bucketMap = Object.fromEntries(buckets.map((b) => [b.date, b]))
  const actorId = actorUserId ? String(actorUserId) : null

  for (const entry of entries || []) {
    for (const point of collectTouchpoints(entry, since, Infinity, {
      actorUserId: actorId,
      strictActor: true,
    })) {
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

  const communicationByMode = {
    email: 0,
    call: 0,
    meeting: 0,
    whatsapp: 0,
    other: 0,
  }
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
  const maxRecentComms = 8

  for (const entry of entries) {
    const raw = entry?.crm && typeof entry.crm === 'object' ? entry.crm : {}
    const lead = entry.lead || {}
    const leadName =
      [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || lead.name || 'Lead'

    const lastComm = raw.lastCommunicationAt || raw.lastEmailSentAt
    if (lastComm) {
      if (!orgLatestCommAt || lastComm > orgLatestCommAt) {
        orgLatestCommAt = lastComm
        orgLatestCommType = raw.lastCommunicationType || (raw.lastEmailSentAt ? 'email' : null)
        orgLatestCommSummary = raw.lastCommunicationSummary || ''
        orgLatestLeadName = leadName
      }
      recentCommunications.push({
        leadId: lead.id,
        leadName,
        at: lastComm,
        type: raw.lastCommunicationType || 'email',
        summary: raw.lastCommunicationSummary || '',
      })
      if (recentCommunications.length > maxRecentComms * 4) {
        recentCommunications.sort((a, b) => String(b.at).localeCompare(String(a.at)))
        recentCommunications.length = maxRecentComms
      }
    }

    const profile = normalizeTradingProfile(entry.tradingProfile)
    const isActiveCustomer =
      profile?.active || raw.status === 'active_trading' || Boolean(profile?.firstShipmentAt)
    if (isActiveCustomer || raw.status === 'active_trading') {
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
        if (now - new Date(lastShip).getTime() > days60 && raw.status !== 'new') {
          churnCandidates += 1
        }
      } else if (raw.status !== 'new' && raw.status !== 'lost') {
        noTrade60Days += 1
        churnCandidates += 1
      }
    }

    const deal = Number(raw.dealValue) || 0
    if (deal > 0 && (raw.tagIds || []).length) {
      const share = deal / raw.tagIds.length
      for (const tagId of raw.tagIds) {
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
