import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import useIsMobile from '../../hooks/useIsMobile'
import { isNavTargetActive, MOBILE_NAV_PILL_ITEMS, navTargetToOptions } from '../../lib/navConfig'

const ICONS = {
  home: HomeIcon,
  pipeline: PipelineIcon,
  spark: SparkIcon,
  mail: MailIcon,
  more: MoreIcon,
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
      <div className="flex items-center gap-0.5 px-1 py-1 rounded-full bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
        {MOBILE_NAV_PILL_ITEMS.map((item) => {
          const Icon = ICONS[item.icon] || HomeIcon
          const active = pillItemActive(activePanel, panelOptions, item)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center min-w-[3.25rem] px-2 py-1 rounded-full transition-colors ${
                active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[9px] font-semibold leading-tight mt-0.5 max-w-[3.5rem] truncate">
                {item.label}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="More navigation"
          className={`flex flex-col items-center justify-center min-w-[3.25rem] px-2 py-1 rounded-full transition-colors ${
            moreActive ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <MoreIcon className="w-4 h-4 shrink-0" />
          <span className="text-[9px] font-semibold leading-tight mt-0.5">More</span>
        </button>
      </div>
    </nav>
  )
}

function MoreIcon({ className }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}

function HomeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function PipelineIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
    </svg>
  )
}

function SparkIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
}

function MailIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  )
}
