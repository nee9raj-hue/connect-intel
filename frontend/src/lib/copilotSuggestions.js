/** Context-aware suggestion chips — mirrors server copilot/contextSuggestions.js */

const MARKET = [
  'I need toys exporter from Delhi NCR',
  'Find toy exporters in Mumbai exporting to USA',
  'Research a prospect company',
  'Decision makers at a target company',
]

const CRM_TAB = [
  'Brief me',
  'Who needs follow-up today?',
  'How many leads by stage?',
  'Find similar companies in my pipeline',
]

const ACTIONS_TAB = [
  'Draft follow-up email for a lead',
  'Remind me to follow up next Monday',
  'Schedule a call tomorrow at 3pm',
  'Create task for overdue follow-ups',
]

export function getContextualSuggestions(uiContext = {}) {
  const panel = uiContext.panel || ''
  const hasLead = Boolean(uiContext.leadId)
  const tab = uiContext.copilotTab || 'copilot'

  if (tab === 'market') return MARKET
  if (tab === 'crm') return CRM_TAB
  if (tab === 'actions') return ACTIONS_TAB

  if (hasLead) {
    return [
      'Draft a follow-up email for this lead',
      'Remind me to follow up next Monday',
      'Schedule a call tomorrow at 3pm',
      'Summarize this lead',
    ]
  }
  if (panel === 'pipeline' || panel === 'contacts' || panel === 'companies') {
    return [
      'Who needs follow-up today?',
      'Find similar companies in my pipeline',
      'How many leads by stage?',
      'Draft follow-up email for a lead',
    ]
  }
  if (panel === 'overview' || panel === 'crm-dashboard') {
    return [
      'Brief me',
      'Explain my pipeline health',
      'Highlight overdue follow-ups',
      'Forecast risks this month',
    ]
  }
  if (panel === 'marketing' || panel === 'bulk-email') {
    return [
      'Marketing campaigns vs Pipeline email',
      'How many live signup forms?',
      'Email consent rules',
    ]
  }
  return [
    'Brief me',
    'How many leads in my pipeline?',
    'Research a prospect company',
    'How do I connect work Gmail?',
  ]
}

export const COPILOT_TABS = [
  { id: 'copilot', label: 'Copilot', hint: 'Auto-routes CRM + web' },
  { id: 'market', label: 'Market Intel', hint: 'Companies, exporters, news' },
  { id: 'crm', label: 'CRM', hint: 'Pipeline, counts, records' },
  { id: 'actions', label: 'Actions', hint: 'Email, tasks, meetings' },
]

export const PROGRESS_STEPS = {
  copilot: [
    'Understanding request…',
    'Searching CRM…',
    'Checking duplicate companies…',
    'Searching public companies…',
    'Finding decision makers…',
    'Ranking results…',
    'Preparing recommendations…',
  ],
  market: [
    'Understanding request…',
    'Searching CRM…',
    'Searching verified exporters…',
    'Finding decision makers…',
    'Ranking results…',
    'Preparing CRM-ready results…',
  ],
  crm: ['Understanding request…', 'Scanning your pipeline…', 'Preparing recommendations…'],
  actions: ['Understanding request…', 'Preparing action…', 'Ready…'],
}

const RECENT_KEY = 'ci-copilot-recent'

export function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function pushRecentSearch(query) {
  const trimmed = String(query || '').trim()
  if (!trimmed) return
  const prev = loadRecentSearches().filter((q) => q !== trimmed)
  const next = [trimmed, ...prev].slice(0, 5)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}
