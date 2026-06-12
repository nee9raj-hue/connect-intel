import { useMemo, useState } from 'react'
import {
  DEFAULT_THEME,
  PREVIEW_LEAD,
  STARTER_TEMPLATES,
  renderEmailHtml,
} from '../../lib/marketingEmailDesign'
import { ChevronRightIcon, ListIcon, MailIcon, SearchIcon } from '../ui/icons'

const PAGE_SIZE = 10

const TABS = [
  { id: 'starter', label: 'Template gallery' },
  { id: 'saved', label: 'Saved' },
  { id: 'recent', label: 'Recently sent' },
]

const GALLERY_CATEGORY_META = {
  welcome: { label: 'WELCOME', color: '#0074bd' },
  newsletter: { label: 'MONTHLY UPDATE', color: '#0074bd' },
  announcement: { label: 'ANNOUNCEMENT', color: '#01866f' },
  promo: { label: 'PRODUCT UPDATE', color: '#844b9c' },
  event: { label: 'INVITATION', color: '#c84d3a' },
  popular: { label: 'FEATURED', color: '#6366f1' },
  saved: { label: 'YOUR TEMPLATE', color: '#6b7280' },
}

const NAME_CATEGORY_LABELS = [
  { match: 'product launch', label: 'PRODUCT UPDATE', color: '#844b9c' },
  { match: 'event invite', label: 'INVITATION', color: '#c84d3a' },
  { match: 're-engagement', label: 'RE-ENGAGEMENT', color: '#844b9c' },
  { match: 'case study', label: 'CASE STUDY', color: '#0074bd' },
  { match: 'webinar', label: 'WEBINAR', color: '#c84d3a' },
  { match: 'thank you', label: 'THANK YOU', color: '#01866f' },
  { match: 'pricing', label: 'SPECIAL OFFER', color: '#844b9c' },
  { match: 'testimonial', label: 'TESTIMONIAL', color: '#0074bd' },
  { match: 'seasonal', label: 'SEASONAL', color: '#c84d3a' },
  { match: 'follow-up', label: 'FOLLOW-UP', color: '#6b7280' },
]

function inferGalleryCategory(t) {
  if (t.category) return t.category
  const id = (t.id || '').toLowerCase()
  const name = (t.name || '').toLowerCase()
  if (id.includes('welcome') || name.includes('welcome')) return 'welcome'
  if (id.includes('news') || name.includes('newsletter')) return 'newsletter'
  if (id.includes('promo') || name.includes('launch') || name.includes('offer') || name.includes('pricing')) {
    return 'promo'
  }
  if (id.includes('event') || name.includes('invite') || name.includes('webinar')) return 'event'
  if (id.includes('announce') || name.includes('announce') || name.includes('thank') || name.includes('testimonial')) {
    return 'announcement'
  }
  return 'popular'
}

function galleryCategoryLabel(tpl) {
  const name = (tpl.name || '').toLowerCase()
  const named = NAME_CATEGORY_LABELS.find((row) => name.includes(row.match))
  if (named) return { label: named.label, color: named.color }
  const cat = tpl.source === 'saved' ? 'saved' : inferGalleryCategory(tpl)
  return GALLERY_CATEGORY_META[cat] || GALLERY_CATEGORY_META.popular
}

function GridViewIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="2" y="2" width="5" height="5" rx="0.5" />
      <rect x="9" y="2" width="5" height="5" rx="0.5" />
      <rect x="2" y="9" width="5" height="5" rx="0.5" />
      <rect x="9" y="9" width="5" height="5" rx="0.5" />
    </svg>
  )
}

function formatEdited(iso) {
  if (!iso) return { date: '—', time: '' }
  try {
    const d = new Date(iso)
    return {
      date: d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    }
  } catch {
    return { date: '—', time: '' }
  }
}

function editorName(tpl, user) {
  if (tpl.updatedByName || tpl.createdByName) return tpl.updatedByName || tpl.createdByName
  if (user?.firstName || user?.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  }
  return user?.email?.split('@')[0] || 'You'
}

function TemplateThumb({ blocks, design, className }) {
  const srcDoc = useMemo(
    () =>
      renderEmailHtml(blocks || [], design || DEFAULT_THEME, {
        previewText: '',
        lead: PREVIEW_LEAD,
      }),
    [blocks, design]
  )
  return (
    <div className={`mc-tpl-thumb${className ? ` ${className}` : ''}`}>
      <iframe title="Template preview" srcDoc={srcDoc} tabIndex={-1} />
    </div>
  )
}

