import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { dashboardNavOptions } from '../../lib/dashboardNavigation'
import { formatDateTime } from '../../lib/crmUiConstants'
import '../../styles/dashboard-v4.css'

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
    <div className="dash-v4__stat-row">
      {items.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`dash-v4__stat${s.highlight ? ' is-hot' : ''}`}
          onClick={() => onAction(s.action)}
        >
          <p className="dash-v4__stat-label">{s.label}</p>
          <p className={`dash-v4__stat-value${s.highlight ? ' is-hot' : ''}`}>
            {s.count}
            {s.suffix || ''}
          </p>
          <span className="dash-v4__stat-link">{s.linkLabel} →</span>
        </button>
      ))}
    </div>
  )
}

function StageBars({ stages, onAction, role }) {
  if (!stages?.length) return <p className="dash-v4__empty">No pipeline data yet.</p>
  return (
    <div>
      {stages.map((row) => (
        <div
          key={row.id}
          className="dash-v4__stage-row"
          role="button"
          tabIndex={0}
          onClick={() =>
            onAction({
              panel: 'pipeline',
              status: row.id,
              returnTo: 'overview',
              ...(role === 'rep' ? { scopeOwner: 'me' } : role === 'manager' ? { hierarchyTeam: 'mine' } : { scope: 'all' }),
            })
          }
        >
          <span style={{ fontSize: 12, textTransform: 'capitalize' }}>{row.id.replace(/_/g, ' ')}</span>
          <div className="dash-v4__stage-bar">
            <div
              className={`dash-v4__stage-fill dash-v4__stage-fill--${row.id}`}
              style={{ width: `${row.pct || 0}%` }}
            />
          </div>
          <span style={{ fontSize: 12, textAlign: 'right' }}>{row.count}</span>
        </div>
      ))}
    </div>
  )
}

