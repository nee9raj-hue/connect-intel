const STAGE_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  follow_up: 'Follow up',
  replied: 'Replied',
  won: 'Won',
  active_trading: 'Active trading',
  lost: 'Lost',
}

const STAGE_COLORS = {
  new: '#64748b',
  contacted: '#3b82f6',
  follow_up: '#007c89',
  replied: '#6366f1',
  won: '#059669',
  active_trading: '#0d9488',
  lost: '#94a3b8',
}

function formatShortDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(5, 10)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function niceMax(n) {
  if (!n || n <= 0) return 10
  const mag = 10 ** Math.floor(Math.log10(n))
  return Math.ceil(n / mag) * mag
}

function formatAxis(n) {
  const v = Number(n) || 0
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
  return String(Math.round(v))
}

export function PipelineHealthChart({ stages = [], onStageClick, role = 'rep' }) {
  const rows = (stages || []).filter((s) => s.count > 0 || s.id === 'follow_up' || s.id === 'new')
  const max = Math.max(1, ...rows.map((s) => s.count || 0))
  const total = rows.reduce((n, s) => n + (s.count || 0), 0)

  if (!rows.length) {
    return <p className="dash-home__empty">No pipeline data yet — import leads to get started.</p>
  }

  return (
    <div className="dash-home__pipeline">
      <div className="dash-home__pipeline-summary">
        <span>
          <strong>{total.toLocaleString()}</strong> active leads
        </span>
        <span className="dash-home__pipeline-hint">Click a stage to open filtered pipeline</span>
      </div>
      <div className="dash-home__pipeline-rows">
        {rows.map((row) => {
          const pct = Math.max(4, Math.round(((row.count || 0) / max) * 100))
          const color = STAGE_COLORS[row.id] || '#64748b'
          return (
            <button
              key={row.id}
              type="button"
              className="dash-home__pipeline-row"
              onClick={() =>
                onStageClick?.({
                  panel: 'pipeline',
                  status: row.id,
                  returnTo: 'overview',
                  ...(role === 'rep' ? { scopeOwner: 'me' } : role === 'manager' ? { hierarchyTeam: 'mine' } : { scope: 'all' }),
                })
              }
            >
              <span className="dash-home__pipeline-label">{STAGE_LABELS[row.id] || row.id}</span>
              <span className="dash-home__pipeline-track">
                <span className="dash-home__pipeline-fill" style={{ width: `${pct}%`, background: color }} />
              </span>
              <span className="dash-home__pipeline-count">{row.count?.toLocaleString() ?? 0}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ActivityTrendChart({ activityByDay = [] }) {
  const data = (activityByDay || []).slice(-14)
  if (!data.length) {
    return <p className="dash-home__empty">Activity will appear as your team logs emails, calls, and tasks.</p>
  }

  const values = data.map((d) => Number(d.count ?? d.activities ?? d.total ?? 0))
  const max = niceMax(Math.max(...values, 0))
  const w = 400
  const h = 220
  const padL = 40
  const padR = 8
  const padT = 12
  const padB = 26
  const innerW = w - padL - padR
  const innerH = h - padT - padB
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW

  const points = data.map((d, i) => {
    const v = Number(d.count ?? d.activities ?? d.total ?? 0)
    const x = padL + (data.length > 1 ? i * step : innerW / 2)
    const y = padT + innerH - (max ? (v / max) * innerH : 0)
    return { x, y, v, date: d.date || d.day }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padT + innerH} L ${points[0].x} ${padT + innerH} Z`
      : ''

  const total = values.reduce((a, b) => a + b, 0)

  return (
    <div className="dash-home__activity-chart">
      <div className="dash-home__activity-meta">
        <strong>{total.toLocaleString()}</strong> CRM actions in period
      </div>
      <svg className="dash-home__activity-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="CRM activity trend">
        <defs>
          <linearGradient id="dashHomeActivityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#007c89" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#007c89" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((frac, i) => {
          const y = padT + innerH * (1 - frac)
          return (
            <line key={i} x1={padL} y1={y} x2={w - padR} y2={y} stroke="#e8eceb" strokeWidth="1" />
          )
        })}
        {areaPath ? <path d={areaPath} fill="url(#dashHomeActivityFill)" /> : null}
        {linePath ? (
          <path d={linePath} fill="none" stroke="#007c89" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke="#007c89" strokeWidth="2">
              <title>
                {formatShortDate(p.date)}: {p.v} actions
              </title>
            </circle>
            {(i === 0 || i === points.length - 1 || i % 2 === 0) && (
              <text x={p.x} y={h - 6} textAnchor="middle" fontSize="9" fill="#64748b">
                {formatShortDate(p.date)}
              </text>
            )}
          </g>
        ))}
        <text x={padL - 6} y={padT + innerH + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
          {formatAxis(0)}
        </text>
        <text x={padL - 6} y={padT + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
          {formatAxis(max)}
        </text>
      </svg>
    </div>
  )
}

export function groupActivityByDay(activity = []) {
  const byDay = new Map()
  for (const ev of activity || []) {
    const key = (ev.at || ev.createdAt || '').slice(0, 10)
    if (!key) continue
    byDay.set(key, (byDay.get(key) || 0) + 1)
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, count]) => ({ date, count }))
}
