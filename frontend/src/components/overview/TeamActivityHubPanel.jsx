import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { ACTIVITY_LABELS } from '../../lib/crmUiConstants'
import { buildActivityLogQuery, navigationForActivityMetric } from '../../lib/activityDashboardNav'
import { dashboardNavOptions } from '../../lib/dashboardNavigation'
import { buildDashboardMemberOptions } from '../../lib/memberOptions'
import { mergeRepPerformanceRows } from '../../lib/mergeRepRows'
import ActivityDashboardFilters from '../crm/ActivityDashboardFilters'
import {
  CommandBarMetric,
  InsightsCarousel,
  PerformanceMatrix,
  PipelineHealthFunnel,
  EffectivenessGrid,
  ActivityFeed,
  SkeletonBlock,
} from '../crm/TeamIntelligenceV3Charts'
import {
  TypeBreakdownBar,
  RepActivityBars,
  ActivityTrendMini,
  FilterChips,
} from '../crm/ActivityLogHubCharts'
import { RepPerformanceTable, RollupStrip } from './TeamReviewTables'
import '../../styles/dashboard-home.css'

function periodLabel(period) {
  if (period === 'day') return 'Today'
  if (period === 'month') return '30 days'
  return '7 days'
}

export default function TeamActivityHubPanel({ onNavigate, panelOptions = {}, isActive = true }) {
  const { user, teamMembers, repRoster, refreshTeam, openPipelineLead, orgLeadTags } = useApp()

  const [bootstrap, setBootstrap] = useState(null)
  const [period, setPeriod] = useState(panelOptions?.period || 'week')
  const [activityType, setActivityType] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('')
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [memberUserId, setMemberUserId] = useState(panelOptions?.userId ? String(panelOptions.userId) : '')
  const [metrics, setMetrics] = useState(null)
  const [activityPayload, setActivityPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedFeedId, setExpandedFeedId] = useState(null)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)

  const role = bootstrap?.role || 'rep'
  const isManager = role === 'manager' || role === 'org_admin'
  const scopedMemberId = isManager ? memberUserId : String(user?.id || '')

  useEffect(() => {
    if (!isActive) return undefined
    void refreshTeam()
  }, [isActive, refreshTeam])

  useEffect(() => {
    if (!isManager && user?.id) setMemberUserId(String(user.id))
  }, [isManager, user?.id])

  useEffect(() => {
    if (panelOptions?.userId !== undefined) {
      setMemberUserId(panelOptions.userId ? String(panelOptions.userId) : '')
    }
    if (panelOptions?.period) setPeriod(panelOptions.period)
  }, [panelOptions?.userId, panelOptions?.period])

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await api.getDashboardBootstrap()
      setBootstrap(res.dashboard || null)
    } catch {
      setBootstrap(null)
    }
  }, [])

  const loadData = useCallback(async () => {
    if (!isActive) return
    setLoading(true)
    setError(null)
    try {
      const metricsQ = new URLSearchParams()
      if (useCustomRange && fromDate && toDate) {
        metricsQ.set('from', fromDate)
        metricsQ.set('to', toDate)
      } else {
        metricsQ.set('period', period)
      }
      if (scopedMemberId) metricsQ.set('userId', scopedMemberId)
      if (statusFilter && statusFilter !== 'all') metricsQ.set('status', statusFilter)
      if (tagFilter) metricsQ.set('tagId', tagFilter)

      const activityQuery = buildActivityLogQuery({
        period: useCustomRange ? undefined : period,
        memberUserId: scopedMemberId,
        activityType,
        status: statusFilter,
        tagId: tagFilter,
        from: useCustomRange ? fromDate : '',
        to: useCustomRange ? toDate : '',
      })
      const activityQ = `${activityQuery}${activityQuery ? '&' : ''}limit=50&offset=0`

      const [metricsRes, activityRes] = await Promise.all([
        api.getCrmTeamMetrics(metricsQ.toString()),
        api.getCrmActivityLog(activityQ),
      ])
      setMetrics(metricsRes)
      setActivityPayload(activityRes)
      setExpandedFeedId(null)
    } catch (e) {
      setError(e.message || 'Could not load team dashboard')
    } finally {
      setLoading(false)
    }
  }, [
    isActive,
    period,
    scopedMemberId,
    activityType,
    statusFilter,
    tagFilter,
    useCustomRange,
    fromDate,
    toDate,
  ])

  useEffect(() => {
    if (!isActive) return undefined
    void loadBootstrap()
  }, [isActive, loadBootstrap])

  useEffect(() => {
    if (!isActive) return undefined
    loadData()
  }, [isActive, loadData])

  const openRepReview = useCallback(
    (userId) => {
      onNavigate?.('crm-rep-review', {
        userId: String(userId),
        period,
        returnTo: 'overview',
      })
    },
    [onNavigate, period]
  )

  const selectMember = useCallback((uid) => {
    setMemberUserId(uid ? String(uid) : '')
    setFilterDrawerOpen(false)
  }, [])

  const hub = activityPayload?.hub
  const v3 = metrics?.intelligenceV3
  const intel = metrics?.teamIntelligence
  const rollup = intel?.rollup
  const comparison = intel?.comparison

  const intelMembers = intel?.members || []
  const intelByUser = useMemo(() => new Map(intelMembers.map((m) => [String(m.userId), m])), [intelMembers])

  const baseMemberOptions = useMemo(
    () =>
      buildDashboardMemberOptions({
        teamMembers,
        repRoster,
        metricsMemberOptions: metrics?.memberOptions,
        activityMemberOptions: activityPayload?.memberOptions,
        intelMembers,
        repPerformance: bootstrap?.repPerformance,
      }),
    [
      teamMembers,
      repRoster,
      metrics?.memberOptions,
      activityPayload?.memberOptions,
      intelMembers,
      bootstrap?.repPerformance,
    ]
  )

  const repRows = useMemo(() => {
    if (!isManager) return []
    return mergeRepPerformanceRows(bootstrap?.repPerformance, baseMemberOptions, intelByUser)
  }, [isManager, bootstrap?.repPerformance, baseMemberOptions, intelByUser])

  const memberOptions = useMemo(
    () => buildDashboardMemberOptions({ metricsMemberOptions: baseMemberOptions, repRows }),
    [baseMemberOptions, repRows]
  )

  const memberName = useMemo(() => {
    if (!scopedMemberId) return null
    return memberOptions.find((m) => String(m.userId) === String(scopedMemberId))?.name || 'Team member'
  }, [scopedMemberId, memberOptions])

  const matrixRows = useMemo(() => {
    const rows = v3?.performanceMatrix || []
    if (scopedMemberId) return rows.filter((r) => String(r.userId) === String(scopedMemberId))
    return rows
  }, [v3?.performanceMatrix, scopedMemberId])

  const feedItems = useMemo(
    () =>
      (activityPayload?.activities || []).map((act) => ({
        id: act.id || `act-${act.leadId}-${act.createdAt}`,
        kind: 'activity',
        type: act.type,
        at: act.createdAt,
        title: act.leadName || 'Lead',
        company: act.company,
        body: act.summary,
        actorName: act.createdByName,
        leadId: act.leadId,
        meta: { typeLabel: ACTIVITY_LABELS[act.type] || act.type },
      })),
    [activityPayload?.activities]
  )

  const dashboardFilters = useMemo(
    () => ({
      period: useCustomRange ? 'custom' : period,
      memberUserId: scopedMemberId,
      status: statusFilter,
      tagId: tagFilter,
      from: useCustomRange ? fromDate : '',
      to: useCustomRange ? toDate : '',
    }),
    [period, scopedMemberId, statusFilter, tagFilter, useCustomRange, fromDate, toDate]
  )

  const onMetricClick = useCallback(
    (metric) => {
      const { panel, opts } = navigationForActivityMetric(metric.id, dashboardFilters)
      if (panel === 'crm-log') {
        if (opts.activityType) setActivityType(opts.activityType)
        return
      }
      onNavigate?.(panel, dashboardNavOptions(opts, user))
    },
    [dashboardFilters, onNavigate, user]
  )

  const onLead = useCallback(
    (leadId) => {
      if (!leadId) return
      openPipelineLead(leadId)
      onNavigate?.('pipeline', { returnTo: 'overview' })
    },
    [openPipelineLead, onNavigate]
  )

  const filterControls = (
    <ActivityDashboardFilters
      period={period}
      onPeriodChange={setPeriod}
      memberUserId={scopedMemberId}
      onMemberChange={selectMember}
      memberOptions={memberOptions}
      showMemberFilter={isManager}
      status={statusFilter}
      onStatusChange={setStatusFilter}
      tagId={tagFilter}
      onTagChange={setTagFilter}
      orgLeadTags={orgLeadTags || []}
      fromDate={fromDate}
      toDate={toDate}
      onFromDateChange={setFromDate}
      onToDateChange={setToDate}
      useCustomRange={useCustomRange}
      onUseCustomRangeChange={setUseCustomRange}
    />
  )

  if (!isActive) return null

  const greeting = bootstrap?.greeting || 'Hello'
  const firstName = bootstrap?.user?.firstName || user?.name?.split(/\s+/)[0] || 'there'
  const scopeLabel = bootstrap?.scopeLabel || (isManager ? 'Team overview' : 'Your activity')
  const winning = hub?.pulse === 'active'

  return (
    <div className="panel-shell team-intel-page team-intel-page--v3 ti3-log-hub team-activity-hub">
      <div className="ti3-scroll panel-body-scroll">
        <div className="ti3-chrome ti3-chrome--dash team-activity-hub__chrome">
          <div className="ti3-chrome__title">
            <p className="dash-home__eyebrow">Team dashboard</p>
            <h1>
              {greeting}, {firstName}
            </h1>
            <p className={`ti3-chrome__pulse${winning ? ' is-winning' : ' is-risk'}`}>
              {scopeLabel}
              {scopedMemberId && memberName ? ` · ${memberName}` : ''}
              {` · ${hub?.periodLabel || periodLabel(period)}`}
              {activityPayload?.warming ? ' · refreshing…' : ''}
            </p>
          </div>
          <div className="ti3-chrome__controls ti3-chrome__controls--desktop">{filterControls}</div>
          <button
            type="button"
            className="ti3-chrome__filters-btn"
            onClick={() => setFilterDrawerOpen(true)}
            aria-label="Open filters"
          >
            Filters
          </button>
        </div>

        {error ? <p className="ti3-error">{error}</p> : null}

        {loading && !metrics ? (
          <div className="ti3-cockpit ti3-cockpit--loading">
            <div className="ti3-cmd-strip">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonBlock key={i} className="ti3-skeleton--cmd" />
              ))}
            </div>
            <SkeletonBlock className="ti3-skeleton--insights" />
          </div>
        ) : (
          <div className="ti3-cockpit ti3-cockpit--dash">
            <section className="ti3-cmd-strip" aria-label="Activity KPIs">
              {(hub?.commandBar || []).map((metric) => (
                <CommandBarMetric key={metric.id} metric={metric} onClick={onMetricClick} />
              ))}
            </section>

            <RollupStrip rollup={rollup} comparison={comparison} />

            {isManager && !scopedMemberId ? (
              <section className="ti3-panel team-activity-hub__review" aria-label="Team rep review">
                <header className="ti3-panel__head ti3-panel__head--row">
                  <div>
                    <h2>Team review</h2>
                    <p>Rep performance for {periodLabel(period)} — click a rep to drill in</p>
                  </div>
                </header>
                <RepPerformanceTable
                  rows={repRows}
                  periodLabel={periodLabel(period)}
                  onSelectRep={selectMember}
                  onReviewRep={openRepReview}
                  onPipelineAction={(action) => onNavigate?.(action.panel, dashboardNavOptions(action, user))}
                />
              </section>
            ) : null}

            <section className="ti3-panel ti3-panel--insights" aria-label="Insights">
              <header className="ti3-panel__head">
                <h2>Insights</h2>
                <span className="ti3-panel__tag">AI intelligence</span>
              </header>
              <InsightsCarousel
                insights={hub?.insights || v3?.insights}
                onSelect={(uid) => {
                  if (uid) selectMember(uid)
                }}
              />
            </section>

            <div className="ti3-grid">
              <section className="ti3-panel ti3-span-12" aria-label="Performance matrix">
                <header className="ti3-panel__head">
                  <h2>{scopedMemberId ? `${memberName || 'Rep'} performance` : 'Team performance'}</h2>
                  <p>Activity, pipeline, and outcomes</p>
                </header>
                <PerformanceMatrix rows={matrixRows} onSelectRep={selectMember} />
              </section>

              <section className="ti3-panel ti3-span-6" aria-label="Pipeline health">
                <header className="ti3-panel__head">
                  <h2>Pipeline health</h2>
                  <p>Stage volume and bottlenecks</p>
                </header>
                <PipelineHealthFunnel pipeline={v3?.pipelineHealth} />
              </section>

              <section className="ti3-panel ti3-span-6" aria-label="Activity by type">
                <header className="ti3-panel__head">
                  <h2>By type</h2>
                  <p>Tap to filter the feed</p>
                </header>
                <FilterChips filters={hub?.filters} value={activityType || 'all'} onChange={setActivityType} />
                <TypeBreakdownBar rows={hub?.typeBreakdown} activeType={activityType} onSelect={setActivityType} />
              </section>

              <section className="ti3-panel ti3-span-6" aria-label="Activity trend">
                <header className="ti3-panel__head">
                  <h2>Trend</h2>
                  <p>{hub?.periodLabel || periodLabel(period)}</p>
                </header>
                <ActivityTrendMini trend={hub?.trend} />
              </section>

              <section className="ti3-panel ti3-span-6" aria-label="Activity effectiveness">
                <header className="ti3-panel__head">
                  <h2>Effectiveness</h2>
                  <p>Outcomes vs volume</p>
                </header>
                <EffectivenessGrid rows={v3?.activityEffectiveness} />
              </section>

              {isManager && !scopedMemberId && (hub?.repActivity?.length ?? 0) > 0 ? (
                <section className="ti3-panel ti3-span-12" aria-label="Rep activity comparison">
                  <header className="ti3-panel__head">
                    <h2>Who logged activity</h2>
                    <p>Tap a rep to filter this dashboard</p>
                  </header>
                  <RepActivityBars rows={hub.repActivity} onSelect={selectMember} />
                </section>
              ) : null}
            </div>

            <section className="ti3-panel ti3-panel--feed" aria-label="Detailed activity feed">
              <header className="ti3-panel__head ti3-panel__head--row">
                <div>
                  <h2>Activity detail</h2>
                  <p>
                    {(activityPayload?.pagination?.total ?? feedItems.length).toLocaleString()} events ·{' '}
                    {hub?.periodLabel || periodLabel(period)}
                  </p>
                </div>
                {scopedMemberId ? (
                  <button type="button" className="ti3-dash-link-btn" onClick={() => selectMember('')}>
                    ← All team
                  </button>
                ) : null}
              </header>
              <ActivityFeed
                items={feedItems}
                expandedId={expandedFeedId}
                onToggle={(id) => setExpandedFeedId((c) => (c === id ? null : id))}
                onOpen={(item) => {
                  if (item.leadId) onLead(item.leadId)
                }}
              />
            </section>
          </div>
        )}
      </div>

      {filterDrawerOpen ? (
        <div className="ti3-drawer-backdrop" role="presentation" onClick={() => setFilterDrawerOpen(false)}>
          <div className="ti3-drawer" role="dialog" aria-label="Filters" onClick={(e) => e.stopPropagation()}>
            <header className="ti3-drawer__head">
              <h2>Filters</h2>
              <button type="button" onClick={() => setFilterDrawerOpen(false)} aria-label="Close">
                ×
              </button>
            </header>
            <div className="ti3-drawer__body">
              {filterControls}
              <FilterChips filters={hub?.filters} value={activityType || 'all'} onChange={setActivityType} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
