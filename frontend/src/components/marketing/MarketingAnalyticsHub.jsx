import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { navigateToMarketingPipeline } from '../../lib/marketingNavigation'
import { openMarketingCampaignReport, openMarketingReportsList } from '../../lib/marketingReportUrls'
import MarketingAnalyticsPage from './MarketingAnalyticsPage'

export default function MarketingAnalyticsHub({
  onNavigate,
  period: externalPeriod,
  onPeriodChange,
  reportCampaigns = [],
  summary = null,
  teamMembers = [],
  onPause,
  onStop,
  onResume,
  busy = false,
}) {
  const [period, setPeriod] = useState(externalPeriod || '30d')
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (externalPeriod && externalPeriod !== period) setPeriod(externalPeriod)
  }, [externalPeriod, period])

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await api.getMarketingAnalytics(period)
      setAnalytics(res)
    } catch (e) {
      setError(e.message || 'Could not load analytics')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    load()
  }, [load])

  const handlePeriodChange = (next) => {
    setPeriod(next)
    onPeriodChange?.(next)
  }

  const goToCampaignPipeline = (campaign, filter) => {
    if (!campaign?.id) return
    void navigateToMarketingPipeline(onNavigate, {
      campaignId: campaign.id,
      filter,
      campaignName: campaign.name,
      returnTo: 'marketing',
    })
  }

  const openCampaignReport = (id) => {
    openMarketingCampaignReport(id)
  }

  return (
    <MarketingAnalyticsPage
      period={period}
      onPeriodChange={handlePeriodChange}
      teamMembers={teamMembers}
      analytics={analytics}
      loading={loading}
      error={error}
      reportCampaigns={reportCampaigns}
      summary={summary}
      onDrillCampaign={openCampaignReport}
      onOpenAllReports={() => openMarketingReportsList()}
      onNavigate={onNavigate}
      onPause={onPause}
      onResume={onResume}
      onStop={onStop}
      busy={busy}
      goToCampaignPipeline={goToCampaignPipeline}
    />
  )
}
