import { DEAL_MILESTONE_FIELDS, filledDealMilestones, formatDealCalendarDate } from '../../lib/dealMilestones'

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
  onChange,
  disabled = false,
  loggedAt = null,
  compact = false,
}) {
  return (
    <section className={`lw-deal-dates ${compact ? 'lw-deal-dates--compact' : ''}`}>
      <header className="lw-deal-dates__head">
        <h4>Customer dates</h4>
        <p>When it happened with the customer — not when it was entered in CRM.</p>
      </header>
      <div className="lw-deal-dates__grid">
        {DEAL_MILESTONE_FIELDS.map((field) => (
          <label key={field.id} className="lw-deal-dates__field">
            <span className="lw-deal-dates__label">{field.label}</span>
            <input
              type="date"
              className="lw-deal-dates__input"
              value={values[field.id] || ''}
              disabled={disabled}
              title={field.hint}
              aria-label={field.label}
              onChange={(e) => onChange?.({ ...values, [field.id]: e.target.value || null })}
            />
          </label>
        ))}
      </div>
      {loggedAt ? (
        <p className="lw-deal-dates__crm">Logged in CRM {formatDealCalendarDate(loggedAt) || '—'}</p>
      ) : null}
    </section>
  )
}
