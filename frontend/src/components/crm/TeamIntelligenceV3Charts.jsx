/** V3 command center charts — CSS/SVG only (Vite-safe). */

import { Sparkline } from './TeamIntelligenceCharts'
import { formatDealValue } from '../../lib/crmTimeline'

import { brand } from '../../lib/brandTokens'

const ORANGE = brand.primary
const SLATE = '#64748b'
const GREEN = '#16a34a'
const AMBER = '#d97706'
const RED = '#dc2626'

export function CommandBarMetric({ metric, onClick }) {
  const statusColor = metric.status === 'good' ? GREEN : metric.status === 'warn' ? AMBER : RED
  const tone =
    metric.delta != null ? (metric.delta > 0 ? 'up' : metric.delta < 0 ? 'down' : 'flat') : null

  const Tag = onClick ? 'button' : 'article'
  const props = onClick
    ? { type: 'button', onClick: () => onClick(metric), className: `ti3-cmd-metric ti3-cmd-metric--${metric.status || 'warn'} ti3-cmd-metric--clickable` }
    : { className: `ti3-cmd-metric ti3-cmd-metric--${metric.status || 'warn'}` }

  return (
    <Tag {...props}>
      <div className="ti3-cmd-metric__head">
        <span className="ti3-cmd-metric__label">{metric.label}</span>
        <span className="ti3-cmd-metric__status" style={{ background: statusColor }} aria-hidden />
      </div>
      <div className="ti3-cmd-metric__body">
        <span className="ti3-cmd-metric__value">
          {metric.format === 'score' ? metric.value : (metric.value ?? 0).toLocaleString()}
          {metric.format === 'score' ? <span className="ti3-cmd-metric__unit">/100</span> : null}
        </span>
        {metric.delta != null ? (
          <span className={`ti3-cmd-metric__delta ti3-cmd-metric__delta--${tone}`}>
            {metric.delta > 0 ? '+' : ''}
            {metric.delta}%
          </span>
        ) : null}
      </div>
      <div className="ti3-cmd-metric__foot">
        <Sparkline data={metric.spark} color={ORANGE} height={28} />
        {metric.hint ? <span className="ti3-cmd-metric__hint">{metric.hint}</span> : null}
      </div>
    </Tag>
  )
}

export function InsightsCarousel({ insights = [], onSelect }) {
  if (!insights.length) {
    return <p className="ti3-empty">No insights yet — check back after more CRM activity.</p>
  }
  return (
    <div className="ti3-insights-track" role="list">
      {insights.map((insight, i) => (
        <button
          key={i}
          type="button"
          role="listitem"
          className={`ti3-insight-card ti3-insight-card--${insight.kind || 'highlight'}`}
          onClick={() => {
            if (insight.userId) onSelect?.(insight.userId)
            else if (insight.action) onSelect?.(null, insight.action)
          }}
        >
          <span className="ti3-insight-card__icon" aria-hidden>
            {insight.kind === 'risk' ? '!' : '✦'}
          </span>
          <span className="ti3-insight-card__text">{insight.text}</span>
        </button>
      ))}
    </div>
  )
}

const STATUS_LABELS = { strong: 'Strong', watch: 'Watch', attention: 'Needs attention' }
const BADGE_LABELS = { top: 'Top performer', improved: 'Most improved', coaching: 'Needs coaching' }

