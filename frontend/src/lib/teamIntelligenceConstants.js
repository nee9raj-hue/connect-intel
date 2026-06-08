export const INTEL_CHART_COLORS = [
  '#00a4bd',
  '#ff7a59',
  '#516f90',
  '#25d366',
  '#f5c518',
  '#7c3aed',
  '#647185',
  '#e85d75',
]

export function formatDelta(delta) {
  if (delta == null || Number.isNaN(delta)) return null
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta}%`
}

export function formatHours(h) {
  if (h == null) return '0h'
  if (h < 1) return `${Math.round(h * 60)}m`
  return `${h}h`
}

export const TIMELINE_KIND_LABELS = {
  activity: 'Activity',
  deal: 'Deal',
  task: 'Task',
  meeting: 'Meeting',
}

export const TIMELINE_TYPE_LABELS = {
  call: 'Call',
  email: 'Email',
  whatsapp: 'WhatsApp',
  note: 'Note',
  meeting: 'Meeting',
  field_visit: 'Field visit',
  task: 'Task',
  task_created: 'Task created',
  task_completed: 'Task completed',
  deal_created: 'Deal logged',
  deal_updated: 'Deal updated',
  deal_won: 'Deal won',
  deal_lost: 'Deal lost',
  status: 'Status change',
  assignment: 'Assignment',
  lead: 'New lead',
}

export function timelineTypeLabel(type) {
  return TIMELINE_TYPE_LABELS[type] || TIMELINE_KIND_LABELS[type] || type || 'Activity'
}

export function formatShortDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  } catch {
    return '—'
  }
}
