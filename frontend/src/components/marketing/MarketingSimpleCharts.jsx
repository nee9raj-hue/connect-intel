import { MH } from './marketingTheme'

function niceMax(n) {
  if (!n || n <= 0) return 10
  const mag = 10 ** Math.floor(Math.log10(n))
  return Math.ceil(n / mag) * mag
}

function formatChartDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) {
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  return String(value).slice(5, 10)
}

export function BarChart({ data = [], valueKey = 'sent', labelKey = 'date', height = 160 }) {
  const values = data.map((d) => Number(d[valueKey]) || 0)
  const max = niceMax(Math.max(...values, 0))
  const barCount = data.length
  const barW = barCount > 8 ? 14 : Math.min(20, Math.max(8, (280 - 40) / Math.max(barCount, 1) - 6))
  const w = Math.max(barCount * (barW + 10) + 48, 280)
  const labelStep = Math.max(1, Math.ceil(barCount / 6))

  if (!data.length) {
    return <p className="mc-analytics-empty">No data for this period yet.</p>
  }

  return (
    <div className="mc-analytics-chart" role="img" aria-label="Bar chart">
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid meet">
        {data.map((d, i) => {
          const v = Number(d[valueKey]) || 0
          const barH = max ? (v / max) * (height - 36) : 0
          const x = 24 + i * (barW + 10)
          const y = height - 24 - barH
          const showLabel = i % labelStep === 0 || i === barCount - 1
          return (
            <g key={d[labelKey] || i}>
              <title>
                {d[labelKey]}: {v}
                {d.openRate != null ? ` · ${d.openRate}% open` : ''}
              </title>
              <rect x={x} y={y} width={barW} height={barH} rx={3} fill={MH.accent} opacity={0.9} />
              {showLabel ? (
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="10" fill={MH.textMuted}>
                  {formatChartDate(d[labelKey])}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function LineChart({ data = [], valueKey = 'total', labelKey = 'date', height = 160 }) {
  const values = data.map((d) => Number(d[valueKey]) || 0)
  const max = niceMax(Math.max(...values, 0))
  const w = Math.max(data.length * 40, 280)
  const pad = 24
  const innerH = height - pad * 2

  if (!data.length) {
    return <p className="mc-analytics-empty">Start importing contacts to see growth here.</p>
  }

  const points = data.map((d, i) => {
    const v = Number(d[valueKey]) || 0
    const x = pad + (i / Math.max(data.length - 1, 1)) * (w - pad * 2)
    const y = pad + innerH - (max ? (v / max) * innerH : 0)
    return { x, y, d }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - pad} L ${points[0].x} ${height - pad} Z`

  return (
    <div className="mc-analytics-chart" role="img" aria-label="Line chart">
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid meet">
        <path d={areaPath} fill={MH.accentTint} fillOpacity={0.3} />
        <path d={linePath} fill="none" stroke={MH.accent} strokeWidth="2" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={MH.accent}>
            <title>
              {p.d[labelKey]}: {p.d[valueKey]}
            </title>
          </circle>
        ))}
      </svg>
    </div>
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
