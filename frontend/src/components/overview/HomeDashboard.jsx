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
import '../../styles/dashboard-home.css'

const PERIODS = [
  { id: '7d', label: '7 days', api: '7d' },
  { id: '30d', label: '30 days', api: '30d' },
]

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
  return (
    <div className="dash-home__kpi-row">
      {items.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`dash-home__kpi${s.highlight ? ' is-alert' : ''}`}
          onClick={() => onAction(s.action)}
        >
          <span className="dash-home__kpi-label">{s.label}</span>
          <span className="dash-home__kpi-value">
            {s.count}
            {s.suffix || ''}
          </span>
          <span className="dash-home__kpi-link">{s.linkLabel} →</span>
        </button>
      ))}
    </div>
  )
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

  const load = useCallback(async (silent = false) => {
    const cacheKey = teamReviewCacheKey(user?.organizationId, period)
    const apiPeriod = PERIODS.find((p) => p.id === period)?.api || '7d'
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
    setTeamMetricsLoading(Boolean(user?.organizationId))
    try {
      const [bootstrapRes, teamRes] = await Promise.all([
        api.getDashboardBootstrap(),
        user?.organizationId
          ? api.getCrmTeamMetrics(`period=${apiPeriod}`)
          : Promise.resolve(null),
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
  }, [user?.organizationId, period])

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
        onNavigate?.('crm-log', dashboardNavOptions({ panel: 'crm-log', period: 'day', returnTo: 'overview' }, user))
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
    if (viewData.role === 'org_admin') return { label: 'Full org report', action: { panel: 'crm-dashboard', returnTo: 'overview' } }
    if (viewData.role === 'manager') return { label: 'Team intelligence', action: { panel: 'crm-dashboard', returnTo: 'overview' } }
    if (viewData.role === 'marketing_manager') return { label: 'Marketing analytics', action: { panel: 'marketing', tab: 'analytics', returnTo: 'overview' } }
    return { label: 'Open pipeline', action: { panel: 'pipeline', scopeOwner: 'me', returnTo: 'overview' } }
  }, [viewData?.role])

  if (loading && !data) {
    return (
      <div className="dash-home">
        <div className="dash-home__inner">
          <p className="dash-home__empty">Loading dashboard…</p>
        </div>
      </div>
    )
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
    <div className="dash-home">
      <div className="dash-home__inner">
        <header className="dash-home__header">
          <div>
            <p className="dash-home__eyebrow">Command center</p>
            <h1 className="dash-home__title">
              {viewData.greeting}, {viewData.user?.firstName || 'there'}
            </h1>
            <p className="dash-home__meta">
              Updated {freshnessLabel}
              {refreshing ? ' · refreshing…' : ''}
              {viewData.scopeLabel ? ` · ${viewData.scopeLabel}` : ''}
              <button type="button" className="dash-home__link" onClick={() => load(true)} aria-label="Refresh">
                ↺ Refresh
              </button>
            </p>
          </div>
          <div className="dash-home__header-actions">
            {primaryAction ? (
              <button type="button" className="dash-home__btn dash-home__btn--primary" onClick={() => runAction(primaryAction.action)}>
                {primaryAction.label}
              </button>
            ) : null}
          </div>
        </header>

        <CrmGettingStarted onNavigate={runAction} pipelineSummary={ps} />

        <div className="dash-home__toolbar">
          <div className="dash-home__filters">
            <span className="dash-home__filters-label">Period</span>
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`dash-home__filter-pill${period === p.id ? ' is-active' : ''}`}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {viewData.quickActions?.length ? (
            <div className="dash-home__quick-actions">
              {viewData.quickActions.map((q) => (
                <button key={q.id} type="button" className="dash-home__btn" onClick={() => runAction(q.action)}>
                  {q.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <StatStrip items={viewData.statStrip || []} onAction={runAction} />

        <div className="dash-home__charts">
          <section className="dash-home__panel">
            <div className="dash-home__panel-head">
              <div>
                <h2 className="dash-home__panel-title">Pipeline health</h2>
                <p className="dash-home__panel-sub">
                  {ps.leadCount?.toLocaleString() || 0} leads · ₹{ps.dealValue?.toLocaleString() || 0} pipeline · {ps.stuck || 0} stuck
                </p>
              </div>
              <button type="button" className="dash-home__btn" onClick={() => runAction({ panel: 'crm-dashboard', returnTo: 'overview' })}>
                Full report
              </button>
            </div>
            <PipelineHealthChart stages={ps.stages} role={role} onStageClick={runAction} />
          </section>

          <section className="dash-home__panel">
            <div className="dash-home__panel-head">
              <div>
                <h2 className="dash-home__panel-title">CRM activity</h2>
                <p className="dash-home__panel-sub">Emails, calls, tasks, and notes over time</p>
              </div>
              <button type="button" className="dash-home__btn" onClick={() => runAction({ panel: 'crm-log', period: period === '30d' ? 'month' : 'week', returnTo: 'overview' })}>
                Activity log
              </button>
            </div>
            <ActivityTrendChart activityByDay={activityTrend} />
          </section>
        </div>

        {role === 'manager' || role === 'org_admin' ? (
          <TeamReviewBlock
            role={role}
            period={period}
            viewData={viewData}
            user={user}
            metrics={teamMetrics}
            metricsLoading={teamMetricsLoading}
            onNavigate={onNavigate}
            onLead={onLead}
          />
        ) : null}

        <div className="dash-home__main">
          <div className="dash-home__main-col">
            {role === 'rep' ? (
              <PrioritiesCard
                title="My priorities"
                subtitle="Tasks and follow-ups ranked by urgency"
                priorities={viewData.priorities}
                onAction={runAction}
                onLead={onLead}
              />
            ) : null}

            {role === 'marketing_manager' ? (
              <section className="dash-home__card">
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
            ) : null}

            <section className="dash-home__card">
              <div className="dash-home__card-head">
                <h3 className="dash-home__card-title">Recent activity</h3>
                <button type="button" className="dash-home__link" onClick={() => runAction({ panel: 'crm-log', returnTo: 'overview' })}>
                  View all →
                </button>
              </div>
              <ActivityFeed items={(viewData.activity || []).slice(0, 10)} onLead={onLead} />
            </section>
          </div>

          <aside className="dash-home__aside">
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
        </div>
      </div>
    </div>
  )
}
