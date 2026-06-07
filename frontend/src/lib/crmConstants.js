export const CRM_STATUSES = [
  { id: 'new', label: 'New', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'follow_up', label: 'Follow up', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'replied', label: 'Replied', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { id: 'won', label: 'Won', color: 'bg-[#fff4ee] text-[#FF773D] border-[#ffd4b8]' },
  {
    id: 'active_trading',
    label: 'Active trading',
    color: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  { id: 'lost', label: 'Lost', color: 'bg-gray-100 text-gray-500 border-gray-200' },
]

/** HubSpot-style deal stages (multiple deals per lead). */
export const DEAL_STAGES = CRM_STATUSES.filter((col) => col.id !== 'active_trading')

export function isClosedDealStage(stage) {
  return stage === 'won' || stage === 'lost'
}

export function getDealStageMeta(stage) {
  return DEAL_STAGES.find((s) => s.id === stage) || DEAL_STAGES[0]
}

const PIPELINE_ROLE_COLUMNS = {
  org_admin: ['new', 'contacted', 'follow_up', 'replied', 'won', 'active_trading', 'lost'],
  member: ['new', 'contacted', 'follow_up', 'replied', 'won', 'active_trading', 'lost'],
  sales: ['new', 'contacted', 'follow_up'],
}

export const TEAM_PIPELINE_ROLES = [
  { id: 'member', label: 'Full pipeline', description: 'New through Replied and Lost' },
  { id: 'sales', label: 'Sales rep', description: 'Early funnel only' },
]

export function getVisiblePipelineColumns(user) {
  if (!user || user.accountType !== 'company') return CRM_STATUSES
  if (user.isOrgAdmin || user.orgRole === 'org_admin' || user.isPlatformAdmin) return CRM_STATUSES
  const role = user.pipelineRole || 'member'
  const allowed = PIPELINE_ROLE_COLUMNS[role] || PIPELINE_ROLE_COLUMNS.member
  return CRM_STATUSES.filter((col) => allowed.includes(col.id))
}

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
    activities: [],
    tasks: [],
    meetings: [],
    nextFollowUpAt: null,
    lastCommunicationAt: null,
    lastCommunicationType: null,
    lastCommunicationSummary: '',
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
