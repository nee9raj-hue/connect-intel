import { useMemo, useState } from 'react'
import { formatDateTime } from '../../lib/crmUiConstants'
import { campaignThumbnailStyle } from '../../lib/marketingExperience'
import { renderEmailCanvasHtml } from '../../lib/marketingEmailDesign'
import MarketingCreatorBadge from './MarketingCreatorBadge'
import MarketingCampaignDetailPanel from './MarketingCampaignDetailPanel'
import { CAMPAIGN_STATUS, campaignInitials, campaignIconTint } from './marketingTheme'

function StatusBadge({ status }) {
  const key = String(status || 'draft').toLowerCase()
  const s = CAMPAIGN_STATUS[key] || CAMPAIGN_STATUS.draft
  return (
    <span className="mhub-v3-badge" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function CampaignGalleryCard({ campaign, audience, busy, user, permissions, onOpen, onStart, onPause, onResume, onApprove, onReject, onEdit, onNavigate }) {
  const stats = campaign.stats || {}
  const thumbHtml = useMemo(() => {
    if (!campaign.blocks?.length) return null
    return renderEmailCanvasHtml(campaign.blocks, campaign.design || {}, { preview: true })
  }, [campaign.blocks, campaign.design])

  const canStart = campaign.status === 'draft' || campaign.status === 'scheduled'
  const isActive = campaign.status === 'active'

  return (
    <article className="mhub-v3-campaign-card" onClick={() => onOpen?.(campaign)} role="button" tabIndex={0}>
      <div className="mhub-v3-campaign-card__preview" style={{ background: campaignThumbnailStyle(campaign) }}>
        {thumbHtml ? (
          <div className="mhub-v3-campaign-card__html" dangerouslySetInnerHTML={{ __html: thumbHtml }} />
        ) : (
          <span className="mhub-v3-campaign-card__initial">{campaignInitials(campaign.name)}</span>
        )}
        <StatusBadge status={campaign.status} />
      </div>
      <div className="mhub-v3-campaign-card__body">
        <div className="mhub-v3-campaign-card__top">
          <h3>{campaign.name}</h3>
          {user?.isOrgAdmin && user?.accountType === 'company' ? <MarketingCreatorBadge item={campaign} compact /> : null}
        </div>
        <p className="mhub-v3-campaign-card__meta">
          {audience} · {campaign.updatedAt ? formatDateTime(campaign.updatedAt) : '—'}
        </p>
        <div className="mhub-v3-campaign-card__metrics">
          <div><strong>{stats.openRate || 0}%</strong><span>Opens</span></div>
          <div><strong>{stats.clickRate || 0}%</strong><span>Clicks</span></div>
          <div><strong>{stats.revenue ? `$${stats.revenue}` : '—'}</strong><span>Revenue</span></div>
        </div>
        <footer className="mhub-v3-campaign-card__foot" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="mhub-v3-btn" onClick={() => onEdit?.(campaign)}>Edit</button>
          {canStart && (
            <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" disabled={busy} onClick={() => onStart?.(campaign.id)}>Launch</button>
          )}
          {isActive && (
            <button type="button" className="mhub-v3-btn" disabled={busy} onClick={() => onPause?.(campaign.id)}>Pause</button>
          )}
          {campaign.status === 'paused' && (
            <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" disabled={busy} onClick={() => onResume?.(campaign.id)}>Resume</button>
          )}
          {stats.sent > 0 && (
            <button type="button" className="mhub-v3-btn" onClick={() => onNavigate?.('marketing', { tab: 'analytics', campaignId: campaign.id })}>Report</button>
          )}
          {campaign.status === 'pending_approval' && permissions?.canApprove && (
            <>
              <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" disabled={busy} onClick={() => onApprove?.(campaign.id)}>Approve</button>
              <button type="button" className="mhub-v3-btn" disabled={busy} onClick={() => onReject?.(campaign.id)}>Reject</button>
            </>
          )}
        </footer>
      </div>
    </article>
  )
}

export default function MarketingCampaignStudio({
  campaigns = [],
  lists = [],
  segments = [],
  summary,
  busy,
  user,
  permissions,
  onNavigate,
  onStart,
  onPause,
  onResume,
  onApprove,
  onReject,
  onCreate,
  onEdit,
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [view, setView] = useState('grid')
  const [detail, setDetail] = useState(null)

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
      if (!q) return true
      return c.name?.toLowerCase().includes(q) || c.status?.includes(q)
    })
  }, [campaigns, query, statusFilter])

  const studioKpis = useMemo(() => {
    const active = campaigns.filter((c) => c.status === 'active').length
    const scheduled = campaigns.filter((c) => c.status === 'scheduled').length
    const draft = campaigns.filter((c) => c.status === 'draft').length
    const completed = campaigns.filter((c) => c.status === 'completed' || c.status === 'sent').length
    const openSum = campaigns.reduce((n, c) => n + (c.stats?.openRate || 0), 0)
    const clickSum = campaigns.reduce((n, c) => n + (c.stats?.clickRate || 0), 0)
    const withStats = campaigns.filter((c) => c.stats?.openRate).length || 1
    return {
      active,
      scheduled,
      draft,
      completed,
      openRate: Math.round(openSum / withStats) || summary?.openRate || 0,
      clickRate: Math.round(clickSum / withStats) || summary?.clickRate || 0,
    }
  }, [campaigns, summary])

  return (
    <div className="mhub-v3-page mhub-v3-campaigns">
      <header className="mhub-v3-campaigns__head">
        <div>
          <p className="mhub-v3-eyebrow">Campaign studio</p>
          <h2 style={{ fontSize: 16, fontWeight: 500, margin: '0 0 4px' }}>Build campaigns that perform</h2>
          <p style={{ fontSize: 12, color: '#666', margin: 0 }}>Visual gallery — outcomes first, no spreadsheet mindset.</p>
        </div>
        <button type="button" className="mhub-v3-btn mhub-v3-btn--primary" onClick={onCreate}>
          Create campaign
        </button>
      </header>

      <div className="mhub-v3-inline-stats" style={{ marginBottom: 12 }}>
        <span>Active: <strong>{studioKpis.active}</strong></span>
        <span>Scheduled: <strong>{studioKpis.scheduled}</strong></span>
        <span>Drafts: <strong>{studioKpis.draft}</strong></span>
        <span>Completed: <strong>{studioKpis.completed}</strong></span>
        <span>Open rate: <strong>{studioKpis.openRate}%</strong></span>
        <span>Click rate: <strong>{studioKpis.clickRate}%</strong></span>
      </div>

      <div className="mhub-v3-campaigns__toolbar">
        <input type="search" className="mhub-v3-input" placeholder="Search campaigns…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="mhub-v3-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="scheduled">Scheduled</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
        </select>
        <div className="mhub-v3-periods">
          <button type="button" className={`mhub-v3-period${view === 'grid' ? ' is-active' : ''}`} onClick={() => setView('grid')}>Grid</button>
          <button type="button" className={`mhub-v3-period${view === 'list' ? ' is-active' : ''}`} onClick={() => setView('list')}>List</button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="mhub-v3-campaign-grid">
          {filtered.map((c, i) => (
            <CampaignGalleryCard
              key={c.id}
              campaign={c}
              audience={audienceById[c.listId] || audienceById[c.segmentId] || c.segmentName || 'Audience'}
              busy={busy}
              user={user}
              permissions={permissions}
              onNavigate={onNavigate}
              onOpen={setDetail}
              onStart={onStart}
              onPause={onPause}
              onResume={onResume}
              onApprove={onApprove}
              onReject={onReject}
              onEdit={onEdit}
            />
          ))}
        </div>
      ) : (
        <table className="mhub-v3-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Audience</th>
              <th>Status</th>
              <th>Open%</th>
              <th>Click%</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const tint = campaignIconTint(i)
              const stats = c.stats || {}
              return (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(c)}>
                  <td>
                    <span className="mhub-v3-campaign-icon" style={{ background: tint.bg, color: tint.color, display: 'inline-flex', marginRight: 8 }}>
                      {campaignInitials(c.name)}
                    </span>
                    {c.name}
                  </td>
                  <td>{audienceById[c.listId] || audienceById[c.segmentId] || '—'}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{stats.openRate || 0}%</td>
                  <td>{stats.clickRate || 0}%</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="mhub-v3-link" onClick={() => onEdit?.(c)}>Edit</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {!filtered.length ? <p className="mhub-v3-empty">No campaigns yet — create your first.</p> : null}

      {detail ? (
        <MarketingCampaignDetailPanel
          campaign={detail}
          onClose={() => setDetail(null)}
          onEdit={(c) => { setDetail(null); onEdit?.(c) }}
          onNavigate={onNavigate}
        />
      ) : null}
    </div>
  )
}
