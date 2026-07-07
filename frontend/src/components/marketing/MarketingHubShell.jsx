import { useEffect, useState } from 'react'
import {
  MARKETING_HUB_TABS,
  MOBILE_HUB_TABS,
  CAMPAIGN_SUB_NAV,
  AUDIENCE_SUB_NAV,
} from '../../lib/marketingHubNav'
import useIsMobile from '../../hooks/useIsMobile'
import { BRAND_LOGO_MARK_LIGHT, BRAND_LOGO_MARK_CLASS } from '../../lib/brandAssets'
import { openConnectAI } from '../../lib/openConnectAI'
import {
  HomeIcon,
  MailIcon,
  BoltIcon,
  PeopleIcon,
  NoteIcon,
  ChartIcon,
  LayoutTemplateIcon,
  RouteIcon,
  ChevronLeftIcon,
  SignOutIcon,
} from '../ui/icons'

const SIDEBAR_KEY = 'ci_mhub_sidebar_collapsed'

const TAB_ICONS = {
  overview: HomeIcon,
  campaigns: MailIcon,
  automations: BoltIcon,
  audiences: PeopleIcon,
  forms: NoteIcon,
  analytics: ChartIcon,
  domains: RouteIcon,
  templates: LayoutTemplateIcon,
}

function loadCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

function userInitials(user) {
  const n = [user?.firstName, user?.lastName].filter(Boolean).join(' ')
  if (n) {
    const p = n.split(/\s+/)
    return `${p[0]?.[0] || ''}${p[1]?.[0] || ''}`.toUpperCase() || 'U'
  }
  return (user?.email?.[0] || 'U').toUpperCase()
}

export default function MarketingHubShell({
  tab,
  onTabChange,
  audienceSubTab = 'contacts',
  onAudienceSubTabChange,
  onNavigate,
  onCreateCampaign,
  user,
  orgName,
  children,
  alerts,
}) {
  const isMobile = useIsMobile()
  const visibleTabs = isMobile ? MOBILE_HUB_TABS : MARKETING_HUB_TABS
  const [collapsed, setCollapsed] = useState(loadCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  const backToCrm = () => onNavigate?.('pipeline')

  const sidebar = !isMobile ? (
    <aside className={`mc-nav${collapsed ? ' is-collapsed' : ''}`} aria-label="Marketing">
      <div className="mc-nav__head">
        <img src={BRAND_LOGO_MARK_LIGHT} alt="" className={`mc-nav__logo ${BRAND_LOGO_MARK_CLASS}`} />
        {!collapsed ? <span className="mc-nav__brand">Connect Intel</span> : null}
        <button
          type="button"
          className="mc-nav__collapse"
          onClick={backToCrm}
          title="Back to CRM"
          aria-label="Back to CRM"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
      </div>

      <button type="button" className="mc-nav__create" onClick={onCreateCampaign}>
        {!collapsed ? '+ Create' : '+'}
      </button>

      <nav className="mc-nav__links">
        {visibleTabs.map((t) => {
          const Icon = TAB_ICONS[t.id] || MailIcon
          const active = tab === t.id
          return (
            <div key={t.id}>
              <button
                type="button"
                className={`mc-nav__link${active ? ' is-active' : ''}`}
                onClick={() => onTabChange(t.id)}
                title={t.label}
              >
                <Icon className="mc-nav__icon" />
                {!collapsed ? (
                  <>
                    <span>{t.label}</span>
                    {t.badge ? <span className="mc-nav__badge mc-nav__badge--inline">{t.badge}</span> : null}
                  </>
                ) : null}
              </button>
              {!collapsed && CAMPAIGN_SUB_NAV.length > 0 && t.id === 'campaigns' && tab === 'campaigns'
                ? CAMPAIGN_SUB_NAV.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      className={`mc-nav__sublink${tab === sub.id ? ' is-active' : ''}`}
                      onClick={() => onTabChange(sub.id)}
                    >
                      {sub.label}
                      {sub.badge ? <span className="mc-nav__badge">{sub.badge}</span> : null}
                    </button>
                  ))
                : null}
              {!collapsed && t.id === 'audiences' && tab === 'audiences'
                ? AUDIENCE_SUB_NAV.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      className={`mc-nav__sublink${audienceSubTab === sub.id ? ' is-active' : ''}`}
                      onClick={() => onAudienceSubTabChange?.(sub.id)}
                    >
                      {sub.label}
                    </button>
                  ))
                : null}
            </div>
          )
        })}
      </nav>

      <div className="mc-nav__foot">
        {!collapsed && user ? (
          <div className="mc-nav__user">
            <span className="mc-nav__avatar" aria-hidden>
              {userInitials(user)}
            </span>
            <div className="mc-nav__user-meta">
              <strong>
                {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
              </strong>
              <span>{user.email}</span>
            </div>
          </div>
        ) : null}
        <button type="button" className="mc-nav__exit" onClick={backToCrm}>
          <SignOutIcon className="mc-nav__icon" />
          {!collapsed ? <span>Back to CRM</span> : null}
        </button>
        <button type="button" className="mc-nav__exit" onClick={() => openConnectAI()}>
          <BoltIcon className="mc-nav__icon" />
          {!collapsed ? <span>CRM AI</span> : null}
        </button>
      </div>
    </aside>
  ) : null

  const mobileTabs = isMobile ? (
    <nav className="mc-mobile-tabs" aria-label="Marketing sections">
      {visibleTabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`mc-mobile-tabs__btn${tab === t.id ? ' is-active' : ''}`}
          onClick={() => onTabChange(t.id)}
        >
          {t.short || t.label}
        </button>
      ))}
      <button type="button" className="mc-mobile-tabs__btn" onClick={() => openConnectAI()}>
        AI
      </button>
    </nav>
  ) : null

  return (
    <div className="mc-shell">
      {sidebar}
      <div className="mc-shell__main">
        {mobileTabs}
        {alerts ? <div className="mc-shell__alerts">{alerts}</div> : null}
        <div className="mc-shell__body">{children}</div>
      </div>
    </div>
  )
}
