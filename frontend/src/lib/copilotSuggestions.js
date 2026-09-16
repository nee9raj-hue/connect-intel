/** Context-aware suggestion chips — mirrors server copilot/contextSuggestions.js */

const MY_WORK = [
  'Brief me',
  'Who needs follow-up today?',
  'How many leads by stage?',
  'Show at-risk and churned accounts',
]

const THIS_LEAD = [
  'Summarize this lead',
  'Draft a follow-up email for this lead',
  'Remind me to follow up next Monday',
  'Paste RFQ text to auto-fill deal',
]

const WRITE = [
  'Draft follow-up email for this lead',
  'Remind me to follow up next Monday',
  'Schedule a call tomorrow at 3pm',
  'Create task for overdue follow-ups',
]

export function getContextualSuggestions(uiContext = {}) {
  const panel = uiContext.panel || ''
  const hasLead = Boolean(uiContext.leadId)
  const tab = uiContext.copilotTab || 'crm'

  if (tab === 'actions') return WRITE
  if (tab === 'lead') {
    return hasLead
      ? THIS_LEAD
      : ['Open a pipeline lead first — then I can draft, remind, or parse an RFQ']
  }
  if (tab === 'crm') return MY_WORK

  if (hasLead) return THIS_LEAD
  if (panel === 'pipeline' || panel === 'contacts' || panel === 'companies' || panel === 'deals') {
    return [
      'Who needs follow-up today?',
      'How many leads by stage?',
      'Highlight stalled deals',
      'Show at-risk and churned accounts',
    ]
  }
  if (panel === 'overview' || panel === 'crm-dashboard') {
    return ['Brief me', 'How many leads by stage?', 'Highlight overdue follow-ups', 'Highlight stalled deals']
  }
  if (panel === 'marketing' || panel === 'bulk-email') {
    return [
      'How did my bulk email campaign perform?',
      'How many live signup forms?',
      'Email consent rules',
    ]
  }
  if (panel === 'crm-calendar') {
    return ['Who needs follow-up today?', 'Highlight overdue follow-ups', 'Brief me']
  }
  return MY_WORK
}

export const COPILOT_TABS = [
  { id: 'crm', label: 'My work', hint: 'Follow-ups, stages, and today’s pipeline' },
  { id: 'lead', label: 'This lead', hint: 'Summarize, draft, remind, or parse RFQ' },
  { id: 'actions', label: 'Write', hint: 'Email, tasks, and meetings on the open lead' },
]

export const PROGRESS_STEPS = {
  crm: ['Reading your pipeline…', 'Preparing the answer…'],
  lead: ['Opening this lead…', 'Preparing the answer…'],
  actions: ['Preparing the action…', 'Ready…'],
  copilot: ['Reading your pipeline…', 'Preparing the answer…'],
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
