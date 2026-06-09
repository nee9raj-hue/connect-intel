import { DashboardNavIcon } from '../dashboard/dashboardUi'
import { formatDealValue } from '../../lib/crmTimeline'
import { formatDateTime } from '../../lib/crmUiConstants'

const ORANGE = '#FF773D'

const KIND_ICONS = {
  task: 'task',
  follow_up: 'log',
  meeting: 'calendar',
  reply: 'mail',
  deal: 'chart',
  lead: 'people',
}

export function PersonalCommandBar({ items = [], onAction }) {
  return (
    <div className="myday-cmd-strip" role="list">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="listitem"
          className={`myday-cmd-card myday-cmd-card--${item.status || 'neutral'}`}
          onClick={() => onAction?.(item)}
        >
          <span className="myday-cmd-card__count">{item.count}</span>
          <span className="myday-cmd-card__label">{item.label}</span>
          {item.trend != null ? (
            <span className={`myday-cmd-card__trend${item.trend >= 0 ? ' is-up' : ' is-down'}`}>
              {item.trend > 0 ? '+' : ''}
              {item.trend}%
            </span>
          ) : (
            <span className="myday-cmd-card__action">Preview →</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function PriorityList({ items = [], onOpen }) {
  if (!items.length) {
    return (
      <p className="myday-empty myday-empty--good">
        Nothing urgent — you&apos;re caught up. Check pipeline for proactive outreach.
      </p>
    )
  }
  return (
    <ol className="myday-priorities">
      {items.map((item, i) => (
        <li key={item.id}>
          <button type="button" className="myday-priority" onClick={() => onOpen?.(item)}>
            <span className="myday-priority__rank">{i + 1}</span>
            <span className="myday-priority__icon" aria-hidden>
              <DashboardNavIcon name={KIND_ICONS[item.kind] || 'task'} className="myday-priority__svg" />
            </span>
            <span className="myday-priority__body">
              <span className="myday-priority__title">{item.title}</span>
              <span className="myday-priority__sub">{item.subtitle}</span>
            </span>
            {item.dueAt ? (
              <time className="myday-priority__time">{formatDateTime(item.dueAt)}</time>
            ) : (
              <span className="myday-priority__cta">Do →</span>
            )}
          </button>
        </li>
      ))}
    </ol>
  )
}

export function PipelineMini({ snapshot, onOpen }) {
  if (!snapshot) return null
  const stages = snapshot.stages || []
  const leadCount = snapshot.leadCount ?? stages.reduce((n, s) => n + (s.count || 0), 0)
  const max = Math.max(1, ...stages.map((s) => s.count || 0), leadCount)

  return (
    <div className="myday-pipeline">
      <div className="myday-pipeline__stats">
        <div>
          <span className="myday-stat-label">Leads</span>
          <strong>{leadCount}</strong>
        </div>
        <div>
          <span className="myday-stat-label">Deal value</span>
          <strong>{formatDealValue(snapshot.dealValue)}</strong>
        </div>
        <div>
          <span className="myday-stat-label">Expected</span>
          <strong>{formatDealValue(snapshot.expectedRevenue)}</strong>
        </div>
        <div>
          <span className="myday-stat-label">Stuck</span>
          <strong className={snapshot.stuckDeals > 0 ? 'myday-stat-warn' : ''}>{snapshot.stuckDeals}</strong>
        </div>
      </div>
      <div className="myday-pipeline__stages">
        {stages.map((st) => (
          <button
            key={st.id}
            type="button"
            className="myday-stage"
            onClick={() => onOpen?.({ status: st.id })}
          >
            <span className="myday-stage__label">{st.id.replace(/_/g, ' ')}</span>
            <span className="myday-stage__bar">
              <i style={{ width: `${(st.count / max) * 100}%` }} />
            </span>
            <span className="myday-stage__count">{st.count}</span>
          </button>
        ))}
      </div>
      <button type="button" className="myday-link-btn" onClick={() => onOpen?.({})}>
        Open my pipeline →
      </button>
    </div>
  )
}

export function DayTimeline({ items = [], onOpen }) {
  if (!items.length) return <p className="myday-empty">Nothing scheduled for today yet.</p>
  return (
    <ul className="myday-timeline">
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" className="myday-timeline__row" onClick={() => onOpen?.(item)}>
            <time>{formatDateTime(item.at)}</time>
            <span className="myday-timeline__title">{item.title}</span>
            <span className="myday-timeline__kind">{item.kind?.replace(/_/g, ' ')}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function ActivityCards({ items = [], onOpen }) {
  if (!items.length) return <p className="myday-empty">No recent updates on your leads.</p>
  return (
    <div className="myday-activity-cards">
      {items.map((item) => (
        <button key={item.id} type="button" className="myday-activity-card" onClick={() => onOpen?.(item)}>
          <span className="myday-activity-card__kind">{item.kind}</span>
          <span className="myday-activity-card__title">{item.title}</span>
          <span className="myday-activity-card__summary">{item.summary || item.company}</span>
          <time>{formatDateTime(item.at)}</time>
        </button>
      ))}
    </div>
  )
}

export function RevenueProgressBar({ revenue }) {
  if (!revenue) return null
  return (
    <div className="myday-revenue">
      <div className="myday-revenue__head">
        <span>Monthly target</span>
        <strong>{formatDealValue(revenue.monthlyTarget)}</strong>
      </div>
      <div className="myday-revenue__track">
        <span style={{ width: `${revenue.progressPct}%` }} />
      </div>
      <div className="myday-revenue__grid">
        <div>
          <span>Achieved</span>
          <strong>{formatDealValue(revenue.achieved)}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>{formatDealValue(revenue.remaining)}</strong>
        </div>
        <div>
          <span>Forecast</span>
          <strong>{formatDealValue(revenue.forecast)}</strong>
        </div>
      </div>
    </div>
  )
}

export function LeadFocusCards({ focus, onCardClick, onNavigate }) {
  if (!focus) return null
  const cards = [
    { id: 'new', label: 'New leads', count: focus.newLeads, status: 'new' },
    { id: 'hot', label: 'Hot leads', count: focus.hotLeads, smartTags: ['hot_score'] },
    { id: 'uncontacted', label: 'Uncontacted', count: focus.uncontacted, status: 'new' },
    { id: 'followup', label: 'Follow-up due', count: focus.followUpDue, status: 'follow_up', followUpDue: true },
  ]
  return (
    <div className="myday-lead-focus">
      {cards.map((c) => (
        <button
          key={c.id}
          type="button"
          className="myday-lead-card"
          onClick={() =>
            onCardClick
              ? onCardClick(c)
              : onNavigate?.('pipeline', {
                  status: c.status,
                  smartTags: c.smartTags,
                  followUpDue: c.followUpDue || undefined,
                })
          }
        >
          <span className="myday-lead-card__count">{c.count}</span>
          <span className="myday-lead-card__label">{c.label}</span>
        </button>
      ))}
      {focus.scoreDistribution?.length ? (
        <div className="myday-score-dist">
          {focus.scoreDistribution.map((row) => (
            <span key={row.id}>
              {row.label}: <strong>{row.count}</strong>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function QuickActionsFab({ actions = [], onAction, floating = false }) {
  const cls = floating ? 'myday-quick myday-quick--fab' : 'myday-quick'
  return (
    <div className={cls}>
      {actions.map((act) => (
        <button key={act.id} type="button" className="myday-quick__btn" onClick={() => onAction?.(act)}>
          <DashboardNavIcon name={act.icon || 'bolt'} className="myday-quick__icon" />
          <span>{act.label}</span>
        </button>
      ))}
    </div>
  )
}

export function GoalsCard({ goals }) {
  if (!goals) return null
  return (
    <div className="myday-goals">
      <div className="myday-goals__ring" style={{ '--pct': `${goals.progressPct}%` }}>
        <span className="myday-goals__pct">{goals.progressPct}%</span>
      </div>
      <div className="myday-goals__copy">
        <p className="myday-goals__label">{goals.label}</p>
        <p>
          <strong>{goals.achievement}</strong> / {goals.weeklyTarget} target
        </p>
        {goals.weeklyPerformance != null ? (
          <p className={`myday-goals__delta${goals.weeklyPerformance >= 0 ? ' is-up' : ''}`}>
            {goals.weeklyPerformance >= 0 ? '+' : ''}
            {goals.weeklyPerformance}% vs last week
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function InsightPills({ insights = [], onAction }) {
  if (!insights.length) return null
  return (
    <div className="myday-insights">
      {insights.map((ins, i) => (
        <button
          key={i}
          type="button"
          className={`myday-insight myday-insight--${ins.kind || 'highlight'}`}
          onClick={() => ins.action && onAction?.(ins.action)}
        >
          {ins.text}
        </button>
      ))}
    </div>
  )
}

export function MyDaySkeleton() {
  return (
    <div className="myday-skeleton-wrap" aria-hidden>
      <div className="myday-cmd-strip">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="myday-skeleton myday-skeleton--cmd" />
        ))}
      </div>
      <div className="myday-skeleton myday-skeleton--panel" />
      <div className="myday-skeleton myday-skeleton--panel" />
    </div>
  )
}
