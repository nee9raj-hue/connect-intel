import { formatDateTime } from '../../lib/crmUiConstants'

function relTime(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 3600000) return `${Math.max(1, Math.round(diff / 60000))}m ago`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
  return formatDateTime(iso)
}

export function RollupStrip({ rollup, comparison }) {
  if (!rollup) return null
  const items = [
    { id: 'acts', label: 'CRM actions', value: rollup.activitiesTotal ?? 0, delta: comparison?.activitiesTotal?.delta },
    { id: 'emails', label: 'Emails', value: rollup.emails ?? 0, delta: comparison?.emails?.delta },
    { id: 'calls', label: 'Calls', value: rollup.calls ?? 0, delta: comparison?.calls?.delta },
    { id: 'contacts', label: 'Leads touched', value: rollup.contactsOpened ?? rollup.leadsTouched ?? 0, delta: comparison?.contactsOpened?.delta },
    { id: 'tasks', label: 'Tasks', value: rollup.tasksCreated ?? 0, delta: comparison?.tasksCreated?.delta },
    { id: 'hours', label: 'Hours in app', value: rollup.hoursInApp != null ? `${rollup.hoursInApp}h` : '—', delta: comparison?.hoursInApp?.delta, isText: true },
  ]

  return (
    <div className="dash-home-team__rollup team-activity-hub__rollup">
      {items.map((item) => (
        <div key={item.id} className="dash-home-team__rollup-cell">
          <span className="dash-home-team__rollup-label">{item.label}</span>
          <span className={`dash-home-team__rollup-value${item.isText ? ' is-text' : ''}`}>{item.value}</span>
          {item.delta != null ? (
            <span className={`dash-home-team__rollup-delta${item.delta >= 0 ? ' is-up' : ' is-down'}`}>
              {item.delta >= 0 ? '+' : ''}
              {item.delta}% vs prior
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function RepPerformanceTable({ rows, onSelectRep, onReviewRep, onPipelineAction, periodLabel }) {
  if (!rows?.length) {
    return <p className="dash-home__empty">No rep activity in {periodLabel || 'this period'} yet.</p>
  }

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
                <button type="button" className="dash-home-team__name-btn" onClick={() => onSelectRep?.(row.userId)}>
                  {row.name}
                </button>
                {row.needsHelp ? <span className="dash-home-team__flag">Needs attention</span> : null}
              </td>
              <td className="is-num">
                <button
                  type="button"
                  className="dash-home-team__cell-btn"
                  onClick={() => onPipelineAction?.(row.cellActions?.open || row.action)}
                >
                  {row.open ?? 0}
                </button>
              </td>
              <td className="is-num">
                <button
                  type="button"
                  className="dash-home-team__cell-btn"
                  onClick={() => onPipelineAction?.(row.cellActions?.followups || row.action)}
                >
                  {row.followups ?? 0}
                </button>
              </td>
              <td className="is-num">{row.emails ?? '—'}</td>
              <td className="is-num">{row.calls ?? '—'}</td>
              <td className="is-num">
                <button
                  type="button"
                  className="dash-home-team__cell-btn"
                  onClick={() => onSelectRep?.(row.userId)}
                >
                  {row.activitiesTotal ?? row.activities7d ?? 0}
                </button>
              </td>
              <td className="is-num">
                <button
                  type="button"
                  className="dash-home-team__cell-btn"
                  onClick={() => onPipelineAction?.(row.cellActions?.won || row.action)}
                >
                  {row.wonMonth ?? 0}
                </button>
              </td>
              <td className="is-muted">{relTime(row.lastActiveAt)}</td>
              <td className="is-action">
                <button
                  type="button"
                  className="dash-home-team__row-action"
                  onClick={() => (onReviewRep || onSelectRep)?.(row.userId)}
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
