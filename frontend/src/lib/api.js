import { appendTimeZoneToQuery } from './dateLocale.js'
import { getSessionToken, storeSessionToken } from './sessionAuth'
import { trackApiLoading } from './apiLoading'
import { fetchWithTimeout } from './fetchWithTimeout'
import {
  prepareWorkspaceUploadRows,
  WORKSPACE_UPLOAD_CHUNK_ROWS,
} from './workspaceUploadPrep'

let refreshInFlight = null

async function touchSession() {
  if (refreshInFlight) return refreshInFlight

  refreshInFlight = (async () => {
    const response = await fetchWithTimeout(
      '/api/auth/session',
      {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      },
      45_000
    )
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
  }, typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 25_000)

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
    if (data.blocked) error.blocked = data.blocked
    if (data.skippedUnsubscribed) error.skippedUnsubscribed = data.skippedUnsubscribed

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
  getSession: () => request('/api/auth/session', { timeoutMs: 45_000 }),
  createSession: (payload) =>
    request('/api/auth/session', { method: 'POST', body: payload, timeoutMs: 55_000 }),
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
  getOrgLeadTags: ({ silent = false } = {}) => request('/api/org/lead-tags', {}, { silent }),
  getOrgWorkspaceSettings: () => request('/api/org/workspace'),
  updateOrgWorkspaceSettings: (body) =>
    request('/api/org/workspace', { method: 'PATCH', body }),
  getCompanyWorkspace: () =>
    request('/api/org/company-workspace', { timeoutMs: 60_000 }),
  uploadCompanyWorkspace: async ({ rows, fileName }) => {
    const prepared = prepareWorkspaceUploadRows(rows)
    if (!prepared.rows.length) throw new Error('No rows in file')
    const uploadId = `ws-up-${Date.now()}`
    const chunkSize = WORKSPACE_UPLOAD_CHUNK_ROWS
    for (let i = 0; i < prepared.rows.length; i += chunkSize) {
      const chunk = prepared.rows.slice(i, i + chunkSize)
      const chunkIndex = Math.floor(i / chunkSize)
      const done = i + chunkSize >= prepared.rows.length
      const payload = {
        action: 'uploadChunk',
        uploadId,
        chunkIndex,
        done,
        rows: chunk,
        ...(chunkIndex === 0
          ? {
              fileName,
              columns: prepared.columns,
              totalRowsInFile: prepared.total,
              truncatedInFile: prepared.truncated,
            }
          : {}),
      }
      const result = await request('/api/org/company-workspace', {
        method: 'POST',
        body: payload,
        timeoutMs: 120_000,
      })
      if (done) return result
    }
    throw new Error('Upload failed')
  },
  analyzeCompanyWorkspace: () =>
    request('/api/org/company-workspace', {
      method: 'POST',
      body: { action: 'analyze' },
      timeoutMs: 120_000,
    }),
  saveCompanyWorkspaceGoals: (body) =>
    request('/api/org/company-workspace', { method: 'PATCH', body }),
  createOrgLeadTag: (payload) => request('/api/org/lead-tags', { method: 'POST', body: payload }),
  updateOrgLeadTag: (payload) => request('/api/org/lead-tags', { method: 'PATCH', body: payload }),
  deleteOrgLeadTag: (id) => request('/api/org/lead-tags', { method: 'DELETE', body: { id } }),
  updateMemberPermissions: (payload) =>
    request('/api/team/permissions', { method: 'PATCH', body: payload }),
  getPipelineSummary: ({ silent = false } = {}) =>
    request('/api/saved-leads?summary=1&light=1', { timeoutMs: 45_000 }, { silent }),

  /** One request: pipeline summary + first page (faster app open). */
  getPipelineBootstrap: ({
    offset = 0,
    limit = 100,
    status,
    q,
    city,
    state,
    cities,
    states,
    assigneeUserId,
    tagIds,
    silent = false,
  } = {}) => {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (status && status !== 'all') qs.set('status', status)
    if (q) qs.set('q', q)
    for (const c of cities || (city ? [city] : [])) {
      if (c) qs.append('city', c)
    }
    for (const s of states || (state ? [state] : [])) {
      if (s) qs.append('state', s)
    }
    if (assigneeUserId) qs.set('assigneeUserId', assigneeUserId)
    for (const id of tagIds || []) qs.append('tagId', id)
    return request(`/api/pipeline/bootstrap?${qs}`, { timeoutMs: 60_000 }, { silent })
  },

  fetchPipelineDeals: ({ dealStage = 'all', offset = 0, limit = 100, silent = false } = {}) => {
    const qs = new URLSearchParams({
      view: 'deals',
      limit: String(limit),
      offset: String(offset),
      light: '1',
    })
    if (dealStage && dealStage !== 'all') qs.set('dealStage', dealStage)
    return request(`/api/saved-leads?${qs}`, { timeoutMs: 60_000 }, { silent })
  },

  fetchPipelineBoard: (params = {}) => {
    const qs = new URLSearchParams({ view: 'board', light: '1' })
    if (params.status && params.status !== 'all') qs.set('status', params.status)
    if (params.q) qs.set('q', params.q)
    for (const c of params.cities || (params.city ? [params.city] : [])) {
      if (c) qs.append('city', c)
    }
    for (const s of params.states || (params.state ? [params.state] : [])) {
      if (s) qs.append('state', s)
    }
    if (params.assigneeUserId) qs.set('assigneeUserId', params.assigneeUserId)
    for (const id of params.tagIds || []) qs.append('tagId', id)
    for (const [col, limit] of Object.entries(params.columnLimits || {})) {
      if (limit > 0) qs.set(`col_${col}`, String(limit))
    }
    return request(`/api/saved-leads?${qs}`, { timeoutMs: 60_000 })
  },

  fetchPipelineLeads: ({
    offset = 0,
    limit = 100,
    status,
    q,
    city,
    state,
    cities,
    states,
    assigneeUserId,
    tagIds,
    silent = false,
  } = {}) => {
    const qs = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      light: '1',
    })
    if (status && status !== 'all') qs.set('status', status)
    if (q) qs.set('q', q)
    for (const c of cities || (city ? [city] : [])) {
      if (c) qs.append('city', c)
    }
    for (const s of states || (state ? [state] : [])) {
      if (s) qs.append('state', s)
    }
    if (assigneeUserId) qs.set('assigneeUserId', assigneeUserId)
    for (const id of tagIds || []) qs.append('tagId', id)
    return request(`/api/saved-leads?${qs}`, { timeoutMs: 45_000 }, { silent })
  },

  /** First page only — use fetchPipelineLeads / loadMore in AppContext for large pipelines. */
  getSavedLeads: async ({ silent = false, light = true } = {}) => {
    const data = await request(
      `/api/saved-leads?${new URLSearchParams({ limit: '100', offset: '0', light: light ? '1' : '0' })}`,
      { timeoutMs: 45_000 },
      { silent }
    )
    return { leads: data.leads || [], total: data.pipelineTotal ?? data.total ?? 0 }
  },
  getPipelineLead: (leadId, { silent = false } = {}) =>
    request(`/api/saved-leads?leadId=${encodeURIComponent(leadId)}`, { timeoutMs: 60_000 }, { silent }),
  getSearchHistory: ({ silent = false } = {}) =>
    request('/api/search-history', { timeoutMs: 30_000 }, { silent }),
  saveLead: (lead) => request('/api/saved-leads', { method: 'POST', body: { lead } }),
  addManualLead: (manual) => request('/api/saved-leads', { method: 'POST', body: { manual } }),
  removeLead: (leadId) => request('/api/saved-leads', { method: 'DELETE', body: { leadId } }),
  updateSavedLead: (leadId, body) =>
    request('/api/saved-leads', { method: 'PATCH', body: { leadId, ...body }, timeoutMs: 60_000 }),
  assignLead: (leadId, assignToUserId) =>
    request('/api/saved-leads', {
      method: 'PATCH',
      body: { leadId, assignToUserId },
      timeoutMs: 60_000,
    }),
  getCrmCalendar: (query = '', { silent = false } = {}) =>
    request(`/api/crm/calendar${query ? `?${query}` : ''}`, {}, { silent }),
  getCrmGoogleCalendarStatus: () => request('/api/crm/calendar/google'),
  connectCrmGoogleCalendar: () =>
    request('/api/crm/calendar/google', { method: 'POST', body: { action: 'connect' } }),
  syncCrmGoogleCalendar: () =>
    request('/api/crm/calendar/google', { method: 'POST', body: { action: 'sync' } }),
  setCrmGoogleCalendarSync: (enabled) =>
    request('/api/crm/calendar/google', {
      method: 'POST',
      body: { action: enabled ? 'enable' : 'disable' },
    }),
  startCrmGmailOAuthWithCalendar: () =>
    request('/api/crm/email-oauth/start?calendar=1'),
  getCrmActivityLog: (query = '') =>
    request(`/api/crm/activity-log?${appendTimeZoneToQuery(query)}`, { timeoutMs: 60_000 }),
  getFieldVisitExpenses: (query = '', { silent = false } = {}) =>
    request(`/api/crm/field-expenses${query ? `?${query}` : ''}`, { timeoutMs: 60_000 }, { silent }),
  updateFieldVisitExpenseSettings: (body) =>
    request('/api/crm/field-expenses', { method: 'PATCH', body }),
  suggestFieldVisitDistance: (body) =>
    request('/api/crm/field-visit/distance', { method: 'POST', body }),
  getFieldVisitDistanceStatus: () => request('/api/crm/field-visit/distance'),
  lookupPostalCode: ({ pin, side = 'delivery' } = {}, { silent = true } = {}) => {
    const params = new URLSearchParams()
    if (pin) params.set('pin', pin)
    if (side) params.set('side', side)
    const qs = params.toString()
    return request(`/api/crm/pincode-lookup${qs ? `?${qs}` : ''}`, { timeoutMs: 15_000 }, { silent })
  },
  getCrmNotifications: (since, { silent = false } = {}) =>
    request(
      `/api/crm/notifications${since ? `?since=${encodeURIComponent(since)}` : ''}`,
      {},
      { silent }
    ),
  getCrmTeamDashboard: (query = '') =>
    request(`/api/crm/team-dashboard?${appendTimeZoneToQuery(query)}`, { timeoutMs: 120_000 }),
  getCrmMyDay: (query = '') =>
    request(`/api/crm/my-day?${appendTimeZoneToQuery(query)}`, { timeoutMs: 45_000 }),
  postWorkspacePulse: (body = {}) =>
    request('/api/crm/workspace-pulse', { method: 'POST', body }, { silent: true }),
  ackMeetingReminder: (leadId, meetingId, { silent = false } = {}) =>
    request('/api/crm/reminders-ack', { method: 'POST', body: { leadId, meetingId } }, { silent }),
  getCrmGmailStatus: () => request('/api/crm/email-gmail-status'),
  startCrmGmailOAuth: () => request('/api/crm/email-oauth/start'),
  disconnectCrmGmailOAuth: () =>
    request('/api/crm/email-oauth/start', { method: 'POST', body: { action: 'disconnect' } }),
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
  getWhatsAppInbox: (query = '') => request(`/api/crm/whatsapp-inbox${query}`),
  getWhatsAppInboxStats: () => request('/api/crm/whatsapp-inbox?stats=1'),
  getWhatsAppThread: (threadId) =>
    request(`/api/crm/whatsapp-inbox?threadId=${encodeURIComponent(threadId)}`),
  replyWhatsAppInbox: (threadId, message) =>
    request(`/api/crm/whatsapp-inbox?threadId=${encodeURIComponent(threadId)}`, {
      method: 'POST',
      body: { action: 'reply', threadId, message },
    }),
  tagWhatsAppThread: (threadId, tag) =>
    request(`/api/crm/whatsapp-inbox?threadId=${encodeURIComponent(threadId)}`, {
      method: 'PATCH',
      body: { action: 'tag', threadId, tag },
    }),
  syncWhatsAppInbox: () =>
    request('/api/crm/whatsapp-inbox', { method: 'POST', body: { action: 'sync' } }),
  generateCrmEmail: (leadId, options = {}) =>
    request('/api/crm-generate-email', {
      method: 'POST',
      body: { leadId, ...options },
      timeoutMs: 90_000,
    }),
  sendCrmEmail: (leadId, payload) =>
    request('/api/crm-send-email', { method: 'POST', body: { leadId, ...payload }, timeoutMs: 120_000 }),
  searchLeads: (filters, count = 50, provider = 'free') =>
    request('/api/search-leads', { method: 'POST', body: { filters, count, provider }, timeoutMs: 180_000 }),
  addSearchHistory: (entry) => request('/api/search-history', { method: 'POST', body: { entry } }),
  unlockLead: (lead, field) => request('/api/lead-unlocks', { method: 'POST', body: { lead, field } }),
  getAdminOverview: () => request('/api/admin/imports', { timeoutMs: 180_000 }),
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
  createImport: ({ datasetType, rows, importJobId, chunkIndex = 0, done = true }) =>
    request('/api/admin/imports', {
      method: 'POST',
      body: { datasetType, rows, importJobId, chunkIndex, done },
      timeoutMs: 180_000,
    }),
  dedupeMasterDatabase: () =>
    request('/api/admin/imports', { method: 'POST', body: { action: 'dedupe' }, timeoutMs: 300_000 }),
  researchLeads: (filters, count = 10) =>
    request('/api/admin/research-leads', { method: 'POST', body: { filters, count } }),
  getOrgImportOverview: () => request('/api/org/imports'),
  importOrgPipeline: ({ datasetType, rows, addToPipeline = true, tagIds = [] }) =>
    request('/api/org/imports', {
      method: 'POST',
      body: { datasetType, rows, addToPipeline, tagIds },
      timeoutMs: 120_000,
    }),
  getActiveTradingOverview: () => request('/api/org/active-trading'),
  importActiveTrading: (body) =>
    request('/api/org/active-trading', { method: 'POST', body }),
  getMyImportOverview: () => request('/api/my/imports'),
  importMyPipeline: ({ datasetType, rows, addToPipeline = true }) =>
    request('/api/my/imports', {
      method: 'POST',
      body: { datasetType, rows, addToPipeline },
      timeoutMs: 120_000,
    }),
  updateUserProfile: (payload) => request('/api/user/profile', { method: 'PATCH', body: payload }),
  sendBulkCrmEmail: (payload, opts = {}) =>
    request('/api/crm/bulk-email', {
      method: 'POST',
      body: payload,
      timeoutMs: opts.timeoutMs ?? 120_000,
      silent: opts.silent,
    }),
  getMarketingOverview: (opts = {}) =>
    request(`/api/marketing/campaigns?overview=1${opts.light ? '&light=1' : ''}`, {
      timeoutMs: opts.timeoutMs ?? 60_000,
    }),
  getMarketingCampaignReport: (campaignId) =>
    request(`/api/marketing/campaigns?campaignId=${encodeURIComponent(campaignId)}`),
  duplicateMarketingCampaign: (id) =>
    request('/api/marketing/campaigns', { method: 'POST', body: { action: 'duplicate', id } }),
  listMarketingLists: () => request('/api/marketing/lists'),
  createMarketingList: (payload) => request('/api/marketing/lists', { method: 'POST', body: payload }),
  createMarketingListBatches: (payload) =>
    request('/api/marketing/lists', { method: 'POST', body: { action: 'create_batches', ...payload } }),
  updateMarketingList: (payload) => request('/api/marketing/lists', { method: 'PATCH', body: payload }),
  addMarketingListLeads: (id, leadIds) =>
    request('/api/marketing/lists', { method: 'PATCH', body: { id, action: 'add_leads', leadIds } }),
  removeMarketingListLeads: (id, leadIds) =>
    request('/api/marketing/lists', { method: 'PATCH', body: { id, action: 'remove_leads', leadIds } }),
  deleteMarketingList: (id) => request('/api/marketing/lists', { method: 'DELETE', body: { id } }),
  listMarketingTemplates: () => request('/api/marketing/templates'),
  createMarketingTemplate: (payload) =>
    request('/api/marketing/templates', { method: 'POST', body: payload }),
  updateMarketingTemplate: (payload) =>
    request('/api/marketing/templates', { method: 'PATCH', body: payload }),
  deleteMarketingTemplate: (id) =>
    request('/api/marketing/templates', { method: 'DELETE', body: { id } }),
  createMarketingCampaign: (payload) =>
    request('/api/marketing/campaigns', { method: 'POST', body: payload, timeoutMs: 120_000 }),
  updateMarketingCampaign: (payload) =>
    request('/api/marketing/campaigns', { method: 'PATCH', body: payload, timeoutMs: 120_000 }),
  startMarketingCampaign: (id, opts = {}) =>
    request('/api/marketing/campaigns', {
      method: 'POST',
      body: { action: 'start', id },
      timeoutMs: opts.timeoutMs ?? 300_000,
    }),
  processMarketingCampaignSends: (id, opts = {}) =>
    request('/api/marketing/campaigns', {
      method: 'POST',
      body: {
        action: 'process_sends',
        id,
        limit: opts.limit ?? 8,
        burst: opts.burst !== false,
      },
      timeoutMs: opts.timeoutMs ?? 120_000,
      silent: opts.silent,
    }),
  logMarketingWhatsAppSent: (enrollmentId) =>
    request('/api/marketing/campaigns', {
      method: 'POST',
      body: { action: 'log_whatsapp_sent', enrollmentId },
    }),
  pauseMarketingCampaign: (id) =>
    request('/api/marketing/campaigns', { method: 'PATCH', body: { action: 'pause', id } }),
  resumeMarketingCampaign: (id, opts = {}) =>
    request('/api/marketing/campaigns', {
      method: 'PATCH',
      body: { action: 'resume', id, limit: opts.limit },
      timeoutMs: opts.timeoutMs ?? 120_000,
      silent: opts.silent,
    }),
  stopMarketingCampaign: (id) =>
    request('/api/marketing/campaigns', { method: 'PATCH', body: { action: 'stop', id } }),
  archiveMarketingCampaign: (id) =>
    request('/api/marketing/campaigns', { method: 'PATCH', body: { action: 'archive', id } }),
  deleteMarketingCampaign: (id, opts = {}) =>
    request('/api/marketing/campaigns', {
      method: 'DELETE',
      body: { id, permanent: Boolean(opts.permanent) },
    }),
  listMarketingForms: () => request('/api/marketing/forms'),
  createMarketingForm: (payload) => request('/api/marketing/forms', { method: 'POST', body: payload }),
  updateMarketingForm: (payload) => request('/api/marketing/forms', { method: 'PATCH', body: payload }),
  deleteMarketingForm: (id) => request('/api/marketing/forms', { method: 'DELETE', body: { id } }),
  platformSearch: (q, limit = 20) =>
    request(`/api/platform/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  getMarketingDashboard: (period = '30d') =>
    request(`/api/marketing/dashboard?period=${encodeURIComponent(period)}`),
  getMarketingHub: (period = '30d') =>
    request(`/api/marketing/dashboard?hub=1&period=${encodeURIComponent(period)}`),
  listMarketingSegments: () => request('/api/marketing/segments'),
  previewMarketingSegment: (filterJson) =>
    request('/api/marketing/segments', { method: 'POST', body: { action: 'preview', filterJson } }),
  createMarketingSegment: (payload) =>
    request('/api/marketing/segments', { method: 'POST', body: payload }),
  refreshMarketingSegment: (id) =>
    request('/api/marketing/segments', { method: 'PATCH', body: { id, action: 'refresh' } }),
  deleteMarketingSegment: (id) =>
    request('/api/marketing/segments', { method: 'DELETE', body: { id } }),
  getMarketingSuppressions: (opts = {}) => {
    const q = new URLSearchParams()
    if (opts.search) q.set('search', opts.search)
    if (opts.reason) q.set('reason', opts.reason)
    const suffix = q.toString() ? `?${q}` : ''
    return request(`/api/marketing/suppressions${suffix}`)
  },
  addMarketingSuppression: (payload) =>
    request('/api/marketing/suppressions', { method: 'POST', body: payload }),
  removeMarketingSuppression: (email) =>
    request('/api/marketing/suppressions', { method: 'DELETE', body: { email } }),
  getMarketingAutomations: () => request('/api/marketing/automations'),
  createMarketingAutomation: (payload) =>
    request('/api/marketing/automations', { method: 'POST', body: payload }),
  updateMarketingAutomation: (payload) =>
    request('/api/marketing/automations', { method: 'PATCH', body: payload }),
  deleteMarketingAutomation: (id) =>
    request('/api/marketing/automations', { method: 'DELETE', body: { id } }),
  testSendMarketingCampaign: (id, emails) =>
    request('/api/marketing/campaigns', {
      method: 'POST',
      body: { action: 'test_send', id, emails },
      timeoutMs: 120_000,
    }),
  submitMarketingCampaignApproval: (id) =>
    request('/api/marketing/campaigns', { method: 'POST', body: { action: 'submit_approval', id } }),
  approveMarketingCampaign: (id, comment) =>
    request('/api/marketing/campaigns', {
      method: 'POST',
      body: { action: 'approve', id, comment },
    }),
  rejectMarketingCampaign: (id, comment) =>
    request('/api/marketing/campaigns', {
      method: 'POST',
      body: { action: 'reject', id, comment },
    }),
  scheduleMarketingCampaign: (id, scheduledAt) =>
    request('/api/marketing/campaigns', {
      method: 'POST',
      body: { action: 'start', id, scheduledAt },
      timeoutMs: 120_000,
    }),
  getMarketingLandingPages: () => request('/api/marketing/landing-pages'),
  createMarketingLandingPage: (payload) =>
    request('/api/marketing/landing-pages', { method: 'POST', body: payload }),
  updateMarketingLandingPage: (payload) =>
    request('/api/marketing/landing-pages', { method: 'PATCH', body: payload }),
  deleteMarketingLandingPage: (id) =>
    request('/api/marketing/landing-pages', { method: 'DELETE', body: { id } }),
  getMarketingFeeds: () => request('/api/marketing/feeds'),
  createMarketingFeed: (payload) =>
    request('/api/marketing/feeds', { method: 'POST', body: payload }),
  deleteMarketingFeed: (id) =>
    request('/api/marketing/feeds', { method: 'DELETE', body: { id } }),
  updateMarketingOrgSettings: (payload) =>
    request('/api/marketing/dashboard', { method: 'PATCH', body: payload }),
  getChithiSummary: () => request('/api/chithi?resource=summary', { timeoutMs: 25_000 }),
  markChithiSeen: () =>
    request('/api/chithi?resource=summary', { method: 'POST', body: { action: 'seen' }, timeoutMs: 25_000 }),
  getChithiPushConfig: () => request('/api/chithi?resource=push', { timeoutMs: 25_000 }),
  subscribeChithiPush: (subscription) =>
    request('/api/chithi?resource=push', { method: 'POST', body: { subscription }, timeoutMs: 25_000 }),
  unsubscribeChithiPush: (endpoint) =>
    request('/api/chithi?resource=push', { method: 'DELETE', body: { endpoint }, timeoutMs: 25_000 }),
  listChithiChannels: () => request('/api/chithi?resource=channels', { timeoutMs: 25_000 }),
  createChithiChannel: (payload) =>
    request('/api/chithi?resource=channels', { method: 'POST', body: payload, timeoutMs: 25_000 }),
  openChithiDm: (peerUserId) =>
    request('/api/chithi?resource=channels', { method: 'POST', body: { peerUserId }, timeoutMs: 25_000 }),
  listChithiMessages: (channelId) =>
    request(`/api/chithi?resource=messages&channelId=${encodeURIComponent(channelId)}`, { timeoutMs: 25_000 }),
  sendChithiMessage: (channelId, body, threadParentId = null) =>
    request(`/api/chithi?resource=messages&channelId=${encodeURIComponent(channelId)}`, {
      method: 'POST',
      body: { body, threadParentId },
      timeoutMs: 20_000,
    }),
  reactChithiMessage: (messageId, emoji) =>
    request('/api/chithi?resource=react', { method: 'POST', body: { messageId, emoji }, timeoutMs: 30_000 }),
  getChithiSettings: () => request('/api/chithi?resource=settings', { timeoutMs: 30_000 }),
  updateChithiSettings: (payload) =>
    request('/api/chithi?resource=settings', { method: 'PATCH', body: payload, timeoutMs: 25_000 }),
  getTeamHubSummary: () => request('/api/team/hub'),
  markTeamHubSeen: () => request('/api/team/hub', { method: 'POST', body: { action: 'seen' } }),
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
  getCompaniesHub: ({ q = '', limit = 50, offset = 0 } = {}) =>
    request(
      `/api/companies/hub?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`
    ),
  getCompanyDetail: (companyId) =>
    request(`/api/companies/hub?companyId=${encodeURIComponent(companyId)}`),
  getCrmLeadTimeline: (leadId) =>
    request(`/api/crm/lead-timeline?leadId=${encodeURIComponent(leadId)}`),
}
