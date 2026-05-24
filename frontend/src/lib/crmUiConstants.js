export const ACTIVITY_LABELS = {
  note: 'Note',
  email: 'Email',
  email_inbound: 'Reply',
  whatsapp: 'WhatsApp',
  call: 'Call',
  meeting: 'Meeting',
  field_visit: 'Field visit',
  task: 'Task',
  status: 'Status',
  assignment: 'Assignment',
  transfer: 'Transfer',
  form_response: 'Form response',
}

export const MEETING_TYPES = [
  { id: 'call', label: 'Phone call' },
  { id: 'video', label: 'Video call' },
  { id: 'field_visit', label: 'Field visit' },
  { id: 'office', label: 'Office meeting' },
]

export function formatDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function toDatetimeLocalValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDatetimeLocalValue(value) {
  if (!value) return null
  return new Date(value).toISOString()
}
