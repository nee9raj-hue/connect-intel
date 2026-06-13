import { BRAND_LOGO_MARK_LIGHT, BRAND_LOGO_MARK_CLASS } from '../../lib/brandAssets'
import { openMarketingReportsList } from '../../lib/marketingReportUrls'
import { ChevronLeftIcon, RouteIcon } from '../ui/icons'

export default function MarketingReportFocusShell({
  title,
  subtitle,
  onNavigate,
  children,
  showBackToList = true,
}) {
  const goMarketing = (opts) => onNavigate?.('marketing', opts)
  const goPipeline = () => onNavigate?.('pipeline', { returnTo: 'marketing', marketingTab: 'reports' })

  return (
    <div className="mc-report-focus">
      <header className="mc-report-focus__bar">
        <div className="mc-report-focus__brand">
          <img src={BRAND_LOGO_MARK_LIGHT} alt="" className={`mc-report-focus__logo ${BRAND_LOGO_MARK_CLASS}`} />
          <div className="mc-report-focus__titles">
            <span className="mc-report-focus__eyebrow">Marketing · Reports</span>
            {title ? <h1 className="mc-report-focus__title">{title}</h1> : null}
            {subtitle ? <p className="mc-report-focus__sub">{subtitle}</p> : null}
          </div>
        </div>
        <nav className="mc-report-focus__nav" aria-label="Report navigation">
          {showBackToList ? (
            <button
              type="button"
              className="mc-btn mc-btn--ghost mc-btn--sm"
              onClick={() => openMarketingReportsList()}
            >
              <ChevronLeftIcon className="w-4 h-4" aria-hidden />
              All reports
            </button>
          ) : null}
          <button
            type="button"
            className="mc-btn mc-btn--ghost mc-btn--sm"
            onClick={() => goMarketing({ tab: 'analytics' })}
          >
            Analytics
          </button>
          <button
            type="button"
            className="mc-btn mc-btn--ghost mc-btn--sm"
            onClick={() => goMarketing({ tab: 'campaigns' })}
          >
            Campaigns
          </button>
          <button type="button" className="mc-btn mc-btn--outline mc-btn--sm" onClick={goPipeline}>
            <RouteIcon className="w-4 h-4" aria-hidden />
            CRM Pipeline
          </button>
        </nav>
      </header>
      <main className="mc-report-focus__main">{children}</main>
    </div>
  )
}
