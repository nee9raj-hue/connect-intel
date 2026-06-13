import MarketingReportFocusShell from './MarketingReportFocusShell'
import CampaignReportsView from './CampaignReportsView'

/** Full-page all-campaigns report list (no popups). */
export default function MarketingReportsListPage(props) {
  return (
    <MarketingReportFocusShell
      title="Campaign reports"
      subtitle="Performance across every send — open a campaign for the full engagement story."
      onNavigate={props.onNavigate}
      showBackToList={false}
    >
      <div className="mc-page mc-reports-list-page">
        <CampaignReportsView {...props} standalone />
      </div>
    </MarketingReportFocusShell>
  )
}
