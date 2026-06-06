import { useState } from 'react'
import { useLeadPhoneCall } from '../../hooks/useLeadPhoneCall'
import LeadPhoneCall from './LeadPhoneCall'
import { leadHasCallablePhone } from '../../lib/phoneUtils'
import { CALL_OUTCOMES, fromDatetimeLocalValue } from '../../lib/crmUiConstants'

/**
 * Log outbound calls on a lead: dial, outcome, notes, and callback follow-up date.
 */
export default function LeadCallLogCard({ lead, saving, onLog, onSuccess }) {
  const [outcome, setOutcome] = useState('connected')
  const [notes, setNotes] = useState('')
  const [callbackAt, setCallbackAt] = useState('')
  const { initiateCall, logging } = useLeadPhoneCall(lead?.id)

  const phone = lead?.phone
  const callable = leadHasCallablePhone(phone)
  const busy = saving || logging

  const submitLog = async () => {
    const outcomeLabel = CALL_OUTCOMES.find((o) => o.id === outcome)?.label || outcome
    const summary = notes.trim()
      ? `Call (${outcomeLabel}): ${notes.trim()}`
      : `Call — ${outcomeLabel}`

    const body = {
      activity: {
        type: 'call',
        summary,
        meta: {
          outcome,
          direction: 'outbound',
          phone: phone || null,
        },
      },
    }

    const callbackIso = fromDatetimeLocalValue(callbackAt)
    if (callbackIso) {
      body.crm = { nextFollowUpAt: callbackIso }
    }

    await onLog(body)
    setNotes('')
    if (!callbackAt) setCallbackAt('')
    onSuccess?.('Call logged')
  }

  return (
    <section className="lead-call-log-card">
      <div className="lead-call-log-card__head">
        <h3 className="lead-call-log-card__title">Log a call</h3>
        {callable ? (
          <button
            type="button"
            className="lead-call-log-card__dial"
            disabled={busy}
            onClick={() => initiateCall(phone)}
          >
            {logging ? 'Dialing…' : 'Call now'}
          </button>
        ) : null}
      </div>
      <p className="lead-call-log-card__hint">
        Record calls you make on this lead. Set a callback date so it appears on your calendar and dashboard.
      </p>

      {phone ? (
        <p className="lead-call-log-card__phone">
          <span className="text-gray-500">Phone · </span>
          <LeadPhoneCall phone={phone} leadId={lead.id} pipelineCallIcon showNumber />
        </p>
      ) : (
        <p className="lead-call-log-card__phone lead-call-log-card__phone--missing">No phone number on this lead.</p>
      )}

      <label className="lead-call-log-card__field">
        <span>Call outcome</span>
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)} disabled={busy}>
          {CALL_OUTCOMES.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="lead-call-log-card__field">
        <span>Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          disabled={busy}
          placeholder="What was discussed? Objections, next steps…"
        />
      </label>

      <label className="lead-call-log-card__field">
        <span>Call back on</span>
        <input
          type="datetime-local"
          value={callbackAt}
          onChange={(e) => setCallbackAt(e.target.value)}
          disabled={busy}
        />
      </label>

      <button type="button" className="lead-call-log-card__submit" disabled={busy} onClick={submitLog}>
        {saving ? 'Saving…' : 'Save call to timeline'}
      </button>
    </section>
  )
}
