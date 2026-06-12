import { useMemo } from 'react'
import { formatDateTime } from '../../lib/crmUiConstants'
import { formatDealValue } from '../../lib/crmTimeline'
import {
  CAMPAIGN_STATUS,
  campaignIconTint,
  campaignInitials,
  formatPct,
} from './marketingTheme'
import { navigateToMarketingPipeline } from '../../lib/marketingNavigation'
import MarketingGettingStarted from './MarketingGettingStarted'

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
  summary = null,
  reportCampaigns = [],
  forms = [],
  lists = [],
  segments = [],
  dataLoading = false,
  onOpenCampaign,
  onCreateCampaign,
}) {
  const kpis = useMemo(() => {
    const sent = summary?.sent ?? 0
    const opens = summary?.opens ?? 0
    const clicks = summary?.clicks ?? 0
    const activeContacts = (lists || []).reduce(
      (n, l) => n + (l.memberCount || l.leadIds?.length || 0),
      0
    )
    return {
      emailsSent: sent,
      openRate: sent ? Math.round((opens / sent) * 100) : 0,
      clickRate: sent ? Math.round((clicks / sent) * 100) : 0,
      activeContacts,
      totalContacts: summary?.enrolled ?? activeContacts,
    }
  }, [summary, lists])

  const recent = useMemo(
    () =>
      [...(reportCampaigns || [])]
        .sort(
          (a, b) =>
            new Date(b.startedAt || b.updatedAt || b.createdAt || 0) -
            new Date(a.startedAt || a.updatedAt || a.createdAt || 0)
        )
        .slice(0, 6),
    [reportCampaigns]
  )

  const scheduledSends = useMemo(
    () =>
      (reportCampaigns || [])
        .filter((c) => c.status === 'scheduled' && c.scheduledAt)
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
        .slice(0, 5)
        .map((c) => ({
          id: c.id,
          name: c.name,
          scheduledAt: c.scheduledAt,
          audience: c.listName || c.segmentName || 'Audience',
          recipientCount: c.stats?.enrolled || c.stats?.sent,
        })),
    [reportCampaigns]
  )

  const topInsight = useMemo(() => {
    const top = [...(reportCampaigns || [])].sort(
      (a, b) => (b.stats?.openRate || b.openRate || 0) - (a.stats?.openRate || a.openRate || 0)
    )[0]
    if (top && (top.stats?.openRate || top.openRate)) {
      return {
        text: `"${top.name}" is your top performer (${top.stats?.openRate || top.openRate}% opens).`,
        action: { tab: 'analytics', campaignId: top.id },
      }
    }
    if (kpis.openRate >= 25) {
      return {
        text: `Open rate is ${kpis.openRate}% — above benchmark for this period.`,
        action: { tab: 'analytics' },
      }
    }
    return null
  }, [reportCampaigns, kpis.openRate])

  const runAction = (action) => {
    if (!action) return
    onNavigate?.('marketing', { tab: action.tab || 'overview', ...action })
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

  if (dataLoading && !reportCampaigns.length && !summary) {
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

  return (
    <div className="mhub-v3-page">
      <MarketingGettingStarted
        lists={lists}
        reportCampaigns={reportCampaigns}
        onNavigate={onNavigate}
        onCreateCampaign={onCreateCampaign}
      />
      <div className="mhub-v3-stat-row">
        <div className="mhub-v3-stat">
          <span className="mhub-v3-stat__label">Emails sent</span>
          <span className="mhub-v3-stat__value">{kpis.emailsSent.toLocaleString()}</span>
          <span className="mhub-v3-stat__sub">last 30d</span>
        </div>
        <div className="mhub-v3-stat">
          <span className="mhub-v3-stat__label">Open rate</span>
          <span className="mhub-v3-stat__value">{formatPct(kpis.openRate, '0%')}</span>
          <span className="mhub-v3-stat__sub">vs period</span>
        </div>
        <div className="mhub-v3-stat">
          <span className="mhub-v3-stat__label">Click rate</span>
          <span className="mhub-v3-stat__value">{formatPct(kpis.clickRate, '0%')}</span>
          <span className="mhub-v3-stat__sub">vs period</span>
        </div>
        <div className="mhub-v3-stat">
          <span className="mhub-v3-stat__label">Active contacts</span>
          <span className="mhub-v3-stat__value">{kpis.activeContacts.toLocaleString()}</span>
          <span className="mhub-v3-stat__sub">of {kpis.totalContacts.toLocaleString()} total</span>
        </div>
        <div className="mhub-v3-stat">
          <span className="mhub-v3-stat__label">Lists · Segments</span>
          <span className="mhub-v3-stat__value">
            {(lists || []).length} · {(segments || []).length}
          </span>
          <span className="mhub-v3-stat__sub">audiences</span>
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
              const opens = c.stats?.uniqueOpens ?? c.opens ?? 0
              const clicks = c.stats?.uniqueClicks ?? c.clicks ?? 0
              return (
                <div key={c.id} className="mhub-v3-campaign-row">
                  <span className="mhub-v3-campaign-icon" style={{ background: tint.bg, color: tint.color }}>
                    {campaignInitials(c.name)}
                  </span>
                  <button
                    type="button"
                    className="mhub-v3-campaign-row__name"
                    onClick={() =>
                      onOpenCampaign ? onOpenCampaign(c) : runAction({ tab: 'analytics', campaignId: c.id })
                    }
                  >
                    <span className="mhub-v3-campaign-name">{c.name}</span>
                    <span className="mhub-v3-campaign-meta">
                      {c.ownerName || c.createdByName || 'Owner'} ·{' '}
                      {c.listName || c.segmentName || c.audience || 'Audience'} ·{' '}
                      {c.startedAt || c.sentAt ? formatDateTime(c.startedAt || c.sentAt) : '—'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mhub-v3-metric-col mhub-v3-metric-col--link"
                    disabled={opens <= 0}
                    onClick={() => goToCampaignPipeline(c, 'opened')}
                  >
                    <strong>{formatPct(openRate)}</strong>
                    <span>Opens</span>
                  </button>
                  <button
                    type="button"
                    className="mhub-v3-metric-col mhub-v3-metric-col--link"
                    disabled={clicks <= 0}
                    onClick={() => goToCampaignPipeline(c, 'clicked')}
                  >
                    <strong>{formatPct(clickRate)}</strong>
                    <span>Clicks</span>
                  </button>
                  <span className="mhub-v3-metric-col">
                    <strong>{c.revenue ? formatDealValue(c.revenue) : '—'}</strong>
                    <span>Rev</span>
                  </span>
                  <StatusBadge status={c.status} />
                </div>
              )
            })
          )}
        </div>

        <div className="mhub-v3-sidebar-stack">
          <div className="mhub-v3-card">
            <h3 className="mhub-v3-card__title" style={{ marginBottom: 10 }}>
              Upcoming sends
            </h3>
            {scheduledSends.length ? (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {scheduledSends.map((s) => (
                  <li key={s.id} style={{ padding: '8px 0', borderBottom: '0.5px solid rgba(0,0,0,0.09)', fontSize: 12 }}>
                    <strong style={{ display: 'block', fontWeight: 500 }}>{s.name}</strong>
                    <span style={{ color: '#999' }}>
                      {s.scheduledAt ? formatDateTime(s.scheduledAt) : 'Soon'} · {s.recipientCount || s.audience || '—'}{' '}
                      recipients
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
                <strong>{kpis.activeContacts.toLocaleString()}</strong>
                <span>Active</span>
              </div>
              <div className="mhub-v3-micro-stat">
                <strong>{kpis.totalContacts.toLocaleString()}</strong>
                <span>Total</span>
              </div>
              <div className="mhub-v3-micro-stat">
                <strong>{(lists || []).length}</strong>
                <span>Lists</span>
              </div>
              <div className="mhub-v3-micro-stat">
                <strong>{(segments || []).length}</strong>
                <span>Segments</span>
              </div>
            </div>
          </div>

          <div className="mhub-v3-card">
            <div className="mhub-v3-card__head">
              <h3 className="mhub-v3-card__title">Form submissions</h3>
              <button
                type="button"
                className="mhub-v3-btn mhub-v3-btn--primary"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={() => runAction({ tab: 'forms' })}
              >
                + New form
              </button>
            </div>
            {forms.length ? (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {forms.slice(0, 5).map((f) => (
                  <li key={f.id} style={{ padding: '6px 0', fontSize: 12, borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                    <strong style={{ fontWeight: 500 }}>{f.name}</strong>
                    <span style={{ color: '#999', display: 'block' }}>
                      {f.submissions || 0} submissions
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
          <button type="button" className="mhub-v3-link" onClick={() => runAction(topInsight.action)}>
            View full analytics →
          </button>
        </div>
      ) : null}
    </div>
  )
}
