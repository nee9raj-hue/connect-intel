import { getSessionToken } from './sessionAuth'

async function request(path, options = {}) {
  const token = getSessionToken()
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
    body:
      options.body && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
  })

  const text = await response.text()
  let data = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(response.ok ? 'Invalid server response' : text.slice(0, 120) || 'Request failed')
    }
  }

  if (!response.ok) {
    const message = data.error || data.hint || 'Request failed'
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  return data
}

export const api = {
  getIntegrationStatus: () => request('/api/integrations/status'),
  getSession: () => request('/api/auth/session'),
  createSession: (payload) => request('/api/auth/session', { method: 'POST', body: payload }),
  destroySession: () => request('/api/auth/session', { method: 'DELETE' }),
  completeOnboarding: (payload) =>
    request('/api/onboarding/complete', { method: 'POST', body: payload }),
  getTeamMembers: () => request('/api/team/members'),
  inviteTeamMember: (payload) => request('/api/team/invite', { method: 'POST', body: payload }),
  getInviteEmailDiagnostics: () => request('/api/team/invite-email'),
  sendInviteTestEmail: () => request('/api/team/invite-email', { method: 'POST' }),
  startInviteEmailOAuth: () => request('/api/team/email-oauth/start'),
  previewInvite: (token) => request(`/api/invite/preview?token=${encodeURIComponent(token)}`),
  acceptInvite: (token) => request('/api/invite/accept', { method: 'POST', body: { token } }),
  updateTeamBranding: (payload) => request('/api/team/branding', { method: 'PATCH', body: payload }),
  updateMemberPermissions: (payload) =>
    request('/api/team/permissions', { method: 'PATCH', body: payload }),
  getSavedLeads: () => request('/api/saved-leads'),
  saveLead: (lead) => request('/api/saved-leads', { method: 'POST', body: { lead } }),
  removeLead: (leadId) => request('/api/saved-leads', { method: 'DELETE', body: { leadId } }),
  updateSavedLead: (leadId, body) =>
    request('/api/saved-leads', { method: 'PATCH', body: { leadId, ...body } }),
  assignLead: (leadId, assignToUserId) =>
    request('/api/saved-leads', { method: 'PATCH', body: { leadId, assignToUserId } }),
  getCrmCalendar: () => request('/api/crm/calendar'),
  getCrmActivityLog: () => request('/api/crm/activity-log'),
  ackMeetingReminder: (leadId, meetingId) =>
    request('/api/crm/reminders-ack', { method: 'POST', body: { leadId, meetingId } }),
  getCrmGmailStatus: () => request('/api/crm/email-gmail-status'),
  startCrmGmailOAuth: () => request('/api/crm/email-oauth/start'),
  generateCrmEmail: (leadId, options = {}) =>
    request('/api/crm-generate-email', { method: 'POST', body: { leadId, ...options } }),
  sendCrmEmail: (leadId, payload) =>
    request('/api/crm-send-email', { method: 'POST', body: { leadId, ...payload } }),
  getSearchHistory: () => request('/api/search-history'),
  addSearchHistory: (entry) => request('/api/search-history', { method: 'POST', body: { entry } }),
  unlockLead: (lead) => request('/api/lead-unlocks', { method: 'POST', body: { lead } }),
  getAdminOverview: () => request('/api/admin/imports'),
  createImport: ({ datasetType, rows }) =>
    request('/api/admin/imports', { method: 'POST', body: { datasetType, rows } }),
  researchLeads: (filters, count = 10) =>
    request('/api/admin/research-leads', { method: 'POST', body: { filters, count } }),
  getOrgImportOverview: () => request('/api/org/imports'),
  importOrgPipeline: ({ datasetType, rows, addToPipeline = true }) =>
    request('/api/org/imports', { method: 'POST', body: { datasetType, rows, addToPipeline } }),
}
