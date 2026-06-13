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
  SearchIcon,
  SlidersIcon,
} from '../ui/icons'

const PERIODS = [
  { id: 'all', label: 'All time' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'year', label: 'Year' },
]

const STATUS_FILTERS = [
  { id: '', label: 'All statuses' },
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

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (period !== 'all') n += 1
    if (teamFilter !== 'all') n += 1
    if (statusFilter) n += 1
    if (query.trim()) n += 1
    return n
  }, [period, teamFilter, statusFilter, query])

  const clearFilters = () => {
    setPeriod('all')
    setTeamFilter('all')
    setStatusFilter('')
    setQuery('')
  }

  const activeCampaignCount = useMemo(
    () => campaigns.filter((c) => c.status !== 'archived').length,
    [campaigns]
  )

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
      subtitle="Opens, clicks, and delivery for every send — filter, search, and drill into CRM."
      onNavigate={onNavigate}
      showBackToList={false}
    >
      <div className="mc-page mc-reports-list-page">
        {error ? <p className="mc-analytics-error">{error}</p> : null}
        {loading ? <LoadingExperience message="Loading campaign reports…" fill={false} className="py-12" /> : null}

        {!loading ? (
          <>
            <div className="mc-reports-kpis">
              <div className="mc-reports-kpi">
                <span className="mc-reports-kpi__value">{totals.count}</span>
                <span className="mc-reports-kpi__label">Campaigns</span>
              </div>
              <div className="mc-reports-kpi">
                <span className="mc-reports-kpi__value">{totals.enrolled.toLocaleString()}</span>
                <span className="mc-reports-kpi__label">Recipients</span>
              </div>
              <div className="mc-reports-kpi mc-reports-kpi--accent">
                <span className="mc-reports-kpi__value">{totals.sent.toLocaleString()}</span>
                <span className="mc-reports-kpi__label">Emails sent</span>
              </div>
              <div className="mc-reports-kpi">
                <span className="mc-reports-kpi__value">{totals.openRate}%</span>
                <span className="mc-reports-kpi__label">{totals.opens.toLocaleString()} opens</span>
              </div>
              <div className="mc-reports-kpi">
                <span className="mc-reports-kpi__value">{totals.clickRate}%</span>
                <span className="mc-reports-kpi__label">{totals.clicks.toLocaleString()} clicks</span>
              </div>
            </div>

            <div className="mc-reports-shell">
              <nav className="mc-reports-tabs" aria-label="Report folders">
                <button
                  type="button"
                  className={`mc-reports-tab${folder === 'reports' ? ' is-active' : ''}`}
                  onClick={() => setFolder('reports')}
                >
                  Campaigns
                  <span className="mc-reports-tab__count">{activeCampaignCount}</span>
                </button>
                <button
                  type="button"
                  className={`mc-reports-tab${folder === 'archive' ? ' is-active' : ''}`}
                  onClick={() => setFolder('archive')}
                >
                  Archive
                  {archiveCount > 0 ? (
                    <span className="mc-reports-tab__count">{archiveCount}</span>
                  ) : null}
                </button>
              </nav>

              <div className="mc-reports-toolbar">
                <div className="mc-reports-toolbar__search">
                  <SearchIcon className="mc-reports-toolbar__search-icon" aria-hidden />
                  <input
                    id="reports-search"
                    type="search"
                    className="mc-reports-toolbar__search-input"
                    placeholder="Search by campaign name…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>

                <div className="mc-reports-toolbar__filters" aria-label="Filter campaigns">
                  <SlidersIcon className="mc-reports-toolbar__filters-icon" aria-hidden />
                  <select
                    id="reports-period"
                    className="mc-reports-select"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    aria-label="Date range"
                  >
                    {PERIODS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  {showTeamFilter ? (
                    <select
                      id="reports-team"
                      className="mc-reports-select"
                      value={teamFilter}
                      onChange={(e) => setTeamFilter(e.target.value)}
                      aria-label="Team member"
                    >
                      <option value="all">All team</option>
                      {teamOptions.map((m) => (
                        <option key={teamMemberUserId(m)} value={teamMemberUserId(m)}>
                          {teamMemberLabel(m)}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <select
                    id="reports-status"
                    className="mc-reports-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Campaign status"
                  >
                    {STATUS_FILTERS.map((f) => (
                      <option key={f.id || 'all'} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mc-reports-toolbar__actions">
                  {activeFilterCount > 0 ? (
                    <button type="button" className="mc-reports-clear" onClick={clearFilters}>
                      Clear filters
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="mc-btn mc-btn--ghost mc-btn--sm"
                    onClick={load}
                    disabled={loading}
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    className="mc-btn mc-btn--outline mc-btn--sm"
                    onClick={() => onNavigate?.('marketing', { tab: 'campaigns' })}
                  >
                    Manage campaigns
                  </button>
                </div>
              </div>

              <div className="mc-reports-results-bar">
                <p className="mc-reports-results-bar__text">
                  <strong>{filtered.length}</strong>
                  {filtered.length === 1 ? ' campaign' : ' campaigns'}
                  {activeFilterCount > 0 ? (
                    <span className="mc-reports-results-bar__hint">
                      {' '}
                      · {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} applied
                    </span>
                  ) : null}
                </p>
              </div>

              {!filtered.length ? (
                <div className="mc-reports-empty">
                  <ChartIcon className="mc-reports-empty__icon" aria-hidden />
                  <h3 className="mc-reports-empty__title">No campaigns match</h3>
                  <p className="mc-reports-empty__text">
                    {activeFilterCount > 0
                      ? 'Try clearing filters or widening the date range.'
                      : folder === 'archive'
                        ? 'Archived campaigns will appear here.'
                        : 'Send a campaign to see performance reports.'}
                  </p>
                  {activeFilterCount > 0 ? (
                    <button type="button" className="mc-btn mc-btn--outline mc-btn--sm" onClick={clearFilters}>
                      Clear filters
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="mc-table-wrap mc-reports-table-wrap">
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
                        <th aria-label="Actions" />
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
                              <div className="mc-reports-row-actions">
                                <button
                                  type="button"
                                  className="mc-btn mc-btn--primary mc-btn--sm"
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

              {filtered.length > 0 ? (
                <p className="mc-reports-table-foot">
                  Click open or click rates to jump to those contacts in CRM Pipeline.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </MarketingReportFocusShell>
  )
}
