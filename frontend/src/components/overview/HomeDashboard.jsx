import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { dashboardNavOptions } from '../../lib/dashboardNavigation'
import { formatDateTime } from '../../lib/crmUiConstants'
import {
  ActivityTrendChart,
  groupActivityByDay,
  PipelineHealthChart,
} from './DashboardHomeCharts'
import TeamReviewBlock from './TeamReviewBlock'
import CrmGettingStarted from './CrmGettingStarted'
import { readPanelCache, writePanelCache, teamReviewCacheKey } from '../../lib/panelCache'
import DashboardSkeleton from './enterprise/DashboardSkeleton'
import DashboardTopBar from './enterprise/DashboardTopBar'
import ExecutiveKpiStrip from './enterprise/ExecutiveKpiStrip'
import SalesPipelineSnapshot from './enterprise/SalesPipelineSnapshot'
import DashboardCustomizePanel from './enterprise/DashboardCustomizePanel'
import { useDashboardLayout } from '../../hooks/useDashboardLayout'
import { useDashboardLive } from '../../hooks/useDashboardLive'
import {
  TEAM_INTELLIGENCE_IN_CRM_ENABLED,
  ACTIVITY_LOG_HUB_IN_CRM_ENABLED,
} from '../../lib/crmProductFlags'
import '../../styles/dashboard-home.css'
import '../../styles/dashboard-enterprise.css'

const PERIODS = [
  { id: '7d', label: '7 days', api: '7d' },
  { id: '30d', label: '30 days', api: '30d' },
]

function isCompanyRepUser(user) {
  if (!user || user.accountType !== 'company') return false
  if (user.isOrgAdmin || user.orgRole === 'org_admin') return false
  return String(user.pipelineRole || '').toLowerCase() !== 'manager'
}

function teamMetricsQuery(user, apiPeriod) {
  if (!user?.organizationId) return null
  const qs = new URLSearchParams({ period: apiPeriod })
  if (isCompanyRepUser(user)) qs.set('userId', user.id)
  return qs.toString()
}

function initials(name) {
  const p = String(name || '?').trim().split(/\s+/)
  if (p.length >= 2) return `${p[0][0]}${p[1][0]}`.toUpperCase()
  return String(name || '?').slice(0, 2).toUpperCase()
}

function relTime(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
  return formatDateTime(iso)
}

function StatStrip({ items, onAction }) {
  return <ExecutiveKpiStrip items={items} onAction={onAction} />
}

function PrioritiesCard({ priorities, onAction, onLead, title, subtitle }) {
  return (
    <section className="dash-home__card">
      <div className="dash-home__card-head">
        <div>
          <h3 className="dash-home__card-title">{title}</h3>
          {subtitle ? <p className="dash-home__card-sub">{subtitle}</p> : null}
        </div>
        <button type="button" className="dash-home__link" onClick={() => onAction({ panel: 'pipeline', view: 'tasks', returnTo: 'overview' })}>
          View all →
        </button>
      </div>
      {(priorities || []).map((p, i) => (
        <button
          key={p.id}
          type="button"
          className={`dash-home__priority${p.overdue ? ' is-overdue' : p.dueToday ? ' is-today' : ''}`}
          onClick={() => (p.leadId ? onLead(p.leadId) : onAction(p.action))}
        >
          <span className="dash-home__priority-rank">{i + 1}</span>
          <span className="dash-home__priority-body">
            <strong>{p.title}</strong>
            {p.subtitle ? <span>{p.subtitle}</span> : null}
            {p.dueAt ? <span className="dash-home__priority-due">{formatDateTime(p.dueAt)}</span> : null}
          </span>
          <span className={`dash-home__badge dash-home__badge--${p.kind}`}>
            {p.kind === 'follow_up' ? 'Follow up' : 'Task'}
          </span>
        </button>
      ))}
      {!priorities?.length ? <p className="dash-home__empty">No urgent items — you&apos;re clear.</p> : null}
    </section>
  )
}

function ActivityFeed({ items, onLead }) {
  if (!items?.length) return <p className="dash-home__empty">Recent CRM activity will show here.</p>
  return (
    <div className="dash-home__feed">
      {items.map((a) => (
        <button key={a.id} type="button" className="dash-home__feed-item" onClick={() => onLead(a.leadId)}>
          <span className="dash-home__avatar">{initials(a.actorName)}</span>
          <span className="dash-home__feed-body">
            <strong>{a.actorName}</strong>
            <span>{a.summary}</span>
            <span className="dash-home__feed-meta">{a.leadName}</span>
          </span>
          <span className="dash-home__feed-time">{relTime(a.at)}</span>
        </button>
      ))}
    </div>
  )
}

