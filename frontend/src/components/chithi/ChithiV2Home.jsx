import { formatDateTime } from '../../lib/crmUiConstants'

export default function ChithiV2Home({
  workspace,
  onSelectChannel,
  onOpenCustomerChannel,
  onNavigate,
  onOpenTasks,
  onNewDm,
}) {
  const w = workspace || {}

  return (
    <div className="chithi2-home">
      <header className="chithi2-home__hero">
        <h1>Chithi</h1>
        <p>CRM-native collaboration — every conversation has business context.</p>
      </header>

      <div className="chithi2-home__grid">
        <section className="chithi2-home-panel">
          <h2>Unread & mentions</h2>
          <div className="chithi2-home-stats">
            <div className="chithi2-stat">
              <strong>{w.unread?.messages || 0}</strong>
              <span>Messages</span>
            </div>
            <div className="chithi2-stat">
              <strong>{w.unread?.tasks || 0}</strong>
              <span>Tasks</span>
            </div>
            <div className="chithi2-stat">
              <strong>{w.mentions?.length || 0}</strong>
              <span>Mentions</span>
            </div>
          </div>
          <ul className="chithi2-home-list">
            {(w.mentions || []).slice(0, 5).map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onSelectChannel?.(m.channelId)}>
                  <strong>{m.authorName}</strong>
                  <span>{m.body?.slice(0, 80)}</span>
                </button>
              </li>
            ))}
            {!w.mentions?.length ? <li className="chithi2-muted">No new mentions</li> : null}
          </ul>
        </section>

        <section className="chithi2-home-panel">
          <h2>Pending tasks</h2>
          <ul className="chithi2-home-list">
            {(w.pendingTasks || []).map((t) => (
              <li key={t.id}>
                <button type="button" onClick={onOpenTasks}>
                  <strong>{t.title}</strong>
                  {t.dueAt ? <time>{formatDateTime(t.dueAt)}</time> : null}
                </button>
              </li>
            ))}
            {!w.pendingTasks?.length ? <li className="chithi2-muted">You&apos;re caught up</li> : null}
          </ul>
        </section>

        <section className="chithi2-home-panel chithi2-home-panel--wide">
          <h2>CRM activity feed</h2>
          <ul className="chithi2-activity-feed">
            {(w.activityFeed || []).map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => a.channelId && onSelectChannel?.(a.channelId)}>
                  <span className="chithi2-activity-badge">CRM</span>
                  <p>{a.body}</p>
                  <span className="chithi2-muted">
                    {a.channelLabel} · {formatDateTime(a.createdAt)}
                  </span>
                </button>
              </li>
            ))}
            {!w.activityFeed?.length ? (
              <li className="chithi2-muted">Deal updates and meetings will appear here automatically.</li>
            ) : null}
          </ul>
        </section>

        <section className="chithi2-home-panel">
          <h2>Upcoming meetings</h2>
          <ul className="chithi2-home-list">
            {(w.upcomingMeetings || []).map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onNavigate?.('crm-calendar')}>
                  <strong>{m.title}</strong>
                  <time>{formatDateTime(m.scheduledAt)}</time>
                </button>
              </li>
            ))}
            {!w.upcomingMeetings?.length ? <li className="chithi2-muted">No upcoming meetings</li> : null}
          </ul>
        </section>

        <section className="chithi2-home-panel">
          <h2>Customer channels</h2>
          <ul className="chithi2-home-list">
            {(w.suggestedCustomers || []).slice(0, 6).map((c) => (
              <li key={c.leadId}>
                <button type="button" onClick={() => onOpenCustomerChannel?.(c.leadId, c.label)}>
                  <strong>#{c.label?.toLowerCase().replace(/\s+/g, '-')}</strong>
                  <span>{c.dealCount} deals · {c.stage || 'pipeline'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="chithi2-home-panel">
          <h2>Quick actions</h2>
          <div className="chithi2-quick-actions">
            <button type="button" className="chithi2-btn chithi2-btn--primary" onClick={onNewDm}>
              New message
            </button>
            <button type="button" className="chithi2-btn" onClick={onOpenTasks}>
              View tasks
            </button>
            <button type="button" className="chithi2-btn" onClick={() => onNavigate?.('pipeline')}>
              Pipeline
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
