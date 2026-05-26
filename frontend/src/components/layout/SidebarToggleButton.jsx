export default function SidebarToggleButton({ mode = 'expanded', onToggle, showLabel = false, className = '' }) {
  const rail = mode === 'rail'
  const label = rail ? 'Expand sidebar' : 'Collapse to icons'

  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        showLabel
          ? `hidden md:flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors mb-2 ${className}`
          : `inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors ${className}`
      }
      title={label}
      aria-expanded={!rail}
      aria-label={label}
    >
      <PanelToggleIcon className={showLabel ? 'w-4 h-4 shrink-0' : 'w-5 h-5'} rail={rail} />
      {showLabel && <span className="flex-1 text-left truncate">{label}</span>}
    </button>
  )
}

function PanelToggleIcon({ className, rail }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      {rail ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7" />
      )}
    </svg>
  )
}
