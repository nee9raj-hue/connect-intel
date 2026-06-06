/** CSS/SVG charts — avoids recharts bundler breakage with Vite 8 / Rolldown. */

const MIX_COLORS = ['#00a4bd', '#ff7a59', '#516f90', '#25d366', '#f5c518', '#7c3aed', '#647185', '#e85d75']

export function ActivityMixPie({ data = [] }) {
  if (!data.length) {
    return <p className="dashboard-empty">No activity recorded this period.</p>
  }
  const total = data.reduce((s, d) => s + d.count, 0) || 1
  let offset = 0
  const slices = data.map((row, i) => {
    const pct = (row.count / total) * 100
    const start = offset
    offset += pct
    return { ...row, pct, start, color: MIX_COLORS[i % MIX_COLORS.length] }
  })

  const gradient = slices
    .map((s) => `${s.color} ${s.start}% ${s.start + s.pct}%`)
    .join(', ')

  return (
    <div className="intel-pie-layout">
      <div
        className="intel-pie-ring"
        style={{ background: `conic-gradient(${gradient})` }}
        aria-hidden
      />
      <ul className="intel-pie-legend">
        {slices.map((s) => (
          <li key={s.key}>
            <span className="intel-pie-legend__dot" style={{ background: s.color }} />
            <span className="intel-pie-legend__label">{s.label}</span>
            <span className="intel-pie-legend__value">
              {s.count} ({Math.round(s.pct)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ActivityTrendChart({ data = [] }) {
  if (!data.length) {
    return <p className="dashboard-empty">No daily activity yet.</p>
  }
  const max = Math.max(1, ...data.map((d) => d.count))

  return (
    <div className="intel-stacked-chart">
      {data.map((day) => {
        const segments = [
          { key: 'email', val: day.email, color: '#00a4bd' },
          { key: 'call', val: day.call, color: '#ff7a59' },
          { key: 'whatsapp', val: day.whatsapp, color: '#25d366' },
          { key: 'meeting', val: day.meeting, color: '#516f90' },
          { key: 'task', val: day.task, color: '#f5c518' },
          { key: 'note', val: day.note, color: '#7c3aed' },
        ].filter((s) => s.val > 0)
        const barH = Math.max(day.count ? 8 : 2, (day.count / max) * 100)
        return (
          <div key={day.date} className="intel-stacked-bar" title={`${day.count} activities`}>
            <div className="intel-stacked-bar__col" style={{ height: `${barH}%` }}>
              {segments.map((s) => (
                <span
                  key={s.key}
                  className="intel-stacked-bar__seg"
                  style={{
                    flexGrow: s.val,
                    background: s.color,
                  }}
                />
              ))}
            </div>
            <span className="intel-stacked-bar__label">{day.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function TeamHoursBarChart({ members = [] }) {
  if (!members.length) return <p className="dashboard-empty">No team members.</p>
  const rows = members.slice(0, 12)
  const max = Math.max(1, ...rows.map((m) => Math.max(m.hoursInApp || 0, m.activitiesTotal || 0)))

  return (
    <div className="intel-dual-bar-chart">
      {rows.map((m) => (
        <div key={m.userId} className="intel-dual-bar-row">
          <span className="intel-dual-bar-row__name">{m.name?.split(' ')[0] || 'Member'}</span>
          <div className="intel-dual-bar-row__tracks">
            <div className="intel-dual-bar-row__track">
              <span
                className="intel-dual-bar-row__fill intel-dual-bar-row__fill--hours"
                style={{ width: `${((m.hoursInApp || 0) / max) * 100}%` }}
              />
            </div>
            <div className="intel-dual-bar-row__track">
              <span
                className="intel-dual-bar-row__fill intel-dual-bar-row__fill--acts"
                style={{ width: `${((m.activitiesTotal || 0) / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="intel-dual-bar-row__nums">
            {m.hoursInApp || 0}h · {m.activitiesTotal || 0}
          </span>
        </div>
      ))}
      <div className="intel-dual-bar-legend">
        <span>
          <i className="intel-legend-swatch intel-legend-swatch--hours" /> Hours in app
        </span>
        <span>
          <i className="intel-legend-swatch intel-legend-swatch--acts" /> CRM actions
        </span>
      </div>
    </div>
  )
}

export function PipelineFunnelChart({ rows = [], onClick }) {
  if (!rows.length) return <p className="dashboard-empty">No pipeline data.</p>
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="intel-funnel-list">
      {rows.map((row) => {
        const pct = Math.round((row.count / max) * 100)
        const label = row.label || row.status?.replace(/_/g, ' ')
        return (
          <li key={row.status}>
            <button type="button" className="intel-funnel-row" onClick={() => onClick?.(row.status)}>
              <span className="intel-funnel-row__label">{label}</span>
              <span className="intel-funnel-row__track">
                <span className="intel-funnel-row__fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="intel-funnel-row__count">{row.count}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
