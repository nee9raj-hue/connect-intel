import { useLeadPhoneCall } from '../../hooks/useLeadPhoneCall'
import { leadHasCallablePhone } from '../../lib/phoneUtils'

const PIPELINE_CALL_ICON = `${import.meta.env.BASE_URL || '/'}phone-call-icon.png`

/**
 * Phone number with optional pipeline call icon — uses device dialer (`tel:`) and logs activity on the lead.
 * Pass pipelineCallIcon on the leads table/kanban only (callable numbers).
 */
export default function LeadPhoneCall({
  phone,
  leadId,
  className = '',
  showNumber = true,
  iconOnly = false,
  pipelineCallIcon = false,
  numberClassName = '',
  onClick,
}) {
  const display = String(phone || '').trim()
  const callable = leadHasCallablePhone(display)
  const { initiateCall, logging } = useLeadPhoneCall(leadId)

  if (!display) {
    return <span className={`lead-phone-call lead-phone-call--empty ${className}`.trim()}>—</span>
  }

  if (!callable) {
    return showNumber ? (
      <span className={`lead-phone-call__number ${numberClassName}`.trim()} title={display}>
        {display}
      </span>
    ) : null
  }

  if (!pipelineCallIcon) {
    return showNumber ? (
      <span className={`lead-phone-call__number ${numberClassName}`.trim()} title={display}>
        {display}
      </span>
    ) : null
  }

  const handleCall = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    onClick?.(event)
    await initiateCall(display)
  }

  return (
    <span
      className={`lead-phone-call ${iconOnly ? 'lead-phone-call--icon-only' : ''} ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
    >
      {showNumber && !iconOnly ? (
        <span className={`lead-phone-call__number ${numberClassName}`.trim()} title={display}>
          {display}
        </span>
      ) : null}
      <button
        type="button"
        className="lead-phone-call__btn"
        onClick={handleCall}
        disabled={logging}
        title={logging ? 'Logging call…' : `Call ${display}`}
        aria-label={`Call ${display}`}
      >
        <img
          src={PIPELINE_CALL_ICON}
          alt=""
          className="lead-phone-call__icon lead-phone-call__icon--brand"
          draggable={false}
        />
      </button>
    </span>
  )
}
