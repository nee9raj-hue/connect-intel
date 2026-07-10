import { getContextualSuggestions } from './contextSuggestions.js'

export function buildCopilotActions({ plan, leadContext, crmSearch, companyCard, uiContext }) {
  const actions = []
  const intents = plan.intents || {}

  if (intents.draftEmail && (leadContext?.id || uiContext.leadId)) {
    actions.push({
      type: 'navigate',
      panel: 'pipeline',
      leadId: leadContext?.id || uiContext.leadId,
      leadTab: 'email',
      label: 'Draft email',
    })
  }

  if (intents.scheduleMeeting && (leadContext?.id || uiContext.leadId)) {
    actions.push({
      type: 'navigate',
      panel: 'pipeline',
      leadId: leadContext?.id || uiContext.leadId,
      leadTab: 'schedule',
      label: 'Schedule meeting',
    })
  }

  if (intents.createTask && (leadContext?.id || uiContext.leadId)) {
    actions.push({
      type: 'navigate',
      panel: 'pipeline',
      leadId: leadContext?.id || uiContext.leadId,
      leadTab: 'schedule',
      label: 'Create task',
    })
  }

  if (intents.createLead && companyCard) {
    actions.push({
      type: 'create_lead',
      label: 'Create lead in Pipeline',
      payload: {
        company: companyCard.name || companyCard.company || '',
        website: companyCard.website || '',
        industry: companyCard.industry || '',
      },
    })
  }

  if (plan.intents?.leadGeneration && companyCard) {
    actions.push({
      type: 'create_lead',
      label: 'Add to CRM',
      payload: {
        company: companyCard.name || '',
        website: companyCard.website || '',
        industry: companyCard.industry || '',
      },
    })
    actions.push({ type: 'navigate', panel: 'pipeline', label: 'Export CSV' })
  }

  if (companyCard?.leadId) {
    actions.push({
      type: 'navigate',
      panel: 'pipeline',
      leadId: companyCard.leadId,
      label: 'Assign lead owner',
    })
  }

  if (crmSearch?.results?.length === 1 && crmSearch.results[0].leadId) {
    const r = crmSearch.results[0]
    actions.push({
      type: 'navigate',
      panel: r.panel || 'pipeline',
      leadId: r.leadId,
      label: `Open ${r.title}`,
    })
  }

  if (leadContext?.id && !actions.some((a) => a.leadId === leadContext.id)) {
    actions.push({
      type: 'navigate',
      panel: 'pipeline',
      leadId: leadContext.id,
      label: 'Open lead',
    })
  }

  if (intents.forecast) {
    actions.push({
      type: 'navigate',
      panel: 'pipeline',
      view: 'deals',
      label: 'Open deal forecast',
    })
  }

  return actions.slice(0, 4)
}

export function buildCopilotSuggestions({ plan, uiContext, companyCard }) {
  const base = getContextualSuggestions(uiContext)
  if (plan.intents?.morningBrief) {
    return ['Who needs follow-up today?', 'Highlight stalled deals', ...base].slice(0, 4)
  }
  if (companyCard?.name) {
    return [
      `Latest news about ${companyCard.name}`,
      `More contacts at ${companyCard.name}`,
      ...base.slice(0, 2),
    ].slice(0, 4)
  }
  if (plan.runWeb) {
    return base.filter((s) => /research|company|news/i.test(s)).concat(base).slice(0, 4)
  }
  return base.slice(0, 4)
}

export function sanitizeCreateLeadPayload(payload = {}) {
  const out = {}
  for (const key of ['company', 'firstName', 'lastName', 'email', 'phone', 'industry', 'website', 'city', 'state']) {
    if (payload[key] != null && payload[key] !== '') {
      out[key] = String(payload[key]).trim().slice(0, 200)
    }
  }
  return out
}
