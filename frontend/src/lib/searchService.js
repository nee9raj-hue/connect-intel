import { api } from './api'
import { PROVIDERS } from './providers'

export { PROVIDERS }

function shouldUseLocalFallback(error, provider) {
  if (provider === 'apollo') return false
  if (!error) return false
  if (error.status === 401 || error.status === 402 || error.status === 403) return false
  const message = String(error.message || '').toLowerCase()
  if (message.includes('authentication') || message.includes('searches remaining')) return false
  return false
}

/**
 * Search leads — Connect Intel database (imported + built-in), then live AI on the server.
 * @param {object} filters
 * @param {string} provider — use 'free' for customer search
 * @param {number} count
 */
const AI_SEARCH_FETCH_COUNT = 50

export async function searchLeads(filters, provider = 'free', count = AI_SEARCH_FETCH_COUNT) {
  if (provider === 'hunter') {
    throw new Error(`${PROVIDERS.hunter.label} integration coming soon`)
  }

  if (provider === 'apollo' || provider === 'claude') {
    throw new Error('This search mode is not available on your plan. Use the main search.')
  }

  try {
    const data = await api.searchLeads(filters, count, provider)
    if (data.leads?.length) return data
    if (data.error) {
      const error = new Error(data.error)
      error.status = data.status
      throw error
    }
    if (data.notice || data.discoveryError) return data
    return data
  } catch (e) {
    if (!shouldUseLocalFallback(e, provider)) throw e
    throw new Error(
      e.message ||
        'Search is temporarily unavailable. Wait a moment and try again — your Connect Intel database is still loading.'
    )
  }
}
