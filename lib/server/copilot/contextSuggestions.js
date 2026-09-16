/**
 * Context-aware suggestion chips per CRM surface.
 */

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
