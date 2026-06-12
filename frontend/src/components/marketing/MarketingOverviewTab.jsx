import MarketingCreateHome from './MarketingCreateHome'
import MarketingGettingStarted from './MarketingGettingStarted'

export default function MarketingOverviewTab({
  onNavigate,
  lists = [],
  reportCampaigns = [],
  onCreateCampaign,
}) {
  return (
    <div className="mc-page mc-home">
      <MarketingCreateHome onNavigate={onNavigate} onCreateCampaign={onCreateCampaign} />
      <MarketingGettingStarted
        lists={lists}
        reportCampaigns={reportCampaigns}
        onNavigate={onNavigate}
        onCreateCampaign={onCreateCampaign}
      />
    </div>
  )
}
