import { useMemo, useState } from 'react'
import { formatDateTime } from '../../lib/crmUiConstants'
import { campaignThumbnailStyle } from '../../lib/marketingExperience'
import { renderEmailCanvasHtml } from '../../lib/marketingEmailDesign'
import MarketingCreatorBadge from './MarketingCreatorBadge'

function CampaignGalleryCard({
  campaign,
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
  const stats = campaign.stats || {}
  const thumbHtml = useMemo(() => {
    if (!campaign.blocks?.length) return null
    return renderEmailCanvasHtml(campaign.blocks, campaign.design || {}, { preview: true })
  }, [campaign.blocks, campaign.design])

  const canStart = campaign.status === 'draft' || campaign.status === 'scheduled'
  const isActive = campaign.status === 'active'

  return (
    <article className="mkt-campaign-card">
      <div className="mkt-campaign-card__thumb" style={{ background: campaignThumbnailStyle(campaign) }}>
        {thumbHtml ? (
          <div className="mkt-campaign-card__preview" dangerouslySetInnerHTML={{ __html: thumbHtml }} />
        ) : (
          <div className="mkt-campaign-card__placeholder">
            <span>{campaign.name?.slice(0, 2)?.toUpperCase() || 'CI'}</span>
          </div>
        )}
        <span className={`mkt-status mkt-status--${campaign.status}`}>{campaign.status}</span>
      </div>
      <div className="mkt-campaign-card__body">
        <div className="mkt-campaign-card__top">
          <h3>{campaign.name}</h3>
          {user?.isOrgAdmin && user?.accountType === 'company' ? (
            <MarketingCreatorBadge item={campaign} compact />
          ) : null}
        </div>
        <p className="mkt-campaign-card__audience">{audience}</p>
        <div className="mkt-campaign-card__metrics">
          <div>
            <strong>{stats.openRate || 0}%</strong>
            <span>Opens</span>
          </div>
          <div>
            <strong>{stats.clickRate || 0}%</strong>
            <span>Clicks</span>
          </div>
          <div>
            <strong>{stats.revenue ? `$${stats.revenue}` : '—'}</strong>
            <span>Revenue</span>
          </div>
        </div>
        <footer className="mkt-campaign-card__foot">
          <time>Updated {campaign.updatedAt ? formatDateTime(campaign.updatedAt) : 'recently'}</time>
          <div className="mkt-campaign-card__actions">
            <button type="button" className="mkt-btn mkt-btn--ghost mkt-btn--sm" onClick={() => onEdit?.(campaign)}>
              Edit
            </button>
            {canStart && (
              <button type="button" className="mkt-btn mkt-btn--primary mkt-btn--sm" disabled={busy} onClick={() => onStart?.(campaign.id)}>
                Launch
              </button>
            )}
            {isActive && (
              <button type="button" className="mkt-btn mkt-btn--ghost mkt-btn--sm" disabled={busy} onClick={() => onPause?.(campaign.id)}>
                Pause
              </button>
            )}
            {campaign.status === 'paused' && (
              <button type="button" className="mkt-btn mkt-btn--primary mkt-btn--sm" disabled={busy} onClick={() => onResume?.(campaign.id)}>
                Resume
              </button>
            )}
            {campaign.status === 'pending_approval' && permissions?.canApprove && (
              <>
                <button type="button" className="mkt-btn mkt-btn--primary mkt-btn--sm" disabled={busy} onClick={() => onApprove?.(campaign.id)}>
                  Approve
                </button>
                <button type="button" className="mkt-btn mkt-btn--ghost mkt-btn--sm" disabled={busy} onClick={() => onReject?.(campaign.id)}>
                  Reject
                </button>
              </>
            )}
            {stats.sent > 0 && (
              <button
                type="button"
                className="mkt-btn mkt-btn--ghost mkt-btn--sm"
                onClick={() => onNavigate?.('marketing', { tab: 'analytics', campaignId: campaign.id })}
              >
                Report
              </button>
            )}
          </div>
        </footer>
      </div>
    </article>
  )
}

export default function MarketingCampaignStudio({
  campaigns = [],
  lists = [],
  summary,
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
  const [query, setQuery] = useState('')

  const listById = useMemo(() => Object.fromEntries((lists || []).map((l) => [l.id, l.name])), [lists])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return campaigns
    return campaigns.filter((c) => c.name?.toLowerCase().includes(q) || c.status?.includes(q))
  }, [campaigns, query])

  const studioKpis = useMemo(() => {
    const active = campaigns.filter((c) => c.status === 'active').length
    const scheduled = campaigns.filter((c) => c.status === 'scheduled').length
    const draft = campaigns.filter((c) => c.status === 'draft').length
    const openSum = campaigns.reduce((n, c) => n + (c.stats?.openRate || 0), 0)
    const clickSum = campaigns.reduce((n, c) => n + (c.stats?.clickRate || 0), 0)
    const withStats = campaigns.filter((c) => c.stats?.openRate).length || 1
    return {
      active,
      scheduled,
      draft,
      revenue: summary?.revenue || 0,
      openRate: Math.round(openSum / withStats) || summary?.openRate || 0,
      clickRate: Math.round(clickSum / withStats) || summary?.clickRate || 0,
    }
  }, [campaigns, summary])

  return (
    <div className="mkt-studio">
      <header className="mkt-studio__hero">
        <div>
          <p className="mkt-eyebrow">Campaign studio</p>
          <h1>Build campaigns that perform</h1>
          <p>Visual gallery · outcomes first · no spreadsheet mindset.</p>
        </div>
        <button type="button" className="mkt-btn mkt-btn--primary mkt-btn--lg" onClick={onCreate}>
          Create campaign
        </button>
      </header>

      <section className="mkt-studio__kpis">
        {[
          { label: 'Active', value: studioKpis.active, accent: '#ff773d' },
          { label: 'Scheduled', value: studioKpis.scheduled, accent: '#0ea5e9' },
          { label: 'Drafts', value: studioKpis.draft, accent: '#94a3b8' },
          { label: 'Revenue', value: studioKpis.revenue ? `$${studioKpis.revenue}` : '—', accent: '#10b981' },
          { label: 'Open rate', value: `${studioKpis.openRate}%`, accent: '#6366f1' },
          { label: 'Click rate', value: `${studioKpis.clickRate}%`, accent: '#ec4899' },
        ].map((k) => (
          <div key={k.label} className="mkt-kpi" style={{ '--mkt-accent': k.accent }}>
            <span className="mkt-kpi__label">{k.label}</span>
            <strong className="mkt-kpi__value">{k.value}</strong>
          </div>
        ))}
      </section>

      <div className="mkt-studio__toolbar">
        <input
          type="search"
          className="mkt-studio__search"
          placeholder="Search campaigns…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mkt-studio__gallery">
        {filtered.map((c) => (
          <CampaignGalleryCard
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
        {!filtered.length ? <p className="mkt-empty mkt-empty--wide">No campaigns yet — create your first.</p> : null}
      </div>
    </div>
  )
}
