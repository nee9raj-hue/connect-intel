import { createId } from './store.js'
import { CRM_STATUSES, DEAL_STAGES, defaultCrm, isClosedDealStage } from './crm.js'
import { normalizeVisitTravelPayload } from '../fieldVisitExpenses.js'
import { mergeFreightRfq, normalizeFreightRfq } from './freightDeal.js'

export const ACTIVITY_TYPES = [
  'note',
  'email',
  'email_inbound',
  'whatsapp',
  'call',
  'meeting',
  'field_visit',
  'task',
  'status',
  'assignment',
  'transfer',
  'form_response',
]

export const MEETING_TYPES = ['call', 'video', 'field_visit', 'office']

const MS_DAY = 86400000

function capList(list, max = 80) {
  return Array.isArray(list) ? list.slice(0, max) : []
}

function capListByDate(list, max, dateField = 'createdAt') {
  if (!Array.isArray(list) || !list.length) return []
  return list
    .slice()
    .sort((a, b) => new Date(b[dateField] || 0) - new Date(a[dateField] || 0))
    .slice(0, max)
}

export function resolveEntryCrm(entry) {
  if (entry?.crm && typeof entry.crm === 'object') return entry.crm
  if (entry?.lead?.crm && typeof entry.lead.crm === 'object') return entry.lead.crm
  return {}
}

function uniqueIds(ids) {
  return [...new Set((ids || []).filter(Boolean).map(String))]
}

export function normalizeParticipantIds(primaryUserId, extraIds = []) {
  return uniqueIds([primaryUserId, ...extraIds])
}

function userCanSeeCalendarEvent(user, eventMeta, entry) {
  if (user.isOrgAdmin || user.orgRole === 'org_admin') return true
  const related = new Set(
    normalizeParticipantIds(eventMeta.assignedToUserId, [
      eventMeta.createdByUserId,
      ...(eventMeta.participantUserIds || []),
    ])
  )
  if (related.has(user.id)) return true
  if (entry.assignedToUserId === user.id) return true
  return false
}

export function defaultExtendedCrmFields() {
  return {
    nextFollowUpAt: null,
    expectedCloseDate: null,
    dealValue: null,
    dealCurrency: 'INR',
    leadScore: null,
    customFields: {},
    tagIds: [],
    lastCommunicationAt: null,
    lastCommunicationType: null,
    lastCommunicationSummary: '',
    activities: [],
    tasks: [],
    meetings: [],
    deals: [],
    primaryDealId: null,
  }
}

function normalizeDealAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  return Math.max(0, Number(raw) || 0)
}

export function normalizeDealRow(raw = {}, now = new Date().toISOString()) {
  const stage = DEAL_STAGES.includes(raw.stage) ? raw.stage : 'new'
  const closed = isClosedDealStage(stage)
  return {
    id: raw.id || createId('deal'),
    name: String(raw.name || 'Deal').slice(0, 200),
    stage,
    amount: normalizeDealAmount(raw.amount),
    currency: raw.currency === 'USD' ? 'USD' : 'INR',
    expectedCloseDate: raw.expectedCloseDate || null,
    wonAt: raw.wonAt || (stage === 'won' ? now : null),
    lostAt: raw.lostAt || (stage === 'lost' ? now : null),
    lostReason: String(raw.lostReason || '').slice(0, 500),
    notes: String(raw.notes || '').slice(0, 2000),
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    createdByUserId: raw.createdByUserId || null,
    createdByName: raw.createdByName || '',
    freight: raw.freight ? normalizeFreightRfq(raw.freight) : null,
  }
}

export function normalizeDealsList(list) {
  if (!Array.isArray(list)) return []
  const byId = new Map()
  for (const row of list) {
    const deal = normalizeDealRow(row)
    byId.set(deal.id, deal)
  }
  return [...byId.values()]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 50)
}

export function computeDealAggregates(deals) {
  const rows = normalizeDealsList(deals)
  const open = rows.filter((d) => !isClosedDealStage(d.stage))
  const openValue = open.reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
  const closeDates = open
    .map((d) => d.expectedCloseDate)
    .filter(Boolean)
    .sort()
  return {
    openValue: open.length ? openValue : null,
    wonValue: rows.filter((d) => d.stage === 'won').reduce((sum, d) => sum + (Number(d.amount) || 0), 0),
    nextCloseDate: closeDates[0] || null,
  }
}

