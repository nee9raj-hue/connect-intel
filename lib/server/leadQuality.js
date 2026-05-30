/** Normalize contacts; search shows any lead with a company or person name. */

export function hasValidEmail(email) {
  const value = String(email || '').trim()
  if (!value || value.includes('•')) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value)
}

export function hasValidPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 10) return true
  if (digits.length === 11 && digits.startsWith('0')) return true
  if (digits.length >= 12 && digits.startsWith('91')) return true
  return false
}

export function normalizeLeadContact(lead) {
  if (!lead || typeof lead !== 'object') return lead

  let email = String(lead.email || lead.work_email || lead.workEmail || '').trim().toLowerCase()
  let phone = String(
    lead.phone || lead.mobile || lead.phone_number || lead.phoneNumber || lead.telephone || ''
  ).trim()

  if (email === 'n/a' || email === 'na') email = ''

  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    phone = `+91-${digits.slice(0, 5)}-${digits.slice(5)}`
  } else if (digits.length === 11 && digits.startsWith('0')) {
    phone = `+91-${digits.slice(1, 6)}-${digits.slice(6)}`
  } else if (digits.length >= 12 && digits.startsWith('91')) {
    phone = `+91-${digits.slice(2, 7)}-${digits.slice(7, 12)}`
  }

  const website = String(lead.companyDomain || lead.website || '').trim()
  let companyDomain = website
  if (companyDomain && !companyDomain.includes('://')) {
    companyDomain = companyDomain.replace(/^www\./, '').split('/')[0]
  }

  return {
    ...lead,
    email,
    phone,
    companyDomain,
  }
}

export function isDisplayableLead(lead) {
  const normalized = normalizeLeadContact(lead)
  const company = String(normalized.company || normalized.company_name || '').trim()
  const name = [normalized.firstName, normalized.lastName].filter(Boolean).join(' ').trim()
  return Boolean(company || name)
}

export function hasReachableContact(lead) {
  const normalized = normalizeLeadContact(lead)
  return hasValidEmail(normalized.email) || hasValidPhone(normalized.phone)
}

export function hasCompleteContact(lead) {
  const normalized = normalizeLeadContact(lead)
  return hasValidEmail(normalized.email) && hasValidPhone(normalized.phone)
}

/** Include all leads with a company or contact name (email/phone optional). */
export function filterUsableLeads(leads = []) {
  return (leads || []).map(normalizeLeadContact).filter(isDisplayableLead)
}

export function filterPersistableLeads(leads = []) {
  return (leads || []).map(normalizeLeadContact).filter((lead) => {
    const company = String(lead.company || lead.company_name || '').trim()
    return Boolean(company || isDisplayableLead(lead))
  })
}

export function discoveryFiltersReady(filters = {}, naturalQuery = '') {
  const keywords = String(filters.keywords || '').trim()
  const query = String(naturalQuery || keywords).trim()
  if (query.length >= 6) return true
  if (keywords.length >= 2) return true
  if (filters.states?.length || filters.cities?.length) return true
  if (filters.industries?.length) return true
  return false
}
