import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { navTargetToOptions } from '../../lib/navConfig'
import { openMarketingCampaignReport } from '../../lib/marketingReportUrls'
import { formatDealValue } from '../../lib/crmTimeline'
import { formatDateTime } from '../../lib/crmUiConstants'

const PERIODS = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'year', label: 'YTD' },
]

function VisualKpi({ label, value, sub, accent, trend }) {
  return (
    <div className="mkt-kpi" style={{ '--mkt-accent': accent || '#6366f1' }}>
      <span className="mkt-kpi__label">{label}</span>
      <strong className="mkt-kpi__value">{value}</strong>
      {sub ? <span className="mkt-kpi__sub">{sub}</span> : null}
      {trend ? <span className={`mkt-kpi__trend mkt-kpi__trend--${trend.dir}`}>{trend.text}</span> : null}
    </div>
  )
}

function RecommendationCard({ text, action, onAction }) {
  return (
    <button type="button" className="mkt-rec-card" onClick={() => onAction?.(action)}>
      <span className="mkt-rec-card__icon">✦</span>
      <span className="mkt-rec-card__text">{text}</span>
    </button>
  )
}

export default function MarketingCommandCenter({ onNavigate, period: externalPeriod, onPeriodChange }) {
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
      if (action.campaignId) {
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

  if (loading && !hub) {
    return (
      <div className="mkt-command mkt-command--loading">
        <div className="mkt-skeleton mkt-skeleton--hero" />
        <div className="mkt-skeleton-row">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="mkt-skeleton mkt-skeleton--kpi" />
          ))}
        </div>
      </div>
    )
  }

  const kpis = hub?.kpis || {}
  const audience = hub?.audienceGrowth || {}
  const score = hub?.healthScore || 0

  const recommendations = [
    ...(hub?.insights || []).slice(0, 2).map((i) => ({ text: i.label || i.text, action: i.action })),
    kpis.openRate < 18
      ? { text: 'Open rates are below benchmark — try a shorter subject line or resend to non-openers.', action: { tab: 'campaigns' } }
      : null,
    audience.trend === 'down'
      ? { text: 'Audience growth is slowing — add a capture form or import contacts.', action: { tab: 'audiences' } }
      : null,
    hub?.topCampaigns?.[0]
      ? {
          text: `"${hub.topCampaigns[0].name}" drove the highest engagement this period.`,
          action: { tab: 'analytics', campaignId: hub.topCampaigns[0].id },
        }
      : null,
  ].filter(Boolean)

  return (
    <div className="mkt-command">
      <header className="mkt-command__hero">
        <div className="mkt-command__hero-copy">
          <p className="mkt-eyebrow">Marketing command center</p>
          <h1>How are your campaigns performing?</h1>
          <p>Health, reach, and revenue — at a glance.</p>
        </div>
        <div className="mkt-command__periods">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`mkt-period${period === p.id ? ' is-active' : ''}`}
              onClick={() => setPeriodAndNotify(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {error ? <p className="mkt-error">{error}</p> : null}

      <section className="mkt-command__health">
        <div className="mkt-health-ring" style={{ '--mkt-score': score }}>
          <div className="mkt-health-ring__inner">
            <strong>{score}</strong>
            <span>{hub?.healthLabel || 'Health'}</span>
          </div>
        </div>
        <div className="mkt-command__kpi-strip">
          <VisualKpi
            label="Open rate"
            value={`${kpis.openRate ?? 0}%`}
            sub="vs last period"
            accent="#6366f1"
            trend={kpis.openRateTrend ? { dir: kpis.openRateTrend > 0 ? 'up' : 'down', text: `${kpis.openRateTrend > 0 ? '+' : ''}${kpis.openRateTrend}%` } : null}
          />
          <VisualKpi
            label="Audience growth"
            value={audience.total != null ? audience.total.toLocaleString() : '—'}
            sub={audience.delta != null ? `${audience.delta > 0 ? '+' : ''}${audience.delta} this period` : 'contacts'}
            accent="#10b981"
          />
          <VisualKpi
            label="Revenue influence"
            value={formatDealValue(kpis.revenueInfluence || 0)}
            sub="attributed"
            accent="#f59e0b"
          />
          <VisualKpi
            label="Automation health"
            value={`${hub?.automationHealth?.score ?? 100}%`}
            sub={hub?.automationHealth?.label || 'workflows on track'}
            accent="#8b5cf6"
          />
          <VisualKpi
            label="Deliverability"
            value={kpis.deliverability || 'Excellent'}
            sub="inbox placement"
            accent="#0ea5e9"
          />
        </div>
      </section>

      <div className="mkt-command__grid">
        <section className="mkt-panel mkt-panel--wide">
          <div className="mkt-panel__head">
            <h2>Top campaigns</h2>
            <button type="button" className="mkt-link" onClick={() => runAction({ tab: 'campaigns' })}>
              View all
            </button>
          </div>
          <div className="mkt-campaign-mini-grid">
            {(hub?.topCampaigns || []).slice(0, 4).map((c) => (
              <button
                key={c.id}
                type="button"
                className="mkt-campaign-mini"
                onClick={() => runAction({ tab: 'analytics', campaignId: c.id })}
              >
                <div className="mkt-campaign-mini__thumb" style={{ background: c.accent || 'linear-gradient(135deg,#e0e7ff,#f8fafc)' }}>
                  <span>{c.name?.slice(0, 1) || 'C'}</span>
                </div>
                <div>
                  <strong>{c.name}</strong>
                  <span>{c.stats?.openRate || 0}% opens · {c.stats?.clickRate || 0}% clicks</span>
                </div>
              </button>
            ))}
            {!hub?.topCampaigns?.length ? <p className="mkt-empty">Launch a campaign to see performance here.</p> : null}
          </div>
        </section>

        <section className="mkt-panel">
          <div className="mkt-panel__head">
            <h2>Upcoming sends</h2>
          </div>
          <ul className="mkt-schedule-list">
            {(hub?.scheduledSends || []).slice(0, 5).map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong>
                <time>{s.scheduledAt ? formatDateTime(s.scheduledAt) : 'Soon'}</time>
              </li>
            ))}
            {!hub?.scheduledSends?.length ? <li className="mkt-empty">No scheduled sends.</li> : null}
          </ul>
        </section>

        <section className="mkt-panel">
          <div className="mkt-panel__head">
            <h2>Workflow status</h2>
            <button type="button" className="mkt-link" onClick={() => runAction({ tab: 'automations' })}>
              Automations
            </button>
          </div>
          <div className="mkt-workflow-stats">
            <div>
              <strong>{hub?.automationHealth?.active ?? 0}</strong>
              <span>Active</span>
            </div>
            <div>
              <strong>{hub?.automationHealth?.paused ?? 0}</strong>
              <span>Paused</span>
            </div>
            <div>
              <strong>{hub?.automationHealth?.draft ?? 0}</strong>
              <span>Draft</span>
            </div>
          </div>
        </section>

        <section className="mkt-panel mkt-panel--full">
          <div className="mkt-panel__head">
            <h2>AI recommendations</h2>
            <p>What to do next for better outcomes</p>
          </div>
          <div className="mkt-rec-grid">
            {recommendations.map((r, i) => (
              <RecommendationCard key={i} text={r.text} action={r.action} onAction={runAction} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
