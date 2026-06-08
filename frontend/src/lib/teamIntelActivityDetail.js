import { getDealStageMeta } from './crmConstants'
import { formatDealValue } from './crmTimeline'
import { formatDealSharePlainText } from './dealShareFormat'
import {
  ACTIVITY_LABELS,
  CALL_OUTCOMES,
  MEETING_TYPES,
  formatDateTime,
} from './crmUiConstants'
import { timelineTypeLabel } from './teamIntelligenceConstants'

function row(label, value) {
  if (value == null || value === '' || value === '—') return null
  return { label, value: String(value) }
}

function section(title, rows) {
  const items = rows.filter(Boolean)
  if (!items.length) return null
  return { title, rows: items }
}

function leadDisplayName(lead) {
  return [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.name || lead?.company || 'Lead'
}

function findActivity(crm, item) {
  const acts = crm?.activities || []
  if (item.id && !String(item.id).startsWith('act-')) {
    const byId = acts.find((a) => a.id === item.id)
    if (byId) return byId
  }
  return acts.find(
    (a) =>
      a.createdAt === item.at &&
      (a.type === item.type ||
        (item.type === 'email' && a.type === 'email') ||
        (item.type === 'call' && a.type === 'call'))
  )
}

function findEmail(crm, item, activity) {
  const emails = crm?.emails || []
  const emailId = activity?.meta?.emailId || item.meta?.emailId
  if (emailId) return emails.find((e) => e.id === emailId) || null
  return emails.find((e) => e.sentAt === item.at) || null
}

function outcomeLabel(id) {
  return CALL_OUTCOMES.find((o) => o.id === id)?.label || id
}

function meetingTypeLabel(id) {
  return MEETING_TYPES.find((o) => o.id === id)?.label || id
}

export function leadTabForTimelineItem(item) {
  if (!item) return 'notes'
  if (item.kind === 'deal') return 'deals'
  if (item.kind === 'task' || item.kind === 'meeting' || item.type === 'field_visit') return 'schedule'
  if (item.type === 'email' || item.type === 'email_inbound') return 'email'
  if (item.type === 'whatsapp') return 'whatsapp'
  return 'notes'
}

export function resolveTeamIntelDetail(entry, timelineItem, { user, freightOrg = false } = {}) {
  const lead = entry?.lead || entry || {}
  const crm = entry?.crm || lead?.crm || {}
  const sections = []
  const typeLabel = timelineTypeLabel(timelineItem.type)
  const activityTypeLabel = ACTIVITY_LABELS[timelineItem.type] || typeLabel

  const leadRows = [
    row('Contact', leadDisplayName(lead)),
    row('Company', lead.company),
    row('Phone', lead.phone),
    row('Email', lead.email),
    row('Status', lead.status),
  ]
  sections.push(section('Lead', leadRows))

  if (timelineItem.kind === 'deal') {
    const dealId = timelineItem.meta?.dealId
    const deal = (crm.deals || []).find((d) => d.id === dealId)
    if (deal) {
      const stageMeta = getDealStageMeta(deal.stage, { freightOrg })
      sections.push(
        section('Deal', [
          row('Name', deal.name),
          row('Stage', stageMeta?.label || deal.stage),
          row('Value', deal.amount != null ? formatDealValue(deal.amount, deal.currency || 'INR') : null),
          row('Expected close', deal.expectedCloseDate ? formatDateTime(deal.expectedCloseDate) : null),
          row('Notes', deal.notes?.trim()),
          row('Created', formatDateTime(deal.createdAt)),
          row('Updated', formatDateTime(deal.updatedAt)),
        ])
      )
      if (freightOrg && deal.freight) {
        const freightText = formatDealSharePlainText({ deal, lead, user, freightOrg })
        sections.push({ title: 'Freight details', plainText: freightText })
      }
    } else {
      sections.push(
        section('Deal', [
          row('Summary', timelineItem.body),
          row('Stage', timelineItem.meta?.stageLabel),
          row(
            'Value',
            timelineItem.meta?.amount != null
              ? formatDealValue(timelineItem.meta.amount, timelineItem.meta?.currency || 'INR')
              : null
          ),
        ])
      )
    }
  } else if (timelineItem.kind === 'task') {
    const taskId = timelineItem.meta?.taskId
    const task = (crm.tasks || []).find((t) => t.id === taskId)
    if (task) {
      sections.push(
        section('Task', [
          row('Title', task.title),
          row('Description', task.description),
          row('Status', task.status === 'done' ? 'Completed' : 'Open'),
          row('Due', formatDateTime(task.dueAt)),
          row('Completed', formatDateTime(task.completedAt)),
          row('Created', formatDateTime(task.createdAt)),
          row('Created by', task.createdByName),
        ])
      )
    } else {
      sections.push(section('Task', [row('Summary', timelineItem.body), row('Status', timelineItem.meta?.status)]))
    }
  } else if (timelineItem.kind === 'meeting' || timelineItem.type === 'field_visit') {
    const meetingId = timelineItem.meta?.meetingId
    const meeting = (crm.meetings || []).find((m) => m.id === meetingId)
    if (meeting) {
      sections.push(
        section(timelineItem.type === 'field_visit' ? 'Field visit' : 'Meeting', [
          row('Title', meeting.title),
          row('Type', meetingTypeLabel(meeting.type)),
          row('Scheduled', formatDateTime(meeting.scheduledAt)),
          row('Duration', meeting.durationMinutes ? `${meeting.durationMinutes} min` : null),
          row('Location', meeting.location),
          row('Notes', meeting.notes),
          row('Visit recorded', formatDateTime(meeting.visitRecordedAt)),
          row('Visit outcome', meeting.visitOutcome),
          row('Visit notes', meeting.visitNotes),
          row('Created by', meeting.createdByName),
        ])
      )
    } else {
      sections.push(
        section('Meeting', [
          row('Summary', timelineItem.body),
          row('Scheduled', formatDateTime(timelineItem.meta?.scheduledAt || timelineItem.at)),
        ])
      )
    }
  } else {
    const activity = findActivity(crm, timelineItem)
    const email = findEmail(crm, timelineItem, activity)
    const actType = activity?.type || timelineItem.type

    sections.push(
      section(activityTypeLabel, [
        row('Type', ACTIVITY_LABELS[actType] || actType),
        row('Summary', activity?.summary || timelineItem.body),
        row('Logged', formatDateTime(activity?.createdAt || timelineItem.at)),
        row('Logged by', activity?.createdByName || timelineItem.actorName),
      ])
    )

    if (actType === 'call' && (activity?.meta || timelineItem.meta)) {
      const meta = activity?.meta || timelineItem.meta || {}
      sections.push(
        section('Call details', [
          row('Direction', meta.direction === 'inbound' ? 'Incoming' : 'Outgoing'),
          row('Outcome', meta.outcome ? outcomeLabel(meta.outcome) : null),
          row('Phone', meta.phone || lead.phone),
        ])
      )
    }

    if (email) {
      sections.push(
        section('Email', [
          row('Subject', email.subject),
          row('Direction', email.direction === 'inbound' ? 'Inbound' : 'Sent'),
          row('Sent', formatDateTime(email.sentAt)),
          row('Body preview', email.bodyPreview || email.snippet),
        ])
      )
    } else if (actType === 'email' && activity?.summary) {
      sections.push(section('Email', [row('Summary', activity.summary)]))
    }

    if (actType === 'note' && activity?.summary) {
      sections.push(section('Note', [row('Text', activity.summary)]))
    }
  }

  sections.push(
    section('Activity', [
      row('Event', typeLabel),
      row('When', formatDateTime(timelineItem.at)),
      row('Rep', timelineItem.actorName),
    ])
  )

  return {
    lead,
    crm,
    sections: sections.filter(Boolean),
    typeLabel,
    leadTab: leadTabForTimelineItem(timelineItem),
  }
}
