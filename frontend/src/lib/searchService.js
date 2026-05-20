import { MOCK_LEADS } from './mockLeads'
import { PROVIDERS } from './providers'

export { PROVIDERS }
const FREE_FULL_LEAD_PREVIEW_COUNT = 5

function maskEmail(email) {
  if (!email) return ''
  const [local, domain] = String(email).split('@')
  if (!domain) return 'Locked'
  return `${local.slice(0, 2)}•••@${domain}`
}

function maskPhone(phone) {
  if (!phone) return ''
  return `${String(phone).slice(0, 3)}••••${String(phone).slice(-2)}`
}

function maskLinkedin(linkedin) {
  if (!linkedin) return ''
  return 'linkedin.com/in/••••'
}

function shapeFallbackLead(lead, index) {
  const previewUnlocked = index < FREE_FULL_LEAD_PREVIEW_COUNT
  const unlockableFields = [lead.email && 'email', lead.phone && 'phone', lead.linkedin && 'linkedin'].filter(Boolean)

  return {
    ...lead,
    email: previewUnlocked ? lead.email : maskEmail(lead.email),
    phone: previewUnlocked ? lead.phone : maskPhone(lead.phone),
    linkedin: previewUnlocked ? lead.linkedin : maskLinkedin(lead.linkedin),
    access: {
      isUnlocked: previewUnlocked || unlockableFields.length === 0,
      previewUnlocked,
      previouslyUnlocked: false,
      unlockable: unlockableFields.length > 0,
      unlockPricePaise: previewUnlocked ? 0 : 1000,
      unlockableFields,
    },
  }
}

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

async function searchViaApi(filters, count, provider) {
  const res = await fetch('/api/search-leads', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters, count, provider }),
  })

  const text = await res.text()
  let data = {}
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(res.ok ? 'Invalid search response' : 'Search failed')
    }
  }

  if (!res.ok) {
    const error = new Error(data.error || data.hint || 'Search failed')
    error.status = res.status
    throw error
  }

  return data
}

function shouldUseLocalFallback(error, provider) {
  if (provider === 'apollo') return false
  if (!error) return true
  if (error.status === 401 || error.status === 402 || error.status === 403) return false
  const message = String(error.message || '').toLowerCase()
  if (message.includes('authentication') || message.includes('searches remaining')) return false
  return true
}

/**
 * Search leads — imported DB → Apollo → Claude → local demo fallback.
 * @param {object} filters
 * @param {'auto'|'apollo'|'claude'} provider
 * @param {number} count
 */
export async function searchLeads(filters, provider = 'auto', count = 8) {
  if (provider === 'hunter') {
    throw new Error(`${PROVIDERS.hunter.label} integration coming soon`)
  }

  try {
    const data = await searchViaApi(filters, count, provider)
    if (data.leads?.length || data.user || data.provider === 'apollo') return data
  } catch (e) {
    if (!shouldUseLocalFallback(e, provider)) throw e
    console.warn('Search API:', e.message)
  }

  if (provider === 'apollo') {
    throw new Error('Apollo search failed. Check APOLLO_API_KEY on the server.')
  }

  await new Promise((r) => setTimeout(r, 800))
  const leads = filterMockLeads(filters).map(shapeFallbackLead)
  const total = Math.max(leads.length * 150, 3200 + Math.floor(Math.random() * 12000))

  return {
    leads,
    total,
    netNew: Math.floor(total * 0.88),
    provider: leads.length ? 'demo-india' : 'none',
    notice:
      leads.length === 0
        ? 'No demo matches. Add APOLLO_API_KEY or ANTHROPIC_API_KEY on Vercel, or import data in Admin.'
        : 'Showing Indian sample leads. Add APOLLO_API_KEY for Apollo.io or ANTHROPIC_API_KEY for Claude.',
  }
}
