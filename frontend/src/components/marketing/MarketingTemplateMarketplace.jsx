import { useMemo, useState } from 'react'
import { STARTER_TEMPLATES, renderEmailCanvasHtml } from '../../lib/marketingEmailDesign'
import { TEMPLATE_CATEGORIES } from '../../lib/marketingExperience'
import { formatDateTime } from '../../lib/crmUiConstants'

function inferTemplateCategory(t) {
  if (t.category) return t.category
  const id = (t.id || '').toLowerCase()
  if (id.includes('welcome') || id.includes('onboard')) return 'welcome'
  if (id.includes('news') || id.includes('digest') || id.includes('newsletter')) return 'newsletter'
  if (id.includes('promo') || id.includes('sale') || id.includes('offer') || id.includes('trial')) return 'promo'
  if (id.includes('event') || id.includes('invite') || id.includes('workshop')) return 'event'
  if (id.includes('announce') || id.includes('product') || id.includes('thank')) return 'announcement'
  return 'popular'
}

function TemplatePreviewThumb({ blocks, design, accent }) {
  const html = useMemo(
    () => renderEmailCanvasHtml(blocks || [], design || {}, { preview: true }),
    [blocks, design]
  )
  return (
    <div className="mkt-thumb" style={{ background: accent || '#f8fafc' }}>
      <div
        className="mkt-thumb__preview"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

export default function MarketingTemplateMarketplace({
  templates = [],
  savedTemplates = [],
  onSelect,
  onCreateBlank,
  onOpenBrandKit,
  title = 'Template marketplace',
  subtitle,
}) {
  const defaultSubtitle = `Choose from ${STARTER_TEMPLATES.length}+ ready-made layouts — customize copy, images, and design`
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')

  const starterCount = STARTER_TEMPLATES.length

  const allItems = useMemo(() => {
    const starters = STARTER_TEMPLATES.map((t) => ({
      ...t,
      source: 'starter',
      category: inferTemplateCategory(t),
      usageCount: 0,
      openRate: null,
    }))
    const saved = (savedTemplates.length ? savedTemplates : templates).map((t) => ({
      ...t,
      source: 'saved',
      category: 'saved',
      usageCount: t.usageCount || 1,
      openRate: t.stats?.openRate,
      updatedAt: t.updatedAt,
    }))
    return [...starters, ...saved]
  }, [templates, savedTemplates])

  const filtered = useMemo(() => {
    let list = allItems
    if (category === 'recent') {
      list = [...savedTemplates].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    } else if (category !== 'all' && category !== 'popular') {
      list = list.filter((t) => t.category === category || t.id === category)
    } else if (category === 'popular') {
      list = list.filter((t) => t.source === 'starter')
    }
    const q = query.trim().toLowerCase()
    if (q) list = list.filter((t) => t.name?.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q))
    return list
  }, [allItems, category, query, savedTemplates])

  return (
    <div className="mkt-marketplace">
      <header className="mkt-marketplace__hero">
        <div>
          <h2 className="mkt-marketplace__title">{title}</h2>
          <p className="mkt-marketplace__sub">{subtitle || defaultSubtitle}</p>
        </div>
        <div className="mkt-marketplace__hero-actions">
          {onOpenBrandKit ? (
            <button type="button" className="mkt-btn mkt-btn--ghost" onClick={onOpenBrandKit}>
              Brand kit
            </button>
          ) : null}
          <button type="button" className="mkt-btn mkt-btn--primary" onClick={onCreateBlank}>
            Blank canvas
          </button>
        </div>
      </header>

      <div className="mkt-marketplace__toolbar">
        <input
          type="search"
          className="mkt-marketplace__search"
          placeholder="Search templates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mkt-marketplace__cats">
          {TEMPLATE_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`mkt-cat-pill${category === c.id ? ' is-active' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mkt-marketplace__count">
        {filtered.length} template{filtered.length === 1 ? '' : 's'}
        {category !== 'all' || query ? ` · ${starterCount} starters available` : ''}
      </p>

      <div className="mkt-marketplace__grid">
        {filtered.length === 0 ? (
          <div className="mkt-marketplace__empty">
            <p>No templates match your search.</p>
            <button type="button" className="mkt-btn mkt-btn--ghost" onClick={() => { setQuery(''); setCategory('all') }}>
              Clear filters
            </button>
          </div>
        ) : null}
        {filtered.map((tpl) => (
          <button
            key={`${tpl.source}-${tpl.id}`}
            type="button"
            className="mkt-template-card"
            onClick={() => onSelect?.(tpl)}
          >
            <TemplatePreviewThumb
              blocks={tpl.blocks}
              design={tpl.design}
              accent={tpl.design?.primaryColor ? `${tpl.design.primaryColor}18` : undefined}
            />
            <div className="mkt-template-card__body">
              <span className="mkt-template-card__name">{tpl.name}</span>
              <span className="mkt-template-card__meta">
                {tpl.source === 'saved' ? 'Your template' : 'Starter'}
                {tpl.category && tpl.category !== 'popular' ? ` · ${tpl.category}` : ''}
                {tpl.openRate != null ? ` · ${tpl.openRate}% opens` : ''}
                {tpl.usageCount ? ` · Used ${tpl.usageCount}×` : ''}
              </span>
              {tpl.updatedAt ? (
                <time className="mkt-template-card__time">{formatDateTime(tpl.updatedAt)}</time>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
