import {
  getEmailValidationState,
  EMAIL_VALIDATION_TOOLTIPS,
} from '../../lib/emailUtils'
import { EmailValidIcon, EmailInvalidIcon, EmailUncertainIcon } from '../ui/icons'

const STATE_CONFIG = {
  valid: { Icon: EmailValidIcon, className: 'pipeline-email-status--valid' },
  invalid: { Icon: EmailInvalidIcon, className: 'pipeline-email-status--invalid' },
  uncertain: { Icon: EmailUncertainIcon, className: 'pipeline-email-status--uncertain' },
}

export default function EmailValidationIcon({ lead, className = '' }) {
  const state = getEmailValidationState(lead)
  if (state === 'none') return null

  const { Icon, className: stateClass } = STATE_CONFIG[state]
  const title = EMAIL_VALIDATION_TOOLTIPS[state]

  return (
    <span
      className={`pipeline-email-status ${stateClass} ${className}`.trim()}
      title={title}
      aria-label={title}
    >
      <Icon className="pipeline-email-status__icon" />
    </span>
  )
}
