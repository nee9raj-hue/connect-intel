/** Browser history + URL helpers for in-app panel navigation. */

const OAUTH_QUERY_KEYS = ['email_oauth', 'crm_gmail', 'mailbox', 'invite']

export function parseAppLocation(search = '') {
  const params = new URLSearchParams(search)
  let panel = String(params.get('panel') || 'overview').trim() || 'overview'
  const panelOptions = {}

  if (panel === 'team-notes' || panel === 'team-hub') {
    panel = 'chithi'
    panelOptions.tab = 'notes'
  } else if (panel === 'team-tasks') {
    panel = 'chithi'
    panelOptions.tab = 'tasks'
  }

  if (params.get('tab')) panelOptions.tab = params.get('tab')
  if (params.get('status')) panelOptions.status = params.get('status')
  if (params.get('channel')) panelOptions.channel = params.get('channel')
  if (params.get('upcoming') === '1') panelOptions.upcomingOnly = true
  if (params.get('campaign')) panelOptions.campaignId = params.get('campaign')

  const leadId = params.get('lead') || null

  return { panel, panelOptions, leadId }
}

export function serializeAppLocation({ panel = 'overview', panelOptions = {}, leadId = null } = {}) {
  const params = new URLSearchParams()

  if (panel && panel !== 'overview') params.set('panel', panel)
  if (panelOptions.tab) params.set('tab', panelOptions.tab)
  if (panelOptions.status && panelOptions.status !== 'all') params.set('status', panelOptions.status)
  if (panelOptions.channel) params.set('channel', panelOptions.channel)
  if (panelOptions.upcomingOnly) params.set('upcoming', '1')
  if (panelOptions.campaignId) params.set('campaign', String(panelOptions.campaignId))
  if (leadId) params.set('lead', String(leadId))

  return params.toString()
}

export function appLocationKey(location) {
  const { panel, panelOptions, leadId } = location || {}
  return JSON.stringify({
    panel: panel || 'overview',
    panelOptions: panelOptions || {},
    leadId: leadId || null,
  })
}

export function appLocationUrl(location) {
  if (typeof window === 'undefined') return '/'
  const qs = serializeAppLocation(location)
  return `${window.location.pathname}${qs ? `?${qs}` : ''}`
}

export function pushAppLocation(location, { replace = false } = {}) {
  const url = appLocationUrl(location)
  const state = { ciApp: 1, ...location }
  if (replace) window.history.replaceState(state, '', url)
  else window.history.pushState(state, '', url)
  return url
}

/** Remove OAuth / invite params from the current URL without touching panel params. */
export function stripEphemeralQueryParams() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  let changed = false
  for (const key of OAUTH_QUERY_KEYS) {
    if (params.has(key)) {
      params.delete(key)
      changed = true
    }
  }
  if (!changed) return false
  const qs = params.toString()
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}`
  window.history.replaceState(window.history.state, '', url)
  return true
}
