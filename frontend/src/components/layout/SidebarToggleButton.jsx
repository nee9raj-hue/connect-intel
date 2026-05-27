import { SidebarCollapseIcon, SidebarExpandIcon } from '../ui/icons'

export default function SidebarToggleButton({ mode = 'expanded', onToggle, showLabel = false, className = '' }) {
  const rail = mode === 'rail'
  const label = rail ? 'Expand sidebar' : 'Collapse to icons'

  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        showLabel
          ? `hidden md:flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[11px] font-medium tracking-[-0.015em] text-[#a9b2ba] hover:bg-white/8 hover:text-white transition-colors mb-2 ${className}`
          : `inline-flex items-center justify-center rounded-xl border border-[#d7dde5] bg-white px-2.5 py-2 text-[#536072] hover:bg-[#f5f7fa] hover:text-[#17191c] transition-colors ${className}`
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
  if (rail) return <SidebarExpandIcon className={className} />
  return <SidebarCollapseIcon className={className} />
}
