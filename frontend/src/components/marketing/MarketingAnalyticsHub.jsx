import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { formatDealValue } from '../../lib/crmTimeline'
import { HubInsightPills, HubMetricTiles, HubSkeleton } from './MarketingHubCharts'
import CampaignReportsView from './CampaignReportsView'

const PERIODS = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'year', label: 'Year' },
]

export default function MarketingAnalyticsHub({
  onNavigate,
  period: externalPeriod,
  onPeriodChange,
  campaignId,
  reportCampaigns = [],
}) {
  const [period, setPeriod] = useState(externalPeriod || '30d')
  const [hub, setHub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await api.getMarketingHub(period)
      setHub(res.hub)
    } catch (e) {
      setError(e.message || 'Could not load analytics')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const runAction = (action) => {
    if (!action) return
    onNavigate?.('marketing', { tab: action.tab || 'campaigns', ...action })
  }

  if (campaignId && reportCampaigns.length) {
    return (
      <div className="mhub-analytics-page">
        <CampaignReportsView
          campaigns={reportCampaigns}
          initialCampaignId={campaignId}
          onNavigate={onNavigate}
        />
      </div>
    )
  }

  if (loading && !hub) return <HubSkeleton />

  const kpis = hub?.kpis || {}

  return (
    <div className="mhub-analytics-page">
      <header className="mhub-analytics-page__head">
        <div>
          <h2>Analytics</h2>
          <p>What&apos;s working, what isn&apos;t, and what to do next</p>
        </div>
        <div className="mhub-page__periods">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`mhub-period-btn${period === p.id ? ' is-active' : ''}`}
              onClick={() => {
                setPeriod(p.id)
                onPeriodChange?.(p.id)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {error ? <p className="mhub-error">{error}</p> : null}

      <section className="mhub-section">
        <h3 className="mhub-section__head h-only">Recommendations</h3>
        <HubInsightPills insights={hub?.insights} onAction={runAction} />
      </section>

      <div className="mhub-analytics-grid">
        <section className="mhub-section">
          <div className="mhub-section__head">
            <h2>Campaign performance</h2>
          </div>
          <HubMetricTiles
            tiles={[
              { label: 'Emails sent', value: kpis.emailsSent ?? 0 },
              { label: 'Open rate', value: `${kpis.openRate ?? 0}%` },
              { label: 'Click rate', value: `${kpis.clickRate ?? 0}%` },
              { label: 'Campaigns sent', value: kpis.campaignsSent ?? 0 },
            ]}
          />
        </section>

        <section className="mhub-section">
          <div className="mhub-section__head">
            <h2>Audience growth</h2>
          </div>
          <HubMetricTiles
            tiles={[
              { label: 'Total contacts', value: hub?.audienceGrowth?.totalContacts ?? 0 },
              { label: 'Active contacts', value: hub?.audienceGrowth?.activeContacts ?? 0 },
              { label: 'Lists', value: hub?.audienceGrowth?.listCount ?? 0 },
              { label: 'Segments', value: hub?.audienceGrowth?.segmentCount ?? 0 },
            ]}
          />
        </section>

        <section className="mhub-section">
          <div className="mhub-section__head">
            <h2>Revenue attribution</h2>
          </div>
          <HubMetricTiles
            tiles={[
              {
                label: 'Attributed',
                value: formatDealValue(hub?.revenue?.attributedTotal || hub?.revenue?.total || 0),
              },
              { label: 'Bounce rate', value: `${kpis.bounceRate ?? 0}%` },
              { label: 'Unsubscribe rate', value: `${kpis.unsubscribeRate ?? 0}%` },
            ]}
          />
        </section>

        <section className="mhub-section">
          <div className="mhub-section__head">
            <h2>Automation performance</h2>
          </div>
          <HubMetricTiles
            tiles={[
              { label: 'Active', value: hub?.automationHealth?.active ?? 0 },
              { label: 'Paused', value: hub?.automationHealth?.paused ?? 0 },
              { label: 'Errors', value: hub?.automationHealth?.errors ?? 0 },
              { label: 'Draft', value: hub?.automationHealth?.draft ?? 0 },
            ]}
          />
        </section>
      </div>
    </div>
  )
}
