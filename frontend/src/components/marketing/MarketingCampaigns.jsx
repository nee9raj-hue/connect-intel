import { useEffect, useMemo, useState } from 'react'
import { campaignThumbnailStyle } from '../../lib/marketingExperience'
import { renderEmailCanvasHtml } from '../../lib/marketingEmailDesign'
import {
  campaignAnalyticsSummary,
  campaignListStatus,
  campaignMetrics,
  campaignSummaryCounts,
} from '../../lib/marketingCampaignStatus'
import { CAMPAIGN_STATUS, campaignInitials } from './marketingTheme'
import {
  MailIcon,
  ChevronRightIcon,
  SearchIcon,
  PlusIcon,
  ChartIcon,
  PeopleIcon,
  PencilIcon,
  EyeIcon,
  LayoutTemplateIcon,
  CalendarIcon,
  BoltIcon,
} from '../ui/icons'

function formatEdited(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function StatusBadge({ campaign }) {
  const display = campaignListStatus(campaign)
  const badge = CAMPAIGN_STATUS[display.tone] || CAMPAIGN_STATUS.draft
  return (
    <span className="mc-camp-badge" style={{ background: badge.bg, color: badge.color }}>
      {display.label}
      {display.hint ? <span className="mc-camp-badge__hint"> · {display.hint}</span> : null}
    </span>
  )
}

function CampaignThumb({ campaign }) {
  const display = campaignListStatus(campaign)
  const thumbHtml = useMemo(() => {
    const blocks = campaign.blocks || campaign.steps?.[0]?.blocks
    const design = campaign.design || campaign.steps?.[0]?.design
    if (!blocks?.length) return null
    return renderEmailCanvasHtml(blocks, design || {}, { preview: true })
  }, [campaign])

  return (
    <div
      className="mc-camp-card__thumb"
      style={{ background: campaignThumbnailStyle({ ...campaign, status: display.key }) }}
    >
      {thumbHtml ? (
        <div className="mc-camp-card__thumb-html" dangerouslySetInnerHTML={{ __html: thumbHtml }} />
      ) : (
        <span className="mc-camp-card__initials">{campaignInitials(campaign.name)}</span>
      )}
      <StatusBadge campaign={campaign} />
    </div>
  )
}

function CampaignCard({
  campaign,
  audience,
  busy,
  onOpen,
  onEdit,
  onOpenReport,
  onDuplicate,
  onNavigate,
}) {
  const display = campaignListStatus(campaign)
  const m = campaignMetrics(campaign)
  const canEdit = display.key === 'draft' || display.key === 'scheduled'
  const hasReport = m.sent > 0 || display.key === 'completed' || display.key === 'active'

  return (
    <article className="mc-camp-card">
      <button type="button" className="mc-camp-card__open" onClick={() => onOpen(campaign)}>
        <CampaignThumb campaign={campaign} />
        <div className="mc-camp-card__body">
          <h3 className="mc-camp-card__title">{campaign.name || 'Untitled'}</h3>
          <p className="mc-camp-card__meta">
            <PeopleIcon className="mc-camp-card__meta-icon" aria-hidden />
            {audience}
            <span className="mc-camp-card__dot">·</span>
            <CalendarIcon className="mc-camp-card__meta-icon" aria-hidden />
            {formatEdited(campaign.updatedAt || campaign.createdAt)}
          </p>
          <div className="mc-camp-card__metrics">
            <div>
              <strong>{m.sent > 0 ? m.sent.toLocaleString() : m.testSent || '—'}</strong>
              <span>{m.sent > 0 ? 'Sent' : m.testSent ? 'Test' : 'Sent'}</span>
            </div>
            <div>
              <strong>{m.openRate ? `${m.openRate}%` : '—'}</strong>
              <span>Opens</span>
            </div>
            <div>
              <strong>{m.clickRate ? `${m.clickRate}%` : '—'}</strong>
              <span>Clicks</span>
            </div>
          </div>
        </div>
      </button>
      <footer className="mc-camp-card__foot">
        {canEdit ? (
          <button type="button" className="mc-camp-card__action" onClick={() => onEdit?.(campaign)}>
            <PencilIcon className="w-4 h-4" />
            Edit
          </button>
        ) : null}
        {hasReport ? (
          <button type="button" className="mc-camp-card__action" onClick={() => onOpenReport?.(campaign)}>
            <ChartIcon className="w-4 h-4" />
            Report
          </button>
        ) : (
          <button type="button" className="mc-camp-card__action" onClick={() => onNavigate?.('marketing', { tab: 'analytics' })}>
            <EyeIcon className="w-4 h-4" />
            Analytics
          </button>
        )}
        <button
          type="button"
          className="mc-camp-card__action"
          disabled={busy}
          onClick={() => onDuplicate?.(campaign.id)}
        >
          <LayoutTemplateIcon className="w-4 h-4" />
          Duplicate
        </button>
      </footer>
    </article>
  )
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
  onRefresh,
}) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [view, setView] = useState('grid')

  useEffect(() => {
    onRefresh?.()
  }, [onRefresh])

  const audienceById = useMemo(() => {
    const map = {}
    for (const l of lists || []) map[l.id] = l.name
    for (const s of segments || []) map[s.id] = s.name
    return map
  }, [lists, segments])

  const summary = useMemo(() => campaignSummaryCounts(campaigns), [campaigns])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...campaigns]
      .filter((c) => {
        if (statusFilter && campaignListStatus(c).key !== statusFilter) return false
        if (typeFilter && (c.channel || 'email') !== typeFilter) return false
        if (!q) return true
        return c.name?.toLowerCase().includes(q) || c.subject?.toLowerCase().includes(q)
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
  }, [campaigns, query, statusFilter, typeFilter])

  const hasFilters = Boolean(query || statusFilter || typeFilter)

  const openCampaign = (c) => {
    const display = campaignListStatus(c)
    if (display.key === 'draft' || display.key === 'scheduled') onEdit?.(c)
    else onOpenReport?.(c)
  }

  const quickLinks = [
    { id: 'analytics', label: 'View reports', icon: ChartIcon, tab: 'analytics' },
    { id: 'audiences', label: 'Audiences', icon: PeopleIcon, tab: 'audiences', audienceTab: 'contacts' },
    { id: 'templates', label: 'Email templates', icon: LayoutTemplateIcon, tab: 'templates' },
    { id: 'automations', label: 'Automations', icon: BoltIcon, tab: 'automations' },
  ]

  return (
    <div className="mc-page mc-campaigns-page">
      <header className="mc-camp-page-head">
        <div>
          <h1 className="mc-camp-page-head__title">Campaigns</h1>
          <p className="mc-camp-page-head__sub">Create, send, and track email campaigns for your audience.</p>
        </div>
        <button type="button" className="mc-btn mc-btn--primary mc-btn--lg" onClick={onCreate}>
          <PlusIcon className="w-4 h-4" />
          Create campaign
        </button>
      </header>

      <div className="mc-camp-summary">
        <div className="mc-camp-summary__card">
          <MailIcon className="mc-camp-summary__icon" aria-hidden />
          <div>
            <span className="mc-camp-summary__value">{summary.draft}</span>
            <span className="mc-camp-summary__label">Drafts</span>
          </div>
        </div>
        <div className="mc-camp-summary__card">
          <CalendarIcon className="mc-camp-summary__icon" aria-hidden />
          <div>
            <span className="mc-camp-summary__value">{summary.scheduled}</span>
            <span className="mc-camp-summary__label">Scheduled</span>
          </div>
        </div>
        <div className="mc-camp-summary__card">
          <BoltIcon className="mc-camp-summary__icon" aria-hidden />
          <div>
            <span className="mc-camp-summary__value">{summary.active}</span>
            <span className="mc-camp-summary__label">Sending</span>
          </div>
        </div>
        <div className="mc-camp-summary__card mc-camp-summary__card--accent">
          <ChartIcon className="mc-camp-summary__icon" aria-hidden />
          <div>
            <span className="mc-camp-summary__value">{summary.sent}</span>
            <span className="mc-camp-summary__label">Sent</span>
          </div>
        </div>
        {summary.test > 0 ? (
          <div className="mc-camp-summary__card">
            <EyeIcon className="mc-camp-summary__icon" aria-hidden />
            <div>
              <span className="mc-camp-summary__value">{summary.test}</span>
              <span className="mc-camp-summary__label">Test sent</span>
            </div>
          </div>
        ) : null}
      </div>

      <nav className="mc-camp-quicklinks" aria-label="Related">
        {quickLinks.map((link) => {
          const Icon = link.icon
          return (
            <button
              key={link.id}
              type="button"
              className="mc-camp-quicklink"
              onClick={() =>
                onNavigate?.('marketing', {
                  tab: link.tab,
                  ...(link.audienceTab ? { audienceTab: link.audienceTab } : {}),
                })
              }
            >
              <span className="mc-camp-quicklink__icon">
                <Icon className="w-4 h-4" />
              </span>
              {link.label}
              <ChevronRightIcon className="mc-camp-quicklink__chev w-3.5 h-3.5" aria-hidden />
            </button>
          )
        })}
      </nav>

      <div className="mc-camp-toolbar">
        <div className="mc-camp-toolbar__search">
          <SearchIcon className="mc-camp-toolbar__search-icon" aria-hidden />
          <input
            type="search"
            className="mc-input"
            placeholder="Search campaigns"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="mc-input mc-input--filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select
          className="mc-input mc-input--filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="active">Sending</option>
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
            Clear filters
          </button>
        ) : null}
        <div className="mc-camp-toolbar__view">
          <div className="mc-pill-toggle">
            <button
              type="button"
              className={`mc-pill-toggle__btn${view === 'grid' ? ' is-active' : ''}`}
              onClick={() => setView('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              className={`mc-pill-toggle__btn${view === 'list' ? ' is-active' : ''}`}
              onClick={() => setView('list')}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {!filtered.length ? (
        <div className="mc-empty-state mc-camp-empty">
          <div className="mc-empty-state__icon" aria-hidden>
            <MailIcon className="w-10 h-10" />
          </div>
          <h2>No campaigns yet</h2>
          <p>Launch your first email campaign or send a test from the builder.</p>
          <button type="button" className="mc-btn mc-btn--primary" onClick={onCreate}>
            Create a campaign
          </button>
        </div>
      ) : view === 'grid' ? (
        <div className="mc-camp-grid">
          {filtered.map((c) => {
            const audience =
              audienceById[c.listId] || audienceById[c.segmentId] || c.listName || c.segmentName || 'No audience'
            return (
              <CampaignCard
                key={c.id}
                campaign={c}
                audience={audience}
                busy={busy}
                onOpen={openCampaign}
                onEdit={onEdit}
                onOpenReport={onOpenReport}
                onDuplicate={onDuplicate}
                onNavigate={onNavigate}
              />
            )
          })}
        </div>
      ) : (
        <div className="mc-table-wrap mc-camp-table-wrap">
          <table className="mc-table mc-camp-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Audience</th>
                <th>Performance</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const audience =
                  audienceById[c.listId] || audienceById[c.segmentId] || c.listName || c.segmentName || '—'
                const display = campaignListStatus(c)
                const canEdit = display.key === 'draft' || display.key === 'scheduled'
                return (
                  <tr key={c.id}>
                    <td>
                      <button type="button" className="mc-camp-table__name" onClick={() => openCampaign(c)}>
                        <span className="mc-camp-table__thumb-mini">
                          {campaignInitials(c.name)}
                        </span>
                        <span>
                          <strong>{c.name || 'Untitled'}</strong>
                          {c.subject ? <span className="mc-camp-table__subject">{c.subject}</span> : null}
                        </span>
                      </button>
                    </td>
                    <td>
                      <StatusBadge campaign={c} />
                    </td>
                    <td>
                      <span className="mc-camp-table__audience">
                        <PeopleIcon className="w-3.5 h-3.5" aria-hidden />
                        {audience}
                      </span>
                    </td>
                    <td>{campaignAnalyticsSummary(c)}</td>
                    <td className="mc-table__date">{formatEdited(c.updatedAt || c.createdAt)}</td>
                    <td className="mc-table__actions">
                      {canEdit ? (
                        <button type="button" className="mc-btn mc-btn--outline mc-btn--sm" onClick={() => onEdit?.(c)}>
                          Edit
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
                        <LayoutTemplateIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
