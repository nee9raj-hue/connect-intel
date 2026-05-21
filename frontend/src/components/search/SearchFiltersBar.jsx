import { useMemo } from 'react'
import {
  getCitiesForStates,
  INDUSTRIES,
  INDIAN_STATES,
  JOB_TITLES,
  pruneCitiesForStates,
} from '../../lib/filterOptions'

export default function SearchFiltersBar({ filters, onChange, onSearch, loading }) {
  const cityOptions = useMemo(() => getCitiesForStates(filters.states), [filters.states])
  const hasStates = filters.states?.length > 0

  const activeCount =
    (filters.jobTitles?.length || 0) +
    (filters.states?.length || 0) +
    (filters.cities?.length || 0) +
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

  const clearFilters = () => {
    onChange({
      ...filters,
      jobTitles: [],
      states: [],
      cities: [],
      industries: [],
      companySizes: [],
    })
  }

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
        Add designation and location below to narrow results. All selected filters must match.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <MultiSelectField
          label="Designation / role"
          hint="Multi-select"
          options={JOB_TITLES}
          selected={filters.jobTitles || []}
          onToggle={(val) => toggle('jobTitles', val)}
        />
        <MultiSelectField
          label="State"
          hint="Multi-select"
          options={INDIAN_STATES}
          selected={filters.states || []}
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
          hint={hasStates ? 'Filtered by state' : 'Select state first'}
          options={cityOptions}
          selected={filters.cities || []}
          onToggle={(val) => toggle('cities', val)}
          disabled={!hasStates}
          emptyMessage={hasStates ? 'No cities for selected states' : 'Select one or more states'}
        />
        <MultiSelectField
          label="Industry"
          hint="Optional"
          options={INDUSTRIES}
          selected={filters.industries || []}
          onToggle={(val) => toggle('industries', val)}
        />
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(filters.jobTitles || []).map((v) => (
            <Chip key={`t-${v}`} label={v} onRemove={() => toggle('jobTitles', v)} />
          ))}
          {(filters.states || []).map((v) => (
            <Chip key={`s-${v}`} label={v} onRemove={() => changeStates(filters.states.filter((s) => s !== v))} />
          ))}
          {(filters.cities || []).map((v) => (
            <Chip key={`c-${v}`} label={v} onRemove={() => toggle('cities', v)} />
          ))}
          {(filters.industries || []).map((v) => (
            <Chip key={`i-${v}`} label={v} onRemove={() => toggle('industries', v)} />
          ))}
        </div>
      )}
    </div>
  )
}

function MultiSelectField({ label, hint, options, selected, onToggle, disabled, emptyMessage }) {
  return (
    <div className={disabled ? 'opacity-60' : ''}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</label>
        <span className="text-[10px] text-gray-400">{hint}</span>
      </div>
      <div
        className={`border border-gray-200 rounded-lg bg-gray-50/80 max-h-[120px] overflow-y-auto p-1.5 ${
          disabled ? 'pointer-events-none' : ''
        }`}
      >
        {!options.length ? (
          <p className="text-xs text-gray-400 px-2 py-3 text-center">{emptyMessage || 'No options'}</p>
        ) : (
          options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white cursor-pointer text-[13px] text-gray-700"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onToggle(opt)}
                disabled={disabled}
                className="rounded border-gray-300 text-gray-900 focus:ring-[#ffcb2b]"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))
        )}
      </div>
      {selected.length > 0 && (
        <p className="text-[10px] text-[#8a6600] mt-1 font-medium">{selected.length} selected</p>
      )}
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
