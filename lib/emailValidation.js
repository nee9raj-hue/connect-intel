/**
 * Shared email format + placeholder checks (client + server).
 * Phase 1: syntax, reserved domains, obvious placeholders — not SMTP/API verification.
 */

/** RFC 2606 + common import/CRM placeholder domains (never real inboxes). */
export const NON_DELIVERABLE_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'example.edu',
  'test.com',
  'test.test',
  'localhost',
  'invalid',
  'domain.com',
  'email.com',
  'company.com',
  'yourcompany.com',
  'yourdomain.com',
  'sample.com',
  'demo.com',
  'fake.com',
  'noemail.com',
  'none.com',
  'null.com',
  'tempmail.com',
  'mailinator.com',
])

const PLACEHOLDER_LOCAL_PARTS = new Set([
  'test',
  'testing',
  'email',
  'user',
  'sample',
  'dummy',
  'fake',
  'noemail',
  'none',
  'null',
  'na',
  'n/a',
  'unknown',
  'notavailable',
  'not_available',
  'placeholder',
])

const NON_DELIVERABLE_TLD_SUFFIXES = ['.example', '.test', '.invalid', '.localhost', '.local']

export function getEmailDomain(email) {
  const value = String(email || '').trim().toLowerCase()
  const at = value.lastIndexOf('@')
  return at >= 0 ? value.slice(at + 1) : ''
}

export function getEmailLocalPart(email) {
  const value = String(email || '').trim().toLowerCase()
  const at = value.lastIndexOf('@')
  return at >= 0 ? value.slice(0, at) : value
}

export function hasValidEmailFormat(email) {
  const value = String(email || '').trim()
  if (!value || value.includes('•')) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value)
}

/** Reserved domain, placeholder TLD, or obvious fake local part. */
export function isNonDeliverableEmail(email) {
  const value = String(email || '').trim().toLowerCase()
  if (!value) return false

  const domain = getEmailDomain(value)
  const local = getEmailLocalPart(value)
  if (!domain) return true

  if (NON_DELIVERABLE_EMAIL_DOMAINS.has(domain)) return true
  if (NON_DELIVERABLE_TLD_SUFFIXES.some((suffix) => domain.endsWith(suffix))) return true
  if (PLACEHOLDER_LOCAL_PARTS.has(local)) return true

  // Phone number pasted as local part on placeholder/reserved-style domains.
  if (/^\d{7,15}$/.test(local) && (NON_DELIVERABLE_EMAIL_DOMAINS.has(domain) || domain.endsWith('.example'))) {
    return true
  }

  return false
}

/** Format OK and not an obvious placeholder / reserved address. */
export function hasValidEmail(email) {
  return hasValidEmailFormat(email) && !isNonDeliverableEmail(email)
}
