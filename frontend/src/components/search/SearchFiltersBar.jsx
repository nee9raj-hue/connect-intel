import { useMemo, useState } from 'react'
import {
  getCitiesForStates,
  INDUSTRIES,
  INDIAN_STATES,
  isAllCitiesSelected,
  isAllStatesSelected,
  pruneCitiesForStates,
} from '../../lib/filterOptions'
import { SearchIcon } from '../ui/icons'

export default function SearchFiltersBar({
  filters,
  onChange,
  onSearch,
  loading,
  filtersExpanded = false,
  onToggleFilters,
}) {
  const stateOptions = INDIAN_STATES
  const cityOptions = useMemo(() => getCitiesForStates(filters.states), [filters.states])
  const allStatesExplicit = isAllStatesSelected(filters.states)
  const allCitiesExplicit = isAllCitiesSelected(filters.states, filters.cities)

  const activeCount =
    (filters.states?.length && !allStatesExplicit ? 1 : 0) +
    (filters.cities?.length && !allCitiesExplicit ? 1 : 0) +
    (filters.industries?.length || 0)

  const toggle = (key, value) => {
    const current = filters[key] || []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onChange({ ...filters, [key]: next })
  }

  const changeStates = (nextStates) => {
    onChange({
      ...filters,
      states: nextStates,
      cities: pruneCitiesForStates(nextStates, filters.cities),
    })
  }

  const toggleAllStates = () => {
    if (allStatesExplicit) {
      changeStates([])
      return
    }
    changeStates([...INDIAN_STATES])
  }

  const toggleAllCities = () => {
    const all = getCitiesForStates(filters.states)
    if (allCitiesExplicit) {
      onChange({ ...filters, cities: [] })
      return
    }
    onChange({ ...filters, cities: [...all] })
  }

  const clearFilters = () => {
    onChange({
      ...filters,
      states: [],
      cities: [],
      industries: [],
      companySizes: [],
    })
  }

  const stateHint = !filters.states?.length
    ? 'All India'
    : allStatesExplicit
      ? `All ${stateOptions.length} states`
      : `${filters.states.length} selected`

  const cityHint = !filters.cities?.length
    ? 'All cities'
    : allCitiesExplicit
      ? `All ${cityOptions.length} cities`
      : `${filters.cities.length} selected`

  return (
    <div className="crm-toolbar crm-toolbar--compact crm-search-toolbar space-y-2">
      <div className="crm-toolbar-primary">
        <div className="crm-search-wrap !max-w-none">
          <SearchIcon className="crm-search-icon" />
          <label className="sr-only">What are you looking for?</label>
          <input
            type="text"
            placeholder='Try: "textile exporters in Ludhiana, Punjab" or "food manufacturers in Surat"'
            value={filters.keywords}
            onChange={(e) => onChange({ ...filters, keywords: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            className="crm-search-input"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={onSearch}
            disabled={loading}
            className="crm-btn crm-btn-primary min-w-[104px]"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          {onToggleFilters && (
            <button
              type="button"
              onClick={onToggleFilters}
              className={`crm-btn ${filtersExpanded ? 'crm-btn-ghost is-active' : 'crm-btn-secondary'}`}
            >
              {filtersExpanded ? 'Hide filters' : 'Location & industry'}
              {activeCount > 0 && !filtersExpanded ? <span className="ml-1">({activeCount})</span> : null}
            </button>
          )}
          {activeCount > 0 && filtersExpanded && (
            <button type="button" onClick={clearFilters} className="crm-link-btn crm-link-btn--sm">
              Clear
            </button>
          )}
        </div>
      </div>

      {filtersExpanded && (
        <div className="crm-advanced-panel crm-search-advanced">
          <div className="crm-filter-matrix">
            <MultiSelectField
              label="State"
              hint={stateHint}
              searchPlaceholder="Search states…"
              options={stateOptions}
              selected={filters.states || []}
              onSelectAll={toggleAllStates}
              onToggle={(val) => {
                const current = filters.states || []
                const next = current.includes(val)
                  ? current.filter((s) => s !== val)
                  : [...current, val]
                changeStates(next)
              }}
            />
            <MultiSelectField
              label="City"
              hint={cityHint}
              searchPlaceholder="Search cities…"
              options={cityOptions}
              selected={filters.cities || []}
              onSelectAll={toggleAllCities}
              onToggle={(val) => toggle('cities', val)}
            />
            <MultiSelectField
              label="Industry"
              hint="Optional"
              searchPlaceholder="Search industries…"
              options={INDUSTRIES}
              selected={filters.industries || []}
              onSelectAll={() => {
                if ((filters.industries || []).length === INDUSTRIES.length) {
                  onChange({ ...filters, industries: [] })
                } else {
                  onChange({ ...filters, industries: [...INDUSTRIES] })
                }
              }}
              onToggle={(val) => toggle('industries', val)}
            />
          </div>
        </div>
      )}

      {filtersExpanded &&
      (filters.states?.length || filters.cities?.length || filters.industries?.length) > 0 ? (
        <div className="crm-active-filters pt-1">
          {!allStatesExplicit &&
            (filters.states || []).map((value) => (
              <Chip key={`s-${value}`} label={value} onRemove={() => changeStates(filters.states.filter((s) => s !== value))} />
            ))}
          {allStatesExplicit && filters.states?.length > 0 && (
            <Chip label="All states" onRemove={() => changeStates([])} />
          )}
          {!allCitiesExplicit &&
            (filters.cities || []).map((value) => (
              <Chip key={`c-${value}`} label={value} onRemove={() => toggle('cities', value)} />
            ))}
          {allCitiesExplicit && filters.cities?.length > 0 && (
            <Chip label="All cities" onRemove={() => onChange({ ...filters, cities: [] })} />
          )}
          {(filters.industries || []).map((value) => (
            <Chip key={`i-${value}`} label={value} onRemove={() => toggle('industries', value)} />
          ))}
        </div>
      ) : null}

      {!filtersExpanded && activeCount > 0 && (
        <p className="text-[11px] text-[#647185]">
          {stateHint} · {cityHint}
          {filters.industries?.length ? ` · ${filters.industries.length} industries` : ''}
        </p>
      )}
    </div>
  )
}

function MultiSelectField({
  label,
  hint,
  searchPlaceholder,
  options,
  selected,
  onToggle,
  onSelectAll,
}) {
  const [query, setQuery] = useState('')
  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return options
    return options.filter((option) => option.toLowerCase().includes(trimmed))
  }, [options, query])

  const allSelected =
    options.length > 0 && selected.length === options.length && options.every((option) => selected.includes(option))
  const someSelected = selected.length > 0 && !allSelected

  return (
    <div className="crm-filter-card">
      <div className="crm-filter-card-head">
        <label className="crm-filter-card-label">{label}</label>
        <span className="crm-filter-card-hint">{hint}</span>
      </div>
      <div className="crm-filter-card-box">
        <div className="crm-filter-card-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="crm-filter-search-input"
          />
          <label className="crm-filter-bulk-toggle">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(element) => {
                if (element) element.indeterminate = someSelected
              }}
              onChange={onSelectAll}
              className="rounded border-gray-300 text-gray-900"
            />
            <span>Select all{query.trim() ? ` (${filteredOptions.length} shown)` : ` (${options.length})`}</span>
          </label>
        </div>
        <div className="crm-filter-card-options">
          {filteredOptions.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-gray-500 text-center">No matches</p>
          ) : (
            filteredOptions.map((option) => (
              <label key={option} className={`crm-filter-check ${selected.includes(option) ? 'is-checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => onToggle(option)}
                  className="rounded border-gray-300 text-gray-900"
                />
                <span className="truncate" title={option}>
                  {option}
                </span>
              </label>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function Chip({ label, onRemove }) {
  return (
    <span className="crm-filter-chip">
      <span>{label}</span>
      <button type="button" onClick={onRemove} className="crm-filter-chip-x" aria-label={`Remove ${label}`}>
        ×
      </button>
    </span>
  )
}
