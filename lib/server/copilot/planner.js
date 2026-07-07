/**
 * Connect Copilot planner — decides which retrievers to run (no LLM call).
 */

import { extractLeadGenQuery } from './leadGeneration.js'
import { inferSalesIntent } from './salesIntent.js'

const CRM_COUNT_RE =
  /how many|count|leads in (my )?pipeline|leads do i have|overdue follow|pipeline total/i
const CRM_HOWTO_RE =
  /how (do|to)|what is|what's|difference| vs |versus|setup|connect|bulk email|marketing campaign|consent|form/i
const CRM_SEARCH_RE =
  /\b(find|search|show me|list|lookup|look up)\b.*\b(lead|contact|company|deal|pipeline)\b|\bwho needs\b|\bstalled\b|\bfollow.?up\b|\boverdue\b|\bsimilar compan/i
const WEB_SIGNAL_RE =
  /\b(linkedin|amazon|research|competitor|funding|ceo|founder|decision.?maker|supply chain|logistics|export market|industry news|profile url)\b/i
const NEWS_RE = /\b(news|recent|latest|announcement|press release|acquisition)\b/i
const COMPANY_RE =
  /\b(company|startup|corp|corporation|firm|business|market|product category|bestseller)\b/i
const LEAD_GEN_RE =
  /\b(find|search|list|discover|need|i need|looking for|want)\b.*\b(exporter|manufacturer|supplier|buyer|companies?|leads?|toy|toys|textile|plastic|food|auto|pharma)\b|\bexporters?\s+(?:in|from)\b|\bexporting to\b|\b\w+\s+exporters?\b/i
const MORNING_BRIEF_RE = /\b(brief me|morning brief|daily brief|start my day)\b/i
const DECISION_MAKER_RE =
  /\b(decision.?maker|ceo|cfo|cto|founder|vp|director|head of|procurement|buyer)\b/i
const MARKET_INTEL_RE =
  /\b(market intelligence|market size|industry trend|competitor landscape|export market)\b/i

export function planCopilotTurn(message, uiContext = {}, options = {}) {
  const text = String(message || '').trim()
  const lower = text.toLowerCase()
  const copilotTab = uiContext.copilotTab || 'copilot'
  const salesIntent = options.salesIntent || inferSalesIntent(text, uiContext)
  const resolved = options.resolved || null
  const understanding = options.understanding || salesIntent?.queryUnderstanding || null

  const runEntityResearch = understanding?.mode === 'entity_research'

  const isExplicitCrmSearch =
    /\b(find|search|show me|list)\b.*\b(leads?|contacts?|deals?)\b.*\b(named|called|in pipeline|in my)\b/i.test(
      lower
    ) || /\b(find|search)\s+leads?\s+(named|called)\b/i.test(lower)

  const intents = {
    morningBrief: MORNING_BRIEF_RE.test(lower) || salesIntent.isMorningBrief,
    leadGeneration:
      !isExplicitCrmSearch &&
      !runEntityResearch &&
      (LEAD_GEN_RE.test(lower) || salesIntent.isLeadGeneration),
    crmFollowUp: salesIntent.isCrmFollowUp,
    crmStalled: salesIntent.isStalled,
    decisionMaker: DECISION_MAKER_RE.test(lower),
    marketIntelligence: MARKET_INTEL_RE.test(lower),
    crmCounts: CRM_COUNT_RE.test(lower),
    crmHowTo: CRM_HOWTO_RE.test(lower),
    crmSearch: CRM_SEARCH_RE.test(lower),
    news: NEWS_RE.test(lower),
    companyIntel: COMPANY_RE.test(lower) || WEB_SIGNAL_RE.test(lower),
    createLead: /\b(create|add|save)\b.*\b(lead|contact)\b|\bnew lead\b/i.test(lower),
    draftEmail: /\b(draft|write|compose)\b.*\b(email|mail)\b|\bfollow.?up email\b/i.test(lower),
    scheduleMeeting: /\b(schedule|book|set up)\b.*\b(meeting|call)\b/i.test(lower),
    createTask: /\b(create|add)\b.*\btask\b|\bremind me\b/i.test(lower),
    followUpTask:
      /\b(remind me|follow.?up)\b/i.test(lower) && !/\b(email|mail|research|company)\b/i.test(lower),
    forecast:
      /\b(forecast|month.?end|revenue change|highlight risk|stalled deal|deal risk)\b/i.test(lower),
    whereAmI: /\b(where am i|current (page|screen)|what screen)\b/i.test(lower),
  }

  const explicitWeb = /^(search|research|look up|google)\b/i.test(text) || /^\/web\s+/i.test(text)
  const hasLeadContext = Boolean(uiContext.leadId)

  let runWeb =
    explicitWeb ||
    intents.news ||
    intents.leadGeneration ||
    intents.marketIntelligence ||
    intents.decisionMaker ||
    (intents.companyIntel && !intents.crmHowTo && !intents.crmCounts) ||
    (WEB_SIGNAL_RE.test(lower) && !intents.crmHowTo)

  if ((intents.crmCounts || intents.crmHowTo) && !intents.news && !WEB_SIGNAL_RE.test(lower)) {
    runWeb = false
  }

  if (intents.crmSearch && !runWeb && copilotTab !== 'market') {
    runWeb = false
  }

  if (intents.morningBrief || intents.crmFollowUp || intents.crmStalled) {
    runWeb = false
  }

  const runPeopleDiscovery =
    (salesIntent.isPersonDiscovery ||
      resolved?.inferredIntent === 'person_discovery' ||
      understanding?.mode === 'person_at_brand') &&
    resolved?.inferredIntent !== 'contact_lookup' &&
    !runEntityResearch &&
    !intents.crmHowTo &&
    !intents.morningBrief &&
    !intents.crmFollowUp &&
    !hasLeadContext

  const runLeadDiscovery =
    !runEntityResearch &&
    !runPeopleDiscovery &&
    (intents.leadGeneration || copilotTab === 'market') &&
    !intents.crmHowTo &&
    !intents.crmCounts &&
    !intents.morningBrief &&
    !intents.crmFollowUp &&
    !intents.crmStalled &&
    !hasLeadContext &&
    !salesIntent.needsExportClarification &&
    !salesIntent.needsIndustryClarification

  if (runLeadDiscovery || runPeopleDiscovery || runEntityResearch) {
    runWeb = false
  }

  if (
    hasLeadContext &&
    (intents.draftEmail ||
      intents.createTask ||
      intents.scheduleMeeting ||
      intents.followUpTask)
  ) {
    runWeb = false
  }

  if (copilotTab === 'market') {
    if (!runLeadDiscovery) {
      runWeb = !intents.crmHowTo && !intents.crmCounts && !intents.morningBrief
    }
  } else if (copilotTab === 'crm') {
    runWeb = false
  } else if (copilotTab === 'actions') {
    runWeb = false
  }

  let runCrmSearch =
    intents.crmFollowUp ||
    intents.crmStalled ||
    intents.crmSearch ||
    intents.forecast ||
    intents.morningBrief ||
    (copilotTab === 'crm' && lower.length > 3 && !intents.crmFollowUp) ||
    (/\b(find|search)\b/i.test(lower) && !runWeb && !runLeadDiscovery && lower.length > 4)

  const runCrmCrossRef =
    runWeb &&
    !intents.crmHowTo &&
    (intents.leadGeneration || intents.companyIntel || intents.decisionMaker || copilotTab === 'market')

  if (runCrmCrossRef && !runCrmSearch) {
    runCrmSearch = true
  }

  const crmQuery = runCrmSearch
    ? intents.crmSearch || intents.forecast
      ? extractCrmSearchQuery(text)
      : extractLeadGenQuery(text)
    : null

  return {
    text,
    intents,
    salesIntent,
    intentCategory: classifyIntentCategory(intents, copilotTab, salesIntent),
    copilotTab,
    runCrmFacts: !runLeadDiscovery,
    runKnowledge: !runLeadDiscovery,
    runCrmSearch: runCrmSearch && !intents.crmFollowUp && !intents.crmStalled,
    runCrmPipelineQuery: intents.crmFollowUp || intents.crmStalled,
    runCrmCrossRef: runCrmCrossRef && !runLeadDiscovery && !runPeopleDiscovery,
    runLeadDiscovery,
    runPeopleDiscovery,
    runEntityResearch,
    runCrmLead: hasLeadContext,
    runWeb,
    runNews: intents.news && runWeb,
    crmSearchQuery: crmQuery,
    crmCrossRefQuery: runCrmCrossRef ? extractLeadGenQuery(text) : null,
    webQuery: runWeb ? stripWebPrefix(text) : null,
    leadId: uiContext.leadId || null,
    panel: uiContext.panel || null,
    tab: uiContext.tab || null,
  }
}

