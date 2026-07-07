const GENERIC_MAIL_DOMAINS =
  /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|protonmail|aol|zoho|yandex|mail|msn|me|mac)$/i

/**
 * Normalize a website, email host, or domain string to a comparable root domain.
 */
export function normalizeCompanyDomain(input = '') {
  let value = String(input || '').trim().toLowerCase()
  if (!value) return null

  if (value.includes('@')) {
    value = value.split('@')[1] || ''
  }

  value = value.replace(/^https?:\/\//, '').replace(/^www\./, '')
  value = value.split('/')[0].split('?')[0].split('#')[0].trim()
  if (!value || !value.includes('.')) return null

  const root = value.split('.')[0]
  if (!root || root.length < 2 || GENERIC_MAIL_DOMAINS.test(root)) return null

  return value
}

export function inferLeadCompanyDomain(lead = {}) {
  return (
    normalizeCompanyDomain(lead.companyDomain) ||
    normalizeCompanyDomain(lead.website) ||
    normalizeCompanyDomain(lead.email)
  )
}
