import { useState } from 'react'
import { formatDateTime } from '../../lib/crmUiConstants'
import MarketingFeedsPanel from './MarketingFeedsPanel'

export default function MarketingAssetsHub({
  templates = [],
  feedsPanelProps,
  onOpenTemplate,
  onNavigate,
}) {
  const [subTab, setSubTab] = useState('templates')

  return (
    <div className="mhub-assets-page">
      <header className="mhub-assets-page__head">
        <div>
          <h2>Assets</h2>
          <p>Templates, feeds, and reusable creative</p>
        </div>
        <div className="mhub-subnav">
          <button
            type="button"
            className={`mhub-subnav__btn${subTab === 'templates' ? ' is-active' : ''}`}
            onClick={() => setSubTab('templates')}
          >
            Templates
          </button>
          <button
            type="button"
            className={`mhub-subnav__btn${subTab === 'feeds' ? ' is-active' : ''}`}
            onClick={() => setSubTab('feeds')}
          >
            RSS feeds
          </button>
        </div>
      </header>

      {subTab === 'templates' ? (
        <div className="mhub-template-gallery">
          {templates.length ? (
            templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                className="mhub-template-card"
                onClick={() => onOpenTemplate?.(tpl)}
              >
                <div className="mhub-template-card__thumb" aria-hidden>
                  <span className="mhub-template-card__glyph">✉</span>
                </div>
                <span className="mhub-template-card__name">{tpl.name}</span>
                <span className="mhub-template-card__meta">
                  {tpl.subject || 'No subject'} · {tpl.updatedAt ? formatDateTime(tpl.updatedAt) : '—'}
                </span>
                <span className="mhub-template-card__category">{tpl.category || 'Email'}</span>
              </button>
            ))
          ) : (
            <p className="mhub-empty">No templates yet.</p>
          )}
          <button
            type="button"
            className="mhub-template-card mhub-template-card--new"
            onClick={() => onNavigate?.('marketing', { tab: 'templates' })}
          >
            + New template
          </button>
        </div>
      ) : null}

      {subTab === 'feeds' && feedsPanelProps ? <MarketingFeedsPanel {...feedsPanelProps} /> : null}
    </div>
  )
}
