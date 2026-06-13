import { BarChart } from './MarketingSimpleCharts'

function pct(part, total) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

function FunnelStep({ label, value, total, rate, accent }) {
  const width = total ? Math.max(8, Math.round((value / total) * 100)) : 0
  return (
    <div className="mc-report-funnel__step">
      <div className="mc-report-funnel__step-head">
        <span className="mc-report-funnel__step-label">{label}</span>
        <span className="mc-report-funnel__step-value">
          {value.toLocaleString()}
          {rate != null ? <em>{rate}%</em> : null}
        </span>
      </div>
      <div className="mc-report-funnel__track">
        <div
          className={`mc-report-funnel__fill${accent ? ` mc-report-funnel__fill--${accent}` : ''}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export function ReportEngagementFunnel({ stats = {}, isWhatsApp = false }) {
  const enrolled = stats.enrolled ?? 0
  const sent = stats.recipientsSent ?? stats.sent ?? 0
  const base = Math.max(enrolled, sent, 1)

  const steps = isWhatsApp
    ? [
        { label: 'Enrolled', value: enrolled },
        { label: 'Sent', value: sent, accent: 'primary' },
        { label: 'Pending', value: stats.pending ?? 0 },
        { label: 'Failed', value: stats.failed ?? 0, accent: 'warn' },
      ]
    : [
        { label: 'Enrolled', value: enrolled },
        { label: 'Sent', value: sent, accent: 'primary' },
        { label: 'Delivered', value: stats.delivered ?? sent, rate: stats.deliveryRate },
        { label: 'Opened', value: stats.uniqueOpens ?? 0, rate: stats.openRate, accent: 'primary' },
        { label: 'Clicked', value: stats.uniqueClicks ?? 0, rate: stats.clickRate, accent: 'primary' },
        { label: 'Unsubscribed', value: stats.unsubscribed ?? 0, accent: 'muted' },
        { label: 'Bounced', value: stats.bounced ?? 0, rate: stats.bounceRate, accent: 'warn' },
      ]

  return (
    <section className="mc-report-panel mc-report-funnel" aria-label="Engagement funnel">
      <h2 className="mc-report-panel__title">Engagement funnel</h2>
      <p className="mc-report-panel__meta">Click any KPI below to open matching leads in CRM Pipeline.</p>
      <div className="mc-report-funnel__steps">
        {steps.map((s) => (
          <FunnelStep key={s.label} {...s} total={base} />
        ))}
      </div>
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

/** Hour-of-day / day distribution from recipient timestamps (best-effort). */
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

  if (data.length < 2) return null

  return (
    <section className="mc-report-panel">
      <h2 className="mc-report-panel__title">Activity over time</h2>
      <BarChart data={data} valueKey="events" labelKey="date" height={160} />
    </section>
  )
}
