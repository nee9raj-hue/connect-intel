import { useMemo, useState } from 'react'
import { getStatusMeta } from '../../lib/crmConstants'
import FullScreenDetailModal from '../ui/FullScreenDetailModal'

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
    <div className="crm-filter-mobile-panel">
      {options.length > 6 ? (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="crm-input crm-filter-mobile-search text-sm"
        />
      ) : null}
      <ul className="crm-filter-mobile-list">
        <li>
          <button
            type="button"
            className={`crm-filter-mobile-option ${!values?.length ? 'is-selected' : ''}`}
            onClick={() => onChange([])}
          >
            {emptyLabel}
          </button>
        </li>
        {filtered.map((opt) => {
          const checked = (values || []).includes(opt.value)
          return (
            <li key={opt.value}>
              <label className={`crm-filter-mobile-check ${checked ? 'is-checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.value)}
                  className="crm-filter-check-input"
                />
                <span>{opt.label}</span>
              </label>
            </li>
          )
        })}
        {!filtered.length ? (
          <li className="crm-filter-mobile-empty">No matches</li>
        ) : null}
      </ul>
    </div>
  )
}

export function SingleSelectList({ options, value, onChange, emptyLabel, statusStyle = false }) {
  return (
    <ul className="crm-filter-mobile-list">
      <li>
        <button
          type="button"
          className={`crm-filter-mobile-option ${!value || value === 'all' || value === 'any' ? 'is-selected' : ''}`}
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
              className={`crm-filter-mobile-option ${selected ? 'is-selected' : ''}`}
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

/** Full-screen mobile/PWA sheet for a single pipeline filter (Contacts / Marketing lists pattern). */
export default function PipelineMobileFilterSheet({
  open,
  title,
  subtitle = null,
  onClose,
  onSave,
  children,
  saveLabel = 'Apply filters',
  narrow = false,
}) {
  return (
    <FullScreenDetailModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      ariaLabel={title}
      modalClassName={narrow ? 'crm-fullscreen-modal--filter-narrow' : ''}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <button type="button" className="crm-btn crm-btn-ghost shrink-0" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="crm-btn crm-btn-primary flex-1 min-h-[2.75rem]" onClick={onSave}>
            {saveLabel}
          </button>
        </div>
      }
    >
      <div className="crm-filter-mobile-body">{children}</div>
    </FullScreenDetailModal>
  )
}
