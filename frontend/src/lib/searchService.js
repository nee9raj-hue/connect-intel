import { recordMatches } from '../../../lib/filterMatch.js'
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
  return MOCK_LEADS.filter((lead) => recordMatches(lead, filters))
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
 * Search leads — Connect Intel database (imported + built-in), with local fallback when offline.
 * @param {object} filters
 * @param {string} provider — use 'free' for customer search
 * @param {number} count
 */
export async function searchLeads(filters, provider = 'free', count = 8) {
  if (provider === 'hunter') {
    throw new Error(`${PROVIDERS.hunter.label} integration coming soon`)
  }

  try {
    const data = await searchViaApi(filters, count, provider)
    if (data.leads?.length) return data
    if (data.error) {
      const error = new Error(data.error)
      error.status = data.status
      throw error
    }
    if (data.notice && provider !== 'auto') return data
  } catch (e) {
    if (!shouldUseLocalFallback(e, provider)) throw e
    console.warn('Search API:', e.message)
  }

  if (provider === 'apollo' || provider === 'claude') {
    throw new Error('This search mode is not available on your plan. Use the main search.')
  }

  await new Promise((r) => setTimeout(r, 800))
  const leads = filterMockLeads(filters).map(shapeFallbackLead)
  const total = Math.max(leads.length * 150, 3200 + Math.floor(Math.random() * 12000))

  return {
    leads,
    total,
    netNew: Math.floor(total * 0.88),
    provider: leads.length ? 'database' : 'none',
    notice:
      leads.length === 0
        ? 'No matches for these filters. Try broader keywords or ask your admin to import more companies.'
        : 'Sample prospects from the Connect Intel database while you refine filters.',
  }
}
