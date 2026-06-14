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
  new: '#475569',
  contacted: '#3b82f6',
  follow_up: '#007c89',
  replied: '#6366f1',
  won: '#059669',
  active_trading: '#0d9488',
  lost: '#94a3b8',
}

const STAGE_ORDER = ['new', 'contacted', 'follow_up', 'replied', 'won', 'active_trading', 'lost']

const STAGE_SHORT = {
  new: 'New',
  contacted: 'Contacted',
  follow_up: 'Follow up',
  replied: 'Replied',
  won: 'Won',
  active_trading: 'Trading',
  lost: 'Lost',
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

function pct(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 1000) / 10
}

function stageNavAction(row, role) {
  return {
    panel: 'pipeline',
    status: row.id,
    returnTo: 'overview',
    ...(role === 'rep'
      ? { scopeOwner: 'me' }
      : role === 'manager'
        ? { hierarchyTeam: 'mine' }
        : { scope: 'all' }),
  }
}

export function PipelineHealthChart({ stages = [], onStageClick, role = 'rep' }) {
  const rows = STAGE_ORDER.map((id) => {
    const hit = (stages || []).find((s) => s.id === id)
    return { id, count: hit?.count || 0 }
  }).filter((s) => s.count > 0 || s.id === 'follow_up' || s.id === 'new')

  const total = rows.reduce((n, s) => n + (s.count || 0), 0)
  const max = niceMax(Math.max(1, ...rows.map((s) => s.count || 0)))
  const bottleneck = rows.reduce(
    (best, row) => ((row.count || 0) > (best?.count || 0) ? row : best),
    rows[0] || null
  )

  if (!rows.length || !total) {
    return <p className="dash-home__empty">No pipeline data yet — import leads to get started.</p>
  }

  const w = 420
  const h = 210
  const padL = 42
  const padR = 10
  const padT = 14
  const padB = 34
  const innerW = w - padL - padR
  const innerH = h - padT - padB
  const gap = rows.length > 5 ? 6 : 10
  const barW = Math.max(28, (innerW - gap * (rows.length - 1)) / rows.length)

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    frac,
    value: Math.round(max * frac),
    y: padT + innerH * (1 - frac),
  }))

  return (
    <div className="dash-home__pipeline">
      <div className="dash-home__pipeline-summary">
        <span>
          <strong>{total.toLocaleString()}</strong> active leads
          {bottleneck?.count ? (
            <>
              {' '}
              · <span className="dash-home__pipeline-bottleneck">{STAGE_LABELS[bottleneck.id]}</span> holds{' '}
              {pct(bottleneck.count, total)}%
            </>
          ) : null}
        </span>
        <span className="dash-home__pipeline-hint">Click a bar to open filtered pipeline</span>
      </div>

      <div className="dash-home__pipeline-stack" role="img" aria-label="Lead distribution by stage">
        {rows.map((row) => {
          const widthPct = (row.count / total) * 100
          if (widthPct < 0.4) return null
          const color = STAGE_COLORS[row.id] || '#64748b'
          return (
            <button
              key={row.id}
              type="button"
              className="dash-home__pipeline-stack-seg"
              style={{ width: `${widthPct}%`, background: color }}
              title={`${STAGE_LABELS[row.id]}: ${row.count.toLocaleString()} (${pct(row.count, total)}%)`}
              onClick={() => onStageClick?.(stageNavAction(row, role))}
            />
          )
        })}
      </div>

      <svg
        className="dash-home__pipeline-svg"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Pipeline volume by stage"
      >
        <defs>
          {rows.map((row) => {
            const color = STAGE_COLORS[row.id] || '#64748b'
            return (
              <linearGradient key={row.id} id={`dashPipeGrad-${row.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.95" />
                <stop offset="100%" stopColor={color} stopOpacity="0.55" />
              </linearGradient>
            )
          })}
        </defs>

        {yTicks.map((tick) => (
          <g key={tick.frac}>
            <line
              x1={padL}
              y1={tick.y}
              x2={w - padR}
              y2={tick.y}
              stroke="#eef2f6"
              strokeWidth="1"
            />
            <text x={padL - 8} y={tick.y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
              {formatAxis(tick.value)}
            </text>
          </g>
        ))}

        {rows.map((row, i) => {
          const count = row.count || 0
          const barH = max ? (count / max) * innerH : 0
          const x = padL + i * (barW + gap)
          const y = padT + innerH - barH
          const isBottleneck = row.id === bottleneck?.id
          const color = STAGE_COLORS[row.id] || '#64748b'
          const label = STAGE_LABELS[row.id] || row.id

          return (
            <g key={row.id}>
              <rect
                x={x}
                y={padT + innerH - 1}
                width={barW}
                height={1}
                fill="#e2e8f0"
                rx="1"
              />
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, count ? 4 : 0)}
                rx="6"
                fill={`url(#dashPipeGrad-${row.id})`}
                className={`dash-home__pipeline-bar${isBottleneck ? ' is-bottleneck' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onStageClick?.(stageNavAction(row, role))}
              >
                <title>
                  {label}: {count.toLocaleString()} ({pct(count, total)}% of pipeline)
                </title>
              </rect>
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill={color}
              >
                {count >= 1000 ? formatAxis(count) : count}
              </text>
              <text x={x + barW / 2} y={h - 10} textAnchor="middle" fontSize="9" fill="#64748b">
                {STAGE_SHORT[row.id] || label}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="dash-home__pipeline-legend">
        {rows.map((row) => {
          const color = STAGE_COLORS[row.id] || '#64748b'
          const isBottleneck = row.id === bottleneck?.id
          return (
            <button
              key={row.id}
              type="button"
              className={`dash-home__pipeline-chip${isBottleneck ? ' is-bottleneck' : ''}`}
              onClick={() => onStageClick?.(stageNavAction(row, role))}
            >
              <span className="dash-home__pipeline-chip-dot" style={{ background: color }} />
              <span className="dash-home__pipeline-chip-label">{STAGE_LABELS[row.id]}</span>
              <span className="dash-home__pipeline-chip-val">{row.count.toLocaleString()}</span>
              <span className="dash-home__pipeline-chip-pct">{pct(row.count, total)}%</span>
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
