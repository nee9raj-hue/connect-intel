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
  'Research this company on the web',
  'Summarize this lead',
  'Draft a follow-up email',
  'Find public decision makers',
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

export function getContextualSuggestions(uiContext = {}) {
  const panel = uiContext.panel || ''
  const hasLead = Boolean(uiContext.leadId)

  if (hasLead) return LEAD
  if (panel === 'pipeline' || panel === 'contacts' || panel === 'companies') return PIPELINE
  if (panel === 'overview' || panel === 'crm-dashboard') return DASHBOARD
  if (panel === 'marketing' || panel === 'bulk-email') return MARKETING
  if (panel === 'crm-calendar') return CALENDAR
  return DEFAULT
}
