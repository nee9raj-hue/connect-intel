import { normalizeExtendedCrm } from './crmWorkflow.js'
import { collectUpcomingReminders } from './crmWorkflow.js'
import { listCalendarPipelineEntries } from './organizations.js'

const REMINDER_LEAD_MS = 30 * 60 * 1000

function leadName(lead) {
  const name = [lead?.firstName, lead?.lastName].filter(Boolean).join(' ').trim()
  return name || lead?.company || 'Lead'
}

function parseSince(since) {
  if (!since) return Date.now() - 60 * 1000
  const t = new Date(since).getTime()
  return Number.isNaN(t) ? Date.now() - 60 * 1000 : t
}

function entriesWithUpcomingCalendarRaw(entries, withinHours) {
  const now = Date.now()
  const horizon = now + withinHours * 60 * 60 * 1000
  const floor = now - 5 * 60 * 1000
  return entries.filter((entry) => {
    const crm = entry.crm && typeof entry.crm === 'object' ? entry.crm : {}
    if (crm.nextFollowUpAt) {
      const at = new Date(crm.nextFollowUpAt).getTime()
      if (!Number.isNaN(at) && at >= floor && at <= horizon) return true
    }
    for (const m of crm.meetings || []) {
      if (!m?.scheduledAt) continue
      const at = new Date(m.scheduledAt).getTime()
      if (!Number.isNaN(at) && at >= floor && at <= horizon && !m.visitRecordedAt) return true
    }
    for (const t of crm.tasks || []) {
      if (t?.completed) continue
      const when = t.dueAt || t.createdAt
      if (!when) continue
      const at = new Date(when).getTime()
      if (!Number.isNaN(at) && at >= floor && at <= horizon) return true
    }
    return false
  })
}

