/** Enterprise loading skeleton — perceived performance (WCAG-friendly placeholders). */

function Block({ className = '' }) {
  return <div className={`dash-ent__skel ${className}`} aria-hidden />
}

export default function DashboardSkeleton() {
  return (
    <div className="dash-home dash-home--enterprise" role="status" aria-live="polite" aria-label="Loading dashboard">
      <div className="dash-home__inner">
        <div className="dash-ent__skel-header">
          <div>
            <Block className="dash-ent__skel-eyebrow" />
            <Block className="dash-ent__skel-title" />
            <Block className="dash-ent__skel-meta" />
          </div>
          <Block className="dash-ent__skel-btn" />
        </div>
        <div className="dash-ent__skel-toolbar">
          <Block className="dash-ent__skel-pill" />
          <Block className="dash-ent__skel-pill" />
        </div>
        <div className="dash-ent__skel-kpi-row">
          {Array.from({ length: 6 }).map((_, i) => (
            <Block key={i} className="dash-ent__skel-kpi" />
          ))}
        </div>
        <div className="dash-ent__skel-charts">
          <Block className="dash-ent__skel-chart" />
          <Block className="dash-ent__skel-chart" />
        </div>
        <div className="dash-ent__skel-main">
          <Block className="dash-ent__skel-card dash-ent__skel-card--tall" />
          <Block className="dash-ent__skel-card" />
        </div>
      </div>
    </div>
  )
}