function migrateLegacyDealFields(crm) {
  const existing = normalizeDealsList(crm?.deals)
  if (existing.length) {
    return {
      deals: existing,
      primaryDealId: crm?.primaryDealId || existing[0]?.id || null,
    }
  }
  const legacyAmount = normalizeDealAmount(crm?.dealValue)
  const hasLegacy = legacyAmount != null && legacyAmount > 0
  if (!hasLegacy && !crm?.expectedCloseDate) {
    return { deals: [], primaryDealId: null }
  }
  let stage = CRM_STATUSES.includes(crm?.status) ? crm.status : 'new'
  if (stage === 'active_trading') stage = 'won'
  if (!DEAL_STAGES.includes(stage)) stage = 'new'
  const now = new Date().toISOString()
  const deal = normalizeDealRow({
    name: 'Primary deal',
    stage,
    amount: legacyAmount,
    currency: crm?.dealCurrency,
    expectedCloseDate: crm?.expectedCloseDate,
    wonAt: stage === 'won' ? now : null,
    lostAt: stage === 'lost' ? now : null,
  })
  return { deals: [deal], primaryDealId: deal.id }
}

function applyDealAggregates(crm) {
  const { openValue, nextCloseDate } = computeDealAggregates(crm.deals)
  if (crm.deals?.length) {
    crm.dealValue = openValue
    crm.expectedCloseDate = nextCloseDate
  }
  return crm
}

function dealStageLabel(stage) {
  return String(stage || 'new').replace(/_/g, ' ')
}

function finishDealMutation(crm, activity) {
  let next = applyDealAggregates(crm)
  if (activity) next = appendActivity(next, activity)
  return next
}

export function normalizeExtendedCrm(crm) {
  const base = defaultCrm()
  const extra = crm && typeof crm === 'object' ? crm : {}
  const migrated = migrateLegacyDealFields(extra)
  const normalized = {
    ...base,
    ...defaultExtendedCrmFields(),
    ...extra,
    status: CRM_STATUSES.includes(extra.status) ? extra.status : base.status,
    emails: capList(extra.emails ?? base.emails, 50),
    activities: capListByDate(extra.activities, 80),
    tasks: capListByDate(extra.tasks, 200),
    meetings: capListByDate(extra.meetings, 200, 'scheduledAt'),
    deals: normalizeDealsList(migrated.deals),
    primaryDealId: extra.primaryDealId || migrated.primaryDealId || null,
    dealValue:
      extra.dealValue === null || extra.dealValue === undefined || extra.dealValue === ''
        ? null
        : Math.max(0, Number(extra.dealValue) || 0),
    dealCurrency: extra.dealCurrency === 'USD' ? 'USD' : 'INR',
    expectedCloseDate: extra.expectedCloseDate || null,
    leadScore:
      extra.leadScore === null || extra.leadScore === undefined
        ? null
        : Math.max(0, Math.min(100, Number(extra.leadScore) || 0)),
    customFields:
      extra.customFields && typeof extra.customFields === 'object' ? { ...extra.customFields } : {},
    tagIds: uniqueIds(extra.tagIds),
  }
  return applyDealAggregates(normalized)
}

