import { useMemo, useState } from 'react'
import { formatDateTime } from '../../lib/crmUiConstants'
import MarketingCreatorBadge from './MarketingCreatorBadge'
import { openMarketingCampaignReport } from '../../lib/marketingReportUrls'

const VIEWS = [
  { id: 'grid', label: 'Grid' },
  { id: 'table', label: 'Table' },
  { id: 'kanban', label: 'Kanban' },
]

const KANBAN_COLS = ['draft', 'scheduled', 'active', 'paused', 'completed']

export default function MarketingCampaignsHub({
  campaigns = [],
  lists = [],
  busy,
  user,
  permissions,
  onNavigate,
  onStart,
  onPause,
  onResume,
  onStop,
  onContinue,
  onApprove,
  onReject,
  onCreate,
  onEdit,
}) {
  const [view, setView] = useState('grid')
  const [query, setQuery] = useState('')

  const listById = useMemo(() => Object.fromEntries((lists || []).map((l) => [l.id, l.name])), [lists])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return campaigns
    return campaigns.filter((c) => c.name?.toLowerCase().includes(q) || c.status?.includes(q))
  }, [campaigns, query])

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(KANBAN_COLS.map((s) => [s, []]))
    for (const c of filtered) {
      const key = KANBAN_COLS.includes(c.status) ? c.status : 'draft'
      map[key].push(c)
    }
    return map
  }, [filtered])

  return (
    <div className="mhub-campaigns-page">
      <header className="mhub-campaigns-page__head">
        <div>
          <h2>Campaigns</h2>
          <p>Performance-first campaign workspace</p>
        </div>
        <div className="mhub-campaigns-page__tools">
          <input
            type="search"
            placeholder="Search campaigns…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mhub-campaigns-page__search"
          />
          <div className="mhub-view-toggle">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`mhub-view-toggle__btn${view === v.id ? ' is-active' : ''}`}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button type="button" className="mhub-header__cta" onClick={onCreate}>
            New campaign
          </button>
        </div>
      </header>

      {view === 'grid' ? (
        <div className="mhub-campaign-grid">
          {filtered.map((c) => (
            <CampaignPerformanceCard
              key={c.id}
              campaign={c}
              audience={listById[c.listId] || c.segmentName || 'Audience'}
              busy={busy}
              user={user}
              permissions={permissions}
              onNavigate={onNavigate}
              onStart={onStart}
              onPause={onPause}
              onResume={onResume}
              onStop={onStop}
              onContinue={onContinue}
              onApprove={onApprove}
              onReject={onReject}
              onEdit={onEdit}
            />
          ))}
          {!filtered.length ? <p className="mhub-empty">No campaigns match.</p> : null}
        </div>
      ) : null}

      {view === 'table' ? (
        <div className="mhub-campaign-table-wrap">
          <table className="mhub-campaign-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Audience</th>
                <th>Status</th>
                <th>Opens</th>
                <th>CTR</th>
                <th>Sent</th>
                <th>Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const stats = c.stats || {}
                return (
                  <tr key={c.id}>
                    <td>
                      <button type="button" className="mhub-link" onClick={() => onEdit?.(c)}>
                        {c.name}
                      </button>
                    </td>
                    <td>{listById[c.listId] || '—'}</td>
                    <td>
                      <span className={`mhub-pill mhub-pill--${c.status}`}>{c.status}</span>
                    </td>
                    <td>{stats.openRate || 0}%</td>
                    <td>{stats.clickRate || 0}%</td>
                    <td>{stats.sent || stats.recipientsSent || 0}</td>
                    <td>{c.scheduledAt ? formatDateTime(c.scheduledAt) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {view === 'kanban' ? (
        <div className="mhub-kanban">
          {KANBAN_COLS.map((col) => (
            <div key={col} className="mhub-kanban__col">
              <h3 className="mhub-kanban__title">{col}</h3>
              <div className="mhub-kanban__cards">
                {(byStatus[col] || []).map((c) => (
                  <button key={c.id} type="button" className="mhub-kanban__card" onClick={() => onEdit?.(c)}>
                    <span className="mhub-kanban__name">{c.name}</span>
                    <span className="mhub-kanban__meta">{(c.stats?.openRate || 0)}% opens</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function CampaignPerformanceCard({
  campaign: c,
  audience,
  busy,
  user,
  permissions,
  onNavigate,
  onStart,
  onPause,
  onResume,
  onStop,
  onContinue,
  onApprove,
  onReject,
  onEdit,
}) {
  const stats = c.stats || {}
  const sent = stats.recipientsSent ?? stats.sent ?? 0

  return (
    <article className="mhub-perf-card">
      <div className="mhub-perf-card__head">
        <button type="button" className="mhub-perf-card__title" onClick={() => onEdit?.(c)}>
          {c.name}
        </button>
        <span className={`mhub-pill mhub-pill--${c.status}`}>{c.status}</span>
      </div>
      <p className="mhub-perf-card__audience">{audience}</p>
      <div className="mhub-perf-card__metrics">
        <div>
          <span className="mhub-perf-card__metric-label">Open rate</span>
          <strong>{stats.openRate || 0}%</strong>
        </div>
        <div>
          <span className="mhub-perf-card__metric-label">CTR</span>
          <strong>{stats.clickRate || 0}%</strong>
        </div>
        <div>
          <span className="mhub-perf-card__metric-label">Sent</span>
          <strong>{sent}</strong>
        </div>
      </div>
      {user?.isOrgAdmin && c.createdByName ? (
        <MarketingCreatorBadge name={c.createdByName} isOwn={c.isOwn} />
      ) : null}
      <div className="mhub-perf-card__actions">
        <button
          type="button"
          className="mhub-link"
          onClick={() => openMarketingCampaignReport(c.id)}
        >
          Analytics →
        </button>
        {c.status === 'draft' && (
          <button type="button" className="mhub-link" disabled={busy} onClick={() => onStart?.(c.id)}>
            Start
          </button>
        )}
        {c.approvalStatus === 'pending' && permissions?.canApprove && (
          <button type="button" className="mhub-link" disabled={busy} onClick={() => onApprove?.(c.id)}>
            Approve
          </button>
        )}
      </div>
    </article>
  )
}
