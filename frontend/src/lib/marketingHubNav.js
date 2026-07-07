/** Marketing Hub — Mailchimp-style navigation IA */

export const MARKETING_HUB_TABS = [
  { id: 'overview', label: 'Home', short: 'Home' },
  { id: 'campaigns', label: 'Campaigns', short: 'Camp' },
  { id: 'templates', label: 'Email templates', short: 'Tpl' },
  { id: 'automations', label: 'Automations', short: 'Auto' },
  { id: 'forms', label: 'Forms', short: 'Form' },
  { id: 'audiences', label: 'Audience', short: 'Aud' },
  { id: 'analytics', label: 'Analytics', short: 'Stats' },
  { id: 'domains', label: 'Domains', short: 'Dom' },
]

export const CAMPAIGN_SUB_NAV = []

export const AUDIENCE_SUB_NAV = [
  { id: 'contacts', label: 'Contacts' },
  { id: 'tags', label: 'Tags' },
  { id: 'segments', label: 'Segments' },
  { id: 'inbox', label: 'Inbox' },
]

const AUDIENCE_TAB_ALIASES = {
  overview: 'contacts',
  lists: 'contacts',
  studio: 'contacts',
}

export const MOBILE_HUB_TABS = MARKETING_HUB_TABS.filter(
  (t) => !['templates', 'domains'].includes(t.id)
)

const TAB_ALIASES = {
  dashboard: 'overview',
  home: 'overview',
  lists: 'audiences',
  segments: 'audiences',
  feeds: 'templates',
  assets: 'templates',
  content: 'templates',
  suppressions: 'domains',
  inbox: 'audiences',
  'bulk email': 'bulk-email',
  'bulk-email': 'bulk-email',
  landing: 'forms',
}

export function normalizeMarketingTab(tab) {
  if (!tab) return 'overview'
  return TAB_ALIASES[tab] || tab
}

export function audienceTabFromPanelOptions(panelOptions) {
  const raw =
    panelOptions?.audienceTab ||
    (panelOptions?.tab === 'inbox' ? 'inbox' : null) ||
    (panelOptions?.tab === 'lists' ? 'contacts' : panelOptions?.tab === 'segments' ? 'segments' : null)
  if (!raw) return 'contacts'
  if (raw === 'surveys' || raw === 'preferences') return 'contacts'
  return AUDIENCE_TAB_ALIASES[raw] || raw
}
