import { useMemo, useState } from 'react'
import {
  getCitiesForStates,
  INDUSTRIES,
  INDIAN_STATES,
  isAllCitiesSelected,
  isAllStatesSelected,
  pruneCitiesForStates,
} from '../../lib/filterOptions'

export default function SearchFiltersBar({ filters, onChange, onSearch, loading }) {
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

  const changeStates = (nextStates) => {
    onChange({
      ...filters,
      states: nextStates,
      cities: pruneCitiesForStates(nextStates, filters.cities),
    })
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
    <div className="shrink-0 bg-white border-b border-gray-200 px-5 py-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="e.g. exporter, textile, pharma, company name…"
            value={filters.keywords}
            onChange={(e) => onChange({ ...filters, keywords: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ffcb2b]/50 focus:border-[#ffcb2b]"
          />
        </div>
        <div className="flex items-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onSearch}
            disabled={loading}
            className="px-5 py-2.5 bg-[#ffcb2b] hover:bg-[#f0bc00] text-[#242424] text-sm font-semibold rounded-lg disabled:opacity-60 min-w-[100px]"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-gray-500 -mt-1">
        Leave state and city unchecked for all India. Use search inside each list to find a name quickly.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
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

      {(filters.states?.length || filters.cities?.length || filters.industries?.length) > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {!allStatesExplicit &&
            (filters.states || []).map((v) => (
              <Chip key={`s-${v}`} label={v} onRemove={() => changeStates(filters.states.filter((s) => s !== v))} />
            ))}
          {allStatesExplicit && filters.states?.length > 0 && (
            <Chip label="All states" onRemove={() => changeStates([])} />
          )}
          {!allCitiesExplicit &&
            (filters.cities || []).map((v) => (
              <Chip key={`c-${v}`} label={v} onRemove={() => toggle('cities', v)} />
            ))}
          {allCitiesExplicit && filters.cities?.length > 0 && (
            <Chip label="All cities" onRemove={() => onChange({ ...filters, cities: [] })} />
          )}
          {(filters.industries || []).map((v) => (
            <Chip key={`i-${v}`} label={v} onRemove={() => toggle('industries', v)} />
          ))}
        </div>
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
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.toLowerCase().includes(q))
  }, [options, query])

  const allSelected =
    options.length > 0 && selected.length === options.length && options.every((o) => selected.includes(o))

  const someSelected = selected.length > 0 && !allSelected

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</label>
        <span className="text-[10px] text-gray-400">{hint}</span>
      </div>
      <div className="border border-gray-200 rounded-lg bg-gray-50/80 overflow-hidden">
        <div className="p-1.5 border-b border-gray-200 bg-white sticky top-0 z-20 space-y-1.5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full px-2 py-1.5 text-[13px] border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#ffcb2b]/50 focus:border-[#ffcb2b]"
          />
          <label className="flex items-center gap-2 px-2 py-1 rounded bg-[#fffbeb] border border-[#ffe48a] cursor-pointer text-[13px] font-semibold text-[#5b4a00]">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected
              }}
              onChange={onSelectAll}
              className="rounded border-gray-300 text-gray-900 focus:ring-[#ffcb2b]"
            />
            <span>Select all{query.trim() ? ` (${filteredOptions.length} shown)` : ` (${options.length})`}</span>
          </label>
        </div>
        <div className="max-h-[200px] overflow-y-auto p-1.5">
          {filteredOptions.length === 0 ? (
            <p className="px-2 py-3 text-[12px] text-gray-500 text-center">No matches</p>
          ) : (
            filteredOptions.map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white cursor-pointer text-[13px] text-gray-700"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => onToggle(opt)}
                  className="rounded border-gray-300 text-gray-900 focus:ring-[#ffcb2b]"
                />
                <span className="truncate" title={opt}>
                  {opt}
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
    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full border border-gray-200">
      {label}
      <button type="button" onClick={onRemove} className="text-gray-400 hover:text-gray-700" aria-label="Remove">
        ×
      </button>
    </span>
  )
}
