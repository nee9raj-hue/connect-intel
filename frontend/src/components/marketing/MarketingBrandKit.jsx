import { useEffect, useState } from 'react'
import { DEFAULT_THEME } from '../../lib/marketingEmailDesign'

const STORAGE_KEY = 'ci-marketing-brand-kit'

export function loadBrandKit() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function mergeBrandKit(design = {}) {
  const kit = loadBrandKit()
  if (!kit) return design
  return {
    ...DEFAULT_THEME,
    ...design,
    primaryColor: kit.primaryColor || design.primaryColor,
    backgroundColor: kit.backgroundColor || design.backgroundColor,
    contentBackground: kit.contentBackground || design.contentBackground,
    fontFamily: kit.fontFamily || design.fontFamily,
    logoUrl: kit.logoUrl || design.logoUrl,
    footerText: kit.footerText || design.footerText,
    socialLinks: kit.socialLinks || design.socialLinks,
  }
}

export default function MarketingBrandKit({ open, onClose, onSave }) {
  const [kit, setKit] = useState({
    logoUrl: '',
    primaryColor: '#3730a3',
    backgroundColor: '#f4f6f8',
    contentBackground: '#ffffff',
    fontFamily: 'Helvetica, Arial, sans-serif',
    footerText: '© Your company · Unsubscribe',
    socialLinks: '',
    headerText: 'Your brand',
  })

  useEffect(() => {
    if (!open) return
    const saved = loadBrandKit()
    if (saved) setKit((p) => ({ ...p, ...saved }))
  }, [open])

  if (!open) return null

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(kit))
      onSave?.(kit)
      onClose?.()
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mkt-brandkit-overlay" role="dialog" aria-modal="true">
      <div className="mkt-brandkit">
        <header className="mkt-brandkit__head">
          <div>
            <h2>Brand kit</h2>
            <p>Logo, colors, and defaults reused across every email.</p>
          </div>
          <button type="button" className="mkt-btn mkt-btn--ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="mkt-brandkit__grid">
          <label className="mkt-field">
            <span>Logo URL</span>
            <input
              className="mkt-input"
              value={kit.logoUrl}
              onChange={(e) => setKit((p) => ({ ...p, logoUrl: e.target.value }))}
              placeholder="https://…"
            />
          </label>
          <label className="mkt-field">
            <span>Primary color</span>
            <input
              type="color"
              className="mkt-color"
              value={kit.primaryColor}
              onChange={(e) => setKit((p) => ({ ...p, primaryColor: e.target.value }))}
            />
          </label>
          <label className="mkt-field">
            <span>Background</span>
            <input
              type="color"
              className="mkt-color"
              value={kit.backgroundColor}
              onChange={(e) => setKit((p) => ({ ...p, backgroundColor: e.target.value }))}
            />
          </label>
          <label className="mkt-field">
            <span>Content background</span>
            <input
              type="color"
              className="mkt-color"
              value={kit.contentBackground}
              onChange={(e) => setKit((p) => ({ ...p, contentBackground: e.target.value }))}
            />
          </label>
          <label className="mkt-field mkt-field--full">
            <span>Font family</span>
            <input
              className="mkt-input"
              value={kit.fontFamily}
              onChange={(e) => setKit((p) => ({ ...p, fontFamily: e.target.value }))}
            />
          </label>
          <label className="mkt-field mkt-field--full">
            <span>Default footer</span>
            <textarea
              className="mkt-input"
              rows={2}
              value={kit.footerText}
              onChange={(e) => setKit((p) => ({ ...p, footerText: e.target.value }))}
            />
          </label>
          <label className="mkt-field mkt-field--full">
            <span>Social links (comma-separated URLs)</span>
            <input
              className="mkt-input"
              value={kit.socialLinks}
              onChange={(e) => setKit((p) => ({ ...p, socialLinks: e.target.value }))}
            />
          </label>
        </div>
        <footer className="mkt-brandkit__foot">
          <button type="button" className="mkt-btn mkt-btn--primary" onClick={persist}>
            Save brand kit
          </button>
        </footer>
      </div>
    </div>
  )
}
