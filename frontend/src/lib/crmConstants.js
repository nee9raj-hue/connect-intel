export const CRM_STATUSES = [
  { id: 'new', label: 'New', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'follow_up', label: 'Follow up', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'replied', label: 'Replied', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { id: 'won', label: 'Won', color: 'bg-green-50 text-green-700 border-green-200' },
  { id: 'lost', label: 'Lost', color: 'bg-gray-100 text-gray-500 border-gray-200' },
]

export const EMAIL_PURPOSES = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'follow_up', label: 'Follow up' },
  { id: 'meeting', label: 'Meeting request' },
]

export function defaultCrm() {
  return {
    status: 'new',
    notes: '',
    lastEmailSentAt: null,
    lastResponseAt: null,
    responseReceived: false,
    emails: [],
  }
}

export function getStatusMeta(statusId) {
  return CRM_STATUSES.find((s) => s.id === statusId) || CRM_STATUSES[0]
}

export function formatCrmDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export function buildMailto(lead, subject, body) {
  const email = lead.email && !lead.email.includes('•') && !lead.email.includes('locked') ? lead.email : ''
  if (!email) return null
  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (body) params.set('body', body)
  const qs = params.toString()
  return `mailto:${encodeURIComponent(email)}${qs ? `?${qs}` : ''}`
}
