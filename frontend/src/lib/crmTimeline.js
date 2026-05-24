import { ACTIVITY_LABELS } from './crmUiConstants'

export function buildUnifiedTimeline(crm = {}) {
  const items = []

  for (const act of crm.activities || []) {
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

  for (const em of crm.emails || []) {
    items.push({
      id: em.id || `email-${em.sentAt}`,
      kind: 'email',
      type: em.direction === 'inbound' ? 'email_inbound' : 'email',
      at: em.sentAt,
      title: em.subject || '(no subject)',
      subtitle: em.direction === 'inbound' ? 'Inbound email' : 'Sent email',
    })
  }

  for (const t of crm.tasks || []) {
    if (!t.createdAt) continue
    items.push({
      id: t.id,
      kind: 'task',
      type: 'task',
      at: t.createdAt,
      title: t.title,
      subtitle: t.completedAt ? 'Completed' : 'Task',
    })
  }

  for (const m of crm.meetings || []) {
    items.push({
      id: m.id,
      kind: 'meeting',
      type: 'meeting',
      at: m.scheduledAt || m.createdAt,
      title: m.title,
      subtitle: m.type || 'Meeting',
    })
  }

  return items
    .filter((i) => i.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

export function timelineTypeLabel(type) {
  return ACTIVITY_LABELS[type] || type
}

export function formatDealValue(value, currency = 'INR') {
  const n = Number(value) || 0
  if (!n) return '—'
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  }
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}
