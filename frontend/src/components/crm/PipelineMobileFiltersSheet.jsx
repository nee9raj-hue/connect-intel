import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { getStatusMeta } from '../../lib/crmConstants'
import { CONTACT_FILTER_OPTIONS } from '../../lib/pipelineFilters'

function FilterSection({ title, action = null, children }) {
  return (
    <section className="hs-pipeline-filters-sheet__section">
      <div className="hs-pipeline-filters-sheet__section-head">
        <p className="hs-advanced-filter-label mb-0">{title}</p>
        {action}
      </div>
      {children}
    </section>
  )
}

function SearchableMultiList({ options, values, onChange, placeholder, emptyLabel }) {
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
    <div className="hs-pipeline-filters-sheet__list-wrap">
      {options.length > 6 ? (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="crm-filter-search-input hs-pipeline-filters-sheet__search"
        />
      ) : null}
      <ul className="hs-pipeline-filters-sheet__list">
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

function SingleSelectList({ options, value, onChange, emptyLabel, statusStyle = false }) {
  return (
    <ul className="hs-pipeline-filters-sheet__list">
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

export default function PipelineMobileFiltersSheet({
  open,
  onClose,
  onApply,
  onClear,
  draft,
  onDraftChange,
  stageListMode = false,
  statusOptions = [],
  cities = [],
  states = [],
  orgLeadTags = [],
  savedViews = [],
  onApplySmartView,
  activeSmartViewId,
  smartOptions = [],
}) {
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

  const setFilters = (patch) => {
    onDraftChange?.({
      ...draft,
      filters: { ...draft.filters, ...patch },
    })
  }

  const setStatus = (statusId) => {
    onDraftChange?.({
      ...draft,
      statusFilter: statusId || 'all',
    })
  }

  if (!open || !draft) return null

  const cityOptions = cities.map((c) => ({ label: c, value: c }))
  const stateOptions = states.map((s) => ({ label: s, value: s }))
  const contactOptions = CONTACT_FILTER_OPTIONS.filter((o) => o.id !== 'any').map((o) => ({
    label: o.label,
    value: o.id,
  }))
  const tagOptions = orgLeadTags.map((t) => ({ label: t.name, value: t.id }))
  const savedViewOptions = savedViews.map((v) => ({ label: v.name, value: v.id }))

  return createPortal(
    <>
      <button type="button" className="ci-filter-menu-backdrop" aria-label="Close filters" onClick={onClose} />
      <div className="hs-pipeline-filters-sheet" role="dialog" aria-modal="true" aria-label="Lead filters">
        <header className="hs-pipeline-filters-sheet__header">
          <h2 className="hs-pipeline-filters-sheet__title">Filters</h2>
          <button type="button" className="crm-filter-menu-sheet-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="hs-pipeline-filters-sheet__body">
          {savedViews.length > 0 ? (
            <FilterSection title="Saved views">
              <SingleSelectList
                options={savedViewOptions}
                value={activeSmartViewId || ''}
                emptyLabel="None"
                onChange={(viewId) => {
                  const view = savedViews.find((v) => v.id === viewId)
                  if (view) onApplySmartView?.(view)
                }}
              />
            </FilterSection>
          ) : null}

          {!stageListMode ? (
            <FilterSection title="Lead status">
              <SingleSelectList
                statusStyle
                options={statusOptions.map((s) => ({ label: s.label, value: s.id }))}
                value={draft.statusFilter !== 'all' ? draft.statusFilter : ''}
                emptyLabel="All statuses"
                onChange={setStatus}
              />
            </FilterSection>
          ) : null}

          <FilterSection title="City">
            <SearchableMultiList
              options={cityOptions}
              values={draft.filters.cities || []}
              onChange={(v) => setFilters({ cities: v })}
              placeholder="Search cities…"
              emptyLabel="All cities"
            />
          </FilterSection>

          <FilterSection title="State">
            <SearchableMultiList
              options={stateOptions}
              values={draft.filters.states || []}
              onChange={(v) => setFilters({ states: v })}
              placeholder="Search states…"
              emptyLabel="All states"
            />
          </FilterSection>

          <FilterSection title="Contact">
            <SingleSelectList
              options={contactOptions}
              value={draft.filters.contact !== 'any' ? draft.filters.contact : ''}
              emptyLabel="All contacts"
              onChange={(v) => setFilters({ contact: v || 'any' })}
            />
          </FilterSection>

          {orgLeadTags.length > 0 ? (
            <FilterSection
              title="Tags"
              action={
                <select
                  value={draft.filters.tagMode || 'any'}
                  onChange={(e) => setFilters({ tagMode: e.target.value })}
                  className="crm-select-sm crm-select-sm--hubspot"
                >
                  <option value="any">Any</option>
                  <option value="all">All</option>
                </select>
              }
            >
              <SearchableMultiList
                options={tagOptions}
                values={draft.filters.tagIds || []}
                onChange={(v) => setFilters({ tagIds: v })}
                placeholder="Search tags…"
                emptyLabel="Any tag"
              />
            </FilterSection>
          ) : null}

          <FilterSection title="Smart">
            <SearchableMultiList
              options={smartOptions}
              values={draft.filters.smartTags || []}
              onChange={(v) => setFilters({ smartTags: v })}
              placeholder="Search…"
              emptyLabel="Any"
            />
          </FilterSection>
        </div>

        <footer className="hs-pipeline-filters-sheet__footer">
          <button type="button" className="crm-filter-link-btn" onClick={onClear}>
            Clear all
          </button>
          <button type="button" className="crm-filter-action-btn is-primary" onClick={onApply}>
            Apply filters
          </button>
        </footer>
      </div>
    </>,
    document.body
  )
}
