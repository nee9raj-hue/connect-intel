import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'
import { formatDealValue } from '../../lib/crmTimeline'
import {
  DashboardSegmented,
  DashboardEmpty,
} from '../dashboard/dashboardUi'
import {
  formatDelta,
  formatHours,
  timelineTypeLabel,
} from '../../lib/teamIntelligenceConstants'
import { formatDateTime } from '../../lib/crmUiConstants'
import {
  TIMELINE_FILTERS,
  countTimelineFilters,
  matchesTimelineFilter,
} from '../../lib/teamIntelligenceFilters'
import { saveTeamIntelReturn } from '../../lib/teamIntelReturn'
import TeamIntelligenceDetailModal from './TeamIntelligenceDetailModal'
import {
  Sparkline,
  HealthRadial,
  TrendLineChart,
  PipelineFunnelChart,
  WorkloadDistributionChart,
  AdoptionScoreChart,
} from './TeamIntelligenceCharts'

const TIMELINE_PAGE_SIZE = 5

const BADGE_LABELS = {
  top: 'Top performer',
  rising: 'Rising star',
  attention: 'Needs attention',
}

const INSIGHT_ICONS = {
  highlight: '↑',
  risk: '!',
}

const KPI_COLORS = {
  revenue: '#516f90',
  newLeads: '#00a4bd',
  followUps: '#f5c518',
  activeDeals: '#7c3aed',
  calls: '#ff7a59',
  meetings: '#25d366',
  responses: '#00a4bd',
  activityScore: '#e85d75',
}

function formatKpiValue(kpi) {
  if (kpi.format === 'currency') return formatDealValue(kpi.value)
  if (kpi.format === 'score') return `${kpi.value}`
  return (kpi.value ?? 0).toLocaleString()
}

function deltaTone(delta) {
  if (delta == null || Number.isNaN(delta)) return 'neutral'
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'neutral'
}

function ExecutiveKpiCard({ kpi }) {
  const tone = deltaTone(kpi.delta)
  return (
    <article className={`ti2-kpi ti2-kpi--${kpi.id}`}>
      <div className="ti2-kpi__top">
        <span className="ti2-kpi__label">{kpi.label}</span>
        {kpi.delta != null ? (
          <span className={`ti2-kpi__delta ti2-kpi__delta--${tone}`}>{formatDelta(kpi.delta)}</span>
        ) : null}
      </div>
      <div className="ti2-kpi__value-row">
        <span className="ti2-kpi__value">
          {formatKpiValue(kpi)}
          {kpi.format === 'score' ? <span className="ti2-kpi__suffix">/100</span> : null}
        </span>
        <Sparkline data={kpi.spark} color={KPI_COLORS[kpi.id] || '#00a4bd'} />
      </div>
    </article>
  )
}

