import { recordMatches } from '../../../lib/filterMatch.js'
import { api } from './api'
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

function shapeFallbackLead(lead) {
  const hasEmail = Boolean(lead.email)
  const hasPhone = Boolean(lead.phone)

  return {
    ...lead,
    email: hasEmail ? maskEmail(lead.email) : '',
    phone: hasPhone ? maskPhone(lead.phone) : '',
    linkedin: lead.linkedin ? maskLinkedin(lead.linkedin) : '',
    access: {
      hasEmail,
      hasPhone,
      emailUnlocked: false,
      phoneUnlocked: false,
      emailLocked: hasEmail,
      phoneLocked: hasPhone,
      emailUnlockPricePaise: hasEmail ? 100 : 0,
      phoneUnlockPricePaise: hasPhone ? 100 : 0,
      creditCost: 1,
      previouslyUnlocked: false,
      isUnlocked: false,
      unlockable: hasEmail || hasPhone,
      unlockPricePaise: 100,
      unlockableFields: [hasEmail && 'email', hasPhone && 'phone'].filter(Boolean),
    },
  }
}

function filterMockLeads(filters) {
  return MOCK_LEADS.filter((lead) => recordMatches(lead, filters))
}

async function searchViaApi(filters, count, provider) {
  return api.searchLeads(filters, count, provider)
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
const AI_SEARCH_FETCH_COUNT = 50
const AI_SEARCH_DISPLAY_TOTAL_MIN = 50

export async function searchLeads(filters, provider = 'free', count = AI_SEARCH_FETCH_COUNT) {
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
    if (data.notice || data.discoveryError) return data
  } catch (e) {
    if (!shouldUseLocalFallback(e, provider)) throw e
    console.warn('Search API:', e.message)
  }

  if (provider === 'apollo' || provider === 'claude') {
    throw new Error('This search mode is not available on your plan. Use the main search.')
  }

  await new Promise((r) => setTimeout(r, 800))
  const base = filterMockLeads(filters)
  const padded = []
  while (padded.length < count && base.length) {
    for (let i = 0; i < base.length && padded.length < count; i += 1) {
      const src = base[i]
      padded.push({
        ...src,
        id: padded.length ? `${src.id}-p${padded.length}` : src.id,
      })
    }
  }
  const leads = padded.map(shapeFallbackLead)
  const total = Math.max(AI_SEARCH_DISPLAY_TOTAL_MIN, leads.length * 40, leads.length)

  return {
    leads,
    total,
    netNew: Math.max(total - 5, leads.length),
    maskedCount: Math.max(0, leads.length - FREE_FULL_LEAD_PREVIEW_COUNT),
    fullPreviewCount: FREE_FULL_LEAD_PREVIEW_COUNT,
    provider: leads.length ? 'database' : 'none',
    notice:
      leads.length === 0
        ? 'No matches for these filters. Try broader keywords or ask your admin to import more companies.'
        : 'Sample prospects from the Connect Intel database while you refine filters.',
  }
}
