import { getSessionToken, storeSessionToken } from './sessionAuth'

let refreshInFlight = null

async function touchSession() {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const response = await fetch('/api/auth/session', {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
    })
    const text = await response.text()
    let data = {}
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        return { user: null, token: null, ok: false }
      }
    }
    if (data.token) storeSessionToken(data.token)
    return { user: data.user || null, token: data.token || null, ok: Boolean(data.user) }
  })()

  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

async function request(path, options = {}, { retried = false } = {}) {
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

    if (response.status === 401 && !retried && !path.includes('/api/auth/session')) {
      const session = await touchSession()
      if (session.ok) {
        return request(path, options, { retried: true })
      }
    }

    throw error
  }

  return data
}

export const api = {
  touchSession,
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
  addManualLead: (manual) => request('/api/saved-leads', { method: 'POST', body: { manual } }),
  removeLead: (leadId) => request('/api/saved-leads', { method: 'DELETE', body: { leadId } }),
  updateSavedLead: (leadId, body) =>
    request('/api/saved-leads', { method: 'PATCH', body: { leadId, ...body } }),
  assignLead: (leadId, assignToUserId) =>
    request('/api/saved-leads', { method: 'PATCH', body: { leadId, assignToUserId } }),
  getCrmCalendar: (query = '') =>
    request(`/api/crm/calendar${query ? `?${query}` : ''}`),
  getCrmActivityLog: () => request('/api/crm/activity-log'),
  getCrmNotifications: (since) =>
    request(`/api/crm/notifications${since ? `?since=${encodeURIComponent(since)}` : ''}`),
  getCrmTeamDashboard: (query = '') =>
    request(`/api/crm/team-dashboard${query ? `?${query}` : ''}`),
  ackMeetingReminder: (leadId, meetingId) =>
    request('/api/crm/reminders-ack', { method: 'POST', body: { leadId, meetingId } }),
  getCrmGmailStatus: () => request('/api/crm/email-gmail-status'),
  startCrmGmailOAuth: () => request('/api/crm/email-oauth/start'),
  getOrgEmailDomain: () => request('/api/org/email-domain'),
  setupOrgEmailDomain: (body) => request('/api/org/email-domain', { method: 'POST', body }),
  generateCrmEmail: (leadId, options = {}) =>
    request('/api/crm-generate-email', { method: 'POST', body: { leadId, ...options } }),
  sendCrmEmail: (leadId, payload) =>
    request('/api/crm-send-email', { method: 'POST', body: { leadId, ...payload } }),
  searchLeads: (filters, count = 50, provider = 'free') =>
    request('/api/search-leads', { method: 'POST', body: { filters, count, provider } }),
  getSearchHistory: () => request('/api/search-history'),
  addSearchHistory: (entry) => request('/api/search-history', { method: 'POST', body: { entry } }),
  unlockLead: (lead, field) => request('/api/lead-unlocks', { method: 'POST', body: { lead, field } }),
  getAdminOverview: () => request('/api/admin/imports'),
  createImport: ({ datasetType, rows }) =>
    request('/api/admin/imports', { method: 'POST', body: { datasetType, rows } }),
  researchLeads: (filters, count = 10) =>
    request('/api/admin/research-leads', { method: 'POST', body: { filters, count } }),
  getOrgImportOverview: () => request('/api/org/imports'),
  importOrgPipeline: ({ datasetType, rows, addToPipeline = true }) =>
    request('/api/org/imports', { method: 'POST', body: { datasetType, rows, addToPipeline } }),
  getMyImportOverview: () => request('/api/my/imports'),
  importMyPipeline: ({ datasetType, rows, addToPipeline = true }) =>
    request('/api/my/imports', { method: 'POST', body: { datasetType, rows, addToPipeline } }),
  updateUserProfile: (payload) => request('/api/user/profile', { method: 'PATCH', body: payload }),
  sendBulkCrmEmail: (payload) => request('/api/crm/bulk-email', { method: 'POST', body: payload }),
  bulkUpdatePipeline: (payload) => request('/api/crm/bulk-update', { method: 'POST', body: payload }),
  syncCrmEmailThread: (leadId) =>
    request('/api/crm/sync-email-thread', { method: 'POST', body: { leadId } }),
  logCrmEmailReply: (leadId, payload) =>
    request('/api/crm/log-email-reply', { method: 'POST', body: { leadId, ...payload } }),
  generateCrmWhatsApp: (leadId, options = {}) =>
    request('/api/crm/generate-whatsapp', { method: 'POST', body: { leadId, ...options } }),
}