function LeaderboardTable({ rows = [], onSelectRep, showAdoption = false }) {
  if (!rows.length) return <DashboardEmpty>No team activity this period.</DashboardEmpty>

  return (
    <div className="ti2-leaderboard-wrap">
      <table className="ti2-leaderboard">
        <thead>
          <tr>
            <th>Rep</th>
            <th>Activity</th>
            <th>Calls</th>
            <th>Emails</th>
            <th>Meetings</th>
            <th>Leads</th>
            <th>Deals</th>
            <th>Win %</th>
            <th>CRM time</th>
            {showAdoption ? <th>Adoption</th> : null}
            <th>Health</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId} className={row.badge === 'attention' ? 'ti2-leaderboard__row--risk' : ''}>
              <td>
                <button type="button" className="ti2-leaderboard__rep" onClick={() => onSelectRep?.(row.userId)}>
                  <span className="ti2-leaderboard__name">{row.name}</span>
                  {row.badge ? (
                    <span className={`ti2-badge ti2-badge--${row.badge}`}>{BADGE_LABELS[row.badge]}</span>
                  ) : null}
                </button>
              </td>
              <td>
                <span className="ti2-score-pill">{row.activityScore}</span>
              </td>
              <td>{row.calls}</td>
              <td>{row.emails}</td>
              <td>{row.meetings}</td>
              <td>{row.newLeads}</td>
              <td>{row.activeDeals}</td>
              <td>{row.winRate != null ? `${row.winRate}%` : '—'}</td>
              <td>{formatHours(row.crmTimeHours)}</td>
              {showAdoption ? (
                <td>
                  <span className={`ti2-adoption-pill${row.adoptionScore >= 65 ? ' is-good' : row.adoptionScore >= 40 ? ' is-warn' : ' is-risk'}`}>
                    {row.adoptionScore}
                  </span>
                </td>
              ) : null}
              <td>
                <span className={`ti2-health-pill${row.healthScore >= 70 ? ' is-good' : row.healthScore >= 45 ? ' is-warn' : ' is-risk'}`}>
                  {row.healthScore}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TeamIntelligencePanel({ onNavigate, panelOptions = {}, isActive = true }) {
  const { user, teamMembers, openPipelineLead, setPipelineAssigneeFilter } = useApp()
  const [period, setPeriod] = useState(panelOptions?.period || 'week')
  const [memberUserId, setMemberUserId] = useState(panelOptions?.userId || '')
  const [timelineFilter, setTimelineFilter] = useState(panelOptions?.timelineFilter || 'all')
  const [timelineVisible, setTimelineVisible] = useState(TIMELINE_PAGE_SIZE)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [detailItem, setDetailItem] = useState(null)
  const scrollRef = useRef(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const intel = data?.teamIntelligence
  const v2 = data?.intelligenceV2
  const isManagerView = Boolean(v2?.isManagerView ?? (data?.isAdmin && !data?.memberUserId))

  const memberOptions = useMemo(() => {
    if (data?.memberOptions?.length) return data.memberOptions
    return (teamMembers || []).map((m) => ({ userId: m.userId, name: m.name }))
  }, [data?.memberOptions, teamMembers])

  const activeMemberId = data?.memberUserId ?? memberUserId

  const memberName = useMemo(() => {
    if (!activeMemberId) return null
    return (
      memberOptions.find((m) => String(m.userId) === String(activeMemberId))?.name ||
      intel?.members?.find((m) => String(m.userId) === String(activeMemberId))?.name ||
      'Team member'
    )
  }, [activeMemberId, memberOptions, intel?.members])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ period, detailed: '1' })
      if (memberUserId) q.set('userId', memberUserId)
      const res = await api.getCrmTeamDashboard(q.toString())
      setData(res)
    } catch (e) {
      setError(e.message || 'Could not load team intelligence')
    } finally {
      setLoading(false)
    }
  }, [period, memberUserId])

  useEffect(() => {
    if (!isActive) return undefined
    load()
  }, [load, isActive])

  useEffect(() => {
    if (!isActive || loading || !panelOptions?.teamIntelScrollY || !scrollRef.current) return undefined
    const y = panelOptions.teamIntelScrollY
    const t = requestAnimationFrame(() => {
      scrollRef.current.scrollTop = y
    })
    return () => cancelAnimationFrame(t)
  }, [isActive, loading, panelOptions?.teamIntelScrollY, data])

  useEffect(() => {
    if (panelOptions?.userId !== undefined) setMemberUserId(panelOptions.userId ? String(panelOptions.userId) : '')
    if (panelOptions?.period) setPeriod(panelOptions.period)
    if (panelOptions?.timelineFilter) setTimelineFilter(panelOptions.timelineFilter)
  }, [panelOptions?.userId, panelOptions?.period, panelOptions?.timelineFilter])

  const selectMember = (uid) => {
    const id = uid ? String(uid) : ''
    setMemberUserId(id)
    setPipelineAssigneeFilter?.(id || null)
    setTimelineFilter('all')
  }

  const timelineCounts = useMemo(
    () => countTimelineFilters(data?.activityTimeline || []),
    [data?.activityTimeline]
  )

  const filteredTimeline = useMemo(() => {
    const rows = data?.activityTimeline || []
    return rows.filter((item) => matchesTimelineFilter(item, timelineFilter))
  }, [data?.activityTimeline, timelineFilter])

  const visibleTimeline = useMemo(
    () => filteredTimeline.slice(0, timelineVisible),
    [filteredTimeline, timelineVisible]
  )

  const timelineRemaining = Math.max(0, filteredTimeline.length - visibleTimeline.length)

  useEffect(() => {
    setTimelineVisible(TIMELINE_PAGE_SIZE)
  }, [period, memberUserId, timelineFilter, data?.activityTimeline])

  const openInCrm = useCallback(
    (item, leadTab) => {
      if (!item?.leadId) return
      saveTeamIntelReturn({
        period,
        memberUserId: activeMemberId,
        timelineFilter,
        activityId: item.id,
        scrollY: scrollRef.current?.scrollTop || 0,
      })
      openPipelineLead(item.leadId, leadTab || 'notes')
      onNavigate?.('pipeline')
      setDetailItem(null)
    },
    [period, activeMemberId, timelineFilter, openPipelineLead, onNavigate]
  )

  const handleAction = useCallback(
    (action) => {
      if (!action) return
      if (action.action === 'pipeline') {
        onNavigate?.('pipeline', { status: action.filter || 'all', view: action.view })
      } else if (action.action === 'crm-log') {
        onNavigate?.('crm-log', { period, userId: activeMemberId || undefined })
      } else if (action.action === 'coaching' && action.userIds?.[0]) {
        selectMember(action.userIds[0])
      }
    },
    [onNavigate, period, activeMemberId]
  )

  const periodLabel = intel?.periodLabel || period
  const leaderboardRows = useMemo(() => {
    const rows = v2?.leaderboard || []
    if (activeMemberId) return rows.filter((r) => String(r.userId) === String(activeMemberId))
    return rows
  }, [v2?.leaderboard, activeMemberId])

  if (!isActive) return null

  return (
    <div className="panel-shell team-intel-page team-intel-page--v2">
      <header className="team-intel-page__header ti2-header shrink-0">
        <div className="team-intel-page__header-main">
          <h1 className="team-intel-page__title">Team intelligence</h1>
          <p className="team-intel-page__subtitle">
            {isManagerView && !activeMemberId
              ? 'Performance → Risks → Insights → Actions'
              : activeMemberId
                ? `${memberName} — personal performance workspace`
                : 'Your CRM performance pulse'}
          </p>
        </div>
        <div className="team-intel-page__header-actions ti2-header__actions">
          {isManagerView && memberOptions.length > 0 ? (
            <label className="ti2-filter-select">
              <span className="sr-only">Filter by rep</span>
              <select
                value={activeMemberId || ''}
                onChange={(e) => selectMember(e.target.value)}
              >
                <option value="">All team</option>
                {memberOptions.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <DashboardSegmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'day', label: 'Today' },
              { value: 'week', label: '7 days' },
              { value: 'month', label: '30 days' },
            ]}
          />
          <button
            type="button"
            className="crm-btn crm-btn-secondary crm-btn-sm"
            onClick={load}
            disabled={loading}
          >
            Refresh
          </button>
          <button type="button" className="crm-btn crm-btn-secondary crm-btn-sm" onClick={() => onNavigate?.('overview')}>
            Dashboard
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="team-intel-page__body panel-body-scroll ti2-body">
        {error ? (
          <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2 font-medium mb-4">
            {error}
          </p>
        ) : null}

        {loading && !data ? (
          <LoadingExperience
            message={LOADING_MESSAGES.team}
            fill={false}
            className="rounded-2xl border border-[#dde3ea] min-h-[240px] bg-white"
          />
        ) : (
          <div className="ti2-dashboard">
            {loading ? (
              <p className="ti2-updating" role="status">
                Updating…
              </p>
            ) : null}

            {/* SECTION 1 — Executive summary */}
            <section className="ti2-section ti2-kpi-strip" aria-label="Executive summary">
              <div className="ti2-kpi-grid">
                {(v2?.executiveKpis || []).map((kpi) => (
                  <ExecutiveKpiCard key={kpi.id} kpi={kpi} />
                ))}
              </div>
            </section>

            {/* SECTION 2 + 5 — Health + Insights */}
            <div className="ti2-split ti2-split--health">
              <section className="ti2-card ti2-card--health" aria-label="Team health">
                <div className="ti2-card__head">
                  <h2 className="ti2-card__title">Team health</h2>
                  <p className="ti2-card__sub">Are we on track?</p>
                </div>
                <HealthRadial
                  score={v2?.teamHealth?.overall ?? 0}
                  factors={v2?.teamHealth?.factors || []}
                />
              </section>

              <section className="ti2-card ti2-card--insights" aria-label="Team insights">
                <div className="ti2-card__head">
                  <h2 className="ti2-card__title">Insights</h2>
                  <p className="ti2-card__sub">{periodLabel}</p>
                </div>
                {(v2?.insights || []).length ? (
                  <ul className="ti2-insights">
                    {v2.insights.map((insight, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className={`ti2-insight ti2-insight--${insight.kind || 'highlight'}`}
                          onClick={() => insight.userId && selectMember(insight.userId)}
                        >
                          <span className="ti2-insight__icon" aria-hidden>
                            {INSIGHT_ICONS[insight.kind] || '•'}
                          </span>
                          <span className="ti2-insight__text">{insight.text}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <DashboardEmpty>No insights for this period yet.</DashboardEmpty>
                )}
              </section>
            </div>

            {/* SECTION 3 — Leaderboard (centerpiece) */}
            <section className="ti2-card ti2-card--leaderboard" aria-label="Team performance leaderboard">
              <div className="ti2-card__head ti2-card__head--row">
                <div>
                  <h2 className="ti2-card__title">
                    {activeMemberId ? 'Rep performance' : 'Team leaderboard'}
                  </h2>
                  <p className="ti2-card__sub">
                    {activeMemberId
                      ? 'How am I performing?'
                      : 'Who is performing best — who needs attention?'}
                  </p>
                </div>
                {isManagerView && !activeMemberId ? (
                  <span className="ti2-card__meta">{leaderboardRows.length} reps</span>
                ) : null}
              </div>
              <LeaderboardTable
                rows={leaderboardRows}
                onSelectRep={selectMember}
                showAdoption={isManagerView && !activeMemberId}
              />
            </section>

            {/* SECTION 4 — Activity intelligence */}
            <section className="ti2-card" aria-label="Activity trends">
              <div className="ti2-card__head">
                <h2 className="ti2-card__title">Activity intelligence</h2>
                <p className="ti2-card__sub">What activities are driving results?</p>
              </div>
              <div className="ti2-trends-grid">
                <TrendLineChart data={v2?.trends?.calls} color="#ff7a59" label="Calls" />
                <TrendLineChart data={v2?.trends?.emails} color="#00a4bd" label="Emails" />
                <TrendLineChart data={v2?.trends?.followUps} color="#f5c518" label="Follow-ups" />
                <TrendLineChart data={v2?.trends?.leads} color="#7c3aed" label="Lead activity" />
              </div>
            </section>

            {/* SECTION 6 + 7 + 9 — Bottlenecks, Workload, Actions */}
            <div className="ti2-triple">
              <section className="ti2-card ti2-card--compact" aria-label="Bottleneck analysis">
                <div className="ti2-card__head">
                  <h2 className="ti2-card__title">Bottlenecks</h2>
                  <p className="ti2-card__sub">Where revenue is leaking</p>
                </div>
                <PipelineFunnelChart
                  rows={(v2?.bottlenecks?.funnel || []).map((r) => ({
                    id: r.id,
                    label: r.label,
                    count: r.count,
                  }))}
                  onClick={() => onNavigate?.('pipeline')}
                />
              </section>

              <section className="ti2-card ti2-card--compact" aria-label="Workload distribution">
                <div className="ti2-card__head">
                  <h2 className="ti2-card__title">Workload</h2>
                  <p className="ti2-card__sub">Balance across reps</p>
                </div>
                <WorkloadDistributionChart rows={v2?.workload || []} onSelect={selectMember} />
              </section>

              <section className="ti2-card ti2-card--compact ti2-card--actions" aria-label="Manager action center">
                <div className="ti2-card__head">
                  <h2 className="ti2-card__title">Action center</h2>
                  <p className="ti2-card__sub">What should we do next?</p>
                </div>
                {(v2?.actionCenter || []).length ? (
                  <ul className="ti2-actions">
                    {v2.actionCenter.map((action) => (
                      <li key={action.id}>
                        <button
                          type="button"
                          className={`ti2-action ti2-action--${action.severity || 'medium'}`}
                          onClick={() => handleAction(action)}
                        >
                          <span className="ti2-action__label">{action.label}</span>
                          <span className="ti2-action__cta">Review →</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <DashboardEmpty>All clear — no urgent actions.</DashboardEmpty>
                )}
              </section>
            </div>

            {/* SECTION 8 — CRM adoption */}
            {isManagerView && !activeMemberId ? (
              <section className="ti2-card" aria-label="CRM adoption score">
                <div className="ti2-card__head">
                  <h2 className="ti2-card__title">CRM adoption</h2>
                  <p className="ti2-card__sub">Login, notes, calls, meetings, and deal updates</p>
                </div>
                <AdoptionScoreChart rows={v2?.leaderboard || []} />
              </section>
            ) : null}

            {/* Drill-down — activity timeline */}
            <section className="ti2-card ti2-card--timeline">
              <button
                type="button"
                className="ti2-timeline-toggle"
                onClick={() => setTimelineOpen((o) => !o)}
                aria-expanded={timelineOpen}
              >
                <span>
                  <strong>Activity drill-down</strong>
                  <span className="ti2-card__sub">
                    {activeMemberId ? memberName : 'Select a rep'} · {filteredTimeline.length} events
                  </span>
                </span>
                <span className="ti2-timeline-toggle__chev">{timelineOpen ? '−' : '+'}</span>
              </button>

              {timelineOpen ? (
                <div className="ti2-timeline-body">
                  <div className="team-intel-timeline-filters">
                    {TIMELINE_FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`team-intel-timeline-filters__btn${timelineFilter === f.id ? ' is-active' : ''}`}
                        onClick={() => setTimelineFilter(f.id)}
                      >
                        {f.label}
                        <span className="team-intel-timeline-filters__count" aria-label={`${timelineCounts[f.id] ?? 0} items`}>
                          {timelineCounts[f.id] ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>

                  {!filteredTimeline.length ? (
                    <DashboardEmpty>
                      No {timelineFilter === 'all' ? '' : `${timelineFilter} `}activity for this period yet.
                    </DashboardEmpty>
                  ) : (
                    <ul className="team-intel-timeline">
                      {visibleTimeline.map((item) => (
                        <li key={item.id} className={`team-intel-timeline__item team-intel-timeline__item--${item.kind}`}>
                          <button
                            type="button"
                            className="team-intel-timeline__card"
                            onClick={() => setDetailItem(item)}
                          >
                            <div className="team-intel-timeline__head">
                              <span className="team-intel-timeline__type">{timelineTypeLabel(item.type)}</span>
                              <time className="team-intel-timeline__time">{formatDateTime(item.at)}</time>
                            </div>
                            <p className="team-intel-timeline__title">
                              {item.title}
                              {item.company && item.company !== item.title ? ` · ${item.company}` : ''}
                            </p>
                            {item.body ? <p className="team-intel-timeline__body">{item.body}</p> : null}
                            <p className="team-intel-timeline__actor">
                              {item.actorName || 'Rep'}
                              {item.leadId ? ' · View details' : ''}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {timelineRemaining > 0 ? (
                    <div className="team-intel-timeline__more">
                      <button
                        type="button"
                        className="crm-btn crm-btn-secondary crm-btn-sm"
                        onClick={() =>
                          setTimelineVisible((n) => Math.min(filteredTimeline.length, n + TIMELINE_PAGE_SIZE))
                        }
                      >
                        Load more ({timelineRemaining})
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>

      <TeamIntelligenceDetailModal
        item={detailItem}
        user={user}
        onClose={() => setDetailItem(null)}
        onOpenInCrm={openInCrm}
      />
    </div>
  )
}
