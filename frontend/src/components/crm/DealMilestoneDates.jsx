import {
  DEAL_QUERY_FIELDS,
  applyDealOutcome,
  dealOutcomeDateField,
  dealOutcomeOptions,
  filledDealMilestones,
  formatDealCalendarDate,
  resolveDealOutcome,
} from '../../lib/dealMilestones'

export function DealMilestoneChips({ deal, className = '' }) {
  const filled = filledDealMilestones(deal)
  if (!filled.length) return null
  return (
    <ul className={`lw-deal-date-chips ${className}`.trim()}>
      {filled.map((field) => (
        <li key={field.id}>
          <span>{field.label}</span>
          <time dateTime={field.value}>{field.display}</time>
        </li>
      ))}
    </ul>
  )
}

export default function DealMilestoneDates({
  values = {},
  stage = '',
  onChange,
  disabled = false,
  loggedAt = null,
  compact = false,
  includeBooked = true,
}) {
  const outcome = resolveDealOutcome({ ...values, stage })
  const dateId = dealOutcomeDateField(outcome)
  const outcomeDate = dateId ? values[dateId] || '' : ''
  const options = dealOutcomeOptions({ includeBooked })
  const outcomeMeta = options.find((row) => row.id === outcome)

  const emit = (nextValues, nextOutcome) => {
    onChange?.(nextValues, { outcome: nextOutcome })
  }

  const changeQuery = (fieldId, raw) => {
    emit({ ...values, [fieldId]: raw || null }, outcome)
  }

  const changeOutcome = (nextOutcome) => {
    const previous =
      values.bookedOn || values.wonOn || values.lostOn || outcomeDate || null
    const field = dealOutcomeDateField(nextOutcome)
    const nextDate = field ? values[field] || previous : null
    emit(applyDealOutcome(values, nextOutcome, nextDate), nextOutcome)
  }

  const changeOutcomeDate = (raw) => {
    emit(applyDealOutcome(values, outcome, raw || null), outcome)
  }

  return (
    <section className={`lw-deal-dates ${compact ? 'lw-deal-dates--compact' : ''}`}>
      <header className="lw-deal-dates__head">
        <h4>Customer dates</h4>
        <p>When it happened with the customer — not when it was entered in CRM.</p>
      </header>
      <div className="lw-deal-dates__grid">
        {DEAL_QUERY_FIELDS.map((field) => (
          <label key={field.id} className="lw-deal-dates__field">
            <span className="lw-deal-dates__label">{field.label}</span>
            <input
              type="date"
              className="lw-deal-dates__input"
              value={values[field.id] || ''}
              disabled={disabled}
              title={field.hint}
              aria-label={field.label}
              onChange={(e) => changeQuery(field.id, e.target.value)}
            />
          </label>
        ))}
      </div>
      <div className="lw-deal-dates__outcome">
        <label className="lw-deal-dates__field">
          <span className="lw-deal-dates__label">Outcome</span>
          <select
            className="lw-deal-dates__input"
            value={outcome}
            disabled={disabled}
            aria-label="Deal outcome"
            onChange={(e) => changeOutcome(e.target.value)}
          >
            {options.map((option) => (
              <option key={option.id || 'open'} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {outcome ? (
          <label className="lw-deal-dates__field">
            <span className="lw-deal-dates__label">{outcomeMeta?.label || 'Outcome'} on</span>
            <input
              type="date"
              className="lw-deal-dates__input"
              value={outcomeDate}
              disabled={disabled}
              aria-label={`${outcomeMeta?.label || 'Outcome'} date`}
              onChange={(e) => changeOutcomeDate(e.target.value)}
            />
          </label>
        ) : (
          <p className="lw-deal-dates__outcome-hint">Won stays until the shipment is booked. Final stage is Booked or Lost.</p>
        )}
      </div>
      {loggedAt ? (
        <p className="lw-deal-dates__crm">Logged in CRM {formatDealCalendarDate(loggedAt) || '—'}</p>
      ) : null}
    </section>
  )
}
