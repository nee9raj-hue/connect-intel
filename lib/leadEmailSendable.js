import { hasValidEmailFormat, isNonDeliverableEmail } from './emailValidation.js'
import { leadHasCommercialEmailConsent } from './emailConsent.js'

export function getLeadEmail(lead) {
  let email = String(lead?.email || lead?.work_email || lead?.workEmail || '').trim().toLowerCase()
  if (email === 'n/a' || email === 'na') email = ''
  return email
}

export function leadEmailBounced(lead) {
  return Boolean(lead?.emailBouncedAt)
}

/** @returns {'none' | 'invalid' | 'uncertain' | 'valid'} */
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

/** Commercial outbound (CRM + marketing): valid email + recorded opt-in. */
export function leadCanReceiveCommercialEmail(lead) {
  return leadHasSendableEmail(lead) && leadHasCommercialEmailConsent(lead)
}
