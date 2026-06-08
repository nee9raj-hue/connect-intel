import { useState } from 'react'
import { MARKETING_HUB_TABS, MOBILE_HUB_TABS } from '../../lib/marketingHubNav'
import useIsMobile from '../../hooks/useIsMobile'

export default function MarketingHubShell({
  tab,
  onTabChange,
  onNavigate,
  period = '30d',
  onPeriodChange,
  onCreateCampaign,
  onCreateAutomation,
  onImportContacts,
  onCreateForm,
  onCreateLanding,
  searchValue = '',
  onSearchChange,
  children,
  alerts,
}) {
  const isMobile = useIsMobile()
  const [searchOpen, setSearchOpen] = useState(false)
  const visibleTabs = isMobile ? MOBILE_HUB_TABS : MARKETING_HUB_TABS

  return (
    <div className="mhub-shell panel-shell">
      <header className="mhub-header">
        <div className="mhub-header__top">
          <div className="mhub-header__brand">
            <p className="mhub-header__eyebrow">Connect Intel</p>
            <h1 className="mhub-header__title">Marketing Hub</h1>
          </div>
          <div className="mhub-header__actions">
            <button type="button" className="mhub-header__cta" onClick={onCreateCampaign}>
              Create campaign
            </button>
            <button type="button" className="mhub-header__btn" onClick={onCreateAutomation}>
              Automation
            </button>
            <button type="button" className="mhub-header__btn mhub-header__btn--hide-mobile" onClick={onImportContacts}>
              Import contacts
            </button>
            <button type="button" className="mhub-header__btn mhub-header__btn--hide-mobile" onClick={onCreateForm}>
              Form
            </button>
            <button type="button" className="mhub-header__btn mhub-header__btn--hide-mobile" onClick={onCreateLanding}>
              Landing page
            </button>
            <button
              type="button"
              className="mhub-header__icon-btn"
              aria-label="Search marketing"
              onClick={() => setSearchOpen((o) => !o)}
            >
              ⌕
            </button>
            <select
              className="mhub-header__period"
              value={period}
              onChange={(e) => onPeriodChange?.(e.target.value)}
              aria-label="Date range"
            >
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="90d">90 days</option>
              <option value="year">Year</option>
            </select>
          </div>
        </div>

        {searchOpen ? (
          <div className="mhub-header__search">
            <input
              type="search"
              placeholder="Search campaigns, lists, templates…"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="mhub-header__search-input"
            />
          </div>
        ) : null}

        <nav className="mhub-nav" aria-label="Marketing sections">
          <div className="mhub-nav__strip">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`mhub-nav__tab${tab === t.id ? ' is-active' : ''}`}
                onClick={() => onTabChange(t.id)}
              >
                <span className="mhub-nav__tab-long">{t.label}</span>
                <span className="mhub-nav__tab-short">{t.short}</span>
              </button>
            ))}
          </div>
        </nav>

        {alerts}
      </header>

      <div className="mhub-body panel-body-scroll">{children}</div>
    </div>
  )
}