export function PerformanceMatrix({ rows = [], onSelectRep, mobile = false }) {
  if (!rows.length) return <p className="ti3-empty">No team data this period.</p>

  if (mobile) {
    return (
      <div className="ti3-matrix-cards">
        {rows.map((row) => (
          <article key={row.userId} className={`ti3-matrix-card ti3-matrix-card--${row.status}`}>
            <button type="button" className="ti3-matrix-card__head" onClick={() => onSelectRep?.(row.userId)}>
              <span className="ti3-matrix-card__name">{row.name}</span>
              {row.badge ? <span className={`ti3-badge ti3-badge--${row.badge}`}>{BADGE_LABELS[row.badge]}</span> : null}
            </button>
            <div className="ti3-matrix-card__grid">
              <div><span>Health</span><strong>{row.healthScore}</strong></div>
              <div><span>Activity</span><strong>{row.activityScore}</strong></div>
              <div><span>Calls</span><strong>{row.calls}</strong></div>
              <div><span>Meetings</span><strong>{row.meetings}</strong></div>
              <div><span>Follow-up</span><strong>{row.followUpRate}%</strong></div>
              <div><span>Revenue</span><strong>{formatDealValue(row.revenueInfluence)}</strong></div>
            </div>
            <span className={`ti3-status-pill ti3-status-pill--${row.status}`}>{STATUS_LABELS[row.status]}</span>
          </article>
        ))}
      </div>
    )
  }

  return (
    <div className="ti3-matrix-wrap">
      <table className="ti3-matrix">
        <thead>
          <tr>
            <th>Rep</th>
            <th>Health</th>
            <th>Activity</th>
            <th>Calls</th>
            <th>Meetings</th>
            <th>Emails</th>
            <th>Deals</th>
            <th>Follow-up</th>
            <th>Response</th>
            <th>Revenue</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userId} className={`ti3-matrix__row--${row.status}`}>
              <td>
                <button type="button" className="ti3-matrix__rep" onClick={() => onSelectRep?.(row.userId)}>
                  {row.name}
                  {row.badge ? <span className={`ti3-badge ti3-badge--${row.badge}`}>{BADGE_LABELS[row.badge]}</span> : null}
                </button>
              </td>
              <td>{row.healthScore}</td>
              <td>{row.activityScore}</td>
              <td>{row.calls}</td>
              <td>{row.meetings}</td>
              <td>{row.emails}</td>
              <td>{row.deals}</td>
              <td>{row.followUpRate}%</td>
              <td>{row.responseRate}%</td>
              <td>{formatDealValue(row.revenueInfluence)}</td>
              <td>
                <span className={`ti3-status-pill ti3-status-pill--${row.status}`}>{STATUS_LABELS[row.status]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PipelineHealthFunnel({ pipeline }) {
  const stages = pipeline?.stages || []
  if (!stages.length) return <p className="ti3-empty">No pipeline data.</p>
  const max = Math.max(1, ...stages.map((s) => s.volume))

  return (
    <div className="ti3-pipeline-funnel">
      {stages.map((stage) => {
        const isBottleneck = pipeline?.bottleneckStage === stage.id
        const width = Math.max(stage.volume ? 12 : 4, (stage.volume / max) * 100)
        return (
          <div key={stage.id} className={`ti3-pipeline-stage${isBottleneck ? ' is-bottleneck' : ''}`}>
            <div className="ti3-pipeline-stage__head">
              <span className="ti3-pipeline-stage__label">{stage.label}</span>
              <span className="ti3-pipeline-stage__vol">{stage.volume.toLocaleString()}</span>
            </div>
            <div className="ti3-pipeline-stage__bar">
              <span className="ti3-pipeline-stage__fill" style={{ width: `${width}%` }} />
            </div>
            <div className="ti3-pipeline-stage__meta">
              {stage.conversionPct != null ? <span>{stage.conversionPct}% conv</span> : null}
              {stage.avgDays != null ? <span>{stage.avgDays}d avg</span> : null}
              {stage.dropOffPct != null ? <span className="ti3-pipeline-stage__drop">{stage.dropOffPct}% drop</span> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function RevenueLeakGrid({ leaks = [], onAction }) {
  if (!leaks.length) return <p className="ti3-empty ti3-empty--good">No revenue leaks detected.</p>
  return (
    <div className="ti3-leak-grid">
      {leaks.map((leak) => (
        <button
          key={leak.id}
          type="button"
          className={`ti3-leak-card ti3-leak-card--${leak.severity}`}
          onClick={() => onAction?.(leak.id)}
        >
          <span className="ti3-leak-card__count">{leak.count.toLocaleString()}</span>
          <span className="ti3-leak-card__label">{leak.label}</span>
        </button>
      ))}
    </div>
  )
}

export function CapacityChart({ rows = [], onSelect }) {
  if (!rows.length) return <p className="ti3-empty">No capacity data.</p>
  const max = Math.max(1, ...rows.map((r) => r.leads + r.tasks + r.activeDeals))

  return (
    <div className="ti3-capacity">
      {rows.slice(0, 10).map((row) => (
        <button
          key={row.userId}
          type="button"
          className={`ti3-capacity-row ti3-capacity-row--${row.capacity}`}
          onClick={() => onSelect?.(row.userId)}
        >
          <span className="ti3-capacity-row__name">{row.name?.split(' ')[0]}</span>
          <div className="ti3-capacity-row__bars">
            <span className="ti3-capacity-bar" title="Leads">
              <i style={{ width: `${((row.leads || 0) / max) * 100}%`, background: ORANGE }} />
            </span>
            <span className="ti3-capacity-bar" title="Tasks">
              <i style={{ width: `${((row.tasks || 0) / max) * 100}%`, background: SLATE }} />
            </span>
            <span className="ti3-capacity-bar" title="Deals">
              <i style={{ width: `${((row.activeDeals || 0) / max) * 100}%`, background: GREEN }} />
            </span>
            <span className="ti3-capacity-bar" title="Meetings">
              <i style={{ width: `${((row.meetings || 0) / max) * 100}%`, background: AMBER }} />
            </span>
          </div>
          <span className="ti3-capacity-row__tag">
            {row.capacity === 'overloaded' ? 'Overloaded' : row.capacity === 'underutilized' ? 'Underutilized' : ''}
          </span>
        </button>
      ))}
    </div>
  )
}

export function AdoptionPanel({ adoption }) {
  if (!adoption) return null
  const overall = adoption.overall || 0
  const r = 36
  const c = 2 * Math.PI * r
  const offset = c - (overall / 100) * c

  return (
    <div className="ti3-adoption">
      <div className="ti3-adoption__overall">
        <svg width="88" height="88" viewBox="0 0 88 88" aria-label={`CRM adoption ${overall}%`}>
          <circle cx="44" cy="44" r={r} fill="none" stroke="#e8edf2" strokeWidth="8" />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={ORANGE}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform="rotate(-90 44 44)"
          />
          <text x="44" y="48" textAnchor="middle" className="ti3-adoption__pct">
            {overall}%
          </text>
        </svg>
        <p className="ti3-adoption__label">Overall adoption</p>
      </div>
      <div className="ti3-adoption__reps">
        {(adoption.reps || []).slice(0, 8).map((rep) => (
          <div key={rep.userId} className="ti3-adoption-rep">
            <span>{rep.name?.split(' ')[0]}</span>
            <span className="ti3-adoption-rep__track">
              <i style={{ width: `${rep.score}%` }} />
            </span>
            <span>{rep.score}</span>
          </div>
        ))}
      </div>
      {adoption.trend?.length ? (
        <div className="ti3-adoption__trend">
          <span className="ti3-section-label">30-day trend</span>
          <Sparkline data={adoption.trend} color={ORANGE} height={36} className="ti3-adoption-spark" />
        </div>
      ) : null}
    </div>
  )
}

export function EffectivenessGrid({ rows = [] }) {
  if (!rows.length) return <p className="ti3-empty">No effectiveness data.</p>
  return (
    <div className="ti3-effectiveness">
      {rows.map((row) => (
        <article key={row.id} className="ti3-effectiveness-card">
          <header>
            <span className="ti3-effectiveness-card__type">{row.type}</span>
            <span className="ti3-effectiveness-card__vol">{row.volume}</span>
          </header>
          <p className="ti3-effectiveness-card__flow">
            → {row.outcome} <strong>{row.outcomeCount}</strong>
          </p>
          <div className="ti3-effectiveness-card__stats">
            <span>{row.conversionRate}% conv</span>
            <span>{formatDealValue(row.revenueInfluence)}</span>
          </div>
          <div className="ti3-effectiveness-card__bar">
            <span style={{ width: `${Math.min(100, row.conversionRate)}%` }} />
          </div>
        </article>
      ))}
    </div>
  )
}

export function ActionCenterPanel({ items = [], onAction, compact = false }) {
  if (!items.length) return <p className="ti3-empty ti3-empty--good">All clear.</p>
  return (
    <ul className={`ti3-action-center${compact ? ' ti3-action-center--compact' : ''}`}>
      {items.map((item) => (
        <li key={item.id} className={`ti3-action-item ti3-action-item--${item.severity}`}>
          <p className="ti3-action-item__title">{item.title}</p>
          <div className="ti3-action-item__btns">
            {(item.actions || []).map((act) => (
              <button
                key={act.id}
                type="button"
                className="ti3-action-btn"
                onClick={() => onAction?.(item, act)}
              >
                {act.label}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}

function avatarInitials(name) {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

export function ActivityFeed({ items = [], onOpen, expandedId, onToggle }) {
  if (!items.length) return <p className="ti3-empty">No activity in this period.</p>
  return (
    <ul className="ti3-feed">
      {items.map((item) => {
        const open = expandedId === item.id
        const outcome =
          item.meta?.stageLabel ||
          (item.meta?.amount != null ? formatDealValue(item.meta.amount) : null) ||
          item.body?.slice(0, 60)
        return (
          <li key={item.id} className={`ti3-feed__item ti3-feed__item--${item.kind}`}>
            <div className="ti3-feed__rail" aria-hidden />
            <div className="ti3-feed__avatar">{avatarInitials(item.actorName)}</div>
            <div className="ti3-feed__body">
              <button type="button" className="ti3-feed__main" onClick={() => onToggle?.(item.id)}>
                <div className="ti3-feed__top">
                  <span className="ti3-feed__action">{item.type?.replace(/_/g, ' ') || 'Activity'}</span>
                  <time>{new Date(item.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
                </div>
                <p className="ti3-feed__entity">
                  {item.title}
                  {item.company && item.company !== item.title ? ` · ${item.company}` : ''}
                </p>
                {outcome && !open ? <p className="ti3-feed__outcome">{outcome}</p> : null}
              </button>
              {open ? (
                <div className="ti3-feed__detail">
                  {item.body ? <p>{item.body}</p> : null}
                  <p className="ti3-feed__actor">{item.actorName || 'Rep'}</p>
                  {item.leadId ? (
                    <button type="button" className="ti3-feed__open" onClick={() => onOpen?.(item)}>
                      Open in CRM →
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function SkeletonBlock({ className = '' }) {
  return <div className={`ti3-skeleton ${className}`.trim()} aria-hidden />
}

export function ForecastPanel({ forecast }) {
  if (!forecast) return <p className="ti3-empty">Forecast builds as pipeline value grows.</p>
  return (
    <div className="ti3-forecast-grid">
      <article className="ti3-forecast-card">
        <span className="ti3-forecast-card__label">Weighted pipeline</span>
        <strong className="ti3-forecast-card__value">{formatDealValue(forecast.weightedPipeline)}</strong>
      </article>
      <article className="ti3-forecast-card">
        <span className="ti3-forecast-card__label">30-day forecast</span>
        <strong className="ti3-forecast-card__value">{formatDealValue(forecast.forecast30d)}</strong>
      </article>
      <article className="ti3-forecast-card">
        <span className="ti3-forecast-card__label">90-day forecast</span>
        <strong className="ti3-forecast-card__value">{formatDealValue(forecast.forecast90d)}</strong>
      </article>
      <article className="ti3-forecast-card">
        <span className="ti3-forecast-card__label">Won (period)</span>
        <strong className="ti3-forecast-card__value">{formatDealValue(forecast.wonValue)}</strong>
      </article>
      <article className="ti3-forecast-card ti3-forecast-card--meta">
        <span className="ti3-forecast-card__label">Win rate</span>
        <strong className="ti3-forecast-card__value">{forecast.winRate ?? 0}%</strong>
        <span className="ti3-forecast-card__hint">Confidence: {forecast.confidence || 'low'}</span>
      </article>
      {forecast.atRiskValue > 0 ? (
        <article className="ti3-forecast-card ti3-forecast-card--risk">
          <span className="ti3-forecast-card__label">At-risk value</span>
          <strong className="ti3-forecast-card__value">{formatDealValue(forecast.atRiskValue)}</strong>
        </article>
      ) : null}
    </div>
  )
}

export function CoachingPanel({ reps = [], onSelectRep }) {
  if (!reps.length) return <p className="ti3-empty">No reps flagged for coaching this period.</p>
  return (
    <ul className="ti3-coaching-list">
      {reps.map((rep) => (
        <li key={rep.userId}>
          <button type="button" className="ti3-coaching-row" onClick={() => onSelectRep?.(rep.userId)}>
            <span className="ti3-coaching-row__name">{rep.name}</span>
            <span className="ti3-coaching-row__focus">{rep.focus}</span>
            <span className="ti3-coaching-row__scores">
              Health {rep.healthScore} · Activity {rep.activityScore}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
