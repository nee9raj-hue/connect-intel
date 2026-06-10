import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { formatDealValue } from '../../lib/crmTimeline'
import { formatDateTime } from '../../lib/crmUiConstants'
import { HubSkeleton } from './MarketingHubCharts'
import { BarChart, LineChart, ReputationBar } from './MarketingSimpleCharts'
import CampaignReportsView from './CampaignReportsView'

const PERIODS = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'year', label: 'Year' },
]

function buildSentChart(trend = [], campaigns = []) {
  if (trend.length) {
    return trend.slice(-12).map((t) => ({
      date: t.date,
      sent: t.sent || 0,
      openRate: t.opens && t.sent ? Math.round((t.opens / t.sent) * 100) : null,
    }))
  }
  const byDate = new Map()
  for (const c of campaigns) {
    const key = (c.startedAt || c.sentAt || c.createdAt || '').slice(0, 10)
    if (!key) continue
    byDate.set(key, (byDate.get(key) || 0) + (c.stats?.sent || c.sent || 0))
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([date, sent]) => ({ date, sent }))
}

function buildGrowthChart(audienceTrend, totalContacts) {
  if (audienceTrend?.length) {
    return audienceTrend.slice(-12).map((r) => ({
      date: r.date,
      total: r.events || r.opens || r.value || 0,
    }))
  }
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (11 - i) * 7)
    return { date: d.toISOString().slice(0, 10), total: i === 11 ? totalContacts : 0 }
  })
}

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
      <div className="mhub-v3-page">
        <CampaignReportsView
          campaigns={reportCampaigns}
          initialCampaignId={campaignId}
          onNavigate={onNavigate}
        />
      </div>
    )
  }

  if (loading && !hub) return <div className="mhub-v3-page"><HubSkeleton /></div>

  const kpis = hub?.kpis || {}
  const audience = hub?.audienceGrowth || {}
  const automations = hub?.automationHealth || {}
  const deliverability = hub?.deliverability || {}
  const topCampaigns = [...(hub?.topCampaigns || reportCampaigns)]
    .sort((a, b) => (b.openRate || b.stats?.openRate || 0) - (a.openRate || a.stats?.openRate || 0))
    .slice(0, 10)

  const sentChart = buildSentChart(hub?.trend, reportCampaigns)
  const growthChart = buildGrowthChart(hub?.analyticsTrend, audience.totalContacts)

  return (
    <div className="mhub-v3-page">
      <header className="mhub-v3-analytics-head">
        <div>
          <h2>Analytics</h2>
          <p>What&apos;s working, what isn&apos;t, and what to do next</p>
        </div>
        <div className="mhub-v3-periods">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`mhub-v3-period${period === p.id ? ' is-active' : ''}`}
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

      {error ? <p className="mhub-v3-empty" style={{ color: '#dc2626' }}>{error}</p> : null}

      {(hub?.insights || []).length > 0 && (
        <div className="mhub-v3-ai-banner mhub-v3-section">
          <div>
            {(hub.insights || []).slice(0, 3).map((ins, i) => (
              <p key={i} style={{ margin: i ? '8px 0 0' : 0 }}>{ins.text}</p>
            ))}
          </div>
        </div>
      )}

      <section className="mhub-v3-card mhub-v3-section">
        <h3 className="mhub-v3-card__title" style={{ marginBottom: 12 }}>
          Campaign performance
        </h3>
        <div className="mhub-v3-inline-stats">
          <span>
            Emails sent: <strong>{(kpis.emailsSent ?? 0).toLocaleString()}</strong>
          </span>
          <span>
            Open rate: <strong>{kpis.openRate ?? 0}%</strong>
          </span>
          <span>
            Click rate: <strong>{kpis.clickRate ?? 0}%</strong>
          </span>
          <span>
            Campaigns sent: <strong>{kpis.campaignsSent ?? 0}</strong>
          </span>
        </div>
        <p className="mhub-v3-eyebrow">Emails sent over time</p>
        <BarChart data={sentChart} valueKey="sent" labelKey="date" />
        <p className="mhub-v3-eyebrow" style={{ marginTop: 16 }}>
          Top campaigns by open rate
        </p>
        {topCampaigns.length ? (
          <table className="mhub-v3-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Sent</th>
                <th>Open rate</th>
                <th>Click rate</th>
                <th>Revenue</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {topCampaigns.map((c) => (
                <tr
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => runAction({ tab: 'analytics', campaignId: c.id })}
                  onKeyDown={(e) => e.key === 'Enter' && runAction({ tab: 'analytics', campaignId: c.id })}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{c.name}</td>
                  <td>{c.sent ?? c.stats?.sent ?? '—'}</td>
                  <td>{c.openRate ?? c.stats?.openRate ?? 0}%</td>
                  <td>{c.clickRate ?? c.ctr ?? c.stats?.clickRate ?? 0}%</td>
                  <td>{c.revenue ? formatDealValue(c.revenue) : '—'}</td>
                  <td>{c.startedAt ? formatDateTime(c.startedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mhub-v3-empty">No campaign data yet.</p>
        )}
      </section>

      <section className="mhub-v3-card mhub-v3-section">
        <h3 className="mhub-v3-card__title" style={{ marginBottom: 12 }}>
          Audience growth
        </h3>
        <div className="mhub-v3-inline-stats">
          <span>
            Total: <strong>{(audience.totalContacts ?? 0).toLocaleString()}</strong>
          </span>
          <span>
            Active: <strong>{(audience.activeContacts ?? 0).toLocaleString()}</strong>
          </span>
          <span>
            Growth: <strong>{audience.growthPct ?? 0}%</strong>
          </span>
          <span>
            Unsubscribes: <strong>{kpis.unsubscribes ?? 0}</strong>
          </span>
        </div>
        <LineChart data={growthChart} valueKey="total" labelKey="date" />
      </section>

      <section className="mhub-v3-card mhub-v3-section">
        <h3 className="mhub-v3-card__title" style={{ marginBottom: 12 }}>
          Revenue attribution
        </h3>
        <div className="mhub-v3-inline-stats">
          <span>
            Attributed: <strong>{formatDealValue(hub?.revenue?.attributedTotal || hub?.revenue?.total || 0)}</strong>
          </span>
          <span>
            Unsubscribe rate: <strong>{kpis.unsubscribeRate ?? 1}%</strong>
          </span>
        </div>
        {(hub?.revenue?.attributedTotal || hub?.revenue?.total) > 0 ? (
          <p className="mhub-v3-empty">Connect deals to campaigns to see per-campaign attribution.</p>
        ) : (
          <p className="mhub-v3-empty">
            Connect deals to campaigns to see revenue attribution.{' '}
            <button type="button" className="mhub-v3-link" onClick={() => runAction({ tab: 'campaigns' })}>
              Learn how →
            </button>
          </p>
        )}
      </section>

      <section className="mhub-v3-card mhub-v3-section">
        <h3 className="mhub-v3-card__title" style={{ marginBottom: 12 }}>
          Automation performance
        </h3>
        <div className="mhub-v3-inline-stats">
          <span>
            Active: <strong>{automations.active ?? 0}</strong>
          </span>
          <span>
            Paused: <strong>{automations.paused ?? 0}</strong>
          </span>
          <span>
            Draft: <strong>{automations.draft ?? 0}</strong>
          </span>
          <span>
            Errors: <strong>{automations.errors ?? 0}</strong>
          </span>
        </div>
        {(automations.list || []).length ? (
          <table className="mhub-v3-table">
            <thead>
              <tr>
                <th>Automation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {automations.list.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mhub-v3-empty">No automations yet.</p>
        )}
      </section>

      <section className="mhub-v3-card mhub-v3-section">
        <h3 className="mhub-v3-card__title" style={{ marginBottom: 12 }}>
          Deliverability
        </h3>
        <div className="mhub-v3-inline-stats" style={{ flexDirection: 'column', gap: 8 }}>
          <div>
            Domain reputation:{' '}
            <ReputationBar score={8} label={deliverability.reputation || 'Good'} />
          </div>
          <div>
            Inbox placement: <strong>{deliverability.inboxPlacement || 'Excellent (>95%)'}</strong>
          </div>
          <div>
            Bounce rate: <strong>{kpis.bounceRate ?? 0.2}%</strong> (healthy)
          </div>
          <div>
            Spam complaints: <strong>{deliverability.spamRate ?? '0.0%'}</strong>
          </div>
        </div>
      </section>
    </div>
  )
}
