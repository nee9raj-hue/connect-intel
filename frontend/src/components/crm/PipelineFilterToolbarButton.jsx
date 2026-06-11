import { SlidersIcon } from '../ui/icons'

function ChevronDown() {
  return (
    <svg className="crm-filter-chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4.5 6l3.5 3.5L11.5 6H4.5z" />
    </svg>
  )
}

/** HubSpot-style filter trigger — opens popup page on click. */
export default function PipelineFilterToolbarButton({
  label,
  displayValue,
  active = false,
  onClick,
  variant = 'default',
  'aria-expanded': ariaExpanded,
}) {
  const isMore = variant === 'more'
  const shown = displayValue && active

  return (
    <button
      type="button"
      className={
        isMore
          ? `hs-advanced-filter-btn ${active ? 'is-active' : ''}`
          : `crm-filter-btn ${active ? 'crm-filter-btn-active' : ''}`
      }
      onClick={onClick}
      aria-expanded={ariaExpanded}
      aria-label={label}
    >
      {isMore ? (
        <>
          <SlidersIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
          <span>{label}</span>
        </>
      ) : (
        <>
          <span className="truncate max-w-[150px]">
            {shown ? (
              <>
                <span className="crm-filter-btn-label">{label}:</span> {displayValue}
              </>
            ) : (
              label
            )}
          </span>
          <ChevronDown />
        </>
      )}
    </button>
  )
}
