/** Shared commercial-email consent helpers (CRM + marketing compliance). */

export const COMMERCIAL_EMAIL_CONSENT_MESSAGE =
  'This lead has not opted in to receive commercial email. Record consent on the lead before sending.'

const POSITIVE = new Set([
  'yes',
  'y',
  'true',
  '1',
  'opt in',
  'opt-in',
  'optin',
  'granted',
  'consent',
  'consented',
  'ok',
  'agreed',
])

const NEGATIVE = new Set([
  'no',
  'n',
  'false',
  '0',
  'opt out',
  'opt-out',
  'optout',
  'denied',
  'no consent',
  'refused',
])

/** Parse spreadsheet / form values. null = unknown or empty. */
export function parseEmailConsentValue(raw) {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
  if (!value) return null
  if (POSITIVE.has(value)) return true
  if (NEGATIVE.has(value)) return false
  return null
}

export function leadHasCommercialEmailConsent(lead) {
  if (!lead || typeof lead !== 'object') return false
  if (lead.commercialEmailOptIn === true) return true
  if (lead.commercialEmailConsentAt) return true
  return false
}

export function applyCommercialEmailConsent(lead, { granted, source = 'manual', at } = {}) {
  if (!lead || typeof lead !== 'object') return lead
  const next = { ...lead }
  if (granted) {
    next.commercialEmailOptIn = true
    next.commercialEmailConsentAt = at || new Date().toISOString()
    next.commercialEmailConsentSource = source || 'manual'
  } else {
    next.commercialEmailOptIn = false
    next.commercialEmailConsentAt = null
    next.commercialEmailConsentSource = null
  }
  return next
}

export function commercialEmailConsentLabel(lead) {
  if (!leadHasCommercialEmailConsent(lead)) return 'No consent'
  const source = lead?.commercialEmailConsentSource
  const at = lead?.commercialEmailConsentAt
  const when = at
    ? new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
  if (source && when) return `Consented (${source}, ${when})`
  if (when) return `Consented ${when}`
  return 'Consented'
}
