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

export const CALL_OUTCOMES = [
  { id: 'incoming', label: 'Incoming call' },
  { id: 'connected', label: 'Connected' },
  { id: 'no_answer', label: 'No answer' },
  { id: 'voicemail', label: 'Left voicemail' },
  { id: 'busy', label: 'Busy / try again' },
  { id: 'wrong_number', label: 'Wrong number' },
  { id: 'callback_requested', label: 'Callback requested' },
]

export const MEETING_TYPES = [
  { id: 'call', label: 'Phone call' },
  { id: 'video', label: 'Video call' },
  { id: 'field_visit', label: 'Field visit' },
  { id: 'office', label: 'Office meeting' },
]

export { formatDateTime } from './dateLocale.js'

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
