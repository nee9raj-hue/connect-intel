import { formatDealValue } from '../../lib/crmTimeline'
import { formatDateTime } from '../../lib/crmUiConstants'

const ACCENT = '#3730a3'

export function HubCommandBar({ items = [], onAction }) {
  return (
    <div className="mhub-cmd-strip" role="list">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="listitem"
          className={`mhub-cmd-card mhub-cmd-card--${item.status || 'neutral'}`}
          onClick={() => onAction?.(item)}
        >
          <span className="mhub-cmd-card__count">
            {item.format === 'currency' && typeof item.count === 'number'
              ? formatDealValue(item.count)
              : item.count}
          </span>
          <span className="mhub-cmd-card__label">{item.label}</span>
          {item.trend != null ? (
            <span className={`mhub-cmd-card__trend${item.trend >= 0 ? ' is-up' : ' is-down'}`}>
              {item.trend > 0 ? '+' : ''}
              {item.trend}%
            </span>
          ) : (
            <span className="mhub-cmd-card__action">Open →</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function HubHealthRing({ score = 0, label }) {
  return (
    <div className="mhub-health">
      <div className="mhub-health__ring" style={{ '--pct': `${score}%` }}>
        <span className="mhub-health__score">{score}</span>
      </div>
      <div>
        <p className="mhub-health__label">Marketing health</p>
        <p className="mhub-health__status">{label}</p>
      </div>
    </div>
  )
}

export function HubPriorityList({ items = [], onOpen }) {
  if (!items.length) {
    return <p className="mhub-empty mhub-empty--good">No urgent marketing tasks — you&apos;re on track.</p>
  }
  return (
    <ol className="mhub-priorities">
      {items.map((item, i) => (
        <li key={item.id}>
          <button type="button" className="mhub-priority" onClick={() => onOpen?.(item)}>
            <span className="mhub-priority__rank">{i + 1}</span>
            <span className="mhub-priority__body">
              <span className="mhub-priority__title">{item.title}</span>
              <span className="mhub-priority__sub">{item.subtitle}</span>
            </span>
            <span className="mhub-priority__cta">Do →</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

export function HubCampaignCards({ campaigns = [], onOpen }) {
  if (!campaigns.length) {
    return <p className="mhub-empty">No campaign data yet — launch your first send.</p>
  }
  return (
    <div className="mhub-campaign-cards">
      {campaigns.map((c) => (
        <button key={c.id} type="button" className="mhub-campaign-card" onClick={() => onOpen?.(c)}>
          <span className="mhub-campaign-card__name">{c.name}</span>
          <span className={`mhub-campaign-card__status mhub-campaign-card__status--${c.status || 'draft'}`}>
            {c.status}
          </span>
          <div className="mhub-campaign-card__metrics">
            <span>
              <strong>{c.openRate || 0}%</strong> opens
            </span>
            <span>
              <strong>{c.ctr || c.clickRate || 0}%</strong> CTR
            </span>
            <span>
              <strong>{c.sent || 0}</strong> sent
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

export function HubScheduledList({ items = [], onOpen }) {
  if (!items.length) return <p className="mhub-empty">No scheduled sends.</p>
  return (
    <ul className="mhub-scheduled">
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" className="mhub-scheduled__row" onClick={() => onOpen?.(item)}>
            <span className="mhub-scheduled__name">{item.name}</span>
            <span className="mhub-scheduled__meta">{item.audience}</span>
            <time>{formatDateTime(item.scheduledAt)}</time>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function HubInsightPills({ insights = [], onAction }) {
  return (
    <div className="mhub-insights">
      {insights.map((ins, i) => (
        <button
          key={i}
          type="button"
          className={`mhub-insight mhub-insight--${ins.kind || 'highlight'}`}
          onClick={() => ins.action && onAction?.(ins.action)}
        >
          {ins.text}
        </button>
      ))}
    </div>
  )
}

export function HubQuickActions({ actions = [], onAction }) {
  return (
    <div className="mhub-quick">
      {actions.map((act) => (
        <button key={act.id} type="button" className="mhub-quick__btn" onClick={() => onAction?.(act)}>
          {act.label}
        </button>
      ))}
    </div>
  )
}

export function HubSkeleton() {
  return (
    <div className="mhub-skeleton-wrap" aria-hidden>
      <div className="mhub-cmd-strip">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="mhub-skeleton mhub-skeleton--cmd" />
        ))}
      </div>
      <div className="mhub-skeleton mhub-skeleton--panel" />
      <div className="mhub-skeleton mhub-skeleton--panel" />
    </div>
  )
}

export function HubMetricTiles({ tiles = [] }) {
  return (
    <div className="mhub-metric-tiles">
      {tiles.map((t) => (
        <div key={t.label} className="mhub-metric-tile">
          <span className="mhub-metric-tile__label">{t.label}</span>
          <strong className="mhub-metric-tile__value">{t.value}</strong>
          {t.hint ? <span className="mhub-metric-tile__hint">{t.hint}</span> : null}
        </div>
      ))}
    </div>
  )
}

export const MHUB_ACCENT = ACCENT
