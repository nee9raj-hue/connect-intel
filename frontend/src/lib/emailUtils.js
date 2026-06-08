import {
  hasValidEmail,
  hasValidEmailFormat,
  isNonDeliverableEmail,
} from '../../../lib/emailValidation.js'
import {
  getLeadEmail,
  getEmailValidationState,
  leadEmailBounced,
  leadHasSendableEmail,
} from '../../../lib/leadEmailSendable.js'

export {
  hasValidEmail,
  hasValidEmailFormat,
  isNonDeliverableEmail,
  getLeadEmail,
  leadEmailBounced,
  getEmailValidationState,
  leadHasSendableEmail,
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
