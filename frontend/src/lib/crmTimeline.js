import { ACTIVITY_LABELS } from './crmUiConstants'

export const TIMELINE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'email', label: 'Email' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'notes', label: 'Notes' },
]

function marketingEventTitle(ev) {
  if (ev.type === 'email_open' || ev.type === 'open') return 'Email opened'
  if (ev.type === 'link_click' || ev.type === 'click') return 'Link clicked'
  if (ev.type === 'marketing_send' || ev.type === 'send') return 'Campaign email sent'
  if (ev.type === 'unsubscribe') return 'Unsubscribed from marketing'
  return ev.type || 'Marketing event'
}

export function buildUnifiedTimeline(crm = {}, { marketingEvents = [], indexedActivities = [] } = {}) {
  const items = []
  const seenActivityIds = new Set()

  for (const act of crm.activities || []) {
    if (act?.id) seenActivityIds.add(act.id)
    items.push({
      id: act.id,
      kind: 'activity',
      category: act.type === 'note' ? 'notes' : 'activity',
      type: act.type,
      at: act.createdAt,
      title: act.summary,
      subtitle: act.createdByName,
      meta: act.meta,
    })
  }

  for (const act of indexedActivities || []) {
    if (!act?.id || seenActivityIds.has(act.id)) continue
    seenActivityIds.add(act.id)
    items.push({
      id: act.id,
      kind: act.kind || 'activity',
      category: act.type === 'note' ? 'notes' : 'activity',
      type: act.type,
      at: act.at || act.createdAt,
      title: act.body || act.title,
      subtitle: act.actorName || act.createdByName,
      meta: act.meta,
    })
  }

  for (const em of crm.emails || []) {
    items.push({
      id: em.id || `email-${em.sentAt}`,
      kind: 'email',
      category: 'email',
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
      category: 'tasks',
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
      category: 'meetings',
      type: 'meeting',
      at: m.scheduledAt || m.createdAt,
      title: m.title,
      subtitle: m.type || 'Meeting',
    })
  }

  for (const ev of marketingEvents || []) {
    items.push({
      id: ev.id || `mkt-${ev.createdAt}`,
      kind: 'marketing',
      category: 'marketing',
      type:
        ev.type === 'open'
          ? 'email_open'
          : ev.type === 'click'
            ? 'link_click'
            : ev.type === 'send'
              ? 'marketing_send'
              : ev.type,
      at: ev.createdAt,
      title: marketingEventTitle(ev),
      subtitle: ev.campaignId
        ? `Campaign · ${String(ev.campaignId).slice(0, 8)}`
        : ev.url
          ? String(ev.url).slice(0, 80)
          : 'Campaign activity',
      meta: { campaignId: ev.campaignId },
    })
  }

  return items
    .filter((i) => i.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

export function filterTimelineItems(items, filterId) {
  if (!filterId || filterId === 'all') return items
  if (filterId === 'email') return items.filter((i) => i.category === 'email')
  if (filterId === 'marketing') return items.filter((i) => i.category === 'marketing')
  if (filterId === 'meetings') return items.filter((i) => i.category === 'meetings')
  if (filterId === 'tasks') return items.filter((i) => i.category === 'tasks')
  if (filterId === 'notes') {
    return items.filter((i) => i.category === 'notes' || i.type === 'note')
  }
  return items
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
