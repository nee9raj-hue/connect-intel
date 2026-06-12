import { MARKETING_HUB_TABS, MOBILE_HUB_TABS } from '../../lib/marketingHubNav'
import useIsMobile from '../../hooks/useIsMobile'

const SIDEBAR_ICONS = {
  overview: '⌂',
  campaigns: '✉',
  'bulk-email': '◎',
  automations: '⚡',
  audiences: '👥',
  forms: '📋',
  landing: '🌐',
  templates: '▦',
  analytics: '📊',
  domains: '🔗',
}

export default function MarketingHubShell({
  tab,
  onTabChange,
  onNavigate,
  onCreateCampaign,
  onImportContacts,
  orgName,
  children,
  alerts,
}) {
  const isMobile = useIsMobile()
  const visibleTabs = isMobile ? MOBILE_HUB_TABS : MARKETING_HUB_TABS
  const useSidebar = !isMobile

  const backToCrm = () => {
    onNavigate?.('pipeline')
  }

  const sidebar = useSidebar ? (
    <aside className="mhub-v3-sidebar" aria-label="Marketing navigation">
      <div className="mhub-v3-sidebar__brand">Marketing</div>
      <button type="button" className="mhub-v3-btn mhub-v3-btn--primary mhub-v3-sidebar__create" onClick={onCreateCampaign}>
        Create
      </button>
      <nav className="mhub-v3-sidebar__nav">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`mhub-v3-sidebar__link${tab === t.id ? ' is-active' : ''}`}
            onClick={() => onTabChange(t.id)}
          >
            <span aria-hidden>{SIDEBAR_ICONS[t.id] || '•'}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </aside>
  ) : null

  const topbar = (
    <header className="mhub-v3-topbar">
      <div className="mhub-v3-topbar__left">
        <button type="button" className="mhub-v3-back" onClick={backToCrm}>
          ← CRM
        </button>
        <h1 className="mhub-v3-topbar__title">Marketing Hub</h1>
        {orgName ? <span className="mhub-v3-org">{orgName}</span> : null}
      </div>
      <div className="mhub-v3-topbar__actions">
        <button type="button" className="mhub-v3-btn" onClick={onImportContacts}>
          Import
        </button>
        <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" onClick={onCreateCampaign}>
          Create campaign
        </button>
      </div>
    </header>
  )

  const tabs = !useSidebar ? (
    <nav className="mhub-v3-tabs" aria-label="Marketing sections">
      {visibleTabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`mhub-v3-tab${tab === t.id ? ' is-active' : ''}`}
          onClick={() => onTabChange(t.id)}
        >
          {isMobile ? t.short || t.label : t.label}
        </button>
      ))}
    </nav>
  ) : null

  return (
    <div className={`mhub-v3 mhub-shell panel-shell flex-1 min-h-0 w-full${useSidebar ? ' mhub-v3--sidebar' : ''}`}>
      {sidebar}
      <div className="mhub-v3-main">
        {topbar}
        {tabs}
        {alerts ? <div className="mhub-v3-alerts">{alerts}</div> : null}
        <div className="mhub-v3-body panel-body-scroll">{children}</div>
      </div>
    </div>
  )
}
