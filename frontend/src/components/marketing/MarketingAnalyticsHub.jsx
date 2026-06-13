import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { navigateToMarketingPipeline } from '../../lib/marketingNavigation'
import CampaignReportsView from './CampaignReportsView'
import MarketingAnalyticsPage from './MarketingAnalyticsPage'
import { ChevronLeftIcon } from '../ui/icons'

export default function MarketingAnalyticsHub({
  onNavigate,
  period: externalPeriod,
  onPeriodChange,
  campaignId,
  reportCampaigns = [],
  summary = null,
  teamMembers = [],
  onReload,
  onDuplicate,
  onPause,
  onResume,
  onStop,
  onContinue,
  busy = false,
  showCreator = false,
}) {
  const [period, setPeriod] = useState(externalPeriod || '30d')
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [drillId, setDrillId] = useState(campaignId || null)

  useEffect(() => {
    if (externalPeriod && externalPeriod !== period) setPeriod(externalPeriod)
  }, [externalPeriod, period])

  useEffect(() => {
    if (campaignId) setDrillId(campaignId)
  }, [campaignId])

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

  const openDrill = (id) => {
    setDrillId(id)
    onNavigate?.('marketing', { tab: 'analytics', campaignId: id })
  }

  const closeDrill = () => {
    setDrillId(null)
    onNavigate?.('marketing', { tab: 'analytics' })
  }

  if (drillId) {
    return (
      <div className="mc-page mc-analytics-page mc-analytics-page--drill">
        <button type="button" className="mc-analytics-back" onClick={closeDrill}>
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Analytics
        </button>
        <CampaignReportsView
          campaigns={reportCampaigns}
          initialCampaignId={drillId}
          onNavigate={onNavigate}
          onReload={onReload}
          onDuplicate={onDuplicate}
          onPause={onPause}
          onResume={onResume}
          onStop={onStop}
          onContinue={onContinue}
          busy={busy}
          showCreator={showCreator}
        />
      </div>
    )
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
      onDrillCampaign={openDrill}
      onNavigate={onNavigate}
      onPause={onPause}
      onResume={onResume}
      onStop={onStop}
      busy={busy}
      goToCampaignPipeline={goToCampaignPipeline}
    />
  )
}
