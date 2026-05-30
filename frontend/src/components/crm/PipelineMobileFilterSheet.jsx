import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { getStatusMeta } from '../../lib/crmConstants'

export function SearchableMultiList({ options, values, onChange, placeholder, emptyLabel }) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const toggle = (value) => {
    const set = new Set(values || [])
    if (set.has(value)) set.delete(value)
    else set.add(value)
    onChange([...set])
  }

  return (
    <div className="hs-pipeline-filters-sheet__list-wrap hs-pipeline-filter-sheet__list-wrap">
      {options.length > 6 ? (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="crm-filter-search-input hs-pipeline-filters-sheet__search"
        />
      ) : null}
      <ul className="hs-pipeline-filters-sheet__list hs-pipeline-filter-sheet__list">
        <li>
          <button
            type="button"
            className={`hs-pipeline-filters-sheet__option ${!values?.length ? 'is-selected' : ''}`}
            onClick={() => onChange([])}
          >
            {emptyLabel}
          </button>
        </li>
        {filtered.map((opt) => {
          const checked = (values || []).includes(opt.value)
          return (
            <li key={opt.value}>
              <label className={`crm-filter-check-row ${checked ? 'is-checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="crm-filter-check-input"
                />
                <span className="crm-filter-option-label">{opt.label}</span>
              </label>
            </li>
          )
        })}
        {!filtered.length ? (
          <li className="px-3 py-2 text-xs text-[#516f90]">No matches</li>
        ) : null}
      </ul>
    </div>
  )
}

export function SingleSelectList({ options, value, onChange, emptyLabel, statusStyle = false }) {
  return (
    <ul className="hs-pipeline-filters-sheet__list hs-pipeline-filter-sheet__list">
      <li>
        <button
          type="button"
          className={`hs-pipeline-filters-sheet__option ${!value || value === 'all' || value === 'any' ? 'is-selected' : ''}`}
          onClick={() => onChange('')}
        >
          {emptyLabel}
        </button>
      </li>
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <li key={opt.value}>
            <button
              type="button"
              className={`hs-pipeline-filters-sheet__option ${selected ? 'is-selected' : ''}`}
              onClick={() => onChange(opt.value)}
            >
              {statusStyle ? (
                <span className={`pipeline-hs-status ${getStatusMeta(opt.value).color}`}>{opt.label}</span>
              ) : (
                opt.label
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/** Full-screen mobile/PWA sheet for a single pipeline filter. */
export default function PipelineMobileFilterSheet({ open, title, onClose, onSave, children, saveLabel = 'Apply' }) {
  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <button type="button" className="hs-pipeline-filters-backdrop" aria-label="Close filter" onClick={onClose} />
      <div
        className="hs-pipeline-filters-sheet hs-pipeline-filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="hs-pipeline-filters-sheet__header">
          <h2 className="hs-pipeline-filters-sheet__title">{title}</h2>
          <button type="button" className="crm-filter-menu-sheet-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="hs-pipeline-filters-sheet__body hs-pipeline-filter-sheet__body">{children}</div>

        <footer className="hs-pipeline-filters-sheet__footer">
          <button type="button" className="crm-filter-action-btn is-primary" onClick={onSave}>
            {saveLabel}
          </button>
        </footer>
      </div>
    </>,
    document.body
  )
}
