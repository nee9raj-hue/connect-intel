import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { DashboardSegmented } from '../dashboard/dashboardUi'
import {
  TIMELINE_FILTERS,
  countTimelineFilters,
  matchesTimelineFilter,
} from '../../lib/teamIntelligenceFilters'
import { saveTeamIntelReturn } from '../../lib/teamIntelReturn'
import TeamIntelligenceDetailModal from './TeamIntelligenceDetailModal'
import {
  CommandBarMetric,
  InsightsCarousel,
  PerformanceMatrix,
  PipelineHealthFunnel,
  RevenueLeakGrid,
  CapacityChart,
  AdoptionPanel,
  EffectivenessGrid,
  ActionCenterPanel,
  ActivityFeed,
  SkeletonBlock,
} from './TeamIntelligenceV3Charts'

const TIMELINE_PAGE_SIZE = 8

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return mobile
}

export default function TeamIntelligencePanel({ onNavigate, panelOptions = {}, isActive = true }) {
  const { user, teamMembers, openPipelineLead, setPipelineAssigneeFilter } = useApp()
  const [period, setPeriod] = useState(panelOptions?.period || 'week')
  const [memberUserId, setMemberUserId] = useState(panelOptions?.userId || '')
  const [timelineFilter, setTimelineFilter] = useState(panelOptions?.timelineFilter || 'all')
  const [timelineVisible, setTimelineVisible] = useState(TIMELINE_PAGE_SIZE)
  const [expandedFeedId, setExpandedFeedId] = useState(null)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [detailItem, setDetailItem] = useState(null)
  const scrollRef = useRef(null)
  const [data, setData] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [error, setError] = useState(null)
  const isMobile = useIsMobile()

  const intel = data?.teamIntelligence
  const v3 = data?.intelligenceV3
  const isManagerView = Boolean(v3?.isManagerView ?? (data?.isAdmin && !data?.memberUserId))

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

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ period })
      if (memberUserId) q.set('userId', memberUserId)
      const res = await api.getCrmTeamMetrics(q.toString())
      setData(res)
    } catch (e) {
      setError(e.message || 'Could not load team intelligence')
    } finally {
      setSummaryLoading(false)
    }
  }, [period, memberUserId])

  const loadTimeline = useCallback(async () => {
    setTimelineLoading(true)
    try {
      const q = new URLSearchParams({ period })
      if (memberUserId) q.set('userId', memberUserId)
      const res = await api.getCrmActivityTimeline(q.toString())
      setData((prev) =>
        prev
          ? {
              ...prev,
              activityTimeline: res.activityTimeline || [],
              recentActivities: res.recentActivities || prev.recentActivities,
            }
          : prev
      )
    } catch {
      /* timeline is optional — summary still usable */
    } finally {
      setTimelineLoading(false)
    }
  }, [period, memberUserId])

  useEffect(() => {
    if (!isActive) return undefined
    setData(null)
    loadSummary()
  }, [loadSummary, isActive])

  useEffect(() => {
    if (!isActive || summaryLoading || !data) return undefined
    loadTimeline()
  }, [isActive, summaryLoading, data, loadTimeline])

  useEffect(() => {
    if (!isActive || summaryLoading || !panelOptions?.teamIntelScrollY || !scrollRef.current) return undefined
    const y = panelOptions.teamIntelScrollY
    const t = requestAnimationFrame(() => {
      scrollRef.current.scrollTop = y
    })
    return () => cancelAnimationFrame(t)
  }, [isActive, summaryLoading, panelOptions?.teamIntelScrollY, data])

  useEffect(() => {
    if (panelOptions?.userId !== undefined) setMemberUserId(panelOptions.userId ? String(panelOptions.userId) : '')
    if (panelOptions?.period) setPeriod(panelOptions.period)
    if (panelOptions?.timelineFilter) setTimelineFilter(panelOptions.timelineFilter)
  }, [panelOptions?.userId, panelOptions?.period, panelOptions?.timelineFilter])

  const selectMember = useCallback(
    (uid) => {
      const id = uid ? String(uid) : ''
      setMemberUserId(id)
      setPipelineAssigneeFilter?.(id || null)
      setTimelineFilter('all')
      setFilterDrawerOpen(false)
    },
    [setPipelineAssigneeFilter]
  )

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
    setExpandedFeedId(null)
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

  const navigateAction = useCallback(
    (panel, opts = {}) => {
      if (panel === 'crm-dashboard' || panel === 'team-intelligence' || panel === 'team') return
      const scopedUserId = opts.userId || activeMemberId || null
      if (scopedUserId && panel === 'pipeline') setPipelineAssigneeFilter?.(scopedUserId)
      onNavigate?.(panel, {
        period,
        ...opts,
        ...(scopedUserId ? { userId: scopedUserId, assigneeUserId: scopedUserId } : {}),
      })
    },
    [onNavigate, period, activeMemberId, setPipelineAssigneeFilter]
  )

  const handleCenterAction = useCallback(
    (item, act) => {
      const panel = act.panel || 'pipeline'
      if (panel === 'coaching' && item.userIds?.[0]) {
        selectMember(item.userIds[0])
        return
      }
      navigateAction(panel, {
        status: act.status || item.filter,
        view: act.view || item.view,
        userId: item.userIds?.[0],
      })
    },
    [navigateAction, selectMember]
  )

  const handleLeak = useCallback(
    (leakId) => {
      const map = {
        not_contacted: { panel: 'pipeline', status: 'new' },
        inactive_deals: { panel: 'pipeline', view: 'deals' },
        missing_step: { panel: 'pipeline', status: 'follow_up' },
        overdue_tasks: { panel: 'crm-log' },
        inactive_reps: { panel: 'crm-dashboard' },
      }
      const target = map[leakId]
      if (target) navigateAction(target.panel, target)
    },
    [navigateAction]
  )

  const matrixRows = useMemo(() => {
    const rows = v3?.performanceMatrix || []
    if (activeMemberId) return rows.filter((r) => String(r.userId) === String(activeMemberId))
    return rows
  }, [v3?.performanceMatrix, activeMemberId])

  const winning =
    (v3?.commandBar?.find((m) => m.id === 'teamHealth')?.value ?? 0) >= 60 &&
    (v3?.commandBar?.find((m) => m.id === 'pipeline')?.status ?? 'risk') !== 'risk'

  if (!isActive) return null

  const filterControls = (
    <>
      {isManagerView && memberOptions.length > 0 ? (
        <label className="ti3-filter-field">
          <span className="sr-only">Team member</span>
          <select value={activeMemberId || ''} onChange={(e) => selectMember(e.target.value)}>
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
          { value: 'week', label: '7d' },
          { value: 'month', label: '30d' },
        ]}
      />
    </>
  )

  return (
    <div className="panel-shell team-intel-page team-intel-page--v3">
      <div ref={scrollRef} className="ti3-scroll panel-body-scroll">
        {/* Minimal page chrome — secondary to command bar */}
        <div className="ti3-chrome">
          <div className="ti3-chrome__title">
            <h1>Team intelligence</h1>
            <p className={`ti3-chrome__pulse${winning ? ' is-winning' : ' is-risk'}`}>
              {winning ? 'On target' : 'Needs attention'}
              {activeMemberId && memberName ? ` · ${memberName}` : ''}
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

        {error ? (
          <p className="ti3-error">{error}</p>
        ) : null}

        {summaryLoading && !data ? (
          <div className="ti3-cockpit ti3-cockpit--loading">
            <div className="ti3-cmd-strip">{[1, 2, 3, 4, 5, 6].map((i) => <SkeletonBlock key={i} className="ti3-skeleton--cmd" />)}</div>
            <SkeletonBlock className="ti3-skeleton--insights" />
            <SkeletonBlock className="ti3-skeleton--panel" />
          </div>
        ) : (
          <div className="ti3-cockpit">
            {/* SECTION 1 — Executive command bar (sticky) */}
            <section className="ti3-cmd-strip" aria-label="Executive command bar">
              {(v3?.commandBar || []).map((metric) => (
                <CommandBarMetric key={metric.id} metric={metric} />
              ))}
            </section>

            {/* SECTION 2 — AI insights */}
            <section className="ti3-panel ti3-panel--insights" aria-label="Intelligence insights">
              <header className="ti3-panel__head">
                <h2>Insights</h2>
                <span className="ti3-panel__tag">AI intelligence</span>
              </header>
              {summaryLoading ? <SkeletonBlock className="ti3-skeleton--insights" /> : (
                <InsightsCarousel
                  insights={v3?.insights}
                  onSelect={(userId, action) => {
                    if (userId) selectMember(userId)
                    else if (action?.panel) navigateAction(action.panel, { status: action.status })
                  }}
                />
              )}
            </section>

            <div className="ti3-grid">
              {/* SECTION 3 — Performance matrix */}
              <section className="ti3-panel ti3-span-12" aria-label="Team performance matrix">
                <header className="ti3-panel__head">
                  <h2>{activeMemberId ? 'Your performance' : 'Team performance'}</h2>
                  <p>Who is strong — who needs coaching</p>
                </header>
                <PerformanceMatrix rows={matrixRows} onSelectRep={selectMember} mobile={isMobile} />
              </section>

              {/* SECTION 4 — Pipeline health */}
              <section className="ti3-panel ti3-span-7" aria-label="Pipeline health">
                <header className="ti3-panel__head">
                  <h2>Pipeline health</h2>
                  <p>Volume, conversion, and bottlenecks</p>
                </header>
                <PipelineHealthFunnel pipeline={v3?.pipelineHealth} />
              </section>

              {/* SECTION 5 — Revenue leak detector */}
              <section className="ti3-panel ti3-span-5 ti3-panel--risk" aria-label="Revenue leak detector">
                <header className="ti3-panel__head">
                  <h2>Revenue leaks</h2>
                  <p>Action required</p>
                </header>
                <RevenueLeakGrid leaks={v3?.revenueLeaks} onAction={handleLeak} />
              </section>

              {/* SECTION 6 — Capacity */}
              <section className="ti3-panel ti3-span-6" aria-label="Team capacity">
                <header className="ti3-panel__head">
                  <h2>Capacity & workload</h2>
                  <p>Leads · tasks · deals · meetings</p>
                </header>
                <CapacityChart rows={v3?.capacity} onSelect={selectMember} />
              </section>

              {/* SECTION 7 — CRM adoption */}
              {isManagerView && !activeMemberId ? (
                <section className="ti3-panel ti3-span-6" aria-label="CRM adoption">
                  <header className="ti3-panel__head">
                    <h2>CRM adoption</h2>
                    <p>Logins, notes, calls, meetings, deals</p>
                  </header>
                  <AdoptionPanel adoption={v3?.adoption} />
                </section>
              ) : null}

              {/* SECTION 8 — Activity effectiveness */}
              <section className={`ti3-panel ${isManagerView && !activeMemberId ? 'ti3-span-12' : 'ti3-span-6'}`} aria-label="Activity effectiveness">
                <header className="ti3-panel__head">
                  <h2>Activity effectiveness</h2>
                  <p>Outcomes — not just volume</p>
                </header>
                <EffectivenessGrid rows={v3?.activityEffectiveness} />
              </section>

              {/* SECTION 9 — Action center (desktop inline) */}
              <section className="ti3-panel ti3-span-12 ti3-panel--actions ti3-action-desktop" aria-label="Action center">
                <header className="ti3-panel__head">
                  <h2>Action center</h2>
                  <p>Priority-ordered management tasks</p>
                </header>
                <ActionCenterPanel items={v3?.actionCenter} onAction={handleCenterAction} />
              </section>
            </div>

            {/* Activity feed */}
            <section className="ti3-panel ti3-panel--feed" aria-label="Activity feed">
              <header className="ti3-panel__head ti3-panel__head--row">
                <div>
                  <h2>Activity feed</h2>
                  <p>{filteredTimeline.length} events · {intel?.periodLabel || period}</p>
                </div>
                <div className="ti3-feed-filters">
                  {TIMELINE_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`ti3-feed-filter${timelineFilter === f.id ? ' is-active' : ''}`}
                      onClick={() => setTimelineFilter(f.id)}
                    >
                      {f.label}
                      <span>{timelineCounts[f.id] ?? 0}</span>
                    </button>
                  ))}
                </div>
              </header>
              {timelineLoading && !filteredTimeline.length ? (
                <SkeletonBlock className="ti3-skeleton--panel" />
              ) : (
                <ActivityFeed
                  items={visibleTimeline}
                  expandedId={expandedFeedId}
                  onToggle={(id) => setExpandedFeedId((cur) => (cur === id ? null : id))}
                  onOpen={(item) => setDetailItem(item)}
                />
              )}
              {timelineRemaining > 0 ? (
                <button
                  type="button"
                  className="ti3-load-more"
                  onClick={() => setTimelineVisible((n) => Math.min(filteredTimeline.length, n + TIMELINE_PAGE_SIZE))}
                >
                  Load {Math.min(TIMELINE_PAGE_SIZE, timelineRemaining)} more
                </button>
              ) : null}
            </section>
          </div>
        )}
      </div>

      {/* SECTION 9 — Sticky action center (mobile/PWA) */}
      {!summaryLoading && (v3?.actionCenter?.length ?? 0) > 0 ? (
        <aside className="ti3-action-sheet" aria-label="Quick actions">
          <details className="ti3-action-sheet__details">
            <summary>
              <span className="ti3-action-sheet__count">{v3.actionCenter.length}</span>
              Actions today
            </summary>
            <ActionCenterPanel items={v3.actionCenter} onAction={handleCenterAction} compact />
          </details>
        </aside>
      ) : null}

      {/* Filter drawer (mobile) */}
      {filterDrawerOpen ? (
        <div className="ti3-drawer-backdrop" role="presentation" onClick={() => setFilterDrawerOpen(false)}>
          <div className="ti3-drawer" role="dialog" aria-label="Filters" onClick={(e) => e.stopPropagation()}>
            <header className="ti3-drawer__head">
              <h2>Filters</h2>
              <button type="button" onClick={() => setFilterDrawerOpen(false)} aria-label="Close">
                ×
              </button>
            </header>
            <div className="ti3-drawer__body">{filterControls}</div>
          </div>
        </div>
      ) : null}

      <TeamIntelligenceDetailModal
        item={detailItem}
        user={user}
        onClose={() => setDetailItem(null)}
        onOpenInCrm={openInCrm}
      />
    </div>
  )
}
