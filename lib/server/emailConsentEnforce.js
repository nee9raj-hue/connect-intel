import { leadHasSendableEmail, getLeadEmail } from '../leadEmailSendable.js'
import {
  COMMERCIAL_EMAIL_CONSENT_MESSAGE,
  leadHasCommercialEmailConsent,
} from '../emailConsent.js'
import { isEmailSuppressed } from './marketingUnsubscribe.js'

/**
 * Gate outbound commercial email (Gmail, Resend CRM, marketing).
 * Returns { ok: true } or { ok: false, error, code }.
 */
export function checkCommercialEmailAllowed(lead, store, scope) {
  const email = getLeadEmail(lead)
  if (!email || !leadHasSendableEmail(lead)) {
    return { ok: false, error: 'No sendable email on lead', code: 'no_email' }
  }

  if (!leadHasCommercialEmailConsent(lead)) {
    return { ok: false, error: COMMERCIAL_EMAIL_CONSENT_MESSAGE, code: 'no_consent' }
  }

  if (store && scope && isEmailSuppressed(store, { ...scope, email })) {
    return { ok: false, error: 'Recipient unsubscribed from your email list', code: 'suppressed' }
  }

  return { ok: true }
}