/** Merge activities, emails, tasks, meetings into one timeline for UI. */
export function buildUnifiedTimeline(crm) {
  const normalized = normalizeExtendedCrm(crm)
  const items = []

  for (const act of normalized.activities || []) {
    items.push({
      id: act.id,
      kind: 'activity',
      type: act.type,
      at: act.createdAt,
      title: act.summary,
      subtitle: act.createdByName,
      meta: act.meta,
    })
  }

  for (const em of normalized.emails || []) {
    items.push({
      id: em.id || `email-${em.sentAt}`,
      kind: 'email',
      type: em.direction === 'inbound' ? 'email_inbound' : 'email',
      at: em.sentAt,
      title: em.subject || '(no subject)',
      subtitle: em.direction === 'inbound' ? 'Inbound' : 'Sent',
    })
  }

  for (const t of normalized.tasks || []) {
    if (!t.createdAt) continue
    items.push({
      id: t.id,
      kind: 'task',
      type: 'task',
      at: t.createdAt,
      title: t.title,
      subtitle: t.completedAt ? 'Completed' : t.dueAt ? `Due ${t.dueAt}` : 'Open',
    })
  }

  for (const m of normalized.meetings || []) {
    items.push({
      id: m.id,
      kind: 'meeting',
      type: 'meeting',
      at: m.scheduledAt || m.createdAt,
      title: m.title,
      subtitle: m.type || 'meeting',
    })
  }

  return items
    .filter((i) => i.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

export function appendActivity(crm, { type, summary, userId, userName, meta = null }) {
  const normalized = normalizeExtendedCrm(crm)
  const activity = {
    id: createId('act'),
    type: ACTIVITY_TYPES.includes(type) ? type : 'note',
    summary: String(summary || '').slice(0, 500),
    createdAt: new Date().toISOString(),
    createdByUserId: userId,
    createdByName: userName || 'User',
    meta: meta || null,
  }
  normalized.activities = [activity, ...normalized.activities].slice(0, 80)
  if (activity.summary) {
    normalized.lastCommunicationAt = activity.createdAt
    normalized.lastCommunicationType = activity.type
    normalized.lastCommunicationSummary = activity.summary
  }
  return normalized
}

export function addDeal(crm, payload, creator) {
  const normalized = normalizeExtendedCrm(crm)
  const deal = normalizeDealRow({
    name: payload.name,
    stage: payload.stage || 'new',
    amount: payload.amount,
    currency: payload.currency,
    expectedCloseDate: payload.expectedCloseDate,
    notes: payload.notes,
    freight: payload.freight ? normalizeFreightRfq(payload.freight) : null,
    createdByUserId: creator.userId,
    createdByName: creator.name,
  })
  normalized.deals = [deal, ...normalized.deals].slice(0, 50)
  if (!normalized.primaryDealId) normalized.primaryDealId = deal.id
  const amountLabel = deal.amount != null ? ` · ₹${deal.amount.toLocaleString('en-IN')}` : ''
  return {
    crm: finishDealMutation(normalized, {
      type: 'status',
      summary: `Deal created: ${deal.name}${amountLabel}`,
      userId: creator.userId,
      userName: creator.name,
      meta: { dealId: deal.id, dealStage: deal.stage },
    }),
    deal,
  }
}

export function updateDeal(crm, dealId, patch, actor) {
  const normalized = normalizeExtendedCrm(crm)
  const deal = normalized.deals.find((d) => d.id === dealId)
  if (!deal) return normalized
  const prevStage = deal.stage
  if (patch.name !== undefined) deal.name = String(patch.name || 'Deal').slice(0, 200)
  if (patch.stage !== undefined && DEAL_STAGES.includes(patch.stage)) {
    deal.stage = patch.stage
    if (patch.stage === 'won') {
      deal.wonAt = new Date().toISOString()
      deal.lostAt = null
      deal.lostReason = ''
    } else if (patch.stage === 'lost') {
      deal.lostAt = new Date().toISOString()
      deal.wonAt = null
    } else {
      deal.wonAt = null
      deal.lostAt = null
      deal.lostReason = ''
    }
  }
  if (patch.amount !== undefined) deal.amount = normalizeDealAmount(patch.amount)
  if (patch.expectedCloseDate !== undefined) deal.expectedCloseDate = patch.expectedCloseDate || null
  if (patch.notes !== undefined) deal.notes = String(patch.notes || '').slice(0, 2000)
  if (patch.lostReason !== undefined) deal.lostReason = String(patch.lostReason || '').slice(0, 500)
  if (patch.freight !== undefined) {
    deal.freight = mergeFreightRfq(deal.freight, patch.freight)
  }
  deal.updatedAt = new Date().toISOString()
  const stageChanged = patch.stage !== undefined && patch.stage !== prevStage
  const summary = stageChanged
    ? `Deal "${deal.name}" moved to ${dealStageLabel(deal.stage)}`
    : `Deal updated: ${deal.name}`
  return finishDealMutation(normalized, {
    type: 'status',
    summary,
    userId: actor.userId,
    userName: actor.name,
    meta: { dealId: deal.id, dealStage: deal.stage, previousStage: prevStage },
  })
}

export function closeDealWon(crm, dealId, actor) {
  return updateDeal(crm, dealId, { stage: 'won' }, actor)
}

export function closeDealLost(crm, dealId, { lostReason = '' } = {}, actor) {
  const normalized = normalizeExtendedCrm(crm)
  const deal = normalized.deals.find((d) => d.id === dealId)
  if (!deal) return normalized
  deal.stage = 'lost'
  deal.lostAt = new Date().toISOString()
  deal.wonAt = null
  deal.lostReason = String(lostReason || '').slice(0, 500)
  deal.updatedAt = new Date().toISOString()
  return finishDealMutation(normalized, {
    type: 'status',
    summary: `Deal lost: ${deal.name}${deal.lostReason ? ` — ${deal.lostReason}` : ''}`,
    userId: actor.userId,
    userName: actor.name,
    meta: { dealId: deal.id, dealStage: 'lost' },
  })
}

export function addTask(crm, { title, dueAt, assignedToUserId, participantUserIds, createdByUserId, createdByName }) {
  const normalized = normalizeExtendedCrm(crm)
  const primary = assignedToUserId || createdByUserId
  const task = {
    id: createId('task'),
    title: String(title || 'Follow up').slice(0, 200),
    dueAt: dueAt || null,
    assignedToUserId: primary,
    participantUserIds: normalizeParticipantIds(primary, participantUserIds),
    createdByUserId,
    createdByName: createdByName || 'User',
    completedAt: null,
    googleEventId: null,
    googleHtmlLink: null,
    createdAt: new Date().toISOString(),
  }
  normalized.tasks = [task, ...normalized.tasks].slice(0, 200)
  if (task.dueAt && (!normalized.nextFollowUpAt || task.dueAt < normalized.nextFollowUpAt)) {
    normalized.nextFollowUpAt = task.dueAt
  }
  return {
    crm: appendActivity(normalized, {
      type: 'task',
      summary: `Task assigned: ${task.title}`,
      userId: createdByUserId,
      userName: createdByName,
      meta: { taskId: task.id, assignedToUserId: task.assignedToUserId },
    }),
    task,
  }
}

export function completeTask(crm, taskId, userId, userName) {
  const normalized = normalizeExtendedCrm(crm)
  const task = normalized.tasks.find((t) => t.id === taskId)
  if (!task) return normalized
  task.completedAt = new Date().toISOString()
  return appendActivity(normalized, {
    type: 'task',
    summary: `Task completed: ${task.title}`,
    userId,
    userName,
    meta: { taskId },
  })
}

export function addMeeting(crm, payload, creator) {
  const normalized = normalizeExtendedCrm(crm)
  const primary = payload.assignedToUserId || creator.userId
  const meeting = {
    id: createId('mtg'),
    title: String(payload.title || 'Meeting').slice(0, 200),
    scheduledAt: payload.scheduledAt,
    durationMinutes: Number(payload.durationMinutes) || 30,
    type: MEETING_TYPES.includes(payload.type) ? payload.type : 'call',
    location: String(payload.location || '').slice(0, 300),
    notes: String(payload.notes || '').slice(0, 2000),
    assignedToUserId: primary,
    participantUserIds: normalizeParticipantIds(primary, payload.participantUserIds),
    createdByUserId: creator.userId,
    createdByName: creator.name || 'User',
    reminderSentAt: null,
    visitRecordedAt: null,
    visitOutcome: null,
    visitNotes: null,
    googleEventId: null,
    googleHtmlLink: null,
    createdAt: new Date().toISOString(),
  }
  normalized.meetings = [meeting, ...normalized.meetings].slice(0, 200)
  if (
    meeting.scheduledAt &&
    (!normalized.nextFollowUpAt || meeting.scheduledAt < normalized.nextFollowUpAt)
  ) {
    normalized.nextFollowUpAt = meeting.scheduledAt
  }
  const typeLabel =
    meeting.type === 'field_visit' ? 'Field visit' : meeting.type === 'call' ? 'Call' : 'Meeting'
  return {
    crm: appendActivity(normalized, {
      type: meeting.type === 'field_visit' ? 'field_visit' : 'meeting',
      summary: `${typeLabel} scheduled: ${meeting.title} · ${formatWhen(meeting.scheduledAt)}`,
      userId: creator.userId,
      userName: creator.name,
      meta: { meetingId: meeting.id },
    }),
    meeting,
  }
}

function applyFieldVisitPayload(meeting, payload, user, orgSettings, { isUpdate = false } = {}) {
  const recordedAt = payload.visitAt || meeting.actualVisitAt || new Date().toISOString()
  if (!isUpdate) meeting.visitRecordedAt = new Date().toISOString()
  meeting.actualVisitAt = recordedAt
  meeting.visitOutcome = String(payload.outcome || 'completed').slice(0, 100)
  meeting.visitNotes = String(payload.notes || '').slice(0, 2000)
  if (!meeting.visitLoggedByUserId) meeting.visitLoggedByUserId = user.userId
  if (isUpdate) {
    meeting.visitUpdatedAt = new Date().toISOString()
    meeting.visitUpdatedByUserId = user.userId
  }
  if (payload.location) meeting.location = String(payload.location).slice(0, 300)
  if (payload.title) meeting.title = String(payload.title).slice(0, 200)

  if (payload.travel && orgSettings) {
    meeting.visitTravel = normalizeVisitTravelPayload(
      { ...payload.travel, visitAt: recordedAt },
      orgSettings
    )
  }
}

export function recordFieldVisit(crm, meetingId, payload, user, orgSettings) {
  let normalized = normalizeExtendedCrm(crm)
  let meeting = meetingId ? normalized.meetings.find((m) => m.id === meetingId) : null

  if (!meeting && payload.quickLog) {
    const visitAt = payload.visitAt || new Date().toISOString()
    const added = addMeeting(
      normalized,
      {
        title: String(payload.title || 'Field visit').slice(0, 200),
        scheduledAt: visitAt,
        type: 'field_visit',
        location: payload.location || payload.travel?.endLabel || '',
        notes: payload.notes || '',
        assignedToUserId: user.userId,
      },
      user
    )
    normalized = added.crm
    meeting = added.meeting
  }

  if (!meeting) throw new Error('Meeting not found')

  applyFieldVisitPayload(meeting, payload, user, orgSettings, { isUpdate: false })

  const claimHint =
    meeting.visitTravel?.claimAmount > 0
      ? ` · ${meeting.visitTravel.currency === 'INR' ? '₹' : ''}${meeting.visitTravel.claimAmount}`
      : ''

  return appendActivity(normalized, {
    type: 'field_visit',
    summary: `Field visit logged: ${meeting.title} — ${meeting.visitOutcome}${claimHint}`,
    userId: user.userId,
    userName: user.name,
    meta: {
      meetingId: meeting.id,
      visitOutcome: meeting.visitOutcome,
      claimAmount: meeting.visitTravel?.claimAmount ?? null,
    },
  })
}

export function updateFieldVisit(crm, meetingId, payload, user, orgSettings) {
  const normalized = normalizeExtendedCrm(crm)
  const meeting = normalized.meetings.find((m) => m.id === meetingId)
  if (!meeting) throw new Error('Meeting not found')
  if (!meeting.visitRecordedAt) throw new Error('This visit has not been recorded yet')

  applyFieldVisitPayload(meeting, payload, user, orgSettings, { isUpdate: true })

  const claimHint =
    meeting.visitTravel?.claimAmount > 0
      ? ` · ${meeting.visitTravel.currency === 'INR' ? '₹' : ''}${meeting.visitTravel.claimAmount}`
      : ''

  return appendActivity(normalized, {
    type: 'field_visit',
    summary: `Field visit updated: ${meeting.title} — ${meeting.visitOutcome}${claimHint}`,
    userId: user.userId,
    userName: user.name,
    meta: {
      meetingId: meeting.id,
      visitOutcome: meeting.visitOutcome,
      claimAmount: meeting.visitTravel?.claimAmount ?? null,
      updated: true,
    },
  })
}

export function markMeetingReminderSent(crm, meetingId) {
  const normalized = normalizeExtendedCrm(crm)
  const meeting = normalized.meetings.find((m) => m.id === meetingId)
  if (meeting) meeting.reminderSentAt = new Date().toISOString()
  return normalized
}

function eventTimeStatus(atMs, now) {
  if (atMs < now - 5 * 60 * 1000) return 'past'
  return 'upcoming'
}

export function collectCalendarEvents(entries, user, { fromMs, toMs } = {}) {
  const now = Date.now()
  const rangeStart = fromMs ?? now - 90 * MS_DAY
  const rangeEnd = toMs ?? now + 365 * MS_DAY
  const events = []

  for (const entry of entries) {
    const crm = normalizeExtendedCrm(entry.crm)
    const lead = entry.lead || {}
    const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || 'Lead'
    const company = lead.company || ''

    for (const task of crm.tasks) {
      const when = task.dueAt || task.createdAt
      if (!when) continue
      const at = new Date(when).getTime()
      if (Number.isNaN(at) || at < rangeStart || at > rangeEnd) continue
      const meta = {
        assignedToUserId: task.assignedToUserId,
        createdByUserId: task.createdByUserId,
        participantUserIds: task.participantUserIds,
      }
      if (!userCanSeeCalendarEvent(user, meta, entry)) continue

      events.push({
        id: `task-${task.id}`,
        kind: 'task',
        taskId: task.id,
        leadId: lead.id,
        leadName,
        company,
        title: task.title,
        scheduledAt: when,
        endAt: null,
        dueAt: task.dueAt || null,
        assignedToUserId: task.assignedToUserId,
        participantUserIds: task.participantUserIds || [],
        createdByUserId: task.createdByUserId,
        createdByName: task.createdByName,
        completedAt: task.completedAt,
        googleEventId: task.googleEventId || null,
        googleHtmlLink: task.googleHtmlLink || null,
        timeStatus: task.completedAt ? 'completed' : eventTimeStatus(at, now),
      })
    }

    for (const meeting of crm.meetings) {
      if (!meeting.scheduledAt) continue
      const at = new Date(meeting.scheduledAt).getTime()
      if (Number.isNaN(at) || at < rangeStart || at > rangeEnd) continue
      const meta = {
        assignedToUserId: meeting.assignedToUserId,
        createdByUserId: meeting.createdByUserId,
        participantUserIds: meeting.participantUserIds,
      }
      if (!userCanSeeCalendarEvent(user, meta, entry)) continue

      const durationMs = (Number(meeting.durationMinutes) || 30) * 60 * 1000
      let timeStatus = eventTimeStatus(at, now)
      if (meeting.visitRecordedAt || meeting.completedAt) timeStatus = 'completed'
      else if (at + durationMs < now) timeStatus = 'past'

      events.push({
        id: `meeting-${meeting.id}`,
        kind: 'meeting',
        meetingId: meeting.id,
        leadId: lead.id,
        leadName,
        company,
        title: meeting.title,
        scheduledAt: meeting.scheduledAt,
        endAt: new Date(at + durationMs).toISOString(),
        type: meeting.type,
        location: meeting.location,
        notes: meeting.notes,
        assignedToUserId: meeting.assignedToUserId,
        participantUserIds: meeting.participantUserIds || [],
        createdByUserId: meeting.createdByUserId,
        createdByName: meeting.createdByName,
        visitRecordedAt: meeting.visitRecordedAt,
        visitOutcome: meeting.visitOutcome,
        reminderSentAt: meeting.reminderSentAt,
        googleEventId: meeting.googleEventId || null,
        googleHtmlLink: meeting.googleHtmlLink || null,
        timeStatus,
      })
    }

    if (crm.nextFollowUpAt) {
      const at = new Date(crm.nextFollowUpAt).getTime()
      if (!Number.isNaN(at) && at >= rangeStart && at <= rangeEnd) {
        if (userCanSeeCalendarEvent(user, { assignedToUserId: entry.assignedToUserId }, entry)) {
          events.push({
            id: `follow-${lead.id}-${crm.nextFollowUpAt}`,
            kind: 'follow_up',
            leadId: lead.id,
            leadName,
            company,
            title: crm.lastCommunicationSummary || 'Follow up',
            scheduledAt: crm.nextFollowUpAt,
            endAt: null,
            timeStatus: eventTimeStatus(at, now),
          })
        }
      }
    }
  }

  return events.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
}

export function collectUpcomingReminders(entries, user, { withinHours = 48 } = {}) {
  const now = Date.now()
  const horizon = now + withinHours * 60 * 60 * 1000
  const events = collectCalendarEvents(entries, user, {
    fromMs: now - 5 * 60 * 1000,
    toMs: horizon,
  })

  return events
    .filter((e) => e.timeStatus === 'upcoming' && (e.kind !== 'meeting' || !e.visitRecordedAt))
    .map((e) => ({
      kind: e.kind,
      leadId: e.leadId,
      leadName: e.leadName,
      meetingId: e.meetingId,
      taskId: e.taskId,
      title: e.title,
      scheduledAt: e.scheduledAt,
      type: e.type,
      location: e.location,
      reminderDueAt: new Date(new Date(e.scheduledAt).getTime() - 30 * 60 * 1000).toISOString(),
      reminderSentAt: e.reminderSentAt,
    }))
}

export function buildActivityFeed(entries, { limit = 50 } = {}) {
  const rows = []
  for (const entry of entries) {
    const raw = resolveEntryCrm(entry)
    const crm = normalizeExtendedCrm(raw)
    const activities = Array.isArray(raw.activities) ? raw.activities : crm.activities || []
    const lead = entry.lead || {}
    const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || 'Lead'
    for (const act of activities) {
      rows.push({
        ...act,
        leadId: lead.id,
        leadName,
        company: lead.company,
      })
    }
  }
  const sorted = rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  if (limit == null || limit <= 0) return sorted
  return sorted.slice(0, limit)
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
