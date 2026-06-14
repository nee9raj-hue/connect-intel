import { SlidersIcon } from '../ui/icons'

function ChevronDown() {
  return (
    <svg className="pipeline-filter-pill__chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4.5 6l3.5 3.5L11.5 6H4.5z" />
    </svg>
  )
}

/** Pipeline filter trigger — icon + label (+ value when filtered). */
export default function PipelineFilterToolbarButton({
  label,
  displayValue,
  active = false,
  onClick,
  variant = 'default',
  icon: Icon = null,
  iconTone = 'default',
  compact = false,
  badgeCount = 0,
  'aria-expanded': ariaExpanded,
}) {
  const isMore = variant === 'more'
  const shown = displayValue && active && !isMore
  const MoreIcon = isMore ? SlidersIcon : Icon

  return (
    <button
      type="button"
      className={[
        'pipeline-filter-pill',
        isMore ? 'pipeline-filter-pill--more' : '',
        active ? 'is-active' : '',
        compact ? 'is-compact' : '',
        MoreIcon ? `pipeline-filter-pill--tone-${iconTone}` : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-label={label}
    >
      {MoreIcon ? (
        <span className="pipeline-filter-pill__icon" aria-hidden>
          <MoreIcon className="pipeline-filter-pill__icon-svg" />
        </span>
      ) : null}
      <span className="pipeline-filter-pill__body">
        <span className="pipeline-filter-pill__label">{label}</span>
        {shown ? <span className="pipeline-filter-pill__value">{displayValue}</span> : null}
      </span>
      {!isMore ? <ChevronDown /> : null}
      {badgeCount > 0 ? (
        <span className="pipeline-filter-pill__badge" aria-hidden>
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      ) : null}
    </button>
  )
}