function WeekProgressCard({ thisWeek, label = 'CRM actions this week' }) {
  const pct = thisWeek?.progressPct || 0
  return (
    <section className="dash-home__card dash-home__card--compact">
      <h3 className="dash-home__card-title">This week</h3>
      <div className="dash-home__week">
        <div className="dash-home__week-ring" style={{ '--pct': `${pct}%` }}>
          <span>{pct}%</span>
        </div>
        <div>
          <p className="dash-home__week-label">{label}</p>
          <p className="dash-home__week-value">
            {thisWeek?.achieved || 0}
            {thisWeek?.target ? ` / ${thisWeek.target}` : ''}
          </p>
          {thisWeek?.vsLastWeekPct != null ? (
            <p className="dash-home__week-delta">+{thisWeek.vsLastWeekPct}% vs last week</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function LeadFocusGrid({ leadFocus, leadFocusActions, onAction }) {
  const cells = [
    { label: 'New leads', value: leadFocus?.newLeads, action: leadFocusActions?.newLeads || { panel: 'pipeline', status: 'new', scopeOwner: 'me', returnTo: 'overview' } },
    { label: 'Hot leads', value: leadFocus?.hotLeads, action: { panel: 'pipeline', scoreMin: 70, scopeOwner: 'me', returnTo: 'overview' } },
    { label: 'Uncontacted', value: leadFocus?.uncontacted, action: leadFocusActions?.uncontacted },
    { label: 'Follow-up due', value: leadFocus?.followUpDue, action: leadFocusActions?.followUp },
  ]
  return (
    <section className="dash-home__card">
      <h3 className="dash-home__card-title">Lead focus</h3>
      <p className="dash-home__card-sub">Where to spend time today</p>
      <div className="dash-home__focus-grid">
        {cells.map((cell) => (
          <button key={cell.label} type="button" className="dash-home__focus-cell" onClick={() => cell.action && onAction(cell.action)}>
            <span className="dash-home__focus-value">{cell.value ?? 0}</span>
            <span className="dash-home__focus-label">{cell.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export default function HomeDashboard({ onNavigate, isActive = true }) {
  const { user, openPipelineLead, unreadNotificationCount, notifications, navigateToNotification } = useApp()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastFetch, setLastFetch] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState('7d')
  const [activityTrend, setActivityTrend] = useState([])
  const [teamMetrics, setTeamMetrics] = useState(null)
  const [teamMetricsLoading, setTeamMetricsLoading] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const { layout, saveLayout, isVisible, visibleOrder } = useDashboardLayout(user?.id)

  const load = useCallback(async (silent = false) => {
    const cacheKey = teamReviewCacheKey(user?.organizationId || user?.id, period)
    const apiPeriod = PERIODS.find((p) => p.id === period)?.api || '7d'
    const metricsQuery = TEAM_INTELLIGENCE_IN_CRM_ENABLED ? teamMetricsQuery(user, apiPeriod) : null
    if (!silent) {
      const cached = readPanelCache(cacheKey)
      if (cached?.data?.bootstrap) {
        setData(cached.data.bootstrap)
        if (cached.data.teamMetrics) setTeamMetrics(cached.data.teamMetrics)
        setLastFetch(cached.at)
        setLoading(false)
        if (!cached.stale) return
      } else {
        setLoading(true)
      }
    } else {
      setRefreshing(true)
    }
    setError(null)
    setTeamMetricsLoading(Boolean(metricsQuery))
    try {
      const [bootstrapRes, teamRes] = await Promise.all([
        api.getDashboardBootstrap(),
        metricsQuery ? api.getCrmTeamMetrics(metricsQuery) : Promise.resolve(null),
      ])
      setData(bootstrapRes.dashboard)
      setLastFetch(Date.now())
      if (teamRes) {
        setTeamMetrics(teamRes)
        const days = teamRes?.activityByDay
        if (days?.length) setActivityTrend(days)
        else setActivityTrend(groupActivityByDay(bootstrapRes.dashboard?.activity))
      } else {
        setActivityTrend(groupActivityByDay(bootstrapRes.dashboard?.activity))
      }
      writePanelCache(cacheKey, {
        bootstrap: bootstrapRes.dashboard,
        teamMetrics: teamRes,
      })
    } catch (e) {
      if (!silent && !readPanelCache(cacheKey)?.data?.bootstrap) {
        setError(e.message || 'Could not load dashboard')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
      setTeamMetricsLoading(false)
    }
  }, [user?.organizationId, user?.id, user?.accountType, user?.pipelineRole, user?.isOrgAdmin, user?.orgRole, period])

  const refreshDashboard = useCallback(() => load(true), [load])
  useDashboardLive({ enabled: isActive && Boolean(data), onStale: refreshDashboard })

  useEffect(() => {
    if (!isActive) return undefined
    load()
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      load(true)
    }
    const t = setInterval(tick, 90_000)
    return () => clearInterval(t)
  }, [isActive, load])

  const displayData = useMemo(() => {
    if (!data) return null
    if (unreadNotificationCount == null) return data
    return {
      ...data,
      statStrip: (data.statStrip || []).map((s) =>
        s.id === 'unread_updates'
          ? { ...s, count: unreadNotificationCount, highlight: unreadNotificationCount > 0 }
          : s
      ),
    }
  }, [data, unreadNotificationCount])

  const freshnessLabel = useMemo(() => {
    if (!lastFetch) return ''
    const sec = Math.floor((Date.now() - lastFetch) / 1000)
    if (sec < 8) return 'just now'
    if (sec < 60) return `${sec}s ago`
    return `${Math.floor(sec / 60)}m ago`
  }, [lastFetch, data])

  const runAction = useCallback(
    (action = {}) => {
      if (!action?.panel && !action?.leadId) return
      if (action.panel === 'notifications' || action.unreadOnly) {
        const unread = (notifications || []).filter((n) => n.unread)
        const leadIds = [...new Set(unread.map((n) => n.leadId).filter(Boolean))]
        if (leadIds.length === 1) {
          navigateToNotification(unread.find((n) => n.leadId === leadIds[0]))
          return
        }
        if (leadIds.length > 1) {
          onNavigate?.('pipeline', dashboardNavOptions({ panel: 'pipeline', unreadOnly: true, ...action }, user))
          return
        }
        onNavigate?.('pipeline', dashboardNavOptions({ panel: 'pipeline', returnTo: 'overview' }, user))
        return
      }
      const opts = dashboardNavOptions({ ...action, returnTo: action.returnTo || 'overview' }, user)
      if (action.leadId) openPipelineLead(action.leadId)
      onNavigate?.(action.panel || 'pipeline', opts)
    },
    [onNavigate, openPipelineLead, user, notifications, navigateToNotification]
  )

  const onLead = useCallback(
    (leadId) => {
      if (!leadId) return
      openPipelineLead(leadId)
      onNavigate?.('pipeline', { returnTo: 'overview' })
    },
    [openPipelineLead, onNavigate]
  )

  const viewData = displayData || data
  const role = viewData?.role || 'rep'
  const ps = viewData?.pipelineSummary || {}

  const primaryAction = useMemo(() => {
    if (!viewData?.role) return null
    if (viewData.role === 'org_admin' && TEAM_INTELLIGENCE_IN_CRM_ENABLED) {
      return { label: 'Full org report', action: { panel: 'crm-dashboard', returnTo: 'overview' } }
    }
    if (viewData.role === 'manager' && TEAM_INTELLIGENCE_IN_CRM_ENABLED) {
      return { label: 'Team intelligence', action: { panel: 'crm-dashboard', returnTo: 'overview' } }
    }
    if (viewData.role === 'marketing_manager') {
      return { label: 'Marketing analytics', action: { panel: 'marketing', tab: 'analytics', returnTo: 'overview' } }
    }
    return { label: 'Open pipeline', action: { panel: 'pipeline', scopeOwner: 'me', returnTo: 'overview' } }
  }, [viewData?.role])

  const topSectionOrder = useMemo(
    () =>
      visibleOrder.filter((id) =>
        ['getting_started', 'kpis', 'pipeline', 'analytics', ...(TEAM_INTELLIGENCE_IN_CRM_ENABLED ? ['team_review'] : [])].includes(id)
      ),
    [visibleOrder]
  )

  const mainWidgetOrder = useMemo(
    () => visibleOrder.filter((id) => ['priorities', 'marketing', 'activity'].includes(id)),
    [visibleOrder]
  )

  const showMainGrid = useMemo(
    () =>
      isVisible('priorities') ||
      isVisible('marketing') ||
      isVisible('activity') ||
      isVisible('sidebar'),
    [isVisible]
  )

  const renderTopSection = (sectionId) => {
    switch (sectionId) {
      case 'getting_started':
        return isVisible('getting_started') ? (
          <CrmGettingStarted key="getting_started" onNavigate={runAction} pipelineSummary={ps} />
        ) : null
      case 'kpis':
        return isVisible('kpis') ? (
          <StatStrip key="kpis" items={viewData.statStrip || []} onAction={runAction} />
        ) : null
      case 'pipeline':
        return isVisible('pipeline') ? (
          <SalesPipelineSnapshot
            key="pipeline"
            stages={ps.stages}
            total={ps.leadCount}
            role={role}
            onStageClick={runAction}
          />
        ) : null
      case 'analytics':
        return isVisible('analytics') ? (
          <div key="analytics">
            <p className="dash-ent__analytics-label">Analytics</p>
            <div className="dash-home__charts">
              <section className="dash-home__panel">
                <div className="dash-home__panel-head">
                  <div>
                    <h2 className="dash-home__panel-title">Pipeline health</h2>
                    <p className="dash-home__panel-sub">
                      {ps.leadCount?.toLocaleString() || 0} leads · ₹{ps.dealValue?.toLocaleString() || 0} pipeline · {ps.stuck || 0} stuck
                    </p>
                  </div>
                  {TEAM_INTELLIGENCE_IN_CRM_ENABLED ? (
                    <button type="button" className="dash-home__btn" onClick={() => runAction({ panel: 'crm-dashboard', returnTo: 'overview' })}>
                      Full report
                    </button>
                  ) : (
                    <button type="button" className="dash-home__btn" onClick={() => runAction({ panel: 'pipeline', returnTo: 'overview' })}>
                      Open pipeline
                    </button>
                  )}
                </div>
                <PipelineHealthChart stages={ps.stages} role={role} onStageClick={runAction} />
              </section>

              <section className="dash-home__panel">
                <div className="dash-home__panel-head">
                  <div>
                    <h2 className="dash-home__panel-title">CRM activity</h2>
                    <p className="dash-home__panel-sub">Emails, calls, tasks, and notes over time</p>
                  </div>
                  {ACTIVITY_LOG_HUB_IN_CRM_ENABLED ? (
                    <button type="button" className="dash-home__btn" onClick={() => runAction({ panel: 'crm-log', period: period === '30d' ? 'month' : 'week', returnTo: 'overview' })}>
                      Activity log
                    </button>
                  ) : null}
                </div>
                <ActivityTrendChart activityByDay={activityTrend} />
              </section>
            </div>
          </div>
        ) : null
      case 'team_review':
        return TEAM_INTELLIGENCE_IN_CRM_ENABLED && (role === 'manager' || role === 'org_admin') ? (
          isVisible('team_review') ? (
            <TeamReviewBlock
              key="team_review"
              role={role}
              period={period}
              viewData={viewData}
              user={user}
              metrics={teamMetrics}
              metricsLoading={teamMetricsLoading}
              onNavigate={onNavigate}
              onLead={onLead}
            />
          ) : null
        ) : null
      default:
        return null
    }
  }

  const renderMainWidget = (widgetId) => {
    switch (widgetId) {
      case 'priorities':
        return role === 'rep' && isVisible('priorities') ? (
          <PrioritiesCard
            key="priorities"
            title="My priorities"
            subtitle="Tasks and follow-ups ranked by urgency"
            priorities={viewData.priorities}
            onAction={runAction}
            onLead={onLead}
          />
        ) : null
      case 'marketing':
        return role === 'marketing_manager' && isVisible('marketing') ? (
          <section key="marketing" className="dash-home__card">
            <h3 className="dash-home__card-title">Recent campaigns</h3>
            {(viewData.marketing?.campaigns || []).map((c) => (
              <button
                key={c.id}
                type="button"
                className="dash-home__feed-item"
                onClick={() => runAction({ panel: 'marketing', tab: 'reports', report: c.id, returnTo: 'overview' })}
              >
                <span className="dash-home__feed-body">
                  <strong>{c.name}</strong>
                  <span>{c.status}</span>
                </span>
              </button>
            ))}
            {!viewData.marketing?.campaigns?.length ? <p className="dash-home__empty">No campaigns yet.</p> : null}
          </section>
        ) : null
      case 'activity':
        return isVisible('activity') ? (
          <section key="activity" className="dash-home__card dash-ent__timeline-card">
            <div className="dash-home__card-head">
              <div>
                <h3 className="dash-home__card-title">Activity timeline</h3>
                <p className="dash-home__card-sub">Calls, emails, tasks, and notes across your workspace</p>
              </div>
              {ACTIVITY_LOG_HUB_IN_CRM_ENABLED ? (
                <button type="button" className="dash-home__link" onClick={() => runAction({ panel: 'crm-log', returnTo: 'overview' })}>
                  View all →
                </button>
              ) : null}
            </div>
            <ActivityFeed items={(viewData.activity || []).slice(0, 10)} onLead={onLead} />
          </section>
        ) : null
      default:
        return null
    }
  }

  if (loading && !data) {
    return <DashboardSkeleton />
  }

  if (error && !data) {
    return (
      <div className="dash-home">
        <div className="dash-home__inner">
          <p className="dash-home__error">{error}</p>
          <button type="button" className="dash-home__btn" onClick={() => load()}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dash-home dash-home--enterprise">
      <a href="#dash-main-content" className="dash-ent__skip-link">
        Skip to dashboard content
      </a>
      <div className="dash-home__inner">
        <DashboardTopBar
          greeting={viewData.greeting}
          firstName={viewData.user?.firstName}
          role={role}
          scopeLabel={viewData.scopeLabel}
          freshnessLabel={freshnessLabel}
          refreshing={refreshing}
          primaryAction={primaryAction}
          onRefresh={() => load(true)}
          onPrimaryAction={() => runAction(primaryAction.action)}
          period={period}
          periods={PERIODS}
          onPeriodChange={setPeriod}
          quickActions={viewData.quickActions || []}
          onAction={runAction}
          onCustomize={() => setCustomizeOpen(true)}
        />

        <main id="dash-main-content" aria-label="CRM dashboard">
          {topSectionOrder.map((sectionId) => renderTopSection(sectionId))}

          {showMainGrid ? (
            <div className="dash-home__main">
              <div className="dash-home__main-col">
                {mainWidgetOrder.map((widgetId) => renderMainWidget(widgetId))}
              </div>

              {isVisible('sidebar') ? (
                <aside className="dash-home__aside dash-ent__aside-rail" aria-label="Dashboard insights">
                  <WeekProgressCard thisWeek={viewData.thisWeek} label={role === 'manager' ? 'Team CRM actions' : 'Your CRM actions'} />

                  {role === 'rep' ? <LeadFocusGrid leadFocus={viewData.leadFocus} leadFocusActions={viewData.leadFocusActions} onAction={runAction} /> : null}

                  {viewData.topRep ? (
                    <section className="dash-home__card dash-home__card--compact">
                      <h3 className="dash-home__card-title">Top rep this week</h3>
                      <p className="dash-home__top-rep-name">{viewData.topRep.name}</p>
                      <p className="dash-home__card-sub">{viewData.topRep.activities7d} activities</p>
                      <button type="button" className="dash-home__link" onClick={() => runAction(viewData.topRep.action)}>
                        View pipeline →
                      </button>
                    </section>
                  ) : null}

                  {role === 'org_admin' && viewData.revenue ? (
                    <section className="dash-home__card dash-home__card--compact">
                      <h3 className="dash-home__card-title">Revenue progress</h3>
                      <p className="dash-home__revenue-pct">{viewData.revenue.progressPct || 0}% of target</p>
                      <p className="dash-home__card-sub">
                        ₹{viewData.revenue.achieved?.toLocaleString() || 0} / ₹{viewData.revenue.monthlyTarget?.toLocaleString() || 0}
                      </p>
                    </section>
                  ) : null}

                  {(viewData.insights || []).map((ins) => (
                    <div key={ins.text} className={`dash-home__insight dash-home__insight--${ins.kind}`}>
                      {ins.text}
                      {ins.action ? (
                        <button type="button" className="dash-home__link" onClick={() => runAction(ins.action)}>
                          View →
                        </button>
                      ) : null}
                    </div>
                  ))}
                </aside>
              ) : null}
            </div>
          ) : null}
        </main>
      </div>

      {customizeOpen ? (
        <DashboardCustomizePanel layout={layout} onSave={saveLayout} onClose={() => setCustomizeOpen(false)} />
      ) : null}
    </div>
  )
}
