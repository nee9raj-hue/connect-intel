import { getSessionToken, storeSessionToken } from './sessionAuth'
import { trackApiLoading } from './apiLoading'
import { fetchWithTimeout } from './fetchWithTimeout'

let refreshInFlight = null

async function touchSession() {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const response = await fetchWithTimeout('/api/auth/session', {
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

async function request(path, options = {}, meta = { retried: false, silent: false }) {
  const run = () => requestInner(path, options, meta)
  if (meta.silent) return run()
  return trackApiLoading(run())
}

async function requestInner(path, options = {}, { retried = false, silent = false } = {}) {
  const { timeoutMs, ...fetchOptions } = options
  const token = getSessionToken()
  const response = await fetchWithTimeout(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers || {}),
    },
    ...fetchOptions,
    body:
      fetchOptions.body && typeof fetchOptions.body !== 'string'
        ? JSON.stringify(fetchOptions.body)
        : fetchOptions.body,
  }, timeoutMs)

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
        return requestInner(path, options, { retried: true, silent })
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
  getTeamMembers: ({ silent = false } = {}) => request('/api/team/members', {}, { silent }),
  inviteTeamMember: (payload) => request('/api/team/invite', { method: 'POST', body: payload }),
  getInviteEmailDiagnostics: () => request('/api/team/invite-email'),
  sendInviteTestEmail: () => request('/api/team/invite-email', { method: 'POST' }),
  startInviteEmailOAuth: () => request('/api/team/email-oauth/start'),
  previewInvite: (token) => request(`/api/invite/preview?token=${encodeURIComponent(token)}`),
  acceptInvite: (token) => request('/api/invite/accept', { method: 'POST', body: { token } }),
  updateTeamBranding: (payload) => request('/api/team/branding', { method: 'PATCH', body: payload }),
  updateMemberPermissions: (payload) =>
    request('/api/team/permissions', { method: 'PATCH', body: payload }),
  getSavedLeads: ({ silent = false, light = true } = {}) =>
    request(`/api/saved-leads${light ? '?light=1' : '?light=0'}`, {}, { silent }),
  getPipelineLead: (leadId, { silent = false } = {}) =>
    request(`/api/saved-leads?leadId=${encodeURIComponent(leadId)}`, {}, { silent }),
  getSearchHistory: ({ silent = false } = {}) => request('/api/search-history', {}, { silent }),
  saveLead: (lead) => request('/api/saved-leads', { method: 'POST', body: { lead } }),
  addManualLead: (manual) => request('/api/saved-leads', { method: 'POST', body: { manual } }),
  removeLead: (leadId) => request('/api/saved-leads', { method: 'DELETE', body: { leadId } }),
  updateSavedLead: (leadId, body) =>
    request('/api/saved-leads', { method: 'PATCH', body: { leadId, ...body } }),
  assignLead: (leadId, assignToUserId) =>
    request('/api/saved-leads', { method: 'PATCH', body: { leadId, assignToUserId } }),
  getCrmCalendar: (query = '', { silent = false } = {}) =>
    request(`/api/crm/calendar${query ? `?${query}` : ''}`, {}, { silent }),
  getCrmActivityLog: () => request('/api/crm/activity-log'),
  getCrmNotifications: (since, { silent = false } = {}) =>
    request(
      `/api/crm/notifications${since ? `?since=${encodeURIComponent(since)}` : ''}`,
      {},
      { silent }
    ),
  getCrmTeamDashboard: (query = '') =>
    request(`/api/crm/team-dashboard${query ? `?${query}` : ''}`),
  ackMeetingReminder: (leadId, meetingId, { silent = false } = {}) =>
    request('/api/crm/reminders-ack', { method: 'POST', body: { leadId, meetingId } }, { silent }),
  getCrmGmailStatus: () => request('/api/crm/email-gmail-status'),
  startCrmGmailOAuth: () => request('/api/crm/email-oauth/start'),
  getOrgEmailDomain: () => request('/api/org/email-domain'),
  setupOrgEmailDomain: (body) => request('/api/org/email-domain', { method: 'POST', body }),
  getOrgWhatsAppCloud: () => request('/api/org/whatsapp-cloud'),
  connectOrgWhatsAppCloud: (body) =>
    request('/api/org/whatsapp-cloud', { method: 'POST', body: { action: 'connect', ...body } }),
  disconnectOrgWhatsAppCloud: () =>
    request('/api/org/whatsapp-cloud', { method: 'POST', body: { action: 'disconnect' } }),
  getAdminWhatsAppCloud: () => request('/api/admin/whatsapp-cloud'),
  connectAdminWhatsAppCloud: (body) =>
    request('/api/admin/whatsapp-cloud', { method: 'POST', body: { action: 'connect', ...body } }),
  disconnectAdminWhatsAppCloud: () =>
    request('/api/admin/whatsapp-cloud', { method: 'POST', body: { action: 'disconnect' } }),
  bulkSendWhatsApp: (payload) =>
    request('/api/crm/bulk-whatsapp', { method: 'POST', body: payload }),
  generateCrmEmail: (leadId, options = {}) =>
    request('/api/crm-generate-email', { method: 'POST', body: { leadId, ...options } }),
  sendCrmEmail: (leadId, payload) =>
    request('/api/crm-send-email', { method: 'POST', body: { leadId, ...payload } }),
  searchLeads: (filters, count = 50, provider = 'free') =>
    request('/api/search-leads', { method: 'POST', body: { filters, count, provider } }),
  addSearchHistory: (entry) => request('/api/search-history', { method: 'POST', body: { entry } }),
  unlockLead: (lead, field) => request('/api/lead-unlocks', { method: 'POST', body: { lead, field } }),
  getAdminOverview: () => request('/api/admin/imports'),
  getAdminSupportOverview: () => request('/api/admin/support-overview'),
  listAdminSupportTickets: ({ status = 'active', q = '' } = {}) =>
    request(
      `/api/admin/support-tickets?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`
    ),
  getAdminSupportTicket: (ticketId) =>
    request(`/api/admin/support-tickets?ticketId=${encodeURIComponent(ticketId)}`),
  adminSupportTicketAction: (payload) =>
    request('/api/admin/support-tickets', { method: 'PATCH', body: payload }),
  getMySupportTickets: () => request('/api/support/tickets'),
  createSupportTicket: (payload) => request('/api/support/tickets', { method: 'POST', body: payload }),
  listAdminCustomers: (q = '') =>
    request(`/api/admin/customers?view=users&q=${encodeURIComponent(q)}&limit=60`),
  listAdminOrganizations: (q = '') =>
    request(`/api/admin/customers?view=organizations&q=${encodeURIComponent(q)}&limit=40`),
  getAdminCustomer: (userId) => request(`/api/admin/customers?userId=${encodeURIComponent(userId)}`),
  getAdminOrganization: (organizationId) =>
    request(`/api/admin/customers?organizationId=${encodeURIComponent(organizationId)}`),
  adminCustomerAction: (payload) => request('/api/admin/customers', { method: 'PATCH', body: payload }),
  createImport: ({ datasetType, rows }) =>
    request('/api/admin/imports', { method: 'POST', body: { datasetType, rows } }),
  researchLeads: (filters, count = 10) =>
    request('/api/admin/research-leads', { method: 'POST', body: { filters, count } }),
  getOrgImportOverview: () => request('/api/org/imports'),
  importOrgPipeline: ({ datasetType, rows, addToPipeline = true }) =>
    request('/api/org/imports', { method: 'POST', body: { datasetType, rows, addToPipeline } }),
  getActiveTradingOverview: () => request('/api/org/active-trading'),
  importActiveTrading: (body) =>
    request('/api/org/active-trading', { method: 'POST', body }),
  getMyImportOverview: () => request('/api/my/imports'),
  importMyPipeline: ({ datasetType, rows, addToPipeline = true }) =>
    request('/api/my/imports', { method: 'POST', body: { datasetType, rows, addToPipeline } }),
  updateUserProfile: (payload) => request('/api/user/profile', { method: 'PATCH', body: payload }),
  sendBulkCrmEmail: (payload, opts = {}) =>
    request('/api/crm/bulk-email', {
      method: 'POST',
      body: payload,
      timeoutMs: opts.timeoutMs ?? 120_000,
      silent: opts.silent,
    }),
  getMarketingOverview: () => request('/api/marketing/campaigns?overview=1'),
  getMarketingCampaignReport: (campaignId) =>
    request(`/api/marketing/campaigns?campaignId=${encodeURIComponent(campaignId)}`),
  duplicateMarketingCampaign: (id) =>
    request('/api/marketing/campaigns', { method: 'POST', body: { action: 'duplicate', id } }),
  listMarketingLists: () => request('/api/marketing/lists'),
  createMarketingList: (payload) => request('/api/marketing/lists', { method: 'POST', body: payload }),
  createMarketingListBatches: (payload) =>
    request('/api/marketing/lists', { method: 'POST', body: { action: 'create_batches', ...payload } }),
  updateMarketingList: (payload) => request('/api/marketing/lists', { method: 'PATCH', body: payload }),
  deleteMarketingList: (id) => request('/api/marketing/lists', { method: 'DELETE', body: { id } }),
  listMarketingTemplates: () => request('/api/marketing/templates'),
  createMarketingTemplate: (payload) =>
    request('/api/marketing/templates', { method: 'POST', body: payload }),
  updateMarketingTemplate: (payload) =>
    request('/api/marketing/templates', { method: 'PATCH', body: payload }),
  deleteMarketingTemplate: (id) =>
    request('/api/marketing/templates', { method: 'DELETE', body: { id } }),
  createMarketingCampaign: (payload) =>
    request('/api/marketing/campaigns', { method: 'POST', body: payload }),
  updateMarketingCampaign: (payload) =>
    request('/api/marketing/campaigns', { method: 'PATCH', body: payload }),
  startMarketingCampaign: (id, opts = {}) =>
    request('/api/marketing/campaigns', {
      method: 'POST',
      body: { action: 'start', id },
      timeoutMs: opts.timeoutMs ?? 90_000,
    }),
  processMarketingCampaignSends: (id, opts = {}) =>
    request('/api/marketing/campaigns', {
      method: 'POST',
      body: { action: 'process_sends', id, limit: opts.limit ?? 8 },
      timeoutMs: opts.timeoutMs ?? 90_000,
      silent: opts.silent,
    }),
  logMarketingWhatsAppSent: (enrollmentId) =>
    request('/api/marketing/campaigns', {
      method: 'POST',
      body: { action: 'log_whatsapp_sent', enrollmentId },
    }),
  pauseMarketingCampaign: (id) =>
    request('/api/marketing/campaigns', { method: 'PATCH', body: { action: 'pause', id } }),
  deleteMarketingCampaign: (id) =>
    request('/api/marketing/campaigns', { method: 'DELETE', body: { id } }),
  listMarketingForms: () => request('/api/marketing/forms'),
  createMarketingForm: (payload) => request('/api/marketing/forms', { method: 'POST', body: payload }),
  updateMarketingForm: (payload) => request('/api/marketing/forms', { method: 'PATCH', body: payload }),
  deleteMarketingForm: (id) => request('/api/marketing/forms', { method: 'DELETE', body: { id } }),
  listTeamNotes: () => request('/api/team/notes'),
  createTeamNote: (payload) => request('/api/team/notes', { method: 'POST', body: payload }),
  listTeamTasks: () => request('/api/team/tasks'),
  createTeamTask: (payload) => request('/api/team/tasks', { method: 'POST', body: payload }),
  completeTeamTask: (id) => request('/api/team/tasks', { method: 'PATCH', body: { id, action: 'complete' } }),
  searchTeamMentionLeads: (q = '') =>
    request(`/api/team/mention-leads?q=${encodeURIComponent(q)}&limit=12`),
  bulkUpdatePipeline: (payload) => request('/api/crm/bulk-update', { method: 'POST', body: payload }),
  syncCrmEmailThread: (leadId) =>
    request('/api/crm/sync-email-thread', { method: 'POST', body: { leadId } }),
  logCrmEmailReply: (leadId, payload) =>
    request('/api/crm/log-email-reply', { method: 'POST', body: { leadId, ...payload } }),
  generateCrmWhatsApp: (leadId, options = {}) =>
    request('/api/crm/generate-whatsapp', { method: 'POST', body: { leadId, ...options } }),
  listContacts: ({ search = '', limit = 100, offset = 0 } = {}) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (limit) params.set('limit', String(limit))
    if (offset) params.set('offset', String(offset))
    const qs = params.toString()
    return request(`/api/contacts${qs ? `?${qs}` : ''}`)
  },
  getContact: (contactId) => request(`/api/contacts?contactId=${encodeURIComponent(contactId)}`),
  updateContact: (contactId, contact) =>
    request('/api/contacts', { method: 'PATCH', body: { contactId, contact } }),
  searchContactLinkedin: (contactId, contact) =>
    request('/api/contacts/linkedin-search', { method: 'POST', body: { contactId, contact } }),
  getAssistantChat: () => request('/api/assistant/chat'),
  sendAssistantMessage: (message) =>
    request('/api/assistant/chat', { method: 'POST', body: { message } }),
  escalateAssistantSupport: (payload) =>
    request('/api/assistant/chat', { method: 'POST', body: { action: 'escalate', ...payload } }),
  getPipelineSavedViews: () => request('/api/crm/saved-views'),
  savePipelineView: (payload) => request('/api/crm/saved-views', { method: 'POST', body: payload }),
  listCrmSequences: () => request('/api/crm/sequences'),
  createCrmSequence: (payload) => request('/api/crm/sequences', { method: 'POST', body: payload }),
  enrollCrmSequence: (payload) =>
    request('/api/crm/sequences', { method: 'POST', body: { action: 'enroll', ...payload } }),
  processCrmSequences: () => request('/api/crm/sequences?process=1'),
  getCrmSettings: () => request('/api/crm/settings'),
  updateCrmSettings: (payload) => request('/api/crm/settings', { method: 'PATCH', body: payload }),
}
