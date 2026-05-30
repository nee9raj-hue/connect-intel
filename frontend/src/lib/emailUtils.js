/** Client-side email format check (mirrors lib/server/leadQuality.js). */
export function hasValidEmail(email) {
  const value = String(email || '').trim()
  if (!value || value.includes('•')) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value)
}

export function getLeadEmail(lead) {
  let email = String(lead?.email || lead?.work_email || lead?.workEmail || '').trim().toLowerCase()
  if (email === 'n/a' || email === 'na') email = ''
  return email
}

/** @returns {'none' | 'invalid' | 'uncertain' | 'valid'} */
export function getEmailValidationState(lead) {
  const email = getLeadEmail(lead)
  if (!email) return 'none'
  if (!hasValidEmail(email)) return 'invalid'

  const status = String(lead?.emailStatus || '').trim().toLowerCase()
  if (status === 'likely' || status === 'unverified') return 'uncertain'
  return 'valid'
}

/** Bulk send / mailto: valid format only — includes verified and unverified/likely, not invalid. */
export function leadHasSendableEmail(lead) {
  const state = getEmailValidationState(lead)
  return state === 'valid' || state === 'uncertain'
}

export function leadDisplayName(lead) {
  return [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.company || 'Lead'
}

export const EMAIL_VALIDATION_TOOLTIPS = {
  valid: 'Valid email format',
  invalid: 'Invalid or missing email',
  uncertain: 'Email present but not verified',
}
