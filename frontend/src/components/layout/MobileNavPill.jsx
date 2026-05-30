import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import useIsMobile from '../../hooks/useIsMobile'
import { isNavTargetActive, MOBILE_NAV_PILL_ITEMS, navTargetToOptions } from '../../lib/navConfig'
import ChithiMenuIcon from '../ui/ChithiMenuIcon'
import {
  CalendarIcon,
  HomeIcon,
  MailIcon,
  MoreHorizontalIcon,
  PeopleIcon,
  PipelineIcon,
  SparkIcon,
  WhatsAppIcon,
} from '../ui/icons'

const ICONS = {
  home: HomeIcon,
  pipeline: PipelineIcon,
  people: PeopleIcon,
  spark: SparkIcon,
  mail: MailIcon,
  whatsapp: WhatsAppIcon,
  calendar: CalendarIcon,
  chithi: ChithiMenuIcon,
  more: MoreHorizontalIcon,
}

function pillItemActive(activePanel, panelOptions, item) {
  if (item.matchPanelOnly) return activePanel === item.panel
  return isNavTargetActive(activePanel, panelOptions, item)
}

function isMoreSectionActive(activePanel, panelOptions) {
  return !MOBILE_NAV_PILL_ITEMS.some((item) => pillItemActive(activePanel, panelOptions, item))
}

export default function MobileNavPill({ activePanel, panelOptions, onNavigate, onOpenMenu, visible = true }) {
  const { user, pipelineLeadId, chithiUnread } = useApp()
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
      className={`mobile-nav-pill fixed z-[65] left-1/2 md:hidden ${visible ? 'is-visible' : 'is-retracted'}`}
      aria-label="Quick navigation"
      aria-hidden={!visible}
    >
      <div className="mobile-nav-pill__track">
        <div className="mobile-nav-pill__inner">
          {MOBILE_NAV_PILL_ITEMS.map((item) => {
            const Icon = ICONS[item.icon] || HomeIcon
            const active = pillItemActive(activePanel, panelOptions, item)
            const badge = item.badgeKey === 'chithi' ? chithiUnread?.total || 0 : 0
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item)}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                title={item.label}
                className={`mobile-nav-pill__item ${active ? 'is-active' : ''}`}
              >
                <span className="relative shrink-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-[#ff7a59] text-white text-[8px] font-bold flex items-center justify-center px-0.5">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span className="mobile-nav-pill__label">{item.label}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="More navigation"
            title="More"
            className={`mobile-nav-pill__item ${moreActive ? 'is-active' : ''}`}
          >
            <MoreHorizontalIcon className="w-4 h-4 shrink-0" />
            <span className="mobile-nav-pill__label">More</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
