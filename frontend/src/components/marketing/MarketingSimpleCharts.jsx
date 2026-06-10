import { MH } from './marketingTheme'

function niceMax(n) {
  if (!n || n <= 0) return 10
  const mag = 10 ** Math.floor(Math.log10(n))
  return Math.ceil(n / mag) * mag
}

export function BarChart({ data = [], valueKey = 'sent', labelKey = 'date', height = 160 }) {
  const values = data.map((d) => Number(d[valueKey]) || 0)
  const max = niceMax(Math.max(...values, 0))
  const w = Math.max(data.length * 28, 280)
  const barW = Math.min(20, Math.max(8, (w - 40) / Math.max(data.length, 1) - 6))

  if (!data.length) {
    return <p className="mhub-v3-empty">No data for this period yet.</p>
  }

  return (
    <div className="mhub-v3-chart-wrap" role="img" aria-label="Bar chart">
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid meet">
        {data.map((d, i) => {
          const v = Number(d[valueKey]) || 0
          const barH = max ? (v / max) * (height - 36) : 0
          const x = 24 + i * (barW + 8)
          const y = height - 24 - barH
          return (
            <g key={d[labelKey] || i}>
              <title>
                {d[labelKey]}: {v}
                {d.openRate != null ? ` · ${d.openRate}% open` : ''}
              </title>
              <rect x={x} y={y} width={barW} height={barH} rx={3} fill={MH.accent} opacity={0.9} />
              <text x={x + barW / 2} y={height - 8} textAnchor="middle" fontSize="9" fill={MH.textMuted}>
                {String(d[labelKey] || '').slice(5)}
              </text>
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
    return <p className="mhub-v3-empty">Start importing contacts to see growth here.</p>
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
    <div className="mhub-v3-chart-wrap" role="img" aria-label="Line chart">
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
