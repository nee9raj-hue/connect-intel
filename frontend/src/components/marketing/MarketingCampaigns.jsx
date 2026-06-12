import { useMemo, useState } from 'react'
import { formatDateTime } from '../../lib/crmUiConstants'
import { campaignStatusColor } from './marketingTheme'
import { MailIcon, ChevronRightIcon } from '../ui/icons'

function formatEdited(iso) {
  if (!iso) return { date: '—', time: '' }
  try {
    const d = new Date(iso)
    return {
      date: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    }
  } catch {
    return { date: '—', time: '' }
  }
}

function analyticsSummary(campaign) {
  const stats = campaign.stats || {}
  const sent = stats.recipientsSent ?? stats.sent ?? 0
  if (!sent && campaign.status === 'draft') return '—'
  const openRate = stats.openRate ?? campaign.openRate ?? 0
  const clickRate = stats.clickRate ?? campaign.clickRate ?? stats.ctr ?? 0
  if (!openRate && !clickRate) return '—'
  return `${openRate}% opens · ${clickRate}% clicks`
}

export default function MarketingCampaigns({
  campaigns = [],
  lists = [],
  segments = [],
  busy,
  onCreate,
  onEdit,
  onOpenReport,
  onDuplicate,
  onNavigate,
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [view, setView] = useState('list')
  const [botFiltered, setBotFiltered] = useState(true)
  const [selected, setSelected] = useState(() => new Set())

  const audienceById = useMemo(() => {
    const map = {}
    for (const l of lists || []) map[l.id] = l.name
    for (const s of segments || []) map[s.id] = s.name
    return map
  }, [lists, segments])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return campaigns.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false
      if (typeFilter && (c.channel || 'email') !== typeFilter) return false
      if (!q) return true
      return c.name?.toLowerCase().includes(q) || c.status?.includes(q)
    })
  }, [campaigns, query, statusFilter, typeFilter])

  const hasFilters = Boolean(query || statusFilter || typeFilter)
  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id))

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(filtered.map((c) => c.id)))
  }

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openCampaign = (c) => {
    if (c.status === 'draft' || c.status === 'scheduled') onEdit?.(c)
    else onOpenReport?.(c)
  }

  return (
    <div className="mc-page mc-campaigns-page">
      <header className="mc-campaigns-header">
        <h1 className="mc-campaigns-header__title">Campaigns</h1>
        <div className="mc-campaigns-header__actions">
          <div className="mc-pill-toggle">
            <button
              type="button"
              className={`mc-pill-toggle__btn${view === 'list' ? ' is-active' : ''}`}
              onClick={() => setView('list')}
            >
              List
            </button>
            <button
              type="button"
              className={`mc-pill-toggle__btn${view === 'grid' ? ' is-active' : ''}`}
              onClick={() => setView('grid')}
            >
              Calendar
            </button>
          </div>
          <button type="button" className="mc-btn mc-btn--primary mc-btn--lg" onClick={onCreate}>
            Create
          </button>
        </div>
      </header>

      <div className="mc-campaigns-filters">
        <input
          type="search"
          className="mc-input mc-campaigns-filters__search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="mc-input mc-input--filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">Type: All</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select className="mc-input mc-input--filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Status: All</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="active">Active</option>
          <option value="completed">Sent</option>
          <option value="paused">Paused</option>
          <option value="stopped">Stopped</option>
        </select>
        {hasFilters ? (
          <button
            type="button"
            className="mc-link"
            onClick={() => {
              setQuery('')
              setStatusFilter('')
              setTypeFilter('')
            }}
          >
            Clear all
          </button>
        ) : null}
        <div className="mc-campaigns-filters__right">
          <button
            type="button"
            className={`mc-bot-toggle${botFiltered ? ' is-on' : ''}`}
            onClick={() => setBotFiltered((v) => !v)}
          >
            <span className="mc-bot-toggle__dot" aria-hidden />
            Bot filtered data
          </button>
          <button
            type="button"
            className="mc-btn mc-btn--outline"
            onClick={() => onNavigate?.('marketing', { tab: 'analytics' })}
          >
            View analytics
            <ChevronRightIcon className="w-3.5 h-3.5 rotate-90" />
          </button>
        </div>
      </div>

      {!filtered.length ? (
        <div className="mc-empty-state">
          <div className="mc-empty-state__icon" aria-hidden>
            <MailIcon className="w-10 h-10" />
          </div>
          <h2>No campaigns yet</h2>
          <p>Once you create a campaign, you&apos;ll see it here.</p>
          <button type="button" className="mc-btn mc-btn--primary" onClick={onCreate}>
            Create a campaign
          </button>
        </div>
      ) : view === 'list' ? (
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead>
              <tr>
                <th className="mc-table__check">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
                <th>Name</th>
                <th>Date edited</th>
                <th>Status</th>
                <th>Send to</th>
                <th>Analytics</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const edited = formatEdited(c.updatedAt || c.createdAt)
                const audience =
                  audienceById[c.listId] || audienceById[c.segmentId] || c.listName || c.segmentName || '—'
                const canEdit = c.status === 'draft' || c.status === 'scheduled'
                return (
                  <tr key={c.id}>
                    <td className="mc-table__check">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        aria-label={`Select ${c.name}`}
                      />
                    </td>
                    <td>
                      <button type="button" className="mc-campaign-name-link" onClick={() => openCampaign(c)}>
                        <MailIcon className="mc-campaign-name-link__icon" />
                        {c.name || 'Untitled'}
                      </button>
                    </td>
                    <td className="mc-table__date">
                      <span>{edited.date}</span>
                      {edited.time ? <span className="mc-table__date-time">{edited.time}</span> : null}
                    </td>
                    <td>
                      <span className="mc-status-text" style={{ color: campaignStatusColor(c.status) }}>
                        {statusLabel(c.status)}
                      </span>
                    </td>
                    <td>{audience}</td>
                    <td>{analyticsSummary(c)}</td>
                    <td className="mc-table__actions">
                      {canEdit ? (
                        <button type="button" className="mc-btn mc-btn--outline mc-btn--sm" onClick={() => onEdit?.(c)}>
                          Edit ▾
                        </button>
                      ) : (
                        <button type="button" className="mc-btn mc-btn--outline mc-btn--sm" onClick={() => onOpenReport?.(c)}>
                          Report
                        </button>
                      )}
                      <button
                        type="button"
                        className="mc-btn mc-btn--icon"
                        title="Duplicate"
                        disabled={busy}
                        onClick={() => onDuplicate?.(c.id)}
                      >
                        ⧉
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mc-hint">Calendar view coming soon — use List view to manage campaigns.</p>
      )}
    </div>
  )
}

function statusLabel(status) {
  const s = String(status || 'draft').toLowerCase()
  if (s === 'completed' || s === 'sent') return 'Sent'
  if (s === 'active') return 'Sending'
  return s.charAt(0).toUpperCase() + s.slice(1)
}
