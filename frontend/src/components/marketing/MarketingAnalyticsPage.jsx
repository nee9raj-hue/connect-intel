import { useMemo, useState } from 'react'
import { formatDealValue } from '../../lib/crmTimeline'
import { formatDateTime } from '../../lib/crmUiConstants'
import {
  campaignAnalyticsSummary,
  campaignListStatus,
  campaignMetrics,
} from '../../lib/marketingCampaignStatus'
import { CAMPAIGN_STATUS } from './marketingTheme'
import { BarChart, LineChart } from './MarketingSimpleCharts'
import {
  ChartIcon,
  MailIcon,
  PeopleIcon,
  ChevronRightIcon,
  SearchIcon,
  EyeIcon,
  BoltIcon,
} from '../ui/icons'

const PERIODS = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'year', label: 'Year' },
]

const STATUS_FILTERS = [
  { id: '', label: 'All campaigns' },
  { id: 'completed', label: 'Sent' },
  { id: 'active', label: 'Sending' },
  { id: 'draft', label: 'Draft' },
  { id: 'scheduled', label: 'Scheduled' },
]

function teamMemberUserId(member) {
  return member?.userId ? String(member.userId) : ''
}

function teamMemberLabel(member) {
  return member?.name || [member?.firstName, member?.lastName].filter(Boolean).join(' ') || member?.email || 'Team member'
}

function campaignOwnerUserId(campaign) {
  return campaign?.createdByUserId ? String(campaign.createdByUserId) : ''
}

function buildSentChart(trend = [], campaigns = []) {
  if (trend?.length) {
    return trend.slice(-12).map((t) => ({
      date: t.date,
      sent: t.sent || 0,
      openRate: t.opens && t.sent ? Math.round((t.opens / t.sent) * 100) : null,
    }))
  }
  const byDate = new Map()
  for (const c of campaigns) {
    const key = (c.startedAt || c.completedAt || c.updatedAt || c.createdAt || '').slice(0, 10)
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
      total: r.events || r.opens || r.value || r.total || 0,
    }))
  }
  const now = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (11 - i) * 7)
    return { date: d.toISOString().slice(0, 10), total: i === 11 ? totalContacts : 0 }
  })
}

function StatusBadge({ campaign }) {
  const display = campaignListStatus(campaign)
  const badge = CAMPAIGN_STATUS[display.tone] || CAMPAIGN_STATUS.draft
  return (
    <span className="mc-camp-badge" style={{ background: badge.bg, color: badge.color }}>
      {display.label}
    </span>
  )
}

