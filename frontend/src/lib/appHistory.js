/** Browser history + URL helpers for in-app panel navigation. */

const OAUTH_QUERY_KEYS = ['email_oauth', 'crm_gmail', 'mailbox', 'invite']
const LAST_LOCATION_KEY = 'ci_last_app_location'

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
  if (params.get('view')) panelOptions.view = params.get('view')
  if (params.get('dealStage')) panelOptions.dealStage = params.get('dealStage')
  if (params.get('channel')) panelOptions.channel = params.get('channel')
  if (params.get('upcoming') === '1') panelOptions.upcomingOnly = true
  if (params.get('campaign')) panelOptions.campaignId = params.get('campaign')
  if (params.get('activityType')) panelOptions.activityType = params.get('activityType')
  if (params.get('period')) panelOptions.period = params.get('period')
  if (params.get('userId')) panelOptions.userId = params.get('userId')
  if (params.get('adminTab')) panelOptions.tab = params.get('adminTab')

  const leadId = params.get('lead') || null

  return { panel, panelOptions, leadId }
}

export function urlHasAppNavigation(search = '') {
  const params = new URLSearchParams(search)
  return (
    params.has('panel') ||
    params.has('lead') ||
    params.has('tab') ||
    params.has('status') ||
    params.has('view') ||
    params.has('dealStage') ||
    params.has('channel') ||
    params.has('upcoming') ||
    params.has('campaign') ||
    params.has('activityType') ||
    params.has('period') ||
    params.has('userId') ||
    params.has('adminTab')
  )
}

export function persistAppLocation(location) {
  if (typeof window === 'undefined' || !location?.panel) return
  try {
    sessionStorage.setItem(
      LAST_LOCATION_KEY,
      JSON.stringify({
        panel: location.panel || 'overview',
        panelOptions: location.panelOptions || {},
        leadId: location.leadId || null,
      })
    )
  } catch {
    // ignore private mode
  }
}

export function loadPersistedAppLocation() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(LAST_LOCATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.panel) return null
    return {
      panel: parsed.panel,
      panelOptions: parsed.panelOptions || {},
      leadId: parsed.leadId || null,
    }
  } catch {
    return null
  }
}

/** Prefer URL state; fall back to last session location when URL is bare (e.g. PWA reopen). */
export function resolveInitialAppLocation(search = '', { isPlatformAdmin = false } = {}) {
  if (urlHasAppNavigation(search)) {
    return parseAppLocation(search)
  }

  const persisted = loadPersistedAppLocation()
  if (persisted) return persisted

  if (isPlatformAdmin) {
    return { panel: 'admin-home', panelOptions: {}, leadId: null }
  }

  return parseAppLocation(search)
}

export function serializeAppLocation({ panel = 'overview', panelOptions = {}, leadId = null } = {}) {
  const params = new URLSearchParams()

  if (panel && panel !== 'overview') params.set('panel', panel)
  if (panelOptions.tab) params.set('tab', panelOptions.tab)
  if (panelOptions.status && panelOptions.status !== 'all') params.set('status', panelOptions.status)
  if (panelOptions.view && panelOptions.view !== 'leads') params.set('view', panelOptions.view)
  if (panelOptions.dealStage && panelOptions.dealStage !== 'all') {
    params.set('dealStage', panelOptions.dealStage)
  }
  if (panelOptions.channel) params.set('channel', panelOptions.channel)
  if (panelOptions.upcomingOnly) params.set('upcoming', '1')
  if (panelOptions.campaignId) params.set('campaign', String(panelOptions.campaignId))
  if (panelOptions.activityType) params.set('activityType', panelOptions.activityType)
  if (panelOptions.period && panelOptions.period !== 'week') params.set('period', panelOptions.period)
  if (panelOptions.userId) params.set('userId', String(panelOptions.userId))
  if (
    panelOptions.tab &&
    (panel === 'admin-customers' || panel === 'admin-home') &&
    !['notes', 'tasks', 'meetings', 'campaigns', 'reports', 'lists'].includes(panelOptions.tab)
  ) {
    params.set('adminTab', panelOptions.tab)
  }
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
  persistAppLocation(location)
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
