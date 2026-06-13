import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { navTargetToOptions } from '../../lib/navConfig'
import { openMarketingCampaignReport } from '../../lib/marketingReportUrls'
import { formatDealValue } from '../../lib/crmTimeline'
import {
  HubCommandBar,
  HubHealthRing,
  HubPriorityList,
  HubCampaignCards,
  HubScheduledList,
  HubInsightPills,
  HubQuickActions,
  HubSkeleton,
  HubMetricTiles,
} from './MarketingHubCharts'

const PERIODS = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'year', label: 'YTD' },
]

export default function MarketingHubDashboard({ onNavigate, period: externalPeriod, onPeriodChange }) {
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
      setError(e.message || 'Could not load marketing hub')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useEffect(() => {
    if (externalPeriod && externalPeriod !== period) setPeriod(externalPeriod)
  }, [externalPeriod, period])

  const runAction = useCallback(
    (action) => {
      if (!action) return
      if (action.campaignId && action.tab !== 'campaigns') {
        openMarketingCampaignReport(action.campaignId)
        return
      }
      const tab = action.tab || 'overview'
      onNavigate?.('marketing', { tab, ...navTargetToOptions(action) })
    },
    [onNavigate]
  )

  const setPeriodAndNotify = (id) => {
    setPeriod(id)
    onPeriodChange?.(id)
  }

  if (loading && !hub) return <HubSkeleton />

  const kpis = hub?.kpis || {}
  const audience = hub?.audienceGrowth || {}
  const conversion = hub?.leadConversion || {}

  return (
    <div className="mhub-page">
      <header className="mhub-page__head">
        <div>
          <p className="mhub-page__eyebrow">Marketing Hub</p>
          <h1 className="mhub-page__title">Command center</h1>
          <p className="mhub-page__sub">Campaigns, audiences, and revenue — one workspace.</p>
        </div>
        <div className="mhub-page__periods">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`mhub-period-btn${period === p.id ? ' is-active' : ''}`}
              onClick={() => setPeriodAndNotify(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {error ? <p className="mhub-error">{error}</p> : null}

      <div className="mhub-grid">
        <section className="mhub-section mhub-span-12 mhub-section--sticky">
          <HubCommandBar items={hub?.commandBar} onAction={(item) => runAction(item.action)} />
        </section>

        <section className="mhub-section mhub-span-4 mhub-section--hero">
          <div className="mhub-section__head">
            <h2>Health score</h2>
            <p>Engagement · deliverability · automation</p>
          </div>
          <HubHealthRing score={hub?.healthScore || 0} label={hub?.healthLabel} />
        </section>

        <section className="mhub-section mhub-span-8">
          <div className="mhub-section__head">
            <h2>What to do next</h2>
            <p>Prioritized marketing actions</p>
          </div>
          <HubPriorityList items={hub?.priorities} onOpen={(item) => runAction(item.action)} />
        </section>

        <section className="mhub-section mhub-span-6">
          <div className="mhub-section__head">
            <h2>Top campaigns</h2>
            <p>Best performers this period</p>
          </div>
          <HubCampaignCards
            campaigns={hub?.topCampaigns}
            onOpen={(c) => runAction({ tab: 'analytics', campaignId: c.id })}
          />
        </section>

        <section className="mhub-section mhub-span-6">
          <div className="mhub-section__head">
            <h2>Scheduled sends</h2>
            <p>Upcoming deliveries</p>
          </div>
          <HubScheduledList
            items={hub?.scheduledSends}
            onOpen={(item) => runAction({ tab: 'campaigns', campaignId: item.id })}
          />
        </section>

        <section className="mhub-section mhub-span-4">
          <div className="mhub-section__head">
            <h2>Audience</h2>
          </div>
          <HubMetricTiles
            tiles={[
              { label: 'Active contacts', value: audience.activeContacts ?? 0 },
              { label: 'Lists', value: audience.listCount ?? 0 },
              { label: 'Segments', value: audience.segmentCount ?? 0 },
              {
                label: 'Growth',
                value: `${audience.growthPct >= 0 ? '+' : ''}${audience.growthPct ?? 0}%`,
                hint: 'vs prior period',
              },
            ]}
          />
        </section>

        <section className="mhub-section mhub-span-4">
          <div className="mhub-section__head">
            <h2>Conversion</h2>
          </div>
          <HubMetricTiles
            tiles={[
              { label: 'Sent', value: conversion.sent ?? 0 },
              { label: 'Open rate', value: `${conversion.openRate ?? 0}%` },
              { label: 'CTR', value: `${conversion.clickRate ?? 0}%` },
            ]}
          />
        </section>

        <section className="mhub-section mhub-span-4">
          <div className="mhub-section__head">
            <h2>Revenue</h2>
          </div>
          <HubMetricTiles
            tiles={[
              {
                label: 'Attributed',
                value: formatDealValue(hub?.revenue?.attributedTotal || hub?.revenue?.total || 0),
              },
              { label: 'Bounce rate', value: `${kpis.bounceRate ?? 0}%` },
              { label: 'Pending approvals', value: kpis.pendingApprovals ?? 0 },
            ]}
          />
        </section>

        <section className="mhub-section mhub-span-12">
          <div className="mhub-section__head">
            <h2>Smart insights</h2>
            <p>Proactive recommendations</p>
          </div>
          <HubInsightPills insights={hub?.insights} onAction={runAction} />
        </section>

        <section className="mhub-section mhub-span-12">
          <div className="mhub-section__head">
            <h2>Quick actions</h2>
          </div>
          <HubQuickActions
            actions={hub?.quickActions}
            onAction={(act) => runAction({ tab: act.tab, ...act })}
          />
        </section>
      </div>
    </div>
  )
}
