import { formatDateTime } from '../../lib/crmUiConstants'
import { formatDealValue } from '../../lib/crmTimeline'

function ContextSection({ title, children }) {
  if (!children) return null
  return (
    <section className="chithi2-ctx__section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

export default function ChithiV2ContextPanel({ context, loading, onNavigate, onOpenLead, onOpenDeal }) {
  if (loading) {
    return (
      <aside className="chithi2-ctx">
        <div className="chithi2-ctx__skeleton" />
      </aside>
    )
  }

  if (!context || context.kind === 'none') {
    return (
      <aside className="chithi2-ctx chithi2-ctx--empty">
        <p>Select a channel to see CRM context — customers, deals, tasks, and activity.</p>
      </aside>
    )
  }

  return (
    <aside className="chithi2-ctx">
      <header className="chithi2-ctx__head">
        <span className="chithi2-ctx__kind">{context.subtitle}</span>
        <h2>{context.title}</h2>
      </header>

      {context.kind === 'customer' && (
        <>
          {context.customer && (
            <ContextSection title="Customer overview">
              <div className="chithi2-ctx-card">
                {context.customer.stage ? <span className="chithi2-ctx-pill">{context.customer.stage}</span> : null}
                {context.customer.owner ? <p>Owner · {context.customer.owner}</p> : null}
                {context.customer.value > 0 ? (
                  <p className="chithi2-ctx-metric">{formatDealValue(context.customer.value)} pipeline</p>
                ) : null}
                {context.leadId ? (
                  <button type="button" className="chithi2-link" onClick={() => onOpenLead?.(context.leadId)}>
                    Open in CRM
                  </button>
                ) : null}
              </div>
            </ContextSection>
          )}
          <ContextSection title="Open deals">
            <ul className="chithi2-ctx-list">
              {(context.deals || []).map((d) => (
                <li key={d.id}>
                  <button type="button" className="chithi2-ctx-row" onClick={() => onOpenDeal?.(context.leadId, d.id)}>
                    <strong>{d.name}</strong>
                    <span>{d.stage}</span>
                  </button>
                </li>
              ))}
              {!context.deals?.length ? <li className="chithi2-muted">No open deals</li> : null}
            </ul>
          </ContextSection>
          <ContextSection title="Pending tasks">
            <ul className="chithi2-ctx-list">
              {(context.tasks || []).map((t) => (
                <li key={t.id}>
                  <span>{t.title}</span>
                </li>
              ))}
              {!context.tasks?.length ? <li className="chithi2-muted">No linked tasks</li> : null}
            </ul>
          </ContextSection>
          <ContextSection title="Recent activity">
            <ul className="chithi2-ctx-feed">
              {(context.recentActivity || []).map((a) => (
                <li key={a.id}>
                  <p>{a.body}</p>
                  <time>{formatDateTime(a.createdAt)}</time>
                </li>
              ))}
            </ul>
          </ContextSection>
        </>
      )}

      {context.kind === 'deal' && context.deal && (
        <>
          <ContextSection title="Deal overview">
            <div className="chithi2-ctx-card">
              <p className="chithi2-ctx-metric">{formatDealValue(context.deal.amount || 0)}</p>
              <span className="chithi2-ctx-pill">{context.deal.stage}</span>
              {context.deal.expectedCloseDate ? (
                <p>Close · {formatDateTime(context.deal.expectedCloseDate)}</p>
              ) : null}
              {context.leadId ? (
                <button type="button" className="chithi2-link" onClick={() => onOpenLead?.(context.leadId)}>
                  View customer
                </button>
              ) : null}
            </div>
          </ContextSection>
          <ContextSection title="Timeline">
            <ul className="chithi2-ctx-feed">
              {(context.timeline || []).map((ev, i) => (
                <li key={ev.id || i}>
                  <p>{ev.summary}</p>
                  <time>{formatDateTime(ev.createdAt)}</time>
                </li>
              ))}
            </ul>
          </ContextSection>
        </>
      )}

      {context.kind === 'team' && context.metrics && (
        <ContextSection title="Team metrics">
          <div className="chithi2-ctx-stats">
            <div>
              <strong>{context.metrics.members}</strong>
              <span>Members</span>
            </div>
            <div>
              <strong>{context.metrics.openTasks}</strong>
              <span>Open tasks</span>
            </div>
          </div>
        </ContextSection>
      )}

      {context.kind === 'dm' && (
        <ContextSection title="Direct message">
          <p className="chithi2-muted">Private conversation · @mention teammates or #link customers</p>
        </ContextSection>
      )}

      {context.kind === 'campaign' && (
        <ContextSection title="Campaign">
          <button type="button" className="chithi2-link" onClick={() => onNavigate?.('marketing', { tab: 'campaigns' })}>
            Open in Marketing Hub
          </button>
        </ContextSection>
      )}
    </aside>
  )
}
