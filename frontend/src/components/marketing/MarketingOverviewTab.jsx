import MarketingCreateHome from './MarketingCreateHome'
import MarketingGettingStarted from './MarketingGettingStarted'
import MarketingHubScopeBanner from './MarketingHubScopeBanner'

export default function MarketingOverviewTab({
  onNavigate,
  lists = [],
  reportCampaigns = [],
  onCreateCampaign,
}) {
  return (
    <div className="mc-page mc-home">
      <div className="px-4 pt-4 sm:px-6">
        <MarketingHubScopeBanner />
      </div>
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
