import { MARKETING_HUB_TABS, MOBILE_HUB_TABS } from '../../lib/marketingHubNav'
import useIsMobile from '../../hooks/useIsMobile'

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

  const backToCrm = () => {
    onNavigate?.('pipeline')
  }

  return (
    <div className="mhub-v3 mhub-shell panel-shell flex-1 min-h-0 w-full">
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
          <button type="button" className="mhub-v3-btn mhub-v3-btn--accent" onClick={onCreateCampaign}>
            Create campaign
          </button>
        </div>
      </header>

      <nav className="mhub-v3-tabs" aria-label="Marketing sections">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`mhub-v3-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {alerts ? <div className="mhub-v3-alerts">{alerts}</div> : null}

      <div className="mhub-v3-body panel-body-scroll">{children}</div>
    </div>
  )
}
