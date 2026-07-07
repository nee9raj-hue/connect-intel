/**
 * Business goal inference — optimize for what the user is trying to achieve.
 */

const GOALS = {
  lead_generation: 'generate qualified outbound sales leads',
  person_discovery: 'find the right decision maker',
  decision_maker_search: 'identify who to contact at a target company',
  crm_follow_up: 'prioritize today\'s follow-up work',
  crm_stalled: 'surface stalled deals that need attention',
  morning_brief: 'start the day with a clear sales picture',
  company_intelligence: 'understand a company before outreach',
  entity_research: 'research companies from a named context',
  market_intelligence: 'map a market segment for prospecting',
  actions: 'complete a sales task in the CRM',
  general: 'move pipeline work forward',
}

export function inferBusinessGoal(category) {
  return GOALS[category] || GOALS.general
}

export function buildApproachNarrative(category) {
  const goal = inferBusinessGoal(category)
  return `I believe you're trying to **${goal}**.`
}

export function buildApproachPlanSteps(category = 'lead_generation') {
  const base = [
    { id: 'understand', label: 'Understanding your request', status: 'done' },
    { id: 'crm', label: 'Searching CRM', status: 'done' },
    { id: 'dup', label: 'Checking duplicate companies', status: 'done' },
  ]

  if (category === 'person_discovery' || category === 'decision_maker_search') {
    return [
      ...base,
      { id: 'people', label: 'Finding public decision makers', status: 'done' },
      { id: 'linkedin', label: 'Looking for LinkedIn profiles', status: 'done' },
      { id: 'validate', label: 'Validating results', status: 'done' },
      { id: 'ready', label: 'Preparing recommendations', status: 'done' },
    ]
  }

  if (category === 'crm_follow_up' || category === 'crm_stalled') {
    return [
      { id: 'understand', label: 'Understanding your request', status: 'done' },
      { id: 'crm', label: 'Scanning your pipeline', status: 'done' },
      { id: 'ready', label: 'Preparing recommendations', status: 'done' },
    ]
  }

  return [
    ...base,
    { id: 'search', label: 'Searching verified exporters & companies', status: 'done' },
    { id: 'people', label: 'Finding public decision makers', status: 'done' },
    { id: 'web', label: 'Collecting websites & LinkedIn pages', status: 'done' },
    { id: 'rank', label: 'Ranking companies', status: 'done' },
    { id: 'ready', label: 'Preparing CRM-ready results', status: 'done' },
  ]
}

export const INDUSTRY_CLARIFICATION_OPTIONS = [
  'Toys',
  'Handicrafts',
  'Textiles',
  'Engineering',
  'Food',
  'All industries',
]
