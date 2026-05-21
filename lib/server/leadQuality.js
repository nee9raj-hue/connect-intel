/** Leads must have reachable email + phone to be useful in search results. */

export function hasValidEmail(email) {
  const value = String(email || '').trim()
  if (!value || value.includes('•')) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value)
}

export function hasValidPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  return digits.length >= 10
}

export function hasCompleteContact(lead) {
  if (!lead || typeof lead !== 'object') return false
  return hasValidEmail(lead.email) && hasValidPhone(lead.phone)
}

export function filterUsableLeads(leads = []) {
  return (leads || []).filter(hasCompleteContact)
}

export function discoveryFiltersReady(filters = {}) {
  const keywords = String(filters.keywords || '').trim()
  if (keywords.length >= 2) return true
  if (filters.states?.length || filters.cities?.length) return true
  if (filters.industries?.length) return true
  return false
}
