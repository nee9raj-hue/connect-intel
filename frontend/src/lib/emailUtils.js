import {
  hasValidEmail,
  hasValidEmailFormat,
  isNonDeliverableEmail,
} from '../../../lib/emailValidation.js'

export { hasValidEmail, hasValidEmailFormat, isNonDeliverableEmail }

export function getLeadEmail(lead) {
  let email = String(lead?.email || lead?.work_email || lead?.workEmail || '').trim().toLowerCase()
  if (email === 'n/a' || email === 'na') email = ''
  return email
}

/** @returns {'none' | 'invalid' | 'uncertain' | 'valid'} */
export function leadEmailBounced(lead) {
  return Boolean(lead?.emailBouncedAt)
}

export function getEmailValidationState(lead) {
  const email = getLeadEmail(lead)
  if (!email) return 'none'
  if (leadEmailBounced(lead)) return 'invalid'
  if (!hasValidEmailFormat(email)) return 'invalid'
  if (isNonDeliverableEmail(email)) return 'invalid'

  const status = String(lead?.emailStatus || '').trim().toLowerCase()
  if (status === 'likely' || status === 'unverified') return 'uncertain'
  return 'valid'
}

/** Bulk send / mailto: verified format only — not invalid placeholders. */
export function leadHasSendableEmail(lead) {
  const state = getEmailValidationState(lead)
  return state === 'valid' || state === 'uncertain'
}

export function leadDisplayName(lead) {
  return [lead?.firstName, lead?.lastName].filter(Boolean).join(' ') || lead?.company || 'Lead'
}

export function emailValidationTooltip(lead) {
  if (leadEmailBounced(lead)) {
    const reason = String(lead?.emailBounceReason || '').trim()
    return reason ? `Email bounced — ${reason}` : 'Email bounced — delivery failed'
  }
  const state = getEmailValidationState(lead)
  return EMAIL_VALIDATION_TOOLTIPS[state] || ''
}

export const EMAIL_VALIDATION_TOOLTIPS = {
  valid: 'Valid email format',
  invalid: 'Invalid, placeholder, or undeliverable email',
  uncertain: 'Email present but not verified',
}
