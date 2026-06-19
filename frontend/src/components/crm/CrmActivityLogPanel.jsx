import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { ACTIVITY_LABELS } from '../../lib/crmUiConstants'
import { buildActivityLogQuery, navigationForActivityMetric } from '../../lib/activityDashboardNav'
import ActivityDashboardFilters from './ActivityDashboardFilters'
import {
  CommandBarMetric,
  InsightsCarousel,
  ActionCenterPanel,
  ActivityFeed,
  SkeletonBlock,
} from './TeamIntelligenceV3Charts'
import {
  TypeBreakdownBar,
  RepActivityBars,
  ActivityTrendMini,
  QuickLinksHub,
  FilterChips,
} from './ActivityLogHubCharts'

export default function CrmActivityLogPanel({ onNavigate, panelOptions = {}, isActive = true }) {
  const {
    user,
    openPipelineLead,
    pipelineAssigneeFilter,
    setPipelineAssigneeFilter,
    teamMembers,
    orgLeadTags,
  } = useApp()
  const [period, setPeriod] = useState(panelOptions?.period || 'week')
  const [activityType, setActivityType] = useState(panelOptions?.activityType || null)
  const [statusFilter, setStatusFilter] = useState(panelOptions?.status || 'all')
  const [tagFilter, setTagFilter] = useState(panelOptions?.tagId || '')
  const [useCustomRange, setUseCustomRange] = useState(Boolean(panelOptions?.from && panelOptions?.to))
  const [fromDate, setFromDate] = useState(panelOptions?.from || '')
  const [toDate, setToDate] = useState(panelOptions?.to || '')
  const [memberUserId, setMemberUserId] = useState(
    panelOptions?.userId ? String(panelOptions.userId) : pipelineAssigneeFilter ? String(pipelineAssigneeFilter) : ''
  )
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedFeedId, setExpandedFeedId] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const hub = payload?.hub
  const activities = payload?.activities || []

  const memberOptions = useMemo(() => {
    if (payload?.memberOptions?.length) return payload.memberOptions
    return (teamMembers || []).map((m) => ({ userId: m.userId, name: m.name }))
  }, [payload?.memberOptions, teamMembers])

  useEffect(() => {
    if (panelOptions?.period) setPeriod(panelOptions.period)
    if (panelOptions?.activityType !== undefined) setActivityType(panelOptions.activityType || null)
    if (panelOptions?.userId !== undefined) {
      const id = panelOptions.userId ? String(panelOptions.userId) : ''
      setMemberUserId(id)
      setPipelineAssigneeFilter?.(id || null)
    }
  }, [panelOptions?.period, panelOptions?.activityType, panelOptions?.userId, setPipelineAssigneeFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = buildActivityLogQuery({
        period: useCustomRange ? undefined : period,
        memberUserId,
        activityType,
        status: statusFilter,
        tagId: tagFilter,
        from: useCustomRange ? fromDate : '',
        to: useCustomRange ? toDate : '',
      })
      const q = `${query}${query ? '&' : ''}limit=50&offset=0`
      const data = await api.getCrmActivityLog(q)
      setPayload(data)
      setExpandedFeedId(null)
    } catch (err) {
      setError(err.message || 'Could not load activity log')
    } finally {
      setLoading(false)
    }
  }, [memberUserId, activityType, period, statusFilter, tagFilter, useCustomRange, fromDate, toDate])

  const loadMore = useCallback(async () => {
    if (loadingMore || !payload?.pagination?.hasMore) return
    setLoadingMore(true)
    try {
      const nextOffset = payload?.activities?.length || 0
      const query = buildActivityLogQuery({
        period: useCustomRange ? undefined : period,
        memberUserId,
        activityType,
        status: statusFilter,
        tagId: tagFilter,
        from: useCustomRange ? fromDate : '',
        to: useCustomRange ? toDate : '',
      })
      const q = `${query}${query ? '&' : ''}limit=50&offset=${nextOffset}`
      const data = await api.getCrmActivityLog(q)
      setPayload((prev) => ({
        ...data,
        activities: [...(prev?.activities || []), ...(data.activities || [])],
        hub: data.hub || prev?.hub,
      }))
    } catch (err) {
      setError(err.message || 'Could not load more activity')
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, payload, memberUserId, activityType, period, statusFilter, tagFilter, useCustomRange, fromDate, toDate])

  useEffect(() => {
    if (!isActive) return undefined
    load()
  }, [load, isActive])

  const selectMember = useCallback(
    (uid) => {
      const id = uid ? String(uid) : ''
      setMemberUserId(id)
      setPipelineAssigneeFilter?.(id || null)
      setFilterDrawerOpen(false)
    },
    [setPipelineAssigneeFilter]
  )

  const selectType = useCallback((type) => {
    setActivityType(type)
    setFilterDrawerOpen(false)
  }, [])

  const navigateHub = useCallback(
    (panel, opts = {}) => {
      if (panel === 'crm-log') {
        if (opts.activityType !== undefined) setActivityType(opts.activityType)
        if (opts.userId !== undefined) selectMember(opts.userId)
        return
      }
      onNavigate?.(panel, { period, userId: memberUserId || undefined, ...opts })
    },
    [onNavigate, period, memberUserId, selectMember]
  )

  const handleCenterAction = useCallback(
    (_item, act) => {
      if (act.panel === 'crm-log') {
        if (act.activityType) setActivityType(act.activityType)
        return
      }
      navigateHub(act.panel || 'pipeline', {
        activityType: act.activityType,
        status: act.status,
      })
    },
    [navigateHub]
  )

  const feedItems = useMemo(() => {
    return activities.map((act) => ({
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
    }))
  }, [activities])

  const pagination = payload?.pagination
  const totalEvents = pagination?.total ?? activities.length
  const hasMore = pagination?.hasMore ?? false

  const dashboardFilters = useMemo(
    () => ({
      period: useCustomRange ? 'custom' : period,
      memberUserId,
      status: statusFilter,
      tagId: tagFilter,
      from: useCustomRange ? fromDate : '',
      to: useCustomRange ? toDate : '',
    }),
    [period, memberUserId, statusFilter, tagFilter, useCustomRange, fromDate, toDate]
  )

  const onMetricClick = useCallback(
    (metric) => {
      const { panel, opts } = navigationForActivityMetric(metric.id, dashboardFilters)
      if (panel === 'crm-log') {
        if (opts.activityType !== undefined) setActivityType(opts.activityType)
        return
      }
      if (opts.assigneeUserId) setPipelineAssigneeFilter?.(opts.assigneeUserId)
      onNavigate?.(panel, opts)
    },
    [dashboardFilters, onNavigate, setPipelineAssigneeFilter]
  )

  const filterControls = (
    <ActivityDashboardFilters
      period={period}
      onPeriodChange={setPeriod}
      memberUserId={memberUserId}
      onMemberChange={selectMember}
      memberOptions={memberOptions}
      showMemberFilter={hub?.isAdmin}
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

  const active = hub?.pulse === 'active'

  return (
    <div className="panel-shell team-intel-page team-intel-page--v3 ti3-log-hub">
      <div className="ti3-scroll panel-body-scroll">
        <div className="ti3-chrome ti3-chrome--dash">
          <div className="ti3-chrome__title">
            <h1>Activity log</h1>
            <p className={`ti3-chrome__pulse${active ? ' is-winning' : ' is-risk'}`}>
              {hub?.pulseLabel || 'Loading…'}
              {hub?.memberName ? ` · ${hub.memberName}` : ''}
              {activityType ? ` · ${ACTIVITY_LABELS[activityType] || activityType}` : ''}
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

        {loading && !payload ? (
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
            <div className="ti3-filter-bar ti3-filter-bar--desktop-hidden">{filterControls}</div>
            <section className="ti3-cmd-strip" aria-label="Activity command bar">
              {(hub?.commandBar || []).map((metric) => (
                <CommandBarMetric key={metric.id} metric={metric} onClick={onMetricClick} />
              ))}
            </section>

            <section className="ti3-panel ti3-panel--insights" aria-label="Activity insights">
              <header className="ti3-panel__head">
                <h2>What happened</h2>
                <span className="ti3-panel__tag">Linkage hub</span>
              </header>
              <InsightsCarousel
                insights={hub?.insights}
                onSelect={(userId, action) => {
                  if (userId) selectMember(userId)
                  else if (action?.filterType) selectType(action.filterType)
                  else if (action?.panel) navigateHub(action.panel, action)
                }}
              />
            </section>

            <section className="ti3-panel" aria-label="Quick links">
              <header className="ti3-panel__head">
                <h2>Go anywhere</h2>
                <p>Pipeline, dashboard, team intel, and filtered views</p>
              </header>
              <QuickLinksHub links={hub?.quickLinks} onNavigate={navigateHub} />
            </section>

            <div className="ti3-grid">
              <section className="ti3-panel ti3-span-6" aria-label="Activity by type">
                <header className="ti3-panel__head">
                  <h2>By type</h2>
                  <p>Tap to filter the feed</p>
                </header>
                <FilterChips filters={hub?.filters} value={activityType || 'all'} onChange={selectType} />
                <TypeBreakdownBar rows={hub?.typeBreakdown} activeType={activityType} onSelect={selectType} />
              </section>

              <section className="ti3-panel ti3-span-6" aria-label="Activity trend">
                <header className="ti3-panel__head">
                  <h2>Trend</h2>
                  <p>{hub?.periodLabel || period}</p>
                </header>
                <ActivityTrendMini trend={hub?.trend} />
              </section>

              {(hub?.repActivity?.length ?? 0) > 0 && hub?.isAdmin ? (
                <section className="ti3-panel ti3-span-12" aria-label="Rep activity">
                  <header className="ti3-panel__head ti3-panel__head--row">
                    <div>
                      <h2>Who logged activity</h2>
                      <p>Tap a rep to filter</p>
                    </div>
                    <button type="button" className="ti3-dash-link-btn" onClick={() => navigateHub('crm-dashboard')}>
                      Team intelligence →
                    </button>
                  </header>
                  <RepActivityBars rows={hub.repActivity} onSelect={selectMember} />
                </section>
              ) : null}

              <section className="ti3-panel ti3-span-12 ti3-action-desktop" aria-label="Activity actions">
                <header className="ti3-panel__head">
                  <h2>Next steps</h2>
                  <p>Continue work from logged activity</p>
                </header>
                <ActionCenterPanel items={hub?.actionCenter} onAction={handleCenterAction} />
              </section>
            </div>

            <section className="ti3-panel ti3-panel--feed" aria-label="Activity timeline">
              <header className="ti3-panel__head ti3-panel__head--row">
                <div>
                  <h2>Activity feed</h2>
                  <p>
                    {totalEvents.toLocaleString()} events · {hub?.periodLabel || period}
                    {payload?.warming ? ' · refreshing metrics…' : ''}
                  </p>
                </div>
                <button type="button" className="ti3-dash-link-btn" onClick={() => navigateHub('pipeline')}>
                  Open pipeline →
                </button>
              </header>
              <ActivityFeed
                items={feedItems}
                expandedId={expandedFeedId}
                onToggle={(id) => setExpandedFeedId((c) => (c === id ? null : id))}
                onOpen={(item) => {
                  if (item.leadId) {
                    openPipelineLead(item.leadId)
                    onNavigate?.('pipeline')
                  }
                }}
              />
              {hasMore ? (
                <button
                  type="button"
                  className="ti3-load-more"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? 'Loading…'
                    : `Load more (${Math.max(0, totalEvents - activities.length).toLocaleString()} remaining)`}
                </button>
              ) : null}
            </section>
          </div>
        )}
      </div>

      {!loading && (hub?.actionCenter?.length ?? 0) > 0 ? (
        <aside className="ti3-action-sheet" aria-label="Activity quick actions">
          <details className="ti3-action-sheet__details">
            <summary>
              <span className="ti3-action-sheet__count">{hub.actionCenter.length}</span>
              Quick actions
            </summary>
            <ActionCenterPanel items={hub.actionCenter} onAction={handleCenterAction} compact />
          </details>
        </aside>
      ) : null}

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
              <FilterChips filters={hub?.filters} value={activityType || 'all'} onChange={selectType} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
