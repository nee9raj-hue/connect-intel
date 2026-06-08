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
          <li key={row.status || row.id}>
            <button type="button" className="intel-funnel-row" onClick={() => onClick?.(row.status || row.id)}>
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

export function Sparkline({ data = [], color = '#00a4bd', height = 32, className = '' }) {
  const values = (data || []).map((d) => Number(d.value ?? d) || 0)
  if (!values.length) {
    return <svg className={`ti2-sparkline ti2-sparkline--empty ${className}`.trim()} height={height} aria-hidden />
  }
  const w = 88
  const h = height
  const pad = 2
  const max = Math.max(1, ...values)
  const min = Math.min(0, ...values)
  const range = max - min || 1
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0
  const points = values
    .map((v, i) => {
      const x = pad + i * step
      const y = h - pad - ((v - min) / range) * (h - pad * 2)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg className={`ti2-sparkline ${className}`.trim()} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

export function HealthRadial({ score = 0, size = 140, factors = [] }) {
  const pct = Math.max(0, Math.min(100, Number(score) || 0))
  const r = (size - 12) / 2
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  const tone = pct >= 75 ? '#00a4bd' : pct >= 50 ? '#f5a623' : '#e85d75'

  return (
    <div className="ti2-health-radial">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Team health ${pct} out of 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8edf2" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="46%" textAnchor="middle" className="ti2-health-radial__score">
          {pct}
        </text>
        <text x="50%" y="58%" textAnchor="middle" className="ti2-health-radial__label">
          / 100
        </text>
      </svg>
      {factors.length ? (
        <ul className="ti2-health-factors">
          {factors.map((f) => (
            <li key={f.id} className={`ti2-health-factor ti2-health-factor--${f.status || 'warn'}`}>
              <span className="ti2-health-factor__name">{f.label}</span>
              <span className="ti2-health-factor__bar">
                <span className="ti2-health-factor__fill" style={{ width: `${f.score}%` }} />
              </span>
              <span className="ti2-health-factor__score">{f.score}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function TrendLineChart({ data = [], color = '#00a4bd', label = 'Activity' }) {
  if (!data.length) return <p className="dashboard-empty">No trend data yet.</p>
  const values = data.map((d) => Number(d.value) || 0)
  const max = Math.max(1, ...values)
  const w = 100
  const h = 48
  const pad = 4
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0
  const coords = values.map((v, i) => {
    const x = pad + i * step
    const y = h - pad - (v / max) * (h - pad * 2)
    return { x, y, v, date: data[i]?.date }
  })
  const line = coords.map((p) => `${p.x},${p.y}`).join(' ')
  const area = `${pad},${h - pad} ${line} ${pad + (values.length - 1) * step},${h - pad}`

  return (
    <div className="ti2-trend-chart">
      <div className="ti2-trend-chart__head">
        <span className="ti2-trend-chart__label">{label}</span>
        <span className="ti2-trend-chart__total">{values.reduce((s, n) => s + n, 0)}</span>
      </div>
      <svg className="ti2-trend-chart__svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
        <polygon points={area} fill={`${color}22`} />
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={line} />
      </svg>
    </div>
  )
}

export function WorkloadDistributionChart({ rows = [], onSelect }) {
  if (!rows.length) return <p className="dashboard-empty">No workload data.</p>
  const max = Math.max(1, ...rows.map((r) => Math.max(r.leads || 0, r.tasks || 0, r.activeDeals || 0)))

  return (
    <div className="ti2-workload-chart">
      {rows.slice(0, 10).map((row) => (
        <button
          key={row.userId}
          type="button"
          className="ti2-workload-row"
          onClick={() => onSelect?.(row.userId)}
        >
          <span className="ti2-workload-row__name">{row.name?.split(' ')[0] || 'Rep'}</span>
          <div className="ti2-workload-row__bars">
            <span className="ti2-workload-row__track" title={`${row.leads} leads`}>
              <span className="ti2-workload-row__fill ti2-workload-row__fill--leads" style={{ width: `${((row.leads || 0) / max) * 100}%` }} />
            </span>
            <span className="ti2-workload-row__track" title={`${row.tasks} tasks`}>
              <span className="ti2-workload-row__fill ti2-workload-row__fill--tasks" style={{ width: `${((row.tasks || 0) / max) * 100}%` }} />
            </span>
            <span className="ti2-workload-row__track" title={`${row.activeDeals} deals`}>
              <span className="ti2-workload-row__fill ti2-workload-row__fill--deals" style={{ width: `${((row.activeDeals || 0) / max) * 100}%` }} />
            </span>
          </div>
          <span className="ti2-workload-row__nums">
            {row.leads}L · {row.tasks}T · {row.activeDeals}D
          </span>
        </button>
      ))}
      <div className="ti2-workload-legend">
        <span><i className="ti2-legend-swatch ti2-legend-swatch--leads" /> Leads</span>
        <span><i className="ti2-legend-swatch ti2-legend-swatch--tasks" /> Tasks</span>
        <span><i className="ti2-legend-swatch ti2-legend-swatch--deals" /> Deals</span>
      </div>
    </div>
  )
}

export function AdoptionScoreChart({ rows = [] }) {
  if (!rows.length) return <p className="dashboard-empty">No adoption data.</p>
  return (
    <div className="ti2-adoption-chart">
      {rows.slice(0, 12).map((row) => (
        <div key={row.userId} className="ti2-adoption-row">
          <span className="ti2-adoption-row__name">{row.name?.split(' ')[0] || 'Rep'}</span>
          <span className="ti2-adoption-row__track">
            <span
              className={`ti2-adoption-row__fill${row.adoptionScore >= 65 ? ' is-good' : row.adoptionScore >= 40 ? ' is-warn' : ' is-risk'}`}
              style={{ width: `${row.adoptionScore}%` }}
            />
          </span>
          <span className="ti2-adoption-row__score">{row.adoptionScore}</span>
        </div>
      ))}
    </div>
  )
}
