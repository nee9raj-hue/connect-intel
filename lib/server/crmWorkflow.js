import { createId } from './store.js'
import { CRM_STATUSES, defaultCrm } from './crm.js'

export const ACTIVITY_TYPES = [
  'note',
  'email',
  'whatsapp',
  'call',
  'meeting',
  'field_visit',
  'task',
  'status',
  'assignment',
  'transfer',
]

export const MEETING_TYPES = ['call', 'video', 'field_visit', 'office']

const MS_DAY = 86400000

function capList(list, max = 80) {
  return Array.isArray(list) ? list.slice(0, max) : []
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
  if (entry.assignedToUserId === user.id || entry.savedByUserId === user.id) return true
  return false
}

export function defaultExtendedCrmFields() {
  return {
    nextFollowUpAt: null,
    lastCommunicationAt: null,
    lastCommunicationType: null,
    lastCommunicationSummary: '',
    activities: [],
    tasks: [],
    meetings: [],
  }
}

export function normalizeExtendedCrm(crm) {
  const base = defaultCrm()
  const extra = crm && typeof crm === 'object' ? crm : {}
  return {
    ...base,
    ...defaultExtendedCrmFields(),
    ...extra,
    status: CRM_STATUSES.includes(extra.status) ? extra.status : base.status,
    emails: capList(extra.emails ?? base.emails, 50),
    activities: capList(extra.activities, 80),
    tasks: capList(extra.tasks, 200),
    meetings: capList(extra.meetings, 200),
  }
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

export function recordFieldVisit(crm, meetingId, payload, user) {
  const normalized = normalizeExtendedCrm(crm)
  const meeting = normalized.meetings.find((m) => m.id === meetingId)
  if (!meeting) throw new Error('Meeting not found')

  meeting.visitRecordedAt = new Date().toISOString()
  meeting.visitOutcome = String(payload.outcome || 'completed').slice(0, 100)
  meeting.visitNotes = String(payload.notes || '').slice(0, 2000)
  if (payload.location) meeting.location = String(payload.location).slice(0, 300)

  return appendActivity(normalized, {
    type: 'field_visit',
    summary: `Field visit logged: ${meeting.title} — ${meeting.visitOutcome}`,
    userId: user.userId,
    userName: user.name,
    meta: { meetingId, visitOutcome: meeting.visitOutcome },
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
    const crm = normalizeExtendedCrm(entry.crm)
    const lead = entry.lead || {}
    const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company || 'Lead'
    for (const act of crm.activities) {
      rows.push({
        ...act,
        leadId: lead.id,
        leadName,
        company: lead.company,
      })
    }
  }
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit)
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
