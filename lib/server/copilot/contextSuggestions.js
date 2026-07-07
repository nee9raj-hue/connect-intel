/**
 * Context-aware suggestion chips per CRM surface.
 */

const PIPELINE = [
  'Who needs follow-up today?',
  'Find similar companies in my pipeline',
  'Draft follow-up email for a lead',
  'How many leads by stage?',
]

const LEAD = [
  'Draft a follow-up email for this lead',
  'Remind me to follow up next Monday',
  'Schedule a call tomorrow at 3pm',
  'Summarize this lead',
]

const DASHBOARD = [
  'Explain my pipeline health',
  'Highlight overdue follow-ups',
  'CRM vs Marketing email?',
  'Forecast risks this month',
]

const MARKETING = [
  'Marketing campaigns vs Pipeline email',
  'How many live signup forms?',
  'Email consent rules',
  'Open campaign reports',
]

const CALENDAR = [
  'Overdue follow-ups?',
  'How do reminders work?',
  'Open Pipeline',
]

const DEFAULT = [
  'How many leads in my pipeline?',
  'Research a prospect company',
  'How do I connect work Gmail?',
  'CRM vs Marketing email?',
]

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

  if (hasLead) return LEAD
  if (panel === 'pipeline' || panel === 'contacts' || panel === 'companies') return PIPELINE
  if (panel === 'overview' || panel === 'crm-dashboard') return DASHBOARD
  if (panel === 'marketing' || panel === 'bulk-email') return MARKETING
  if (panel === 'crm-calendar') return CALENDAR
  return DEFAULT
}