function classifyIntentCategory(intents, copilotTab, salesIntent) {
  if (salesIntent?.isEntityResearch || salesIntent?.category === 'entity_research') return 'entity_research'
  if (salesIntent?.isPersonDiscovery) return 'person_discovery'
  if (intents.morningBrief) return 'morning_brief'
  if (intents.crmFollowUp) return 'crm_follow_up'
  if (intents.crmStalled) return 'crm_stalled'
  if (intents.leadGeneration) return 'lead_generation'
  if (intents.marketIntelligence) return 'market_intelligence'
  if (intents.decisionMaker) return 'decision_maker'
  if (intents.draftEmail || intents.scheduleMeeting || intents.createTask) return 'actions'
  if (copilotTab === 'crm' || intents.crmSearch || intents.crmCounts) return 'crm'
  if (copilotTab === 'market' || intents.companyIntel) return 'company_research'
  return 'general'
}

function stripWebPrefix(message) {
  return String(message || '')
    .replace(/^\/web\s+/i, '')
    .trim()
}

function extractCrmSearchQuery(message) {
  const text = String(message || '').trim()
  const quoted = text.match(/["']([^"']+)["']/)
  if (quoted) return quoted[1].trim()

  const patterns = [
    /\b(?:find|search|show me|list)\s+(?:leads?|contacts?|companies?|deals?)?\s*(?:for|named|called|matching)?\s+(.+)/i,
    /\bwho needs follow.?up\b/i,
    /\bstalled deals?\b/i,
    /\boverdue follow.?ups?\b/i,
  ]

  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1].trim().slice(0, 120)
  }

  if (/\bwho needs|stalled|overdue\b/i.test(text)) return text
  return text.replace(/^(find|search|show me|list)\s+/i, '').trim().slice(0, 120) || text
}

export function inferConfidence({ sources = [], grounded, webError }) {
  if (webError) return 'low'
  if (grounded && sources.includes('crm')) return 'high'
  if (sources.includes('crm') && sources.includes('web')) return 'high'
  if (sources.includes('faq_confident') || sources.includes('grounded')) return 'high'
  if (sources.includes('web')) return 'medium'
  if (sources.includes('ai')) return 'medium'
  return 'low'
}
