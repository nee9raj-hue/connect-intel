/** Marketing Hub — Mailchimp-style navigation IA */

export const MARKETING_HUB_TABS = [
  { id: 'overview', label: 'Home', short: 'Home' },
  { id: 'campaigns', label: 'Campaigns', short: 'Camp' },
  { id: 'automations', label: 'Automations', short: 'Auto' },
  { id: 'forms', label: 'Forms', short: 'Form' },
  { id: 'audiences', label: 'Audience', short: 'Aud' },
  { id: 'analytics', label: 'Analytics', short: 'Stats' },
  { id: 'domains', label: 'Domains', short: 'Dom' },
  { id: 'templates', label: 'Email templates', short: 'Tpl', badge: 'New' },
]

export const CAMPAIGN_SUB_NAV = [
  { id: 'templates', label: 'Email templates', badge: 'New' },
]

export const MOBILE_HUB_TABS = MARKETING_HUB_TABS.filter(
  (t) => !['templates', 'domains'].includes(t.id)
)

const TAB_ALIASES = {
  dashboard: 'overview',
  home: 'overview',
  lists: 'audiences',
  segments: 'audiences',
  reports: 'analytics',
  feeds: 'templates',
  assets: 'templates',
  content: 'templates',
  suppressions: 'domains',
  inbox: 'campaigns',
  'bulk email': 'bulk-email',
  'bulk-email': 'bulk-email',
  landing: 'templates',
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
