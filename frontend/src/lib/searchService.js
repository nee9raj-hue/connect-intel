import { MOCK_LEADS } from './mockLeads'

/**
 * Lead search providers — wire up real APIs later.
 * - claude: AI-powered search (phase 1)
 * - apollo: Apollo.io API (phase 2)
 * - hunter: Hunter.io API (phase 2)
 */
export const PROVIDERS = {
  claude: { id: 'claude', label: 'Claude AI', status: 'active', description: 'AI-powered lead discovery' },
  apollo: { id: 'apollo', label: 'Apollo.io', status: 'coming_soon', description: '230M+ B2B contacts' },
  hunter: { id: 'hunter', label: 'Hunter.io', status: 'coming_soon', description: 'Email finder & verification' },
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function filterMockLeads(filters) {
  let results = [...MOCK_LEADS]
  const q = (filters.keywords || '').toLowerCase()

  if (q) {
    results = results.filter(
      (l) =>
        l.firstName.toLowerCase().includes(q) ||
        l.lastName.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.title.toLowerCase().includes(q)
    )
  }

  if (filters.jobTitles?.length) {
    results = results.filter((l) =>
      filters.jobTitles.some((t) => l.title.toLowerCase().includes(t.toLowerCase()))
    )
  }

  if (filters.industries?.length) {
    results = results.filter((l) => filters.industries.includes(l.industry))
  }

  if (filters.locations?.length) {
    results = results.filter((l) =>
      filters.locations.some((loc) => l.location.includes(loc))
    )
  }

  if (filters.companySizes?.length) {
    results = results.filter((l) => filters.companySizes.includes(l.employees))
  }

  return results
}

/**
 * Search leads — currently uses mock data + simulated AI delay.
 * Replace body with Claude API call when backend is ready.
 */
export async function searchLeads(filters, provider = 'claude') {
  if (provider === 'apollo' || provider === 'hunter') {
    throw new Error(`${PROVIDERS[provider].label} integration coming soon`)
  }

  await delay(1200 + Math.random() * 800)

  const results = filterMockLeads(filters)
  const totalEstimate = Math.max(results.length, Math.floor(Math.random() * 50000) + 1200)

  return {
    leads: results,
    total: totalEstimate,
    netNew: Math.floor(totalEstimate * 0.85),
    provider,
  }
}