export default function MarketingAnalyticsPage({
  period,
  onPeriodChange,
  teamMembers = [],
  analytics,
  loading,
  error,
  reportCampaigns = [],
  summary,
  onDrillCampaign,
  onNavigate,
  onPause,
  onStop,
  onResume,
  busy,
  goToCampaignPipeline,
}) {
  const [teamFilter, setTeamFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [query, setQuery] = useState('')

  const kpis = analytics?.campaign_stats || {
    emailsSent: summary?.sent ?? 0,
    openRate: summary?.sent ? Math.round(((summary.opens || 0) / summary.sent) * 100) : 0,
    clickRate: summary?.sent ? Math.round(((summary.clicks || 0) / summary.sent) * 100) : 0,
    campaignsSent: summary?.campaigns ?? 0,
  }
  const audience = analytics?.audience_stats || {}
  const insights = analytics?.insights || []
  const sentChart = buildSentChart(analytics?.campaign_stats?.trend, reportCampaigns)
  const growthChart = buildGrowthChart(analytics?.growth_chart, audience.totalContacts)

  const filteredCampaigns = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...reportCampaigns]
      .filter((c) => {
        if (c.status === 'archived') return false
        if (teamFilter !== 'all' && campaignOwnerUserId(c) !== teamFilter) return false
        if (statusFilter && campaignListStatus(c).key !== statusFilter) return false
        if (q && !c.name?.toLowerCase().includes(q)) return false
        return true
      })
      .sort(
        (a, b) =>
          new Date(b.startedAt || b.completedAt || b.updatedAt || 0) -
          new Date(a.startedAt || a.completedAt || a.updatedAt || 0)
      )
  }, [reportCampaigns, teamFilter, statusFilter, query])

  const topByOpens = useMemo(
    () =>
      [...filteredCampaigns]
        .sort((a, b) => (b.stats?.openRate || 0) - (a.stats?.openRate || 0))
        .slice(0, 5),
    [filteredCampaigns]
  )

  const teamOptions = useMemo(
    () => (teamMembers || []).filter((m) => m.status !== 'inactive' && teamMemberUserId(m)),
    [teamMembers]
  )

  const showTeamFilter = teamOptions.length > 1

  return (
    <div className="mc-page mc-analytics-page">
      <header className="mc-camp-page-head">
        <div>
          <h1 className="mc-camp-page-head__title">Analytics</h1>
          <p className="mc-camp-page-head__sub">
            What&apos;s working, what isn&apos;t, and where to focus next — campaign by campaign.
          </p>
        </div>
        <button
          type="button"
          className="mc-btn mc-btn--outline"
          onClick={() => onNavigate?.('marketing', { tab: 'campaigns' })}
        >
          <MailIcon className="w-4 h-4" />
          All campaigns
        </button>
      </header>

      <div className="mc-analytics-filters">
        <div className="mc-analytics-filters__group">
          <span className="mc-analytics-filters__label">Date range</span>
          <div className="mc-pill-toggle mc-analytics-periods">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`mc-pill-toggle__btn${period === p.id ? ' is-active' : ''}`}
                onClick={() => onPeriodChange?.(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {showTeamFilter ? (
          <div className="mc-analytics-filters__group">
            <label className="mc-analytics-filters__label" htmlFor="analytics-team">
              Team member
            </label>
            <select
              id="analytics-team"
              className="mc-input mc-input--filter"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
            >
              <option value="all">All team</option>
              {teamOptions.map((m) => (
                <option key={teamMemberUserId(m)} value={teamMemberUserId(m)}>
                  {teamMemberLabel(m)}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="mc-analytics-filters__group">
          <label className="mc-analytics-filters__label" htmlFor="analytics-status">
            Campaigns sent
          </label>
          <select
            id="analytics-status"
            className="mc-input mc-input--filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.id || 'all'} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? <p className="mc-analytics-error">{error}</p> : null}
      {loading ? <p className="mc-analytics-loading">Loading analytics…</p> : null}

      {insights.length > 0 ? (
        <div className="mc-analytics-insight">
          <BoltIcon className="mc-analytics-insight__icon" aria-hidden />
          <div>
            {insights.slice(0, 2).map((ins, i) => (
              <p key={i}>{ins.text}</p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mc-camp-summary mc-analytics-kpis">
        <div className="mc-camp-summary__card mc-camp-summary__card--accent">
          <MailIcon className="mc-camp-summary__icon" aria-hidden />
          <div>
            <span className="mc-camp-summary__value">{(kpis.emailsSent ?? 0).toLocaleString()}</span>
            <span className="mc-camp-summary__label">Emails sent</span>
          </div>
        </div>
        <div className="mc-camp-summary__card">
          <EyeIcon className="mc-camp-summary__icon" aria-hidden />
          <div>
            <span className="mc-camp-summary__value">{kpis.openRate ?? 0}%</span>
            <span className="mc-camp-summary__label">Open rate</span>
          </div>
        </div>
        <div className="mc-camp-summary__card">
          <ChartIcon className="mc-camp-summary__icon" aria-hidden />
          <div>
            <span className="mc-camp-summary__value">{kpis.clickRate ?? 0}%</span>
            <span className="mc-camp-summary__label">Click rate</span>
          </div>
        </div>
        <div className="mc-camp-summary__card">
          <PeopleIcon className="mc-camp-summary__icon" aria-hidden />
          <div>
            <span className="mc-camp-summary__value">{(audience.totalContacts ?? 0).toLocaleString()}</span>
            <span className="mc-camp-summary__label">Audience</span>
          </div>
        </div>
      </div>

      <div className="mc-analytics-grid">
        <section className="mc-analytics-panel">
          <h2 className="mc-analytics-panel__title">Emails sent over time</h2>
          <BarChart data={sentChart} valueKey="sent" labelKey="date" height={180} />
        </section>
        <section className="mc-analytics-panel">
          <h2 className="mc-analytics-panel__title">Audience growth</h2>
          <LineChart data={growthChart} valueKey="total" labelKey="date" height={180} />
          <p className="mc-analytics-panel__meta">
            Active {(audience.activeContacts ?? 0).toLocaleString()} · Growth {audience.growthPct ?? 0}%
          </p>
        </section>
      </div>

      <section className="mc-analytics-panel mc-analytics-panel--wide">
        <div className="mc-analytics-panel__head">
          <h2 className="mc-analytics-panel__title">Campaign performance</h2>
          <div className="mc-camp-toolbar__search mc-analytics-search">
            <SearchIcon className="mc-camp-toolbar__search-icon" aria-hidden />
            <input
              type="search"
              className="mc-input"
              placeholder="Search campaigns"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {!filteredCampaigns.length ? (
          <p className="mc-analytics-empty">
            {teamFilter !== 'all'
              ? 'No campaigns match this team member for the selected filters.'
              : 'No campaigns match your filters yet.'}
          </p>
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table mc-analytics-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th>Opens</th>
                  <th>Clicks</th>
                  <th>Performance</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((c) => {
                  const m = campaignMetrics(c)
                  const display = campaignListStatus(c)
                  const isActive = display.key === 'active'
                  const isPaused = display.key === 'paused'
                  return (
                    <tr key={c.id}>
                      <td>
                        <button type="button" className="mc-camp-table__name" onClick={() => onDrillCampaign?.(c.id)}>
                          <span className="mc-camp-table__thumb-mini">{c.name?.slice(0, 2).toUpperCase() || 'C'}</span>
                          <span>
                            <strong>{c.name || 'Untitled'}</strong>
                            {c.subject ? <span className="mc-camp-table__subject">{c.subject}</span> : null}
                          </span>
                        </button>
                      </td>
                      <td>
                        <StatusBadge campaign={c} />
                      </td>
                      <td className="mc-analytics-num">
                        {m.sent > 0 ? (
                          <button type="button" className="mc-link" onClick={() => goToCampaignPipeline?.(c, 'sent')}>
                            {m.sent.toLocaleString()}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="mc-analytics-num">
                        {m.opens > 0 ? (
                          <button type="button" className="mc-link" onClick={() => goToCampaignPipeline?.(c, 'opened')}>
                            {m.openRate ? `${m.openRate}%` : m.opens}
                          </button>
                        ) : (
                          `${m.openRate || 0}%`
                        )}
                      </td>
                      <td className="mc-analytics-num">
                        {m.clicks > 0 ? (
                          <button type="button" className="mc-link" onClick={() => goToCampaignPipeline?.(c, 'clicked')}>
                            {m.clickRate ? `${m.clickRate}%` : m.clicks}
                          </button>
                        ) : (
                          `${m.clickRate || 0}%`
                        )}
                      </td>
                      <td className="mc-analytics-meta">{campaignAnalyticsSummary(c)}</td>
                      <td className="mc-table__date">
                        {formatDateTime(c.startedAt || c.completedAt || c.updatedAt || c.createdAt)}
                      </td>
                      <td>
                        <div className="mc-analytics-actions">
                          <button
                            type="button"
                            className="mc-btn mc-btn--outline mc-btn--sm"
                            onClick={() => onDrillCampaign?.(c.id)}
                          >
                            View report
                          </button>
                          {isActive && onPause ? (
                            <button type="button" className="mc-btn mc-btn--ghost mc-btn--sm" disabled={busy} onClick={() => onPause(c.id)}>
                              Pause
                            </button>
                          ) : null}
                          {isPaused && onResume ? (
                            <button type="button" className="mc-btn mc-btn--ghost mc-btn--sm" disabled={busy} onClick={() => onResume(c.id)}>
                              Resume
                            </button>
                          ) : null}
                          {isActive && onStop ? (
                            <button type="button" className="mc-btn mc-btn--ghost mc-btn--sm" disabled={busy} onClick={() => onStop(c.id, c.name)}>
                              Stop
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {topByOpens.length > 0 ? (
          <div className="mc-analytics-top">
            <h3 className="mc-analytics-top__title">Top performers by open rate</h3>
            <ul className="mc-analytics-top__list">
              {topByOpens.map((c) => (
                <li key={c.id}>
                  <button type="button" className="mc-analytics-top__item" onClick={() => onDrillCampaign?.(c.id)}>
                    <span>{c.name}</span>
                    <strong>{c.stats?.openRate ?? campaignMetrics(c).openRate ?? 0}% opens</strong>
                    <ChevronRightIcon className="w-3.5 h-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {(analytics?.revenue_attribution?.attributedTotal || analytics?.revenue_attribution?.total) > 0 ? (
        <section className="mc-analytics-panel">
          <h2 className="mc-analytics-panel__title">Revenue attribution</h2>
          <p className="mc-analytics-panel__meta">
            Attributed {formatDealValue(analytics.revenue_attribution.attributedTotal || analytics.revenue_attribution.total)}
          </p>
        </section>
      ) : null}
    </div>
  )
}
