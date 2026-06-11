import { SlidersIcon } from '../ui/icons'

function ChevronDown({ className = '' }) {
  return (
    <svg className={`hs-filter-popup-btn__chevron ${className}`.trim()} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4.5 6l3.5 3.5L11.5 6H4.5z" />
    </svg>
  )
}

/** HubSpot-style pipeline filter trigger (label + chevron, or More filters accent). */
export default function PipelineFilterToolbarButton({
  label,
  active = false,
  onClick,
  variant = 'default',
  'aria-expanded': ariaExpanded,
}) {
  const isMore = variant === 'more'
  return (
    <button
      type="button"
      className={`hs-filter-popup-btn ${isMore ? 'hs-filter-more-btn' : ''} ${active ? 'is-active' : ''}`}
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-label={label}
    >
      {isMore ? <SlidersIcon className="hs-filter-more-btn__icon" aria-hidden /> : null}
      <span className="hs-filter-popup-btn__label">{label}</span>
      {!isMore ? <ChevronDown /> : null}
    </button>
  )
}
