import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { dashboardNavOptions } from '../../lib/dashboardNavigation'
import { buildDashboardMemberOptions } from '../../lib/memberOptions'
import { mergeRepPerformanceRows } from '../../lib/mergeRepRows'
import { formatDateTime, ACTIVITY_LABELS } from '../../lib/crmUiConstants'
import { timelineTypeLabel } from '../../lib/teamIntelligenceConstants'
import { teamReviewActivityQuery } from '../../lib/rollingActivityRange'
import { prefetchRepReview } from '../../lib/repPrefetch'

const PERIOD_API = { '7d': '7d', '30d': '30d' }

function relTime(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
  return formatDateTime(iso)
}

function activitySummary(item) {
  if (item.body) return item.body
  if (item.kind === 'deal') return item.meta?.stage ? `Deal · ${item.meta.stage}` : 'Deal updated'
  if (item.kind === 'task') return item.meta?.title || 'Task'
  if (item.kind === 'meeting') return item.meta?.title || 'Meeting'
  return timelineTypeLabel(item.type) || 'Activity'
}

function kindBadgeClass(item) {
  if (item.kind === 'deal') return 'deal'
  if (item.kind === 'task') return 'task'
  if (item.kind === 'meeting') return 'meeting'
  if (item.type === 'email' || item.type === 'email_inbound') return 'email'
  if (item.type === 'call') return 'call'
  return 'note'
}

