import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import { formatDealValue } from '../../lib/crmTimeline'
import {
  CAMPAIGN_STATUS,
  campaignIconTint,
  campaignInitials,
  formatPct,
} from './marketingTheme'

function StatusBadge({ status }) {
  const key = String(status || 'draft').toLowerCase()
  const s = CAMPAIGN_STATUS[key] || CAMPAIGN_STATUS.draft
  return (
    <span className="mhub-v3-badge" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

export default function MarketingOverviewTab({
  onNavigate,
  period: externalPeriod = '30d',
  reportCampaigns = [],
  forms = [],
  onOpenCampaign,
}) {
  const [hub, setHub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await api.getMarketingHub(externalPeriod)
      setHub(res.hub)
    } catch (e) {
      setError(e.message || 'Could not load overview')
    } finally {
      setLoading(false)
    }
  }, [externalPeriod])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  const runAction = (action) => {
    if (!action) return
    onNavigate?.('marketing', { tab: action.tab || 'overview', ...action })
  }

  if (loading && !hub) {
    return (
      <div className="mhub-v3-page">
        <div className="mhub-v3-stat-row">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="mhub-v3-stat" style={{ minHeight: 72, opacity: 0.5 }} />
          ))}
        </div>
      </div>
    )
  }

  const kpis = hub?.kpis || {}
  const audience = hub?.audienceGrowth || {}
  const automations = hub?.automationHealth || {}
  const recent =
    reportCampaigns.length > 0
      ? reportCampaigns.slice(0, 6)
      : (hub?.topCampaigns || []).slice(0, 6)
  const topInsight = hub?.insights?.[0]

  const openTrend = kpis.openRateTrend
  const clickTrend = kpis.clickRateTrend

  return (
    <div className="mhub-v3-page">
      {error ? <p className="mhub-v3-empty" style={{ color: '#dc2626' }}>{error}</p> : null}

      <div className="mhub-v3-stat-row">
        <div className="mhub-v3-stat">
          <span className="mhub-v3-stat__label">Emails sent</span>
          <span className="mhub-v3-stat__value">{(kpis.emailsSent ?? 0).toLocaleString()}</span>
          <span className="mhub-v3-stat__sub">last 30d</span>
        </div>
        <div className="mhub-v3-stat">
          <span className="mhub-v3-stat__label">Open rate</span>
          <span className="mhub-v3-stat__value">{formatPct(kpis.openRate, '0%')}</span>
          <span className={`mhub-v3-stat__sub${openTrend > 0 ? ' is-up' : openTrend < 0 ? ' is-down' : ''}`}>
            {openTrend != null ? `${openTrend > 0 ? '↑' : openTrend < 0 ? '↓' : ''} vs period` : 'vs period'}
          </span>
        </div>
        <div className="mhub-v3-stat">
          <span className="mhub-v3-stat__label">Click rate</span>
          <span className="mhub-v3-stat__value">{formatPct(kpis.clickRate, '0%')}</span>
          <span className={`mhub-v3-stat__sub${clickTrend > 0 ? ' is-up' : clickTrend < 0 ? ' is-down' : ''}`}>
            vs period
          </span>
        </div>
        <div className="mhub-v3-stat">
          <span className="mhub-v3-stat__label">Active contacts</span>
          <span className="mhub-v3-stat__value">{(kpis.activeContacts ?? audience.activeContacts ?? 0).toLocaleString()}</span>
          <span className="mhub-v3-stat__sub">
            of {(kpis.totalContacts ?? audience.totalContacts ?? 0).toLocaleString()} total
          </span>
        </div>
        <div className="mhub-v3-stat">
          <span className="mhub-v3-stat__label">Automations</span>
          <span className="mhub-v3-stat__value">{automations.active ?? 0} active</span>
          <span className="mhub-v3-stat__sub">{automations.paused ?? 0} paused</span>
        </div>
      </div>

      <div className="mhub-v3-split">
        <div className="mhub-v3-card">
          <div className="mhub-v3-card__head">
            <h3 className="mhub-v3-card__title">Recent campaigns</h3>
            <button type="button" className="mhub-v3-link" onClick={() => runAction({ tab: 'campaigns' })}>
              View all →
            </button>
          </div>
          {!recent.length ? (
            <p className="mhub-v3-empty">
              No campaigns yet.{' '}
              <button type="button" className="mhub-v3-link" onClick={() => runAction({ tab: 'campaigns' })}>
                Create your first →
              </button>
            </p>
          ) : (
            recent.map((c, i) => {
              const tint = campaignIconTint(i)
              const openRate = c.openRate ?? c.stats?.openRate ?? 0
              const clickRate = c.clickRate ?? c.ctr ?? c.stats?.clickRate ?? 0
              return (
                <button
                  key={c.id}
                  type="button"
                  className="mhub-v3-campaign-row"
                  onClick={() => (onOpenCampaign ? onOpenCampaign(c) : runAction({ tab: 'analytics', campaignId: c.id }))}
                >
                  <span className="mhub-v3-campaign-icon" style={{ background: tint.bg, color: tint.color }}>
                    {campaignInitials(c.name)}
                  </span>
                  <span>
                    <span className="mhub-v3-campaign-name">{c.name}</span>
                    <span className="mhub-v3-campaign-meta">
                      {c.ownerName || c.createdByName || 'Owner'} · {c.listName || c.segmentName || c.audience || 'Audience'} ·{' '}
                      {c.startedAt || c.sentAt ? formatDateTime(c.startedAt || c.sentAt) : '—'}
                    </span>
                  </span>
                  <span className="mhub-v3-metric-col">
                    <strong>{formatPct(openRate)}</strong>
                    <span>Opens</span>
                  </span>
                  <span className="mhub-v3-metric-col">
                    <strong>{formatPct(clickRate)}</strong>
                    <span>Clicks</span>
                  </span>
                  <span className="mhub-v3-metric-col">
                    <strong>{c.revenue ? formatDealValue(c.revenue) : '—'}</strong>
                    <span>Rev</span>
                  </span>
                  <StatusBadge status={c.status} />
                </button>
              )
            })
          )}
        </div>

        <div className="mhub-v3-sidebar-stack">
          <div className="mhub-v3-card">
            <h3 className="mhub-v3-card__title" style={{ marginBottom: 10 }}>
              Upcoming sends
            </h3>
            {(hub?.scheduledSends || []).length ? (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {hub.scheduledSends.map((s) => (
                  <li key={s.id} style={{ padding: '8px 0', borderBottom: '0.5px solid rgba(0,0,0,0.09)', fontSize: 12 }}>
                    <strong style={{ display: 'block', fontWeight: 500 }}>{s.name}</strong>
                    <span style={{ color: '#999' }}>
                      {s.scheduledAt ? formatDateTime(s.scheduledAt) : 'Soon'} · {s.recipientCount || s.audience || '—'} recipients
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mhub-v3-empty">No scheduled sends</p>
            )}
          </div>

          <div className="mhub-v3-card">
            <h3 className="mhub-v3-card__title" style={{ marginBottom: 10 }}>
              Audience health
            </h3>
            <div className="mhub-v3-micro-grid">
              <div className="mhub-v3-micro-stat">
                <strong>{(audience.activeContacts ?? 0).toLocaleString()}</strong>
                <span>Active</span>
              </div>
              <div className="mhub-v3-micro-stat">
                <strong>{(audience.totalContacts ?? 0).toLocaleString()}</strong>
                <span>Total</span>
              </div>
              <div className="mhub-v3-micro-stat">
                <strong>{audience.listCount ?? 0}</strong>
                <span>Lists</span>
              </div>
              <div className="mhub-v3-micro-stat">
                <strong>{audience.segmentCount ?? 0}</strong>
                <span>Segments</span>
              </div>
            </div>
            <p style={{ fontSize: 11, color: '#22a06b', marginTop: 10 }}>
              Growth: {audience.growthPct ?? 0}%
            </p>
          </div>

          <div className="mhub-v3-card">
            <div className="mhub-v3-card__head">
              <h3 className="mhub-v3-card__title">Form submissions (7d)</h3>
              <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => runAction({ tab: 'forms' })}>
                + New form
              </button>
            </div>
            {forms.length ? (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {forms.slice(0, 5).map((f) => (
                  <li key={f.id} style={{ padding: '6px 0', fontSize: 12, borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                    <strong style={{ fontWeight: 500 }}>{f.name}</strong>
                    <span style={{ color: '#999', display: 'block' }}>
                      {f.submissions || f.submission_count || 0} submissions · {f.leadsCreated || f.leads_created || 0} leads
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mhub-v3-empty">No active forms</p>
            )}
          </div>
        </div>
      </div>

      {topInsight ? (
        <div className="mhub-v3-ai-banner">
          <p>{topInsight.text}</p>
          <button type="button" className="mhub-v3-link" onClick={() => runAction(topInsight.action || { tab: 'analytics' })}>
            View full analytics →
          </button>
        </div>
      ) : null}
    </div>
  )
}
