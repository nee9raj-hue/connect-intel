import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * HubSpot-style filter control: text button + popover with optional search.
 */
export default function FilterDropdown({
  label,
  value,
  displayValue,
  options = [],
  onChange,
  searchable = false,
  placeholder = 'Search…',
  emptyLabel = 'Any',
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const active = Boolean(value)
  const shown = displayValue || value || emptyLabel

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`crm-filter-btn ${active ? 'crm-filter-btn-active' : ''}`}
        aria-expanded={open}
      >
        <span className="truncate max-w-[140px]">
          {label}
          {active ? `: ${shown}` : ''}
        </span>
        <svg className="crm-filter-chevron" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M4.5 6l3.5 3.5L11.5 6H4.5z" />
        </svg>
      </button>

      {open && (
        <div className="crm-filter-menu" role="listbox">
          {searchable && (
            <div className="crm-filter-menu-search">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="crm-filter-search-input"
                autoFocus
              />
            </div>
          )}
          <ul className="crm-filter-menu-list">
            <li>
              <button
                type="button"
                className={`crm-filter-option ${!value ? 'is-selected' : ''}`}
                onClick={() => {
                  onChange('')
                  setOpen(false)
                  setQuery('')
                }}
              >
                <span className="crm-filter-option-label">{emptyLabel}</span>
              </button>
            </li>
            {filtered.map((opt) => (
              <li key={opt.id ?? opt.value ?? opt.label}>
                <button
                  type="button"
                  className={`crm-filter-option ${value === (opt.value ?? opt.label) ? 'is-selected' : ''}`}
                  onClick={() => {
                    onChange(opt.value ?? opt.label)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <span className="crm-filter-option-label">{opt.label}</span>
                  {opt.sublabel ? (
                    <span className="crm-filter-option-sublabel">{opt.sublabel}</span>
                  ) : null}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-slate-500">No matches</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

export function FilterChipButton({ label, onRemove }) {
  return (
    <span className="crm-filter-chip">
      <span>{label}</span>
      <button type="button" onClick={onRemove} className="crm-filter-chip-x" aria-label="Remove filter">
        ×
      </button>
    </span>
  )
}
