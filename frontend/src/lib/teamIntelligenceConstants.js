import { formatDate } from './dateLocale.js'

export const INTEL_CHART_COLORS = [
  '#FF773D',
  '#64748B',
  '#e5652f',
  '#94a3b8',
  '#516f90',
  '#ffd4b8',
  '#475569',
  '#cbd5e1',
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
  return formatDate(iso, { day: 'numeric', month: 'short' })
}
