/** Connect Intel Chrome extension — shared API client (constitution: server-side logic only). */

export const API_BASE = 'https://connectintel.net'
export const SESSION_COOKIE = 'connect_intel_session'

export async function getSessionToken() {
  if (!chrome?.cookies?.get) return null
  const cookie = await chrome.cookies.get({
    url: API_BASE,
    name: SESSION_COOKIE,
  })
  return cookie?.value || null
}

export async function apiFetch(path, { method = 'GET', body = null } = {}) {
  const token = await getSessionToken()
  if (!token) throw new Error('not_signed_in')

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  }
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}

export async function extensionBootstrap() {
  return apiFetch('/api/extension/bootstrap')
}

export async function matchLeadsByEmails(emailsOrContext) {
  const body =
    emailsOrContext && typeof emailsOrContext === 'object' && !Array.isArray(emailsOrContext)
      ? emailsOrContext
      : { emails: emailsOrContext }
  return apiFetch('/api/extension/lead-match', { method: 'POST', body })
}

export async function logExtensionAction(action, { leadId = null, metadata = {} } = {}) {
  return apiFetch('/api/extension/log', {
    method: 'POST',
    body: { action, leadId, metadata },
  })
}

export async function syncEmailTrail(leadId) {
  return apiFetch('/api/crm/sync-email-thread', { method: 'POST', body: { leadId } })
}