export function buildCrmNotifications(store, user, { since } = {}) {
  const sinceMs = parseSince(since)
  const now = Date.now()
  const items = []
  const savedLeads = Array.isArray(store?.savedLeads) ? store.savedLeads : []
  const allEntries = listCalendarPipelineEntries({ ...store, savedLeads }, user)
  const recentForFeed = allEntries
    .slice()
    .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
    .slice(0, 500)

  for (const entry of recentForFeed) {
    const lead = entry.lead || {}
    const leadId = lead.id
    if (!leadId) continue
    const name = leadName(lead)
    const crm = normalizeExtendedCrm(entry.crm)

    if (
      entry.assignedToUserId === user.id &&
      entry.assignedAt &&
      new Date(entry.assignedAt).getTime() > sinceMs &&
      entry.assignedByUserId &&
      entry.assignedByUserId !== user.id
    ) {
      items.push({
        id: `assign-${entry.id}-${entry.assignedAt}`,
        type: 'assignment',
        title: 'New lead assigned to you',
        body: `${name}${lead.company ? ` · ${lead.company}` : ''}`,
        leadId,
        createdAt: entry.assignedAt,
      })
    }

    for (const em of crm.emails || []) {
      if (em.direction !== 'inbound' || !em.sentAt) continue
      const at = new Date(em.sentAt).getTime()
      if (at <= sinceMs) continue
      items.push({
        id: `reply-${em.id || `${leadId}-${at}`}`,
        type: 'reply',
        title: `New reply from ${name}`,
        body: em.subject || 'Reply received',
        leadId,
        createdAt: em.sentAt,
      })
    }

    for (const act of crm.activities || []) {
      if (act.type !== 'email_inbound' || !act.createdAt) continue
      const at = new Date(act.createdAt).getTime()
      if (at <= sinceMs) continue
      const id = `reply-act-${act.id}`
      if (items.some((i) => i.id === id)) continue
      items.push({
        id,
        type: 'reply',
        title: `New reply from ${name}`,
        body: act.summary || 'Reply logged in CRM',
        leadId,
        createdAt: act.createdAt,
      })
    }

    if (crm.nextFollowUpAt) {
      const at = new Date(crm.nextFollowUpAt).getTime()
      if (at > sinceMs && at <= now + 24 * 60 * 60 * 1000 && at >= now - 5 * 60 * 1000) {
        items.push({
          id: `follow-${leadId}-${crm.nextFollowUpAt}`,
          type: 'follow_up',
          title: 'Follow-up due',
          body: `${name} · ${crm.lastCommunicationSummary || 'Check in today'}`,
          leadId,
          createdAt: crm.nextFollowUpAt,
        })
      }
    }
  }

  const reminderEntries = entriesWithUpcomingCalendarRaw(allEntries, 48)
  const reminders = collectUpcomingReminders(reminderEntries, user, { withinHours: 48 })
  for (const item of reminders) {
    const at = new Date(item.scheduledAt).getTime()
    const remindAt = at - REMINDER_LEAD_MS
    if (now < remindAt || now > at + 10 * 60 * 1000) continue
    if (item.reminderSentAt) continue

    const id = `cal-${item.leadId}-${item.meetingId || item.taskId || 'fu'}-${item.scheduledAt}`
    if (items.some((i) => i.id === id)) continue

    const label =
      item.kind === 'meeting'
        ? 'Meeting starting soon'
        : item.kind === 'task'
          ? 'Task due soon'
          : 'Follow-up reminder'

    items.push({
      id,
      type: item.kind === 'meeting' ? 'meeting' : item.kind === 'task' ? 'task' : 'follow_up',
      title: label,
      body: `${item.leadName} · ${item.title}`,
      leadId: item.leadId,
      createdAt: item.reminderDueAt || item.scheduledAt,
      scheduledAt: item.scheduledAt,
      meetingId: item.meetingId || null,
      taskId: item.taskId || null,
    })
  }

  for (const msg of store.chithiMessages || []) {
    if (msg.organizationId !== user.organizationId) continue
    if (msg.authorUserId === user.id) continue
    const at = new Date(msg.createdAt).getTime()
    if (at <= sinceMs) continue
    const channel = (store.chithiChannels || []).find((c) => c.id === msg.channelId)
    if (!channel || channel.type !== 'public') continue
    const leadId = msg.leadMentions?.[0]?.leadId || null
    items.push({
      id: `chithi-${msg.id}`,
      type: 'team_note',
      title: `#${channel.name || 'general'} · ${msg.authorName || 'teammate'}`,
      body: String(msg.body || '').slice(0, 120),
      leadId,
      createdAt: msg.createdAt,
    })
  }

  for (const note of store.teamNotes || []) {
    if (note.organizationId !== user.organizationId) continue
    if (note.recipientUserId !== user.id) continue
    const at = new Date(note.createdAt).getTime()
    if (at <= sinceMs) continue
    const leadId = note.leadMentions?.[0]?.leadId || null
    items.push({
      id: `team-note-${note.id}`,
      type: 'team_note',
      title: `Chithi · ${note.authorName || 'teammate'}`,
      body: String(note.body || '').slice(0, 120),
      leadId,
      noteId: note.id,
      createdAt: note.createdAt,
    })
  }

  for (const task of store.teamTasks || []) {
    if (task.organizationId !== user.organizationId) continue
    if (task.assigneeUserId !== user.id) continue
    if (task.status === 'done') continue
    const at = new Date(task.createdAt).getTime()
    if (at <= sinceMs) continue
    const leadId = task.leadMentions?.[0]?.leadId || null
    items.push({
      id: `team-task-${task.id}`,
      type: 'team_task',
      title: `Task: ${task.title}`,
      body: String(task.body || task.title || '').slice(0, 120),
      leadId,
      taskId: task.id,
      createdAt: task.createdAt,
      scheduledAt: task.dueAt || null,
    })
  }

  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const seen = new Set()
  const deduped = []
  for (const row of items) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    deduped.push(row)
  }

  return {
    items: deduped.slice(0, 40),
    serverTime: new Date().toISOString(),
  }
}
