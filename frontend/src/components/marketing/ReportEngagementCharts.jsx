import { MH } from './marketingTheme'

function pct(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

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

function ModernFunnelBand({ label, value, rate, widthPct, tone = 'default', isFirst }) {
  return (
    <div className="mc-funnel-v2__row">
      {!isFirst ? <div className="mc-funnel-v2__spacer" aria-hidden /> : null}
      <div
        className={`mc-funnel-v2__band mc-funnel-v2__band--${tone}`}
        style={{ width: `${Math.max(widthPct, 18)}%` }}
      >
        <div className="mc-funnel-v2__band-inner">
          <span className="mc-funnel-v2__label">{label}</span>
          <span className="mc-funnel-v2__metrics">
            <strong>{value.toLocaleString()}</strong>
            {rate != null ? <span className="mc-funnel-v2__rate">{rate}%</span> : null}
          </span>
        </div>
      </div>
    </div>
  )
}

export function ReportEngagementFunnel({ stats = {}, isWhatsApp = false }) {
  const enrolled = stats.enrolled ?? 0
  const sent = stats.recipientsSent ?? stats.sent ?? 0
  const delivered = stats.delivered ?? sent
  const opened = stats.uniqueOpens ?? 0
  const clicked = stats.uniqueClicks ?? 0
  const base = Math.max(sent, enrolled, 1)

  const mainSteps = isWhatsApp
    ? [
        { label: 'Enrolled', value: enrolled, tone: 'slate' },
        { label: 'Sent', value: sent, tone: 'primary' },
        { label: 'Pending', value: stats.pending ?? 0, tone: 'muted' },
        { label: 'Failed', value: stats.failed ?? 0, tone: 'danger' },
      ]
    : [
        { label: 'Sent', value: sent, rate: pct(sent, base), tone: 'primary' },
        { label: 'Delivered', value: delivered, rate: stats.deliveryRate ?? pct(delivered, sent), tone: 'primary' },
        { label: 'Opened', value: opened, rate: stats.openRate ?? pct(opened, sent), tone: 'accent' },
        { label: 'Clicked', value: clicked, rate: stats.clickRate ?? pct(clicked, sent), tone: 'accent' },
      ]

  const footnotes = isWhatsApp
    ? []
    : [
        { label: 'Enrolled', value: enrolled },
        { label: 'Unsubscribed', value: stats.unsubscribed ?? 0 },
        { label: 'Bounced', value: stats.bounced ?? 0 },
      ]

  return (
    <section className="mc-report-panel mc-report-panel--funnel" aria-label="Engagement funnel">
      <h2 className="mc-report-panel__title">Engagement funnel</h2>
      <p className="mc-report-panel__meta">Conversion from send through opens and clicks.</p>
      <div className="mc-funnel-v2">
        {mainSteps.map((step, i) => (
          <ModernFunnelBand
            key={step.label}
            {...step}
            widthPct={(step.value / base) * 100}
            isFirst={i === 0}
          />
        ))}
      </div>
      {footnotes.length > 0 ? (
        <div className="mc-funnel-v2__footnotes">
          {footnotes.map((f) => (
            <div key={f.label} className="mc-funnel-v2__footnote">
              <span>{f.label}</span>
              <strong>{f.value.toLocaleString()}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function ReportEngagementRates({ stats = {} }) {
  const sent = stats.recipientsSent ?? stats.sent ?? 0
  const tiles = [
    { label: 'Open rate', value: `${stats.openRate ?? pct(stats.uniqueOpens, sent)}%`, sub: `${stats.uniqueOpens ?? 0} opens` },
    { label: 'Click rate', value: `${stats.clickRate ?? pct(stats.uniqueClicks, sent)}%`, sub: `${stats.uniqueClicks ?? 0} clicks` },
    { label: 'Delivery', value: `${stats.deliveryRate ?? pct(stats.delivered, sent)}%`, sub: `${stats.delivered ?? 0} delivered` },
    { label: 'Bounce rate', value: `${stats.bounceRate ?? pct(stats.bounced, sent)}%`, sub: `${stats.bounced ?? 0} bounced` },
  ]

  return (
    <div className="mc-report-rates">
      {tiles.map((t) => (
        <div key={t.label} className="mc-report-rates__tile">
          <span className="mc-report-rates__label">{t.label}</span>
          <strong className="mc-report-rates__value">{t.value}</strong>
          <span className="mc-report-rates__sub">{t.sub}</span>
        </div>
      ))}
    </div>
  )
}

function ReportActivityAreaChart({ data = [], valueKey = 'events', labelKey = 'date' }) {
  const values = data.map((d) => Number(d[valueKey]) || 0)
  const max = niceMax(Math.max(...values, 0))
  const count = data.length
  const w = 400
  const h = 220
  const padL = 36
  const padR = 12
  const padT = 16
  const padB = 28
  const innerW = w - padL - padR
  const innerH = h - padT - padB
  const step = count > 1 ? innerW / (count - 1) : innerW

  const points = data.map((d, i) => {
    const v = Number(d[valueKey]) || 0
    const x = padL + (count > 1 ? i * step : innerW / 2)
    const y = padT + innerH - (max ? (v / max) * innerH : 0)
    return { x, y, v, label: d[labelKey] }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padT + innerH} L ${points[0].x} ${padT + innerH} Z`
      : ''

  const gridLines = [0.25, 0.5, 0.75, 1].map((frac) => padT + innerH * (1 - frac))

  return (
    <div className="mc-report-activity-chart">
      <svg
        className="mc-report-activity-chart__svg"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Activity over time chart"
      >
        <defs>
          <linearGradient id="mcReportActivityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MH.accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={MH.accent} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {gridLines.map((y, i) => (
          <line
            key={i}
            x1={padL}
            y1={y}
            x2={w - padR}
            y2={y}
            stroke="#e8eceb"
            strokeWidth="1"
          />
        ))}
        {areaPath ? <path d={areaPath} fill="url(#mcReportActivityFill)" /> : null}
        {linePath ? (
          <path d={linePath} fill="none" stroke={MH.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#fff" stroke={MH.accent} strokeWidth="2">
              <title>
                {formatChartDate(p.label)}: {p.v} events
              </title>
            </circle>
            <text x={p.x} y={h - 8} textAnchor="middle" fontSize="11" fill={MH.textMuted}>
              {formatChartDate(p.label)}
            </text>
          </g>
        ))}
        {[0, max].map((tick, i) => (
          <text
            key={i}
            x={padL - 6}
            y={i === 0 ? padT + innerH + 4 : padT + 4}
            textAnchor="end"
            fontSize="10"
            fill={MH.textMuted}
          >
            {tick}
          </text>
        ))}
      </svg>
    </div>
  )
}

/** Day distribution from recipient timestamps (best-effort). */
export function ReportActivityChart({ recipients = [] }) {
  const byDay = new Map()
  for (const r of recipients) {
    for (const ts of [r.firstOpenAt, r.lastOpenAt, r.lastClickAt, r.lastSentAt]) {
      if (!ts) continue
      const key = ts.slice(0, 10)
      byDay.set(key, (byDay.get(key) || 0) + 1)
    }
  }
  const data = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, events]) => ({ date, events }))

  if (data.length < 1) return null

  return (
    <section className="mc-report-panel mc-report-panel--chart">
      <h2 className="mc-report-panel__title">Activity over time</h2>
      <p className="mc-report-panel__meta">Opens, clicks, and sends by day.</p>
      <ReportActivityAreaChart data={data} valueKey="events" labelKey="date" />
    </section>
  )
}
