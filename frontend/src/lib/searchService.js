import { MOCK_LEADS } from './mockLeads'
import { PROVIDERS } from './providers'

export { PROVIDERS }

function filterMockLeads(filters) {
  let results = [...MOCK_LEADS]
  const q = (filters.keywords || '').toLowerCase()

  if (q) {
    results = results.filter(
      (l) =>
        l.firstName?.toLowerCase().includes(q) ||
        l.lastName?.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q) ||
        l.title?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q) ||
        l.state?.toLowerCase().includes(q) ||
        l.location?.toLowerCase().includes(q) ||
        l.industry?.toLowerCase().includes(q)
    )
  }

  if (filters.jobTitles?.length) {
    results = results.filter((l) =>
      filters.jobTitles.some((t) => l.title?.toLowerCase().includes(t.split('/')[0].trim().toLowerCase()))
    )
  }

  if (filters.states?.length) {
    results = results.filter((l) =>
      filters.states.some((s) => l.state?.includes(s) || l.location?.includes(s))
    )
  }

  if (filters.cities?.length) {
    results = results.filter((l) =>
      filters.cities.some((c) => l.city?.includes(c) || l.location?.includes(c))
    )
  }

  if (filters.industries?.length) {
    results = results.filter((l) => filters.industries.includes(l.industry))
  }

  if (filters.companySizes?.length) {
    results = results.filter((l) => filters.companySizes.includes(l.employees))
  }

  return results
}

async function searchViaClaude(filters, count) {
  const res = await fetch('/api/search-leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters, count }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error || data.hint || 'Claude search failed')
  return data
}

/**
 * Search leads — Claude via /api on Vercel; Indian demo data fallback locally.
 */
export async function searchLeads(filters, provider = 'claude', count = 8) {
  if (provider === 'apollo' || provider === 'hunter') {
    throw new Error(`${PROVIDERS[provider].label} integration coming soon`)
  }

  try {
    const data = await searchViaClaude(filters, count)
    if (data.leads?.length) return data
  } catch (e) {
    console.warn('Claude API:', e.message)
  }

  // Fallback: Indian mock data (local dev or missing API key)
  await new Promise((r) => setTimeout(r, 800))
  const leads = filterMockLeads(filters)
  const total = Math.max(leads.length * 150, 3200 + Math.floor(Math.random() * 12000))

  return {
    leads,
    total,
    netNew: Math.floor(total * 0.88),
    provider: leads.length ? 'demo-india' : 'none',
    notice:
      leads.length === 0
        ? 'No demo matches — add ANTHROPIC_API_KEY on Vercel for full Claude search.'
        : 'Showing Indian sample leads. Add ANTHROPIC_API_KEY on Vercel for live Claude AI search.',
  }
}
