import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { CONTACT_FILTER_OPTIONS, DEFAULT_PIPELINE_FILTERS } from '../../lib/pipelineFilters'
import FilterDropdown, { FilterChipButton } from './FilterDropdown'

const SMART_TAG_OPTIONS = [
  { id: 'not_touched', label: 'Not touched' },
  { id: 'hot_score', label: 'Hot (Score 70+)' },
]

export default function PipelineFiltersBar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  appliedFilters = DEFAULT_PIPELINE_FILTERS,
  appliedSearch = '',
  filtersDirty = false,
  onApplyFilters,
  applying = false,
  cities = [],
  states = [],
  statusFilter = 'all',
  onStatusFilterChange,
  statusOptions = [],
  resultCount = 0,
  totalCount = 0,
  pipelineTotal = 0,
  onSelectAllFiltered,
  hasActiveFilters = false,
  onClearFilters,
  onApplySmartView,
  activeSmartViewId,
  orgLeadTags = [],
  stageListMode = false,
  onRemoveAppliedFilter,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [savedViews, setSavedViews] = useState([])
  const set = (patch) => onFiltersChange({ ...filters, ...patch })

  const loadViews = useCallback(async () => {
    try {
      const data = await api.getPipelineSavedViews()
      setSavedViews(data.views || [])
    } catch {
      setSavedViews([])
    }
  }, [])

  useEffect(() => {
    loadViews()
  }, [loadViews])

  const toggleTagFilter = (tagId) => {
    const current = filters.tagIds || []
    const next = current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    set({ tagIds: next })
  }

  const handleApply = () => onApplyFilters?.()

  const cityOptions = cities.map((c) => ({ label: c, value: c }))
  const stateOptions = states.map((s) => ({ label: s, value: s }))
  const stageOptions = statusOptions.map((s) => ({ label: s.label, value: s.id }))
  const contactOptions = CONTACT_FILTER_OPTIONS.filter((o) => o.id !== 'any').map((o) => ({
    label: o.label,
    value: o.id,
  }))

  const activeFilterCount =
    (appliedFilters.city ? 1 : 0) +
    (appliedFilters.state ? 1 : 0) +
    (appliedFilters.contact && appliedFilters.contact !== 'any' ? 1 : 0) +
    (appliedFilters.tagIds?.length ? 1 : 0) +
    (appliedFilters.smartTags?.length ? 1 : 0) +
    (statusFilter && statusFilter !== 'all' ? 1 : 0) +
    (appliedSearch ? 1 : 0)

  const countLabel =
    pipelineTotal > totalCount
      ? `${resultCount.toLocaleString()} of ${totalCount.toLocaleString()} · ${pipelineTotal.toLocaleString()} total`
      : `${resultCount.toLocaleString()} lead${resultCount !== 1 ? 's' : ''}`

  return (
    <div className="crm-toolbar">
      {/* Row 1 — search (HubSpot-style) */}
      <div className="crm-toolbar-row">
        <div className="crm-search-wrap">
          <svg className="crm-search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M8.5 3a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 8.5a6.5 6.5 0 1111.436 4.23l3.07 3.07a.75.75 0 11-1.06 1.06l-3.07-3.07A6.5 6.5 0 012 8.5z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleApply()
              }
            }}
            placeholder="Search name, email, phone, company, city…"
            className="crm-search-input"
            aria-label="Search pipeline"
          />
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={applying}
          className={`crm-btn ${filtersDirty ? 'crm-btn-primary' : 'crm-btn-secondary'}`}
        >
          {applying ? 'Searching…' : 'Search'}
        </button>
        {resultCount > 0 && (
          <button type="button" onClick={onSelectAllFiltered} className="crm-btn crm-btn-ghost hidden sm:inline-flex">
            Select all
          </button>
        )}
      </div>

      {/* Row 2 — filter dropdowns */}
      <div className="crm-toolbar-filters">
        {!stageListMode && (
          <FilterDropdown
            label="Stage"
            value={statusFilter !== 'all' ? statusFilter : ''}
            displayValue={statusOptions.find((s) => s.id === statusFilter)?.label}
            options={stageOptions}
            onChange={(v) => onStatusFilterChange?.(v || 'all')}
            emptyLabel="All stages"
          />
        )}
        <FilterDropdown
          label="City"
          value={filters.city}
          options={cityOptions}
          onChange={(v) => set({ city: v })}
          searchable
          placeholder="Search cities…"
          emptyLabel="All cities"
        />
        <FilterDropdown
          label="State"
          value={filters.state}
          options={stateOptions}
          onChange={(v) => set({ state: v })}
          searchable
          placeholder="Search states…"
          emptyLabel="All states"
        />
        <FilterDropdown
          label="Contact"
          value={filters.contact !== 'any' ? filters.contact : ''}
          displayValue={CONTACT_FILTER_OPTIONS.find((o) => o.id === filters.contact)?.label}
          options={contactOptions}
          onChange={(v) => set({ contact: v || 'any' })}
          emptyLabel="All contacts"
        />

        {activeFilterCount > 0 && (
          <button type="button" onClick={onClearFilters} className="crm-link-btn">
            Clear all
          </button>
        )}
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="crm-link-btn ml-auto"
        >
          {advancedOpen ? 'Hide filters' : 'More filters'}
        </button>
      </div>

      {/* Active filter chips */}
      {(appliedSearch || appliedFilters.city || appliedFilters.state) && (
        <div className="crm-active-filters">
          {appliedSearch && (
            <FilterChipButton
              label={`Search: ${appliedSearch}`}
              onRemove={() => onRemoveAppliedFilter?.({ search: '' })}
            />
          )}
          {appliedFilters.city && (
            <FilterChipButton
              label={`City: ${appliedFilters.city}`}
              onRemove={() => onRemoveAppliedFilter?.({ city: '' })}
            />
          )}
          {appliedFilters.state && (
            <FilterChipButton
              label={`State: ${appliedFilters.state}`}
              onRemove={() => onRemoveAppliedFilter?.({ state: '' })}
            />
          )}
        </div>
      )}

      {/* Advanced panel */}
      {advancedOpen && (
        <div className="crm-advanced-panel">
          {savedViews.length > 0 && (
            <div>
              <p className="crm-advanced-label">Saved views</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {savedViews.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onApplySmartView?.(v)}
                    className={`crm-pill ${activeSmartViewId === v.id ? 'crm-pill-active' : ''}`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {orgLeadTags.length > 0 && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="crm-advanced-label">Lead tags</p>
                <select
                  value={filters.tagMode || 'any'}
                  onChange={(e) => set({ tagMode: e.target.value })}
                  className="crm-select-sm"
                >
                  <option value="any">Match any</option>
                  <option value="all">Match all</option>
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {orgLeadTags.map((tag) => {
                  const active = (filters.tagIds || []).includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTagFilter(tag.id)}
                      className={`crm-pill ${active ? 'crm-pill-active' : ''}`}
                      style={active ? { backgroundColor: tag.color, borderColor: tag.color, color: '#fff' } : undefined}
                    >
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <p className="crm-advanced-label">Smart filters</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {SMART_TAG_OPTIONS.map((opt) => {
                const active = (filters.smartTags || []).includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      const current = filters.smartTags || []
                      const next = current.includes(opt.id)
                        ? current.filter((id) => id !== opt.id)
                        : [...current, opt.id]
                      set({ smartTags: next })
                    }}
                    className={`crm-pill ${active ? 'crm-pill-active' : ''}`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <button type="button" onClick={handleApply} disabled={applying} className="crm-btn crm-btn-primary">
            {applying ? 'Applying…' : 'Apply filters'}
          </button>
        </div>
      )}

      {/* Footer status bar */}
      <div className="crm-toolbar-footer">
        <span className="crm-toolbar-count">{countLabel}</span>
        {hasActiveFilters && !activeFilterCount && (
          <button type="button" onClick={onClearFilters} className="crm-link-btn">
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}

export { DEFAULT_PIPELINE_FILTERS }
