import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import useIsMobile from '../../hooks/useIsMobile'
import { isNavTargetActive, MOBILE_NAV_PILL_ITEMS, navTargetToOptions } from '../../lib/navConfig'
import { HomeIcon, MailIcon, MoreHorizontalIcon, PipelineIcon, SparkIcon } from '../ui/icons'

const ICONS = {
  home: HomeIcon,
  pipeline: PipelineIcon,
  spark: SparkIcon,
  mail: MailIcon,
  more: MoreHorizontalIcon,
}

function pillItemActive(activePanel, panelOptions, item) {
  if (item.matchPanelOnly) return activePanel === item.panel
  return isNavTargetActive(activePanel, panelOptions, item)
}

function isMoreSectionActive(activePanel, panelOptions) {
  return !MOBILE_NAV_PILL_ITEMS.some((item) => pillItemActive(activePanel, panelOptions, item))
}

export default function MobileNavPill({ activePanel, panelOptions, onNavigate, onOpenMenu }) {
  const { user, pipelineLeadId } = useApp()
  const isMobile = useIsMobile()

  const moreActive = useMemo(
    () => isMoreSectionActive(activePanel, panelOptions),
    [activePanel, panelOptions]
  )

  if (!isMobile || !user || user.isPlatformAdmin || pipelineLeadId) return null

  const go = (item) => {
    onNavigate?.(item.panel, navTargetToOptions(item))
  }

  return (
    <nav
      className="mobile-nav-pill fixed z-[65] left-1/2 -translate-x-1/2 md:hidden"
      aria-label="Quick navigation"
    >
      <div className="flex items-center gap-1 rounded-full border border-[#d7dde5] bg-white/96 px-1.5 py-1.5 shadow-[0_12px_34px_rgba(15,23,42,0.16)] backdrop-blur-md">
        {MOBILE_NAV_PILL_ITEMS.map((item) => {
          const Icon = ICONS[item.icon] || HomeIcon
          const active = pillItemActive(activePanel, panelOptions, item)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-w-[3.2rem] flex-col items-center justify-center rounded-full px-2.5 py-1.5 transition-colors ${
                active ? 'bg-[#17191c] text-white' : 'text-[#596577] hover:bg-[#f2f5f8]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="mt-0.5 max-w-[3.5rem] truncate text-[9px] font-semibold leading-tight tracking-[-0.02em]">
                {item.label}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="More navigation"
          className={`flex min-w-[3.2rem] flex-col items-center justify-center rounded-full px-2.5 py-1.5 transition-colors ${
            moreActive ? 'bg-[#17191c] text-white' : 'text-[#596577] hover:bg-[#f2f5f8]'
          }`}
        >
          <MoreHorizontalIcon className="w-4 h-4 shrink-0" />
          <span className="mt-0.5 text-[9px] font-semibold leading-tight tracking-[-0.02em]">More</span>
        </button>
      </div>
    </nav>
  )
}
