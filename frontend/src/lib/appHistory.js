/** Browser history + URL helpers for in-app panel navigation. */

const OAUTH_QUERY_KEYS = ['email_oauth', 'crm_gmail', 'mailbox', 'invite']
const LAST_LOCATION_KEY = 'ci_last_app_location'
const POST_LOGIN_NAV_KEY = 'ci_post_login_nav'

export const DASHBOARD_PATH = '/home/dashboard'

const PATH_TO_PANEL = {
  [DASHBOARD_PATH]: 'overview',
}

const PANEL_TO_PATH = {
  overview: DASHBOARD_PATH,
}

let lastWrittenHistoryUrl = ''

function normalizePathname(pathname = '/') {
  const p = String(pathname || '/').replace(/\/+$/, '') || '/'
  return p
}

export function panelFromPathname(pathname = '/') {
  return PATH_TO_PANEL[normalizePathname(pathname)] || null
}

export function pathnameForPanel(panel = 'overview') {
  return PANEL_TO_PATH[panel] || '/'
}

export function defaultDashboardLocation() {
  return { panel: 'overview', panelOptions: {}, leadId: null }
}

export function normalizeLeadId(leadId) {
  if (leadId == null || leadId === '') return null
  return String(leadId)
}

export function parseAppLocation(search = '', pathname = '/') {
  const params = new URLSearchParams(search)
  const pathPanel = panelFromPathname(pathname)
  let panel = pathPanel || String(params.get('panel') || 'overview').trim() || 'overview'
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
  if (params.get('assigneeUserId')) panelOptions.assigneeUserId = params.get('assigneeUserId')
  if (params.get('adminTab')) panelOptions.tab = params.get('adminTab')
  if (params.get('teamTab')) panelOptions.teamTab = params.get('teamTab')
  if (params.get('returnTo')) panelOptions.returnTo = params.get('returnTo')
  if (params.get('marketing_tab')) panelOptions.marketingTab = params.get('marketing_tab')
  if (params.get('followUpDue') === '1') panelOptions.followUpDue = true
  if (params.get('overdueFollowUp') === '1') panelOptions.overdueFollowUp = true
  if (params.get('closingThisWeek') === '1') panelOptions.closingThisWeek = true
  if (params.get('scope')) panelOptions.scope = params.get('scope')
  if (params.get('team')) panelOptions.hierarchyTeam = params.get('team')
  if (params.get('owner') === 'me') panelOptions.scopeOwner = 'me'
  if (params.get('stuck') === '1' || params.get('stuck') === 'true') panelOptions.stuck = true
  if (params.get('score_min')) panelOptions.scoreMin = Number(params.get('score_min'))
  if (params.get('assigned_after')) panelOptions.assignedAfter = params.get('assigned_after')
  if (params.get('due')) panelOptions.due = params.get('due')
  if (params.get('closing')) panelOptions.closing = params.get('closing')
  if (params.get('filter')) panelOptions.activityFilter = params.get('filter')
  if (params.get('team_id')) panelOptions.teamId = params.get('team_id')
  if (params.get('won_month') === '1') panelOptions.wonThisMonth = true
  if (params.get('tasks_due') === 'today') panelOptions.tasksDueToday = true
  if (params.get('unread') === '1') panelOptions.unreadOnly = true
  if (params.get('last_activity')) panelOptions.lastActivity = params.get('last_activity')
  const leadIds = params.getAll('leadId').filter(Boolean)
  if (leadIds.length) panelOptions.leadIds = leadIds
  if (params.get('campaign')) panelOptions.campaignId = params.get('campaign')
  if (params.get('campaign_filter')) panelOptions.campaignRecipientFilter = params.get('campaign_filter')
  if (params.get('campaign_name')) panelOptions.campaignName = params.get('campaign_name')
  if (params.get('opened_campaign')) panelOptions.openedCampaignId = params.get('opened_campaign')
  if (params.get('clicked_campaign')) panelOptions.clickedCampaignId = params.get('clicked_campaign')
  if (params.get('date')) panelOptions.calendarDate = params.get('date')
  const smartTags = params.getAll('smartTag').filter(Boolean)
  if (smartTags.length) panelOptions.smartTags = smartTags

  const leadId = normalizeLeadId(params.get('lead'))

  return { panel, panelOptions, leadId }
}

export function urlHasAppNavigation(search = '', pathname = '/') {
  if (panelFromPathname(pathname)) return true

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
    params.has('assigneeUserId') ||
    params.has('adminTab') ||
    params.has('teamTab') ||
    params.has('returnTo') ||
    params.has('followUpDue') ||
    params.has('overdueFollowUp') ||
    params.has('closingThisWeek') ||
    params.has('smartTag')
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
        leadId: normalizeLeadId(location.leadId),
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

/** Mark the next app shell mount to open the dashboard (post sign-in / onboarding). */
export function preparePostLoginNavigation() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(POST_LOGIN_NAV_KEY, '1')
    sessionStorage.removeItem(LAST_LOCATION_KEY)
  } catch {
    // ignore private mode
  }
}

function consumePostLoginNavigation() {
  if (typeof window === 'undefined') return false
  try {
    if (sessionStorage.getItem(POST_LOGIN_NAV_KEY) === '1') {
      sessionStorage.removeItem(POST_LOGIN_NAV_KEY)
      return true
    }
  } catch {
    // ignore private mode
  }
  return false
}

export function clearAppNavigationState() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(LAST_LOCATION_KEY)
    sessionStorage.removeItem(POST_LOGIN_NAV_KEY)
  } catch {
    // ignore private mode
  }
}

