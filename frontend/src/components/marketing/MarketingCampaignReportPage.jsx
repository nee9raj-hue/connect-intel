import MarketingReportFocusShell from './MarketingReportFocusShell'
import { CampaignDetailReport } from './CampaignReportsView'

export default function MarketingCampaignReportPage({
  campaignId,
  campaignName,
  onNavigate,
  onDuplicate,
  onReload,
  onPause,
  onResume,
  onStop,
  onContinue,
  busy,
}) {
  if (!campaignId) {
    return (
      <MarketingReportFocusShell title="Campaign report" onNavigate={onNavigate}>
        <p className="mc-analytics-empty">No campaign selected.</p>
      </MarketingReportFocusShell>
    )
  }

  return (
    <MarketingReportFocusShell
      title={campaignName || 'Campaign report'}
      onNavigate={onNavigate}
      showBackToList
    >
      <div className="mc-page mc-report-detail-page">
        <CampaignDetailReport
          fullPage
          campaignId={campaignId}
          campaignName={campaignName}
          onNavigate={onNavigate}
          onDuplicate={onDuplicate}
          onReload={onReload}
          onPause={onPause}
          onResume={onResume}
          onStop={onStop}
          onContinue={onContinue}
          busy={busy}
        />
      </div>
    </MarketingReportFocusShell>
  )
}
