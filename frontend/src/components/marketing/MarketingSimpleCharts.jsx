import { MH } from './marketingTheme'

function niceMax(n) {
  if (!n || n <= 0) return 10
  const mag = 10 ** Math.floor(Math.log10(n))
  return Math.ceil(n / mag) * mag
}

function formatChartDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) return `${d.getMonth() + 1}/${d.getDate()}`
  return String(value).slice(5, 10)
}

function formatAxisValue(n) {
  const v = Number(n) || 0
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
  return String(Math.round(v))
}

function ChartFrame({ children, ariaLabel }) {
  return (
    <div className="mc-analytics-chart mc-analytics-chart--pro" role="img" aria-label={ariaLabel}>
      <svg className="mc-analytics-chart__svg" viewBox="0 0 400 240" preserveAspectRatio="none">
        {children}
      </svg>
    </div>
  )
}

function ChartGrid({ padL, padT, innerW, innerH, max, ticks = 4 }) {
  const lines = []
  for (let i = 0; i <= ticks; i += 1) {
    const frac = i / ticks
    const y = padT + innerH * (1 - frac)
    const val = Math.round(max * frac)
    lines.push(
      <g key={i}>
        <line x1={padL} y1={y} x2={padL + innerW} y2={y} stroke="#e8eceb" strokeWidth="1" />
        <text x={padL - 8} y={y + 4} textAnchor="end" fontSize="10" fill={MH.textMuted}>
          {formatAxisValue(val)}
        </text>
      </g>
    )
  }
  return lines
}

export function BarChart({ data = [], valueKey = 'sent', labelKey = 'date', height: _height }) {
  const values = data.map((d) => Number(d[valueKey]) || 0)
  const max = niceMax(Math.max(...values, 0))
  const count = data.length
  const w = 400
  const h = 240
  const padL = 44
  const padR = 12
  const padT = 16
  const padB = 28
  const innerW = w - padL - padR
  const innerH = h - padT - padB
  const gap = count > 1 ? Math.min(8, innerW / count / 5) : 0
  const barW = count ? Math.max(6, (innerW - gap * (count - 1)) / count) : 0
  const labelStep = Math.max(1, Math.ceil(count / 7))

  if (!data.length) {
    return <p className="mc-analytics-empty">No sends in this period yet.</p>
  }

  return (
    <ChartFrame ariaLabel="Emails sent over time">
      <defs>
        <linearGradient id="mcAnalyticsBarFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={MH.accent} stopOpacity="1" />
          <stop offset="100%" stopColor={MH.accent} stopOpacity="0.65" />
        </linearGradient>
      </defs>
      <ChartGrid padL={padL} padT={padT} innerW={innerW} innerH={innerH} max={max} />
      {data.map((d, i) => {
        const v = Number(d[valueKey]) || 0
        const barH = max ? (v / max) * innerH : 0
        const x = padL + i * (barW + gap)
        const y = padT + innerH - barH
        const showLabel = i % labelStep === 0 || i === count - 1
        const opens = d.opens != null ? Number(d.opens) : null
        return (
          <g key={d[labelKey] || i}>
            <title>
              {formatChartDate(d[labelKey])}: {v.toLocaleString()} sent
              {opens != null ? ` · ${opens} opens` : ''}
              {d.openRate != null ? ` · ${d.openRate}% open rate` : ''}
            </title>
            <rect x={x} y={y} width={barW} height={Math.max(barH, v > 0 ? 2 : 0)} rx={4} fill="url(#mcAnalyticsBarFill)" />
            {v > 0 && barH > 18 ? (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill={MH.textSecondary}>
                {formatAxisValue(v)}
              </text>
            ) : null}
            {showLabel ? (
              <text x={x + barW / 2} y={h - 8} textAnchor="middle" fontSize="10" fill={MH.textMuted}>
                {formatChartDate(d[labelKey])}
              </text>
            ) : null}
          </g>
        )
      })}
    </ChartFrame>
  )
}

export function LineChart({ data = [], valueKey = 'total', labelKey = 'date', height: _height }) {
  const values = data.map((d) => Number(d[valueKey]) || 0)
  const min = Math.min(...values, 0)
  const max = niceMax(Math.max(...values, 0))
  const range = Math.max(max - min, max * 0.1, 1)
  const chartMin = min > 0 && max > min * 1.2 ? min * 0.95 : 0
  const chartMax = chartMin + range
  const count = data.length
  const w = 400
  const h = 240
  const padL = 44
  const padR = 12
  const padT = 16
  const padB = 28
  const innerW = w - padL - padR
  const innerH = h - padT - padB
  const step = count > 1 ? innerW / (count - 1) : 0
  const labelStep = Math.max(1, Math.ceil(count / 6))

  if (!data.length) {
    return <p className="mc-analytics-empty">Start importing contacts to see growth here.</p>
  }

  const points = data.map((d, i) => {
    const v = Number(d[valueKey]) || 0
    const x = padL + (count > 1 ? i * step : innerW / 2)
    const y = padT + innerH - ((v - chartMin) / (chartMax - chartMin)) * innerH
    return { x, y, v, label: d[labelKey] }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padT + innerH} L ${points[0].x} ${padT + innerH} Z`
      : ''

  const gridMax = chartMax

  return (
    <ChartFrame ariaLabel="Audience growth over time">
      <defs>
        <linearGradient id="mcAnalyticsAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={MH.accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={MH.accent} stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <ChartGrid padL={padL} padT={padT} innerW={innerW} innerH={innerH} max={gridMax} ticks={4} />
      {areaPath ? <path d={areaPath} fill="url(#mcAnalyticsAreaFill)" /> : null}
      {linePath ? (
        <path d={linePath} fill="none" stroke={MH.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke={MH.accent} strokeWidth="2">
            <title>
              {formatChartDate(p.label)}: {p.v.toLocaleString()} contacts
            </title>
          </circle>
          {(i % labelStep === 0 || i === count - 1) && (
            <text x={p.x} y={h - 8} textAnchor="middle" fontSize="10" fill={MH.textMuted}>
              {formatChartDate(p.label)}
            </text>
          )}
        </g>
      ))}
    </ChartFrame>
  )
}

export function ReputationBar({ score = 8, max = 10, label = 'Good' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ display: 'inline-flex', gap: 3 }}>
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: i < score ? MH.accent : '#e5e5e3',
            }}
          />
        ))}
      </span>
      <span style={{ color: MH.textSecondary }}>{label}</span>
    </div>
  )
}
