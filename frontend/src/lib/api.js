async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
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
  getSavedLeads: () => request('/api/saved-leads'),
  saveLead: (lead) => request('/api/saved-leads', { method: 'POST', body: { lead } }),
  removeLead: (leadId) => request('/api/saved-leads', { method: 'DELETE', body: { leadId } }),
  updateSavedLead: (leadId, crm) =>
    request('/api/saved-leads', { method: 'PATCH', body: { leadId, crm } }),
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
}
