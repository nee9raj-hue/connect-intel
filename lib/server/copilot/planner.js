/**
 * Connect Copilot planner — decides which retrievers to run (no LLM call).
 */

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

export function planCopilotTurn(message, uiContext = {}) {
  const text = String(message || '').trim()
  const lower = text.toLowerCase()

  const intents = {
    crmCounts: CRM_COUNT_RE.test(lower),
    crmHowTo: CRM_HOWTO_RE.test(lower),
    crmSearch: CRM_SEARCH_RE.test(lower),
    news: NEWS_RE.test(lower),
    companyIntel: COMPANY_RE.test(lower) || WEB_SIGNAL_RE.test(lower),
    createLead: /\b(create|add|save)\b.*\b(lead|contact)\b|\bnew lead\b/i.test(lower),
    draftEmail: /\b(draft|write|compose)\b.*\b(email|mail)\b|\bfollow.?up email\b/i.test(lower),
    scheduleMeeting: /\b(schedule|book|set up)\b.*\bmeeting\b/i.test(lower),
    createTask: /\b(create|add)\b.*\btask\b|\bremind me\b/i.test(lower),
    forecast:
      /\b(forecast|month.?end|revenue change|highlight risk|stalled deal|deal risk)\b/i.test(lower),
    whereAmI: /\b(where am i|current (page|screen)|what screen)\b/i.test(lower),
  }

  const explicitWeb = /^(search|research|look up|google)\b/i.test(text) || /^\/web\s+/i.test(text)
  const hasLeadContext = Boolean(uiContext.leadId)

  let runWeb =
    explicitWeb ||
    intents.news ||
    (intents.companyIntel && !intents.crmHowTo && !intents.crmCounts) ||
    (WEB_SIGNAL_RE.test(lower) && !intents.crmHowTo)

  if ((intents.crmCounts || intents.crmHowTo) && !intents.news && !WEB_SIGNAL_RE.test(lower)) {
    runWeb = false
  }

  if (intents.crmSearch && !runWeb) {
    runWeb = false
  }

  const runCrmSearch =
    intents.crmSearch ||
    intents.forecast ||
    (/\b(find|search)\b/i.test(lower) && !runWeb && lower.length > 4)

  return {
    text,
    intents,
    runCrmFacts: true,
    runKnowledge: true,
    runCrmSearch,
    runCrmLead: hasLeadContext,
    runWeb,
    runNews: intents.news && runWeb,
    crmSearchQuery: runCrmSearch ? extractCrmSearchQuery(text) : null,
    webQuery: runWeb ? stripWebPrefix(text) : null,
    leadId: uiContext.leadId || null,
    panel: uiContext.panel || null,
    tab: uiContext.tab || null,
  }
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
