/** Customer-facing labels — hide internal provider/API names. */

export const PRODUCT = {
  tagline: 'AI-powered B2B prospecting',
  databaseLine: 'Search our growing India & global business database',
  searchHint: 'Built-in records plus data your team imports',
  poweredBy: 'Powered by AI',
}

export function getSourceLabel(source) {
  switch (source) {
    case 'database':
    case 'demo':
    case 'demo-india':
      return 'Connect Intel'
    case 'claude':
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
      return { text: 'AI-powered search', className: 'text-violet-700' }
    case 'apollo':
      return { text: 'Partner data', className: 'text-indigo-700' }
    default:
      return { text: PRODUCT.poweredBy, className: 'text-gray-600' }
  }
}

export function softenNotice(notice) {
  if (!notice) return null
  const n = String(notice)
  if (/apollo|401|api key|anthropic|claude api|vercel|enable_paid/i.test(n)) {
    return null
  }
  if (/free database|connect intel|sample|import|admin/i.test(n)) {
    return notice
      .replace(/Connect Intel free database[^.]*\.?\s*/gi, '')
      .replace(/no Apollo or Claude[^.]*\.?\s*/gi, '')
      .trim()
  }
  return notice.length > 120 ? `${notice.slice(0, 117)}…` : notice
}
