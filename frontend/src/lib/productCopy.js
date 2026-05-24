/** Customer-facing labels — hide internal provider/API names. */

export const PRODUCT = {
  tagline: 'AI-powered B2B prospecting',
  databaseLine: 'Search our growing India & global business database',
  searchHint: 'Built-in records plus data your team imports',
  poweredBy: 'Powered by Connect Intel AI',
  liveAiResults: 'Live AI results',
  liveAiSearch: 'Live AI search',
  workEmail: 'work email',
}

const INTERNAL_ERROR_PATTERN =
  /apollo|401|api key|anthropic|claude|vercel|enable_paid|supabase|oauth|google cloud|test user|perplexity|gemini|hubspot|salesforce/i

/** Safety net for any legacy server text that still mentions internal tooling. */
export function sanitizeCustomerText(text) {
  if (text == null) return null
  const n = String(text).trim()
  if (!n) return null
  if (INTERNAL_ERROR_PATTERN.test(n)) return null
  if (n.length > 160) return `${n.slice(0, 157)}…`
  return n
}

export function getSourceLabel(source) {
  switch (source) {
    case 'database':
    case 'demo':
    case 'demo-india':
      return 'Connect Intel'
    case 'claude':
    case 'ai-discovery':
    case 'perplexity':
      return 'AI-ranked'
    case 'apollo':
      return 'Verified data'
    default:
      return 'Connect Intel'
  }
}

export function getResultsBadge(provider) {
  switch (provider) {
    case 'database':
    case 'demo':
    case 'demo-india':
      return { text: 'Connect Intel database', className: 'text-blue-700' }
    case 'claude':
    case 'ai-discovery':
    case 'perplexity':
      return { text: PRODUCT.liveAiSearch, className: 'text-violet-700' }
    case 'apollo':
      return { text: 'Partner data', className: 'text-indigo-700' }
    default:
      return { text: PRODUCT.poweredBy, className: 'text-gray-600' }
  }
}

export function softenNotice(notice) {
  return sanitizeCustomerText(notice)
}