function RepView({ data, onAction, onLead }) {
  const ps = data.pipelineSummary || {}
  return (
    <div className="dash-v4__grid">
      <div>
        <div className="dash-v4__card">
          <div className="dash-v4__card-head">
            <div>
              <h3 className="dash-v4__card-title">My priorities</h3>
              <p className="dash-v4__card-sub">Your assistant-ranked to-do list</p>
            </div>
            <button type="button" className="dash-v4__link" onClick={() => onAction({ panel: 'pipeline', view: 'tasks', scopeOwner: 'me', returnTo: 'overview' })}>
              View all →
            </button>
          </div>
          {(data.priorities || []).map((p, i) => (
            <div
              key={p.id}
              className={`dash-v4__priority${p.overdue ? ' is-overdue' : p.dueToday ? ' is-today' : ''}`}
              onClick={() => (p.leadId ? onLead(p.leadId) : onAction(p.action))}
              role="button"
              tabIndex={0}
            >
              <span style={{ fontSize: 12, color: '#999', minWidth: 18 }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.title}</div>
                {p.subtitle ? <div style={{ fontSize: 11, color: '#666' }}>{p.subtitle}</div> : null}
                {p.dueAt ? <div style={{ fontSize: 11, color: '#999' }}>{formatDateTime(p.dueAt)}</div> : null}
              </div>
              <span className={`dash-v4__badge dash-v4__badge--${p.kind}`}>{p.kind === 'follow_up' ? 'Follow up' : 'Task'}</span>
            </div>
          ))}
          {!data.priorities?.length ? <p className="dash-v4__empty">No urgent items — you&apos;re clear.</p> : null}
        </div>

        <div className="dash-v4__card">
          <div className="dash-v4__card-head">
            <div>
              <h3 className="dash-v4__card-title">My pipeline</h3>
              <p className="dash-v4__card-sub">Your deals &amp; leads only</p>
            </div>
            <button type="button" className="dash-v4__link" onClick={() => onAction({ panel: 'pipeline', scopeOwner: 'me', returnTo: 'overview' })}>
              Open pipeline →
            </button>
          </div>
          <p className="dash-v4__scope" style={{ marginBottom: 12 }}>
            Leads: {ps.leadCount?.toLocaleString() || 0} · Stuck:{' '}
            <button type="button" className="dash-v4__link" onClick={() => onAction({ panel: 'pipeline', stuck: true, scopeOwner: 'me', returnTo: 'overview' })}>
              {ps.stuck || 0}
            </button>
          </p>
          <StageBars stages={ps.stages} onAction={onAction} role="rep" />
        </div>

        <div className="dash-v4__card">
          <div className="dash-v4__card-head">
            <h3 className="dash-v4__card-title">Today&apos;s timeline</h3>
            <button type="button" className="dash-v4__link" onClick={() => onAction({ panel: 'crm-calendar', returnTo: 'overview' })}>
              Full calendar →
            </button>
          </div>
          {(data.timeline || []).map((t) => (
            <div key={t.id} className="dash-v4__activity" onClick={() => (t.leadId ? onLead(t.leadId) : onAction(t.action))} role="button" tabIndex={0}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#999' }}>{t.at ? formatDateTime(t.at) : '—'}</div>
                <div style={{ fontSize: 13 }}>{t.title}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="dash-v4__card">
          <h3 className="dash-v4__card-title">This week</h3>
          <p className="dash-v4__card-sub">Goals &amp; momentum</p>
          <div className="dash-v4__donut-wrap" style={{ marginTop: 12 }}>
            <div className="dash-v4__donut" style={{ '--pct': `${data.thisWeek?.progressPct || 0}%` }}>
              <div className="dash-v4__donut-hole">{data.thisWeek?.progressPct || 0}%</div>
            </div>
            <div>
              <div style={{ fontSize: 12 }}>CRM actions this week</div>
              <div style={{ fontSize: 18, fontWeight: 500 }}>
                {data.thisWeek?.achieved || 0} / {data.thisWeek?.target || 25}
              </div>
              {data.thisWeek?.vsLastWeekPct != null ? (
                <div style={{ fontSize: 11, color: '#3730a3' }}>+{data.thisWeek.vsLastWeekPct}% vs last week</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="dash-v4__card">
          <h3 className="dash-v4__card-title">Lead focus</h3>
          <p className="dash-v4__card-sub">Where to spend time</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            {[
              { label: 'New leads', value: data.leadFocus?.newLeads, action: data.leadFocusActions?.newLeads || { panel: 'pipeline', status: 'new', scopeOwner: 'me', returnTo: 'overview' } },
              { label: 'Hot leads', value: data.leadFocus?.hotLeads, action: { panel: 'pipeline', scoreMin: 70, scopeOwner: 'me', returnTo: 'overview' } },
              { label: 'Uncontacted', value: data.leadFocus?.uncontacted, action: data.leadFocusActions?.uncontacted },
              { label: 'Follow-up due', value: data.leadFocus?.followUpDue, action: data.leadFocusActions?.followUp },
            ].map((cell) => (
              <button
                key={cell.label}
                type="button"
                className="dash-v4__stat"
                style={{ cursor: 'pointer' }}
                onClick={() => cell.action && onAction(cell.action)}
              >
                <div style={{ fontSize: 22, fontWeight: 500 }}>{cell.value ?? 0}</div>
                <div style={{ fontSize: 11, color: '#666' }}>{cell.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ManagerView({ data, onAction, onLead }) {
  const ps = data.pipelineSummary || {}
  return (
    <div className="dash-v4__grid">
      <div>
        <div className="dash-v4__card">
          <div className="dash-v4__card-head">
            <div>
              <h3 className="dash-v4__card-title">Team pipeline</h3>
              <p className="dash-v4__card-sub">{data.teamLabel || 'Your team'} · {data.scopeLabel}</p>
            </div>
            <button type="button" className="dash-v4__link" onClick={() => onAction({ panel: 'pipeline', hierarchyTeam: 'mine', returnTo: 'overview' })}>
              View full pipeline →
            </button>
          </div>
          <p className="dash-v4__scope" style={{ marginBottom: 12 }}>
            Leads: {ps.leadCount?.toLocaleString() || 0} · Stuck: {ps.stuck || 0} · Pipeline value: ₹{ps.dealValue?.toLocaleString() || 0}
          </p>
          <StageBars stages={ps.stages} onAction={onAction} role="manager" />
        </div>

        <div className="dash-v4__card">
          <div className="dash-v4__card-head">
            <h3 className="dash-v4__card-title">Rep performance</h3>
            <p className="dash-v4__card-sub">This week</p>
          </div>
          <table className="dash-v4__table">
            <thead>
              <tr>
                <th>Rep</th>
                <th>Open</th>
                <th>Follow-up</th>
                <th>Activities</th>
                <th>Won</th>
                <th>Last active</th>
              </tr>
            </thead>
            <tbody>
              {(data.repPerformance || []).map((r) => (
                <tr key={r.userId}>
                  <td>
                    <button type="button" className="dash-v4__table-cell-btn" onClick={() => onAction(r.cellActions?.open || r.action)}>
                      <span className="dash-v4__avatar" style={{ display: 'inline-flex', marginRight: 6, width: 24, height: 24, fontSize: 9 }}>
                        {initials(r.name)}
                      </span>
                      {r.name}
                    </button>
                  </td>
                  <td>
                    <button type="button" className="dash-v4__table-cell-btn" onClick={() => onAction(r.cellActions?.open || r.action)}>
                      {r.open}
                    </button>
                  </td>
                  <td>
                    <button type="button" className="dash-v4__table-cell-btn" onClick={() => onAction(r.cellActions?.followups || { ...r.action, status: 'follow_up', followUpDue: true })}>
                      {r.followups}
                    </button>
                  </td>
                  <td>
                    <button type="button" className="dash-v4__table-cell-btn" onClick={() => onAction(r.cellActions?.activities || { panel: 'crm-log', userId: r.userId, period: 'week', returnTo: 'overview' })}>
                      {r.activities7d}
                    </button>
                  </td>
                  <td>
                    <button type="button" className="dash-v4__table-cell-btn" onClick={() => onAction(r.cellActions?.won || { ...r.action, status: 'won', wonThisMonth: true })}>
                      {r.wonMonth}
                    </button>
                  </td>
                  <td>{relTime(r.lastActiveAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="dash-v4__card">
          <div className="dash-v4__card-head">
            <h3 className="dash-v4__card-title">Team activity</h3>
            <button type="button" className="dash-v4__link" onClick={() => onAction({ panel: 'pipeline', view: 'activity', hierarchyTeam: 'mine', returnTo: 'overview' })}>
              View all →
            </button>
          </div>
          {(data.activity || []).map((a) => (
            <div key={a.id} className="dash-v4__activity" onClick={() => onLead(a.leadId)} role="button" tabIndex={0}>
              <span className="dash-v4__avatar">{initials(a.actorName)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{a.actorName}</div>
                <div style={{ fontSize: 12 }}>{a.summary}</div>
                <div style={{ fontSize: 11, color: '#666' }}>{a.leadName}</div>
              </div>
              <span style={{ fontSize: 11, color: '#999' }}>{relTime(a.at)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="dash-v4__card">
          <h3 className="dash-v4__card-title">This week</h3>
          <div className="dash-v4__donut-wrap" style={{ marginTop: 12 }}>
            <div className="dash-v4__donut" style={{ '--pct': `${data.thisWeek?.progressPct || 0}%` }}>
              <div className="dash-v4__donut-hole">{data.thisWeek?.progressPct || 0}%</div>
            </div>
            <div>
              <div style={{ fontSize: 12 }}>Team CRM actions</div>
              <div style={{ fontSize: 18, fontWeight: 500 }}>{data.thisWeek?.achieved || 0}</div>
            </div>
          </div>
        </div>
        {data.topRep ? (
          <div className="dash-v4__card">
            <h3 className="dash-v4__card-title">⭐ Top rep this week</h3>
            <p style={{ fontSize: 13, margin: '8px 0' }}>{data.topRep.name}</p>
            <p style={{ fontSize: 12, color: '#666' }}>{data.topRep.activities7d} activities</p>
            <button type="button" className="dash-v4__link" style={{ marginTop: 8 }} onClick={() => onAction(data.topRep.action)}>
              View their pipeline →
            </button>
          </div>
        ) : null}
        {(data.insights || []).map((ins) => (
          <div key={ins.text} className={`dash-v4__insight dash-v4__insight--${ins.kind}`}>
            {ins.text}
            {ins.action ? (
              <button type="button" className="dash-v4__link" style={{ display: 'block', marginTop: 6 }} onClick={() => onAction(ins.action)}>
                View →
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function AdminView({ data, onAction, onLead }) {
  const ps = data.pipelineSummary || {}
  const rev = data.revenue || {}
  return (
    <div>
      <div className="dash-v4__card">
        <div className="dash-v4__card-head">
          <div>
            <h3 className="dash-v4__card-title">Pipeline health</h3>
            <p className="dash-v4__card-sub">All teams · {ps.leadCount?.toLocaleString() || 0} active leads</p>
          </div>
          <button type="button" className="dash-v4__link" onClick={() => onAction({ panel: 'crm-dashboard', returnTo: 'overview' })}>
            Full report →
          </button>
        </div>
        <StageBars stages={ps.stages} onAction={onAction} role="org_admin" />
      </div>

      <div className="dash-v4__grid">
        <div>
          <div className="dash-v4__card">
            <h3 className="dash-v4__card-title">Team leaderboard</h3>
            <table className="dash-v4__table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Leads</th>
                  <th>Follow-up</th>
                  <th>Activities</th>
                  <th>Won</th>
                </tr>
              </thead>
              <tbody>
                {(data.teamLeaderboard || []).map((t, i) => (
                  <tr key={t.teamId}>
                    <td>{i + 1}. {t.teamName}</td>
                    <td>
                      <button type="button" className="dash-v4__table-cell-btn" onClick={() => onAction(t.cellActions?.openLeads || t.action)}>
                        {t.openLeads}
                      </button>
                    </td>
                    <td>
                      <button type="button" className="dash-v4__table-cell-btn" onClick={() => onAction(t.cellActions?.followups || { panel: 'pipeline', status: 'follow_up', followUpDue: true, teamId: t.teamId, scope: 'all', returnTo: 'overview' })}>
                        {t.followups}
                      </button>
                    </td>
                    <td>
                      <button type="button" className="dash-v4__table-cell-btn" onClick={() => onAction(t.cellActions?.activities || { panel: 'crm-log', period: 'week', teamId: t.teamId, returnTo: 'overview' })}>
                        {t.activities7d}
                      </button>
                    </td>
                    <td>
                      <button type="button" className="dash-v4__table-cell-btn" onClick={() => onAction(t.cellActions?.wonMonth || { panel: 'pipeline', status: 'won', wonThisMonth: true, teamId: t.teamId, scope: 'all', returnTo: 'overview' })}>
                        {t.wonMonth}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="dash-v4__card">
            <h3 className="dash-v4__card-title">Recent pipeline events</h3>
            {(data.activity || []).slice(0, 12).map((a) => (
              <div key={a.id} className="dash-v4__activity" onClick={() => onLead(a.leadId)} role="button" tabIndex={0}>
                <span className="dash-v4__avatar">{initials(a.actorName)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12 }}>{a.summary}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>{a.leadName}</div>
                </div>
                <span style={{ fontSize: 11, color: '#999' }}>{relTime(a.at)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="dash-v4__card">
            <h3 className="dash-v4__card-title">Revenue progress</h3>
            <p className="dash-v4__card-sub">Month to date</p>
            <div style={{ fontSize: 22, fontWeight: 500, margin: '12px 0' }}>{rev.progressPct || 0}%</div>
            <p style={{ fontSize: 12 }}>Achieved: ₹{rev.achieved?.toLocaleString() || 0}</p>
            <p style={{ fontSize: 12, color: '#666' }}>Target: ₹{rev.monthlyTarget?.toLocaleString() || 0}</p>
          </div>

          <div className="dash-v4__card">
            <h3 className="dash-v4__card-title">System health</h3>
            {(data.systemHealth || []).map((f) => (
              <div key={f.label} style={{ fontSize: 12, padding: '6px 0', display: 'flex', justifyContent: 'space-between' }}>
                <span>{f.ok ? '✓' : '⚠'} {f.label}</span>
                <span style={{ color: '#666' }}>{f.detail}</span>
              </div>
            ))}
          </div>

          {(data.insights || []).map((ins) => (
            <div key={ins.text} className={`dash-v4__insight dash-v4__insight--${ins.kind}`}>
              {ins.text}
              {ins.action ? (
                <button type="button" className="dash-v4__link" style={{ display: 'block', marginTop: 6 }} onClick={() => onAction(ins.action)}>
                  View →
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MarketingView({ data, onAction }) {
  return (
    <div className="dash-v4__grid">
      <div className="dash-v4__card">
        <h3 className="dash-v4__card-title">Recent campaigns</h3>
        {(data.marketing?.campaigns || []).map((c) => (
          <div key={c.id} style={{ padding: '8px 0', borderBottom: '0.5px solid rgba(0,0,0,0.06)', fontSize: 12 }}>
            <strong>{c.name}</strong>
            <span style={{ color: '#666', marginLeft: 8 }}>{c.status}</span>
          </div>
        ))}
        {!data.marketing?.campaigns?.length ? <p className="dash-v4__empty">No campaigns yet.</p> : null}
      </div>
      <div className="dash-v4__card">
        <h3 className="dash-v4__card-title">Form submissions</h3>
        {(data.marketing?.forms || []).map((f) => (
          <div key={f.id} style={{ padding: '8px 0', fontSize: 12 }}>
            {f.name} — {f.submissions || 0} submissions
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomeDashboard({ onNavigate, isActive = true }) {
  const { user, openPipelineLead, unreadNotificationCount, notifications, navigateToNotification } = useApp()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastFetch, setLastFetch] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await api.getDashboardBootstrap()
      setData(res.dashboard)
      setLastFetch(Date.now())
    } catch (e) {
      setError(e.message || 'Could not load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!isActive) return undefined
    load()
    const t = setInterval(() => load(true), 90_000)
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

  const primaryAction = useMemo(() => {
    if (!viewData?.role) return null
    if (viewData.role === 'org_admin') return { label: 'Org report', action: { panel: 'crm-dashboard', returnTo: 'overview' } }
    if (viewData.role === 'manager') return { label: 'Team pipeline', action: { panel: 'pipeline', hierarchyTeam: 'mine', returnTo: 'overview' } }
    if (viewData.role === 'marketing_manager') return { label: 'Create campaign', action: { panel: 'marketing', tab: 'campaigns', returnTo: 'overview' } }
    return { label: '+ New lead', action: { panel: 'pipeline', returnTo: 'overview' } }
  }, [viewData?.role])

  if (loading && !data) {
    return (
      <div className="dash-v4 dash-v4__inner">
        <p className="dash-v4__empty">Loading dashboard…</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="dash-v4 dash-v4__inner">
        <p style={{ color: '#791f1f', fontSize: 13 }}>{error}</p>
        <button type="button" className="dash-v4__btn" onClick={() => load()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="dash-v4">
      <div className="dash-v4__inner">
        <header className="dash-v4__topbar">
          <div>
            <p className="dash-v4__eyebrow">My day</p>
            <h1 className="dash-v4__title">
              {viewData.greeting}, {viewData.user?.firstName || 'there'}
            </h1>
            <p className="dash-v4__sub">
              Updated {freshnessLabel}
              {refreshing ? ' · refreshing…' : ''}
              {viewData.scopeLabel ? ` · ${viewData.scopeLabel}` : ''}
              <button type="button" className="dash-v4__link" style={{ marginLeft: 8 }} onClick={() => load(true)} aria-label="Refresh">
                ↺
              </button>
            </p>
          </div>
          <div className="dash-v4__top-actions">
            {primaryAction ? (
              <button type="button" className="dash-v4__btn dash-v4__btn--primary" onClick={() => runAction(primaryAction.action)}>
                {primaryAction.label}
              </button>
            ) : null}
          </div>
        </header>

        {viewData.quickActions?.length ? (
          <div className="dash-v4__quick-row">
            {viewData.quickActions.map((q) => (
              <button key={q.id} type="button" className="dash-v4__btn" onClick={() => runAction(q.action)}>
                {q.label}
              </button>
            ))}
          </div>
        ) : null}

        <StatStrip items={viewData.statStrip || []} onAction={runAction} />

        {viewData.role === 'rep' ? <RepView data={viewData} onAction={runAction} onLead={onLead} /> : null}
        {viewData.role === 'manager' ? <ManagerView data={viewData} onAction={runAction} onLead={onLead} /> : null}
        {viewData.role === 'org_admin' ? <AdminView data={viewData} onAction={runAction} onLead={onLead} /> : null}
        {viewData.role === 'marketing_manager' ? <MarketingView data={viewData} onAction={runAction} /> : null}
      </div>
    </div>
  )
}
