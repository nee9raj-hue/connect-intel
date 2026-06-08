/** Marketing Hub V2 — navigation IA */

export const MARKETING_HUB_TABS = [
  { id: 'overview', label: 'Overview', short: 'Home' },
  { id: 'campaigns', label: 'Campaigns', short: 'Camp' },
  { id: 'automations', label: 'Automations', short: 'Auto' },
  { id: 'audiences', label: 'Audiences', short: 'Aud' },
  { id: 'forms', label: 'Forms', short: 'Form' },
  { id: 'landing', label: 'Landing Pages', short: 'Land' },
  { id: 'templates', label: 'Templates', short: 'Tpl' },
  { id: 'analytics', label: 'Analytics', short: 'Stats' },
  { id: 'domains', label: 'Domains', short: 'Dom' },
  { id: 'assets', label: 'Assets', short: 'Ast' },
]

export const MOBILE_HUB_TABS = MARKETING_HUB_TABS.filter(
  (t) => !['templates', 'landing', 'assets', 'domains'].includes(t.id)
)

const TAB_ALIASES = {
  dashboard: 'overview',
  lists: 'audiences',
  segments: 'audiences',
  reports: 'analytics',
  feeds: 'assets',
  suppressions: 'domains',
  inbox: 'campaigns',
}

export function normalizeMarketingTab(tab) {
  if (!tab) return 'overview'
  return TAB_ALIASES[tab] || tab
}

export function audienceTabFromPanelOptions(panelOptions) {
  if (panelOptions?.audienceTab) return panelOptions.audienceTab
  if (panelOptions?.tab === 'lists') return 'lists'
  if (panelOptions?.tab === 'segments') return 'segments'
  return 'overview'
}