/** Prefer URL state; fall back to last session location when URL is bare (e.g. PWA reopen). */
export function resolveInitialAppLocation(search = '', { isPlatformAdmin = false, pathname = '/' } = {}) {
  if (urlHasAppNavigation(search, pathname)) {
    return parseAppLocation(search, pathname)
  }

  if (consumePostLoginNavigation()) {
    return defaultDashboardLocation()
  }

  const persisted = loadPersistedAppLocation()
  if (persisted) return persisted

  if (isPlatformAdmin) {
    return { panel: 'admin-home', panelOptions: {}, leadId: null }
  }

  return defaultDashboardLocation()
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
  if (panelOptions.assigneeUserId) {
    params.set('assigneeUserId', String(panelOptions.assigneeUserId))
  }
  if (panelOptions.returnTo) params.set('returnTo', String(panelOptions.returnTo))
  if (panelOptions.marketingTab) params.set('marketing_tab', String(panelOptions.marketingTab))
  if (panelOptions.followUpDue) params.set('followUpDue', '1')
  if (panelOptions.overdueFollowUp) params.set('overdueFollowUp', '1')
  if (panelOptions.closingThisWeek) params.set('closingThisWeek', '1')
  if (panelOptions.scope === 'all') params.set('scope', 'all')
  if (panelOptions.hierarchyTeam) params.set('team', String(panelOptions.hierarchyTeam))
  if (panelOptions.scopeOwner === 'me') params.set('owner', 'me')
  if (panelOptions.stuck) params.set('stuck', '1')
  if (panelOptions.scoreMin != null && panelOptions.scoreMin !== '') {
    params.set('score_min', String(panelOptions.scoreMin))
  }
  if (panelOptions.assignedAfter) params.set('assigned_after', String(panelOptions.assignedAfter))
  if (panelOptions.due) params.set('due', String(panelOptions.due))
  if (panelOptions.closing) params.set('closing', String(panelOptions.closing))
  if (panelOptions.activityFilter) params.set('filter', String(panelOptions.activityFilter))
  if (panelOptions.teamId) params.set('team_id', String(panelOptions.teamId))
  if (panelOptions.wonThisMonth) params.set('won_month', '1')
  if (panelOptions.tasksDueToday) params.set('tasks_due', 'today')
  if (panelOptions.unreadOnly) params.set('unread', '1')
  if (panelOptions.lastActivity) params.set('last_activity', String(panelOptions.lastActivity))
  for (const id of panelOptions.leadIds || []) {
    if (id) params.append('leadId', String(id))
  }
  if (panelOptions.campaignId) params.set('campaign', String(panelOptions.campaignId))
  if (panelOptions.campaignRecipientFilter) {
    params.set('campaign_filter', String(panelOptions.campaignRecipientFilter))
  }
  if (panelOptions.campaignName) params.set('campaign_name', String(panelOptions.campaignName))
  if (panelOptions.openedCampaignId) {
    params.set('opened_campaign', String(panelOptions.openedCampaignId))
  }
  if (panelOptions.clickedCampaignId) {
    params.set('clicked_campaign', String(panelOptions.clickedCampaignId))
  }
  if (panelOptions.calendarDate) params.set('date', String(panelOptions.calendarDate))
  for (const tag of panelOptions.smartTags || []) {
    if (tag) params.append('smartTag', String(tag))
  }
  if (
    panelOptions.tab &&
    (panel === 'admin-customers' || panel === 'admin-home') &&
    !['notes', 'tasks', 'meetings', 'campaigns', 'reports', 'lists'].includes(panelOptions.tab)
  ) {
    params.set('adminTab', panelOptions.tab)
  }
  if (panel === 'team' && panelOptions.teamTab && panelOptions.teamTab !== 'members') {
    params.set('teamTab', panelOptions.teamTab)
  }
  const normalizedLeadId = normalizeLeadId(leadId)
  if (normalizedLeadId) params.set('lead', normalizedLeadId)

  return params.toString()
}

export function appLocationKey(location) {
  const { panel, panelOptions, leadId } = location || {}
  return JSON.stringify({
    panel: panel || 'overview',
    panelOptions: panelOptions || {},
    leadId: normalizeLeadId(leadId),
  })
}

export function appLocationUrl(location) {
  if (typeof window === 'undefined') return DASHBOARD_PATH
  const panel = location?.panel || 'overview'
  const pathname = pathnameForPanel(panel)
  const qs = serializeAppLocation(location)
  return `${pathname}${qs ? `?${qs}` : ''}`
}

function writeHistoryState(location, { replace = false } = {}) {
  if (typeof window === 'undefined') return null
  const normalized = {
    ...location,
    leadId: normalizeLeadId(location?.leadId),
  }
  const url = appLocationUrl(normalized)
  if (url === lastWrittenHistoryUrl) return url
  const state = { ciApp: 1, ...normalized }
  try {
    if (replace) window.history.replaceState(state, '', url)
    else window.history.pushState(state, '', url)
    lastWrittenHistoryUrl = url
    return url
  } catch {
    // Blocked history API (sandboxed frame, strict browser policy, rate limit, etc.)
    return url
  }
}

export function pushAppLocation(location, { replace = false } = {}) {
  persistAppLocation(location)
  return writeHistoryState(location, { replace })
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
  if (url === lastWrittenHistoryUrl) return true
  try {
    window.history.replaceState(window.history.state, '', url)
    lastWrittenHistoryUrl = url
  } catch {
    // ignore blocked history API
  }
  return true
}
