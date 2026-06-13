import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import {
  campaignListStatus,
  campaignMetrics,
} from '../../lib/marketingCampaignStatus'
import { navigateToMarketingPipeline } from '../../lib/marketingNavigation'
import { openMarketingCampaignReport } from '../../lib/marketingReportUrls'
import LoadingExperience from '../ui/LoadingExperience'
import MarketingCreatorBadge from './MarketingCreatorBadge'
import MarketingReportFocusShell from './MarketingReportFocusShell'
import { CAMPAIGN_STATUS } from './marketingTheme'
import {
  ChartIcon,
  EyeIcon,
  MailIcon,
  SearchIcon,
  PeopleIcon,
} from '../ui/icons'

const PERIODS = [
  { id: 'all', label: 'All time' },
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

function campaignActivityDate(campaign) {
  return (
    campaign?.startedAt ||
    campaign?.completedAt ||
    campaign?.archivedAt ||
    campaign?.updatedAt ||
    campaign?.createdAt ||
    null
  )
}

function campaignInPeriod(campaign, period) {
  if (period === 'all') return true
  const raw = campaignActivityDate(campaign)
  if (!raw) return period !== 'year'
  const t = new Date(raw).getTime()
  const now = Date.now()
  if (period === '7d') return t >= now - 7 * 86400000
  if (period === '30d') return t >= now - 30 * 86400000
  if (period === '90d') return t >= now - 90 * 86400000
  if (period === 'year') return new Date(raw).getFullYear() === new Date().getFullYear()
  return true
}

function teamMemberUserId(member) {
  return member?.userId ? String(member.userId) : ''
}

function teamMemberLabel(member) {
  return member?.name || member?.email || 'Team member'
}

function campaignOwnerUserId(campaign) {
  return campaign?.createdByUserId ? String(campaign.createdByUserId) : ''
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

function aggregateMetrics(campaigns) {
  let sent = 0
  let enrolled = 0
  let opens = 0
  let clicks = 0
  let unsubscribed = 0
  let bounced = 0
  for (const c of campaigns) {
    const m = campaignMetrics(c)
    const stats = c.stats || c.analytics || {}
    sent += m.sent
    enrolled += m.enrolled || m.sent
    opens += m.opens
    clicks += m.clicks
    unsubscribed += stats.unsubscribed ?? 0
    bounced += stats.bounced ?? 0
  }
  return {
    count: campaigns.length,
    sent,
    enrolled,
    opens,
    clicks,
    unsubscribed,
    bounced,
    openRate: sent > 0 ? Math.round((opens / sent) * 100) : 0,
    clickRate: sent > 0 ? Math.round((clicks / sent) * 100) : 0,
    unsubRate: sent > 0 ? Math.round((unsubscribed / sent) * 100) : 0,
  }
}

export default function MarketingReportsListPage({
  onNavigate,
  teamMembers = [],
  showCreator = false,
  initialCampaigns = [],
}) {
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [loading, setLoading] = useState(!initialCampaigns.length)
  const [error, setError] = useState(null)
  const [folder, setFolder] = useState('reports')
  const [period, setPeriod] = useState('all')
  const [teamFilter, setTeamFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [query, setQuery] = useState('')
  const [archiveBusy, setArchiveBusy] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await api.getMarketingOverview({
        light: true,
        timeoutMs: 45_000,
      })
      setCampaigns(data.campaigns || [])
    } catch (e) {
      setError(e.message || 'Could not load campaign reports')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const teamOptions = useMemo(
    () => (teamMembers || []).filter((m) => m.status !== 'inactive' && teamMemberUserId(m)),
    [teamMembers]
  )
  const showTeamFilter = teamOptions.length > 1

  const archiveCount = useMemo(
    () => campaigns.filter((c) => c.status === 'archived').length,
    [campaigns]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const inFolder =
      folder === 'archive'
        ? campaigns.filter((c) => c.status === 'archived')
        : campaigns.filter((c) => c.status !== 'archived')
    return inFolder
      .filter((c) => {
        if (!campaignInPeriod(c, period)) return false
        if (teamFilter !== 'all' && campaignOwnerUserId(c) !== teamFilter) return false
        if (statusFilter && campaignListStatus(c).key !== statusFilter) return false
        if (q && !c.name?.toLowerCase().includes(q)) return false
        return true
      })
      .sort(
        (a, b) =>
          new Date(campaignActivityDate(b) || 0) - new Date(campaignActivityDate(a) || 0)
      )
  }, [campaigns, folder, period, teamFilter, statusFilter, query])

  const totals = useMemo(() => aggregateMetrics(filtered), [filtered])

  const goToPipeline = (campaign, filter, e) => {
    e?.stopPropagation?.()
    if (!campaign?.id) return
    void navigateToMarketingPipeline(onNavigate, {
      campaignId: campaign.id,
      filter,
      campaignName: campaign.name,
      returnTo: 'marketing',
    })
  }

  const archiveCampaign = async (id, e) => {
    e?.stopPropagation?.()
    if (!id || archiveBusy) return
    setArchiveBusy(id)
    try {
      await api.archiveMarketingCampaign(id)
      await load()
    } catch (err) {
      setError(err.message || 'Could not archive campaign')
    } finally {
      setArchiveBusy(null)
    }
  }

  return (
    <MarketingReportFocusShell
      title="Campaign reports"
      subtitle="Accurate opens, clicks, and delivery — synced from enrollments and engagement events."
      onNavigate={onNavigate}
      showBackToList={false}
    >
      <div className="mc-page mc-reports-list-page">
        <div className="mc-analytics-filters mc-reports-list-filters">
          <div className="mc-analytics-filters__group">
            <span className="mc-analytics-filters__label">Folder</span>
            <div className="mc-pill-toggle">
              <button
                type="button"
                className={`mc-pill-toggle__btn${folder === 'reports' ? ' is-active' : ''}`}
                onClick={() => setFolder('reports')}
              >
                All campaigns
              </button>
              <button
                type="button"
                className={`mc-pill-toggle__btn${folder === 'archive' ? ' is-active' : ''}`}
                onClick={() => setFolder('archive')}
              >
                Archive{archiveCount > 0 ? ` (${archiveCount})` : ''}
              </button>
            </div>
          </div>
          <div className="mc-analytics-filters__group">
            <span className="mc-analytics-filters__label">Date range</span>
            <div className="mc-pill-toggle mc-analytics-periods">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`mc-pill-toggle__btn${period === p.id ? ' is-active' : ''}`}
                  onClick={() => setPeriod(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {showTeamFilter ? (
            <div className="mc-analytics-filters__group">
              <label className="mc-analytics-filters__label" htmlFor="reports-team">
                Team member
              </label>
              <select
                id="reports-team"
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
            <label className="mc-analytics-filters__label" htmlFor="reports-status">
              Status
            </label>
            <select
              id="reports-status"
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
          <div className="mc-analytics-filters__group mc-reports-list-filters__search">
            <label className="mc-analytics-filters__label" htmlFor="reports-search">
              Search
            </label>
            <div className="mc-camp-toolbar__search">
              <SearchIcon className="mc-camp-toolbar__search-icon" aria-hidden />
              <input
                id="reports-search"
                type="search"
                className="mc-input"
                placeholder="Search campaigns"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <button type="button" className="mc-btn mc-btn--ghost mc-btn--sm" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>

        {error ? <p className="mc-analytics-error">{error}</p> : null}
        {loading ? <LoadingExperience message="Loading campaign reports…" fill={false} className="py-12" /> : null}

        {!loading ? (
          <>
            <div className="mc-camp-summary mc-reports-list-kpis">
              <div className="mc-camp-summary__card">
                <ChartIcon className="mc-camp-summary__icon" aria-hidden />
                <div>
                  <span className="mc-camp-summary__value">{totals.count}</span>
                  <span className="mc-camp-summary__label">Campaigns</span>
                </div>
              </div>
              <div className="mc-camp-summary__card">
                <PeopleIcon className="mc-camp-summary__icon" aria-hidden />
                <div>
                  <span className="mc-camp-summary__value">{totals.enrolled.toLocaleString()}</span>
                  <span className="mc-camp-summary__label">Recipients</span>
                </div>
              </div>
              <div className="mc-camp-summary__card mc-camp-summary__card--accent">
                <MailIcon className="mc-camp-summary__icon" aria-hidden />
                <div>
                  <span className="mc-camp-summary__value">{totals.sent.toLocaleString()}</span>
                  <span className="mc-camp-summary__label">Emails sent</span>
                </div>
              </div>
              <div className="mc-camp-summary__card">
                <EyeIcon className="mc-camp-summary__icon" aria-hidden />
                <div>
                  <span className="mc-camp-summary__value">{totals.openRate}%</span>
                  <span className="mc-camp-summary__label">{totals.opens} opens</span>
                </div>
              </div>
              <div className="mc-camp-summary__card">
                <ChartIcon className="mc-camp-summary__icon" aria-hidden />
                <div>
                  <span className="mc-camp-summary__value">{totals.clickRate}%</span>
                  <span className="mc-camp-summary__label">{totals.clicks} clicks</span>
                </div>
              </div>
            </div>

            <section className="mc-analytics-panel mc-analytics-panel--wide mc-reports-list-table-panel">
              <div className="mc-analytics-panel__head">
                <div>
                  <h2 className="mc-analytics-panel__title">Campaign performance</h2>
                  <p className="mc-analytics-panel__meta">
                    Click a metric to open those leads in CRM Pipeline, or View report for the full engagement story.
                  </p>
                </div>
                <button
                  type="button"
                  className="mc-btn mc-btn--outline mc-btn--sm"
                  onClick={() => onNavigate?.('marketing', { tab: 'campaigns' })}
                >
                  Manage campaigns
                </button>
              </div>

              {!filtered.length ? (
                <p className="mc-analytics-empty">No campaigns match your filters.</p>
              ) : (
                <div className="mc-table-wrap">
                  <table className="mc-table mc-reports-list-table">
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th>Status</th>
                        <th>Send date</th>
                        <th>Recipients</th>
                        <th>Open rate</th>
                        <th>Click rate</th>
                        <th>Unsubs</th>
                        <th>Bounced</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => {
                        const m = campaignMetrics(c)
                        const stats = c.stats || c.analytics || {}
                        const channel =
                          c.channel === 'whatsapp'
                            ? 'WhatsApp'
                            : c.type === 'sequence'
                              ? 'Automation'
                              : 'Email'
                        return (
                          <tr key={c.id}>
                            <td>
                              <button
                                type="button"
                                className="mc-camp-table__name"
                                onClick={() => openMarketingCampaignReport(c.id)}
                              >
                                <span className="mc-camp-table__thumb-mini">
                                  {c.name?.slice(0, 2).toUpperCase() || 'C'}
                                </span>
                                <span>
                                  <strong>{c.name || 'Untitled'}</strong>
                                  <span className="mc-camp-table__subject">
                                    {channel}
                                    {c.createdByName ? ` · ${c.createdByName}` : ''}
                                  </span>
                                </span>
                              </button>
                              {showCreator && c.createdByName ? (
                                <MarketingCreatorBadge name={c.createdByName} isOwn={c.isOwn} />
                              ) : null}
                            </td>
                            <td>
                              <StatusBadge campaign={c} />
                            </td>
                            <td className="mc-table__date">
                              {formatDateTime(campaignActivityDate(c))}
                            </td>
                            <td className="mc-analytics-num">
                              {m.sent > 0 || m.enrolled > 0 ? (
                                <button
                                  type="button"
                                  className="mc-link"
                                  onClick={(e) => goToPipeline(c, 'sent', e)}
                                >
                                  {(m.enrolled || m.sent).toLocaleString()}
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="mc-analytics-num">
                              {m.opens > 0 ? (
                                <button
                                  type="button"
                                  className="mc-link"
                                  onClick={(e) => goToPipeline(c, 'opened', e)}
                                >
                                  {m.openRate}%
                                  <span className="mc-reports-list-metric-sub">{m.opens} opened</span>
                                </button>
                              ) : (
                                `${m.openRate || 0}%`
                              )}
                            </td>
                            <td className="mc-analytics-num">
                              {m.clicks > 0 ? (
                                <button
                                  type="button"
                                  className="mc-link"
                                  onClick={(e) => goToPipeline(c, 'clicked', e)}
                                >
                                  {m.clickRate}%
                                  <span className="mc-reports-list-metric-sub">{m.clicks} clicked</span>
                                </button>
                              ) : (
                                `${m.clickRate || 0}%`
                              )}
                            </td>
                            <td className="mc-analytics-num">
                              {(stats.unsubscribed ?? 0) > 0 ? (
                                <button
                                  type="button"
                                  className="mc-link"
                                  onClick={(e) => goToPipeline(c, 'unsubscribed', e)}
                                >
                                  {stats.unsubscribed}
                                </button>
                              ) : (
                                stats.unsubscribed ?? 0
                              )}
                            </td>
                            <td className="mc-analytics-num">
                              {(stats.bounced ?? 0) > 0 ? (
                                <button
                                  type="button"
                                  className="mc-link"
                                  onClick={(e) => goToPipeline(c, 'bounced', e)}
                                >
                                  {stats.bounced}
                                </button>
                              ) : (
                                stats.bounced ?? 0
                              )}
                            </td>
                            <td>
                              <div className="mc-analytics-actions">
                                <button
                                  type="button"
                                  className="mc-btn mc-btn--outline mc-btn--sm"
                                  onClick={() => openMarketingCampaignReport(c.id)}
                                >
                                  View report
                                </button>
                                {folder !== 'archive' ? (
                                  <button
                                    type="button"
                                    className="mc-btn mc-btn--ghost mc-btn--sm"
                                    disabled={archiveBusy === c.id}
                                    onClick={(e) => archiveCampaign(c.id, e)}
                                  >
                                    Archive
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
            </section>
          </>
        ) : null}
      </div>
    </MarketingReportFocusShell>
  )
}
