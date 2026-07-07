/** Context-aware suggestion chips — mirrors server copilot/contextSuggestions.js */

export function getContextualSuggestions(uiContext = {}) {
  const panel = uiContext.panel || ''
  const hasLead = Boolean(uiContext.leadId)

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
      'Explain my pipeline health',
      'Highlight overdue follow-ups',
      'Forecast risks this month',
      'CRM vs Marketing email?',
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
    'How many leads in my pipeline?',
    'Research a prospect company',
    'How do I connect work Gmail?',
  ]
}
