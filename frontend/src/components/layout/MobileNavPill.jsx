import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import useIsMobile from '../../hooks/useIsMobile'
import {
  isNavTargetActive,
  MOBILE_NAV_PILL_ITEMS,
  MOBILE_NAV_PILL_MORE_ITEMS,
  MOBILE_NAV_PILL_PRIMARY_ITEMS,
  navTargetToOptions,
} from '../../lib/navConfig'
import ChithiMenuIcon from '../ui/ChithiMenuIcon'
import {
  CalendarIcon,
  HomeIcon,
  MailIcon,
  MoreHorizontalIcon,
  PeopleIcon,
  PipelineIcon,
  SparkIcon,
  TaskIcon,
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
  task: TaskIcon,
  more: MoreHorizontalIcon,
}

function pillItemActive(activePanel, panelOptions, item) {
  if (item.matchPanelOnly) return activePanel === item.panel
  return isNavTargetActive(activePanel, panelOptions, item)
}

function isMoreSectionActive(activePanel, panelOptions) {
  return !MOBILE_NAV_PILL_ITEMS.some((item) => pillItemActive(activePanel, panelOptions, item))
}

function NavPillButton({ item, active, badge, onClick }) {
  const Icon = ICONS[item.icon] || HomeIcon
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={item.label}
      title={item.label}
      className={`mobile-nav-pill__item ${active ? 'is-active' : ''}`}
    >
      <span className="mobile-nav-pill__icon-wrap relative shrink-0">
        <Icon className="mobile-nav-pill__icon shrink-0" aria-hidden />
        {badge > 0 && (
          <span className="mobile-nav-pill__badge">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span className="mobile-nav-pill__label">{item.label}</span>
    </button>
  )
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

  const badgeFor = (item) => (item.badgeKey === 'chithi' ? chithiUnread?.total || 0 : 0)

  return (
    <nav
      className={`mobile-nav-pill fixed z-[65] left-1/2 md:hidden ${visible ? 'is-visible' : 'is-retracted'}`}
      aria-label="Quick navigation"
      aria-hidden={!visible}
    >
      <div className="mobile-nav-pill__track">
        <div className="mobile-nav-pill__inner">
          <div className="mobile-nav-pill__primary" aria-label="Primary shortcuts">
            {MOBILE_NAV_PILL_PRIMARY_ITEMS.map((item) => (
              <NavPillButton
                key={item.id}
                item={item}
                active={pillItemActive(activePanel, panelOptions, item)}
                badge={badgeFor(item)}
                onClick={() => go(item)}
              />
            ))}
          </div>
          <div className="mobile-nav-pill__scroll" aria-label="More shortcuts">
            {MOBILE_NAV_PILL_MORE_ITEMS.map((item) => (
              <NavPillButton
                key={item.id}
                item={item}
                active={pillItemActive(activePanel, panelOptions, item)}
                badge={badgeFor(item)}
                onClick={() => go(item)}
              />
            ))}
            <button
              type="button"
              onClick={onOpenMenu}
              aria-label="More navigation"
              title="More"
              className={`mobile-nav-pill__item ${moreActive ? 'is-active' : ''}`}
            >
              <span className="mobile-nav-pill__icon-wrap shrink-0">
                <MoreHorizontalIcon className="mobile-nav-pill__icon shrink-0" aria-hidden />
              </span>
              <span className="mobile-nav-pill__label">More</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