function RollupStrip({ rollup, comparison, onOpenReport }) {
  if (!rollup) return null
  const items = [
    { id: 'acts', label: 'CRM actions', value: rollup.activitiesTotal ?? 0, delta: comparison?.activitiesTotal?.delta },
    { id: 'emails', label: 'Emails', value: rollup.emails ?? 0, delta: comparison?.emails?.delta },
    { id: 'calls', label: 'Calls', value: rollup.calls ?? 0, delta: comparison?.calls?.delta },
    { id: 'contacts', label: 'Contacts worked', value: rollup.contactsOpened ?? 0, delta: comparison?.contactsOpened?.delta },
    { id: 'tasks', label: 'Tasks', value: rollup.tasksCreated ?? 0, delta: comparison?.tasksCreated?.delta },
    { id: 'hours', label: 'Hours in app', value: rollup.hoursInApp != null ? `${rollup.hoursInApp}h` : '—', delta: comparison?.hoursInApp?.delta, isText: true },
  ]

  return (
    <div className="dash-home-team__rollup">
      {items.map((item) => (
        <button key={item.id} type="button" className="dash-home-team__rollup-cell" onClick={onOpenReport}>
          <span className="dash-home-team__rollup-label">{item.label}</span>
          <span className={`dash-home-team__rollup-value${item.isText ? ' is-text' : ''}`}>{item.value}</span>
          {item.delta != null ? (
            <span className={`dash-home-team__rollup-delta${item.delta >= 0 ? ' is-up' : ' is-down'}`}>
              {item.delta >= 0 ? '+' : ''}
              {item.delta}% vs prior
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

function TeamsTable({ rows, onAction }) {
  if (!rows?.length) return <p className="dash-home__empty">No teams configured yet.</p>
  return (
    <div className="dash-home-team__table-wrap">
      <table className="dash-home-team__table">
        <thead>
          <tr>
            <th>Team</th>
            <th className="is-num">Open leads</th>
            <th className="is-num">Follow-up</th>
            <th className="is-num">Activities</th>
            <th className="is-num">Won (MTD)</th>
            <th className="is-num">Won value</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.teamId}>
              <td>
                <button type="button" className="dash-home-team__name-btn" onClick={() => onAction(row.action)}>
                  {row.teamName}
                </button>
              </td>
              <td className="is-num">
                <button type="button" className="dash-home-team__cell-btn" onClick={() => onAction(row.cellActions?.openLeads || row.action)}>
                  {row.openLeads ?? 0}
                </button>
              </td>
              <td className="is-num">
                <button type="button" className="dash-home-team__cell-btn" onClick={() => onAction(row.cellActions?.followups || row.action)}>
                  {row.followups ?? 0}
                </button>
              </td>
              <td className="is-num">
                <button type="button" className="dash-home-team__cell-btn" onClick={() => onAction(row.cellActions?.activities || row.action)}>
                  {row.activities7d ?? 0}
                </button>
              </td>
              <td className="is-num">
                <button type="button" className="dash-home-team__cell-btn" onClick={() => onAction(row.cellActions?.wonMonth || row.action)}>
                  {row.wonMonth ?? 0}
                </button>
              </td>
              <td className="is-num is-muted">{row.value ? `₹${row.value.toLocaleString()}` : '—'}</td>
              <td className="is-action">
                <button type="button" className="dash-home-team__row-action" onClick={() => onAction(row.action)}>
                  Pipeline →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RepsTable({ rows, onAction, onReviewRep, onPrefetchRep, periodLabel }) {
  if (!rows?.length) return <p className="dash-home__empty">No rep activity in {periodLabel || 'this period'} yet.</p>
  return (
    <div className="dash-home-team__table-wrap">
      <table className="dash-home-team__table">
        <thead>
          <tr>
            <th>Rep</th>
            <th className="is-num">Open</th>
            <th className="is-num">Follow-up</th>
            <th className="is-num">Emails</th>
            <th className="is-num">Calls</th>
            <th className="is-num">Activities</th>
            <th className="is-num">Won</th>
            <th>Last active</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId}>
              <td>
                <button
                  type="button"
                  className="dash-home-team__name-btn"
                  onClick={() => onReviewRep(row.userId)}
                  onMouseEnter={() => onPrefetchRep?.(row.userId)}
                  onFocus={() => onPrefetchRep?.(row.userId)}
                >
                  {row.name}
                </button>
                {row.needsHelp ? <span className="dash-home-team__flag">Needs attention</span> : null}
              </td>
              <td className="is-num">
                <button type="button" className="dash-home-team__cell-btn" onClick={() => onAction(row.cellActions?.open || row.action)}>
                  {row.open ?? 0}
                </button>
              </td>
              <td className="is-num">
                <button type="button" className="dash-home-team__cell-btn" onClick={() => onAction(row.cellActions?.followups || row.action)}>
                  {row.followups ?? 0}
                </button>
              </td>
              <td className="is-num">{row.emails ?? 0}</td>
              <td className="is-num">{row.calls ?? 0}</td>
              <td className="is-num">
                <button type="button" className="dash-home-team__cell-btn" onClick={() => onAction(row.cellActions?.activities || row.action)}>
                  {row.activitiesTotal ?? 0}
                </button>
              </td>
              <td className="is-num">
                <button type="button" className="dash-home-team__cell-btn" onClick={() => onAction(row.cellActions?.won || row.action)}>
                  {row.wonMonth ?? 0}
                </button>
              </td>
              <td className="is-muted">{relTime(row.lastActiveAt)}</td>
              <td className="is-action">
                <button
                  type="button"
                  className="dash-home-team__row-action"
                  onClick={() => onReviewRep(row.userId)}
                  onMouseEnter={() => onPrefetchRep?.(row.userId)}
                  onFocus={() => onPrefetchRep?.(row.userId)}
                >
                  Review →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LeadActivityTable({ items, onLead, onOpenLog, loading, emptyLabel }) {
  if (loading) {
    return (
      <div className="dash-home-team__loading">
        <span /><span /><span />
      </div>
    )
  }
  if (!items?.length) {
    return (
      <div className="dash-home-team__empty-block">
        <p>{emptyLabel}</p>
        <button type="button" className="dash-home__btn" onClick={onOpenLog}>
          Open activity log
        </button>
      </div>
    )
  }

  return (
    <div className="dash-home-team__table-wrap">
      <table className="dash-home-team__table dash-home-team__table--activity">
        <thead>
          <tr>
            <th>When</th>
            <th>Rep</th>
            <th>Lead</th>
            <th>Type</th>
            <th>Activity</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="is-muted is-nowrap">{formatDateTime(item.at)}</td>
              <td>{item.actorName || '—'}</td>
              <td>
                <button type="button" className="dash-home-team__lead-btn" onClick={() => onLead(item.leadId)}>
                  <strong>{item.title || 'Lead'}</strong>
                  {item.company ? <span>{item.company}</span> : null}
                </button>
              </td>
              <td>
                <span className={`dash-home-team__kind dash-home-team__kind--${kindBadgeClass(item)}`}>
                  {timelineTypeLabel(item.type) || item.kind || 'Note'}
                </span>
              </td>
              <td className="dash-home-team__activity-body">{activitySummary(item)}</td>
              <td className="is-action">
                <button type="button" className="dash-home-team__row-action" onClick={() => onLead(item.leadId)}>
                  Open lead →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Manager / admin team review — teams, reps, and lead-wise activity with drill-down. */
export default function TeamReviewBlock({
  role,
  period = '7d',
  viewData = {},
  user,
  metrics = null,
  metricsLoading = false,
  onNavigate,
  onLead,
}) {
  const { teamMembers, repRoster } = useApp()
  const isAdmin = role === 'org_admin'
  const apiPeriod = PERIOD_API[period] || 'week'
  const [tab, setTab] = useState(isAdmin ? 'teams' : 'reps')
  const [repFilter, setRepFilter] = useState('')
  const [timeline, setTimeline] = useState([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [activityMemberOptions, setActivityMemberOptions] = useState([])

  const runAction = useCallback(
    (action = {}) => {
      if (!action?.panel) return
      onNavigate?.(action.panel, dashboardNavOptions({ ...action, returnTo: 'overview' }, user))
    },
    [onNavigate, user]
  )

  const openFullReport = useCallback(
    (userId = null) => {
      runAction({
        panel: 'crm-dashboard',
        period: apiPeriod,
        ...(userId ? { userId, assigneeUserId: userId } : {}),
      })
    },
    [runAction, apiPeriod]
  )

  const reviewDays = period === '30d' ? 30 : 7

  useEffect(() => {
    if (tab !== 'activity') return undefined
    let cancelled = false
    setTimelineLoading(true)
    api
      .getCrmActivityLog(
        teamReviewActivityQuery({ days: reviewDays, userId: repFilter || '', limit: 100 })
      )
      .then((res) => {
        if (cancelled) return
        setActivityMemberOptions(res.memberOptions || [])
        const rows = (res.activities || [])
          .map((act) => ({
            id: act.id || `act-${act.leadId}-${act.createdAt}`,
            at: act.createdAt,
            actorName: act.createdByName,
            title: act.leadName,
            company: act.company,
            type: act.type,
            kind: 'activity',
            body: act.summary,
            leadId: act.leadId,
            meta: { typeLabel: ACTIVITY_LABELS[act.type] || act.type },
          }))
          .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
        setTimeline(rows)
      })
      .catch(() => {
        if (!cancelled) setTimeline([])
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, reviewDays, repFilter])

  const intelMembers = metrics?.teamIntelligence?.members || []
  const intelByUser = useMemo(() => new Map(intelMembers.map((m) => [String(m.userId), m])), [intelMembers])

  const baseMemberOptions = useMemo(
    () =>
      buildDashboardMemberOptions({
        teamMembers,
        repRoster,
        metricsMemberOptions: metrics?.memberOptions,
        activityMemberOptions,
        intelMembers,
        repPerformance: viewData.repPerformance,
      }),
    [teamMembers, repRoster, metrics?.memberOptions, activityMemberOptions, intelMembers, viewData.repPerformance]
  )

  const repRows = useMemo(() => {
    return mergeRepPerformanceRows(viewData.repPerformance, baseMemberOptions, intelByUser)
  }, [viewData.repPerformance, baseMemberOptions, intelByUser])

  const memberOptions = useMemo(
    () => buildDashboardMemberOptions({ metricsMemberOptions: baseMemberOptions, repRows }),
    [baseMemberOptions, repRows]
  )

  const reviewRep = useCallback(
    (userId) => {
      onNavigate?.('crm-rep-review', {
        userId: String(userId),
        period: apiPeriod,
        returnTo: 'overview',
      })
    },
    [onNavigate, apiPeriod]
  )

  const prefetchRep = useCallback(
    (userId) => {
      prefetchRepReview(user?.organizationId, userId, apiPeriod)
    },
    [user?.organizationId, apiPeriod]
  )

  const periodLabel = period === '30d' ? '30 days' : '7 days'
  const rollup = metrics?.teamIntelligence?.rollup
  const comparison = metrics?.teamIntelligence?.comparison

  if (role !== 'manager' && role !== 'org_admin') return null

  const tabs = isAdmin
    ? [
        { id: 'teams', label: 'Teams' },
        { id: 'reps', label: 'All reps' },
        { id: 'activity', label: 'Lead activity' },
      ]
    : [
        { id: 'reps', label: 'Team reps' },
        { id: 'activity', label: 'Lead activity' },
      ]

  return (
    <section className="dash-home-team" aria-label="Team review">
      <div className="dash-home__panel dash-home-team__panel">
        <div className="dash-home-team__head">
          <div>
            <p className="dash-home__eyebrow">Management</p>
            <h2 className="dash-home-team__title">Team review</h2>
            <p className="dash-home-team__sub">
              {viewData.scopeLabel || (isAdmin ? 'All teams' : 'Your team')}
              {viewData.teamLabel && !isAdmin ? ` · ${viewData.teamLabel}` : ''}
              {' · '}
              Last {periodLabel}
            </p>
          </div>
          <div className="dash-home-team__head-actions">
            <button type="button" className="dash-home__btn" onClick={() => runAction({ panel: 'crm-log', period: apiPeriod })}>
              Activity log
            </button>
            <button type="button" className="dash-home__btn dash-home__btn--primary" onClick={() => openFullReport()}>
              Full intelligence report
            </button>
          </div>
        </div>

        {metricsLoading ? (
          <div className="dash-home-team__loading dash-home-team__loading--short">
            <span /><span /><span />
          </div>
        ) : (
          <RollupStrip rollup={rollup} comparison={comparison} onOpenReport={() => openFullReport()} />
        )}

        <div className="dash-home-team__toolbar">
          <div className="dash-home-team__tabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`dash-home-team__tab${tab === t.id ? ' is-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'activity' ? (
            <div className="dash-home-team__filters">
              <label className="dash-home-team__filter-label" htmlFor="dash-team-rep-filter">
                Rep
              </label>
              <select
                id="dash-team-rep-filter"
                className="dash-home-team__select"
                value={repFilter}
                onChange={(e) => setRepFilter(e.target.value)}
              >
                <option value="">All reps</option>
                {memberOptions.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
              {repFilter ? (
                <button type="button" className="dash-home__link" onClick={() => reviewRep(repFilter)}>
                  Rep report →
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {tab === 'teams' && isAdmin ? (
          <TeamsTable rows={viewData.teamLeaderboard || []} onAction={runAction} />
        ) : null}

        {tab === 'reps' ? (
          <RepsTable
            rows={repRows}
            onAction={runAction}
            onReviewRep={reviewRep}
            onPrefetchRep={prefetchRep}
            periodLabel={periodLabel}
          />
        ) : null}

        {tab === 'activity' ? (
          <LeadActivityTable
            items={timeline}
            loading={timelineLoading}
            onLead={onLead}
            emptyLabel={
              repFilter
                ? 'No lead activity for this rep in the selected period.'
                : 'No team lead activity logged in this period yet.'
            }
            onOpenLog={() =>
              runAction({
                panel: 'crm-log',
                period: apiPeriod,
                ...(repFilter ? { userId: repFilter, assigneeUserId: repFilter } : {}),
              })
            }
          />
        ) : null}

        <p className="dash-home-team__footnote">
          Click any metric to open the full Team Intelligence report with charts, capacity view, and detailed lead timelines.
        </p>
      </div>
    </section>
  )
}
