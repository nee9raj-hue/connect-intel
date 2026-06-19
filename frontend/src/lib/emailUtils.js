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
  leadCanReceiveCommercialEmail,
} from '../../../lib/leadEmailSendable.js'
import {
  leadHasCommercialEmailConsent,
  commercialEmailConsentLabel,
  COMMERCIAL_EMAIL_CONSENT_MESSAGE,
} from '../../../lib/emailConsent.js'

export {
  hasValidEmail,
  hasValidEmailFormat,
  isNonDeliverableEmail,
  getLeadEmail,
  leadEmailBounced,
  getEmailValidationState,
  leadHasSendableEmail,
  leadCanReceiveCommercialEmail,
  leadHasCommercialEmailConsent,
  commercialEmailConsentLabel,
  COMMERCIAL_EMAIL_CONSENT_MESSAGE,
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