function TemplateGalleryCard({ tpl, showCategory = true, onOpen }) {
  const srcDoc = useMemo(
    () =>
      renderEmailHtml(tpl.blocks || [], tpl.design || DEFAULT_THEME, {
        previewText: '',
        lead: PREVIEW_LEAD,
      }),
    [tpl.blocks, tpl.design]
  )
  const category = showCategory ? galleryCategoryLabel(tpl) : null

  return (
    <button
      type="button"
      className="mc-tpl-gallery-card"
      onClick={() => onOpen(tpl)}
    >
      <div className="mc-tpl-gallery-card__preview">
        {category ? (
          <span className="mc-tpl-gallery-card__cat" style={{ color: category.color }}>
            {category.label}
          </span>
        ) : null}
        <iframe title={`Preview ${tpl.name}`} srcDoc={srcDoc} tabIndex={-1} />
      </div>
      <div className="mc-tpl-gallery-card__body">
        <span className="mc-tpl-gallery-card__name">{tpl.name}</span>
        {tpl.subject ? <span className="mc-tpl-gallery-card__sub">{tpl.subject}</span> : null}
      </div>
    </button>
  )
}

export default function MarketingEmailTemplates({
  templates = [],
  user,
  onEdit,
  onCreateBlank,
  onCreateEmail,
  onSelectStarter,
}) {
  const [activeTab, setActiveTab] = useState('starter')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [view, setView] = useState('list')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(() => new Set())
  const [codeMenuOpen, setCodeMenuOpen] = useState(false)

  const starterItems = useMemo(
    () =>
      STARTER_TEMPLATES.map((t) => ({
        ...t,
        source: 'starter',
        status: 'Starter',
        category: inferGalleryCategory(t),
      })),
    []
  )

  const savedItems = useMemo(
    () =>
      templates.map((t) => ({
        ...t,
        source: 'saved',
        status: t.status || 'Draft',
      })),
    [templates]
  )

  const listForTab = useMemo(() => {
    if (activeTab === 'starter') return starterItems
    let list = [...savedItems]
    if (activeTab === 'recent') {
      list = list.filter((t) => t.updatedAt || t.createdAt)
    }
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (t) => t.name?.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      const ta = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const tb = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return sortBy === 'newest' ? tb - ta : ta - tb
    })
    return list
  }, [activeTab, starterItems, savedItems, query, sortBy])

  const totalPages = Math.max(1, Math.ceil(listForTab.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = listForTab.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const allSelected = pageItems.length > 0 && pageItems.every((t) => selected.has(t.id))

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    else setSelected(new Set(pageItems.map((t) => t.id)))
  }

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleTab = (id) => {
    setActiveTab(id)
    setPage(1)
    setQuery('')
    if (id === 'starter') setView('grid')
    else setView('list')
  }

  const openTemplate = (tpl) => {
    if (tpl.source === 'starter') onSelectStarter?.(tpl)
    else onEdit?.(tpl)
  }

  const rangeStart = listForTab.length ? (safePage - 1) * PAGE_SIZE + 1 : 0
  const rangeEnd = Math.min(safePage * PAGE_SIZE, listForTab.length)

  return (
    <div className="mc-page mc-templates-page">
      <header className="mc-templates-header">
        <h1 className="mc-templates-header__title">Email Templates</h1>
        <div className="mc-templates-header__actions">
          <div className="mc-templates-dropdown">
            <button
              type="button"
              className="mc-btn mc-btn--outline"
              onClick={() => setCodeMenuOpen((v) => !v)}
              aria-expanded={codeMenuOpen}
            >
              Code your own
              <ChevronRightIcon className="mc-templates-dropdown__caret" aria-hidden />
            </button>
            {codeMenuOpen ? (
              <div className="mc-templates-dropdown__menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCodeMenuOpen(false)
                    onCreateBlank?.()
                  }}
                >
                  Paste in code
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCodeMenuOpen(false)
                    onCreateBlank?.()
                  }}
                >
                  Plain text
                </button>
              </div>
            ) : null}
          </div>
          <button type="button" className="mc-btn mc-btn--outline mc-templates-create-scratch" onClick={onCreateBlank}>
            <MailIcon className="mc-templates-create-scratch__icon" />
            Create from scratch
          </button>
        </div>
      </header>

      <nav className="mc-templates-tabs" aria-label="Template sources">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`mc-templates-tabs__btn${activeTab === t.id ? ' is-active' : ''}`}
            onClick={() => handleTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {activeTab !== 'starter' ? (
        <div className="mc-templates-toolbar">
          <div className="mc-templates-search-wrap">
            <SearchIcon className="mc-templates-search-wrap__icon" />
            <input
              type="search"
              className="mc-input mc-templates-search"
              placeholder="Search saved templates"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <button type="button" className="mc-templates-filter">
            Format <strong>All</strong>
            <ChevronRightIcon className="mc-templates-filter__caret" aria-hidden />
          </button>
          <button type="button" className="mc-templates-filter">
            Folder <strong>All</strong>
            <ChevronRightIcon className="mc-templates-filter__caret" aria-hidden />
          </button>
          <div className="mc-templates-toolbar__right">
            <label className="mc-templates-sort">
              Sort by:
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="mc-templates-sort__select"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </select>
            </label>
            <div className="mc-templates-view-toggle" role="group" aria-label="Grid or list view">
              <button
                type="button"
                className={`mc-templates-view-btn${view === 'grid' ? ' is-active' : ''}`}
                onClick={() => setView('grid')}
                title="Grid view"
              >
                <GridViewIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                className={`mc-templates-view-btn${view === 'list' ? ' is-active' : ''}`}
                onClick={() => setView('list')}
                title="List view"
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mc-templates-starter-lead">
          Browse ready-made layouts — customize copy, images, and design in the editor.
        </p>
      )}

      {activeTab === 'starter' || view === 'grid' ? (
        <div className="mc-templates-grid">
          {(activeTab === 'starter' ? starterItems : listForTab).map((tpl) => (
            <TemplateGalleryCard
              key={`${tpl.source}-${tpl.id}`}
              tpl={tpl}
              showCategory={activeTab === 'starter'}
              onOpen={openTemplate}
            />
          ))}
          {!listForTab.length && activeTab !== 'starter' ? (
            <div className="mc-templates-empty-inline">
              <p>No saved templates yet.</p>
              <button type="button" className="mc-btn mc-btn--primary" onClick={onCreateBlank}>
                Create template
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mc-table-wrap mc-templates-table-wrap">
          <table className="mc-table mc-templates-table">
            <thead>
              <tr>
                <th className="mc-table__check">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
                <th className="mc-templates-table__preview-col">Preview</th>
                <th>Name</th>
                <th>Format</th>
                <th>Status</th>
                <th className="mc-templates-table__actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((tpl) => {
                const edited = formatEdited(tpl.updatedAt || tpl.createdAt)
                const by = editorName(tpl, user)
                return (
                  <tr key={tpl.id}>
                    <td className="mc-table__check">
                      <input
                        type="checkbox"
                        checked={selected.has(tpl.id)}
                        onChange={() => toggleOne(tpl.id)}
                        aria-label={`Select ${tpl.name}`}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mc-tpl-thumb-btn"
                        onClick={() => openTemplate(tpl)}
                        aria-label={`Preview ${tpl.name}`}
                      >
                        <TemplateThumb blocks={tpl.blocks} design={tpl.design} />
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="mc-templates-name-link"
                        onClick={() => openTemplate(tpl)}
                      >
                        {tpl.name || 'Untitled Template'}
                      </button>
                      <span className="mc-templates-name-meta">
                        Draft edited: {edited.date}
                        {edited.time ? ` ${edited.time}` : ''} by {by}
                      </span>
                    </td>
                    <td>
                      <span className="mc-templates-format">
                        <MailIcon className="mc-templates-format__icon" />
                        Marketing
                      </span>
                    </td>
                    <td>
                      <span className="mc-templates-status">{tpl.status || 'Draft'}</span>
                    </td>
                    <td>
                      <div className="mc-templates-action-split">
                        <button
                          type="button"
                          className="mc-templates-action-split__main"
                          onClick={() => onCreateEmail?.(tpl)}
                        >
                          Create email
                        </button>
                        <button
                          type="button"
                          className="mc-templates-action-split__menu"
                          aria-label="More actions"
                          onClick={() => openTemplate(tpl)}
                        >
                          <ChevronRightIcon className="rotate-90 w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!pageItems.length ? (
            <div className="mc-templates-empty-table">
              <p>No templates match your search.</p>
              <button type="button" className="mc-link" onClick={() => setQuery('')}>
                Clear search
              </button>
            </div>
          ) : null}
        </div>
      )}

      {activeTab !== 'starter' && view === 'list' && listForTab.length > 0 ? (
        <footer className="mc-templates-pagination">
          <span className="mc-templates-pagination__label">
            Showing results {rangeStart} – {rangeEnd} of {listForTab.length}
          </span>
          <div className="mc-templates-pagination__controls">
            <button
              type="button"
              className="mc-templates-page-btn"
              disabled={safePage <= 1}
              onClick={() => setPage(1)}
              aria-label="First page"
            >
              «
            </button>
            <button
              type="button"
              className="mc-templates-page-btn"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              ‹
            </button>
            <span className="mc-templates-page-num">{safePage}</span>
            <span className="mc-templates-page-of">of {totalPages}</span>
            <button
              type="button"
              className="mc-templates-page-btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              ›
            </button>
            <button
              type="button"
              className="mc-templates-page-btn"
              disabled={safePage >= totalPages}
              onClick={() => setPage(totalPages)}
              aria-label="Last page"
            >
              »
            </button>
          </div>
        </footer>
      ) : null}

      <section className="mc-templates-promo">
        <div>
          <h2 className="mc-templates-promo__title">Save time with saved templates</h2>
          <p className="mc-templates-promo__sub">
            Create a template once and reuse it for future campaigns.
          </p>
        </div>
        <button type="button" className="mc-btn mc-btn--outline" onClick={onCreateBlank}>
          Create template
        </button>
      </section>

      <button type="button" className="mc-feedback-tab" tabIndex={-1} aria-hidden>
        Feedback
      </button>
    </div>
  )
}
