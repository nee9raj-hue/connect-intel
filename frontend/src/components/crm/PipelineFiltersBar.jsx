import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { CONTACT_FILTER_OPTIONS, DEFAULT_PIPELINE_FILTERS } from '../../lib/pipelineFilters'

function FilterChip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
        active ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

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
  selectableCount = 0,
  hasActiveFilters = false,
  onClearFilters,
  onApplySmartView,
  activeSmartViewId,
  orgLeadTags = [],
  compact = false,
}) {
  const [expanded, setExpanded] = useState(false)
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

  const activeRefineCount =
    (appliedFilters.city ? 1 : 0) +
    (appliedFilters.state ? 1 : 0) +
    (appliedFilters.contact && appliedFilters.contact !== 'any' ? 1 : 0) +
    (appliedFilters.tagIds?.length ? 1 : 0) +
    (appliedFilters.smartTags?.length ? 1 : 0) +
    (statusFilter && statusFilter !== 'all' ? 1 : 0) +
    (appliedSearch ? 1 : 0)

  const showExpandHint = hasActiveFilters || activeRefineCount > 0

  const handleApply = () => {
    onApplyFilters?.()
  }

  const appliedLocationLabel = [appliedFilters.city, appliedFilters.state].filter(Boolean).join(', ')

  return (
    <div className={`border-t border-gray-100 ${compact ? 'mt-2 pt-2' : 'mt-3 pt-3'}`}>
      <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
        <div className="relative flex-1 min-w-[120px]">
          <span
            className={`absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none ${
              compact ? 'text-xs' : 'text-sm'
            }`}
          >
            ⌕
          </span>
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
            placeholder={compact ? 'Search…' : 'Name, email, phone, company, city…'}
            className={`w-full border border-gray-200 rounded-lg pl-7 pr-2 bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 ${
              compact ? 'text-xs py-1' : 'text-sm py-1.5 pl-8 pr-3'
            }`}
            aria-label="Search pipeline"
          />
        </div>

        <button
          type="button"
          onClick={handleApply}
          disabled={applying}
          className={`shrink-0 font-semibold rounded-lg border transition-colors ${
            compact ? 'text-[10px] px-2.5 py-1' : 'text-xs px-3 py-1.5'
          } ${
            filtersDirty
              ? 'bg-[#ffcb2b] border-[#e6b800] text-[#242424] hover:bg-[#ffe48a]'
              : 'bg-gray-900 border-gray-900 text-white hover:bg-gray-800'
          } disabled:opacity-60`}
        >
          {applying ? 'Searching…' : filtersDirty ? 'Search *' : 'Search'}
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`inline-flex items-center gap-1 text-[10px] md:text-xs font-semibold rounded-lg border transition-colors ${
            compact ? 'px-2 py-1' : 'gap-1.5 px-3 py-1.5'
          } ${
            expanded
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
          aria-expanded={expanded}
        >
          <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
          Filters
          {(showExpandHint || activeRefineCount > 0) && !expanded && (
            <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[#ffcb2b] text-[#242424] text-[10px] font-bold leading-5">
              {activeRefineCount || '!'}
            </span>
          )}
        </button>

        <span className="text-xs text-gray-500 tabular-nums shrink-0">
          <strong className="text-gray-900">{resultCount}</strong>
          {resultCount !== totalCount ? `/${totalCount}` : ''}
          {pipelineTotal > totalCount ? (
            <span className="text-gray-400"> · {pipelineTotal.toLocaleString()} total</span>
          ) : null}
        </span>

        {resultCount > 0 && (
          <button
            type="button"
            onClick={onSelectAllFiltered}
            className="text-xs font-semibold px-2.5 py-1.5 border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
          >
            Select all
          </button>
        )}

        {hasActiveFilters && (
          <button type="button" onClick={onClearFilters} className="text-xs text-gray-500 hover:text-gray-900 underline">
            Clear
          </button>
        )}
      </div>

      {(appliedSearch || appliedLocationLabel) && (
        <div className={`flex flex-wrap items-center gap-1.5 ${compact ? 'mt-1.5' : 'mt-2'}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Active</span>
          {appliedSearch ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-900 text-white">
              Search: {appliedSearch}
            </span>
          ) : null}
          {appliedFilters.city ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#fffbeb] border border-[#ffe48a] text-[#5b4a00]">
              City: {appliedFilters.city}
            </span>
          ) : null}
          {appliedFilters.state ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#fffbeb] border border-[#ffe48a] text-[#5b4a00]">
              State: {appliedFilters.state}
            </span>
          ) : null}
        </div>
      )}

      {savedViews.length > 0 && (
        <div className={`flex flex-wrap gap-1 overflow-x-auto no-scrollbar ${compact ? 'mt-1.5' : 'mt-2 gap-1.5'}`}>
          {savedViews.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onApplySmartView?.(v)}
              className={`shrink-0 rounded-full font-semibold border ${
                compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-1 text-[10px]'
              } ${
                activeSmartViewId === v.id
                  ? 'bg-[#fffbeb] border-[#ffe48a] text-[#5b4a00]'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {v.name}
            </button>
          ))}
        </div>
      )}

      <div className={`flex flex-wrap items-center gap-1 ${compact ? 'mt-1.5' : 'mt-2'}`}>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mr-1">Smart</span>
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
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                active
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {orgLeadTags.length > 0 && (
        <div className={`flex flex-wrap items-center gap-1 ${compact ? 'mt-1.5' : 'mt-2'}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mr-1">Lead tags</span>
          <div className="inline-flex rounded-full border border-gray-200 bg-white overflow-hidden mr-1">
            <button
              type="button"
              onClick={() => set({ tagMode: 'any' })}
              className={`px-2 py-0.5 text-[10px] font-semibold ${
                (filters.tagMode || 'any') === 'any' ? 'bg-gray-900 text-white' : 'text-gray-600'
              }`}
              title="Show leads with any selected tag"
            >
              Any
            </button>
            <button
              type="button"
              onClick={() => set({ tagMode: 'all' })}
              className={`px-2 py-0.5 text-[10px] font-semibold border-l border-gray-200 ${
                filters.tagMode === 'all' ? 'bg-gray-900 text-white border-l-gray-900' : 'text-gray-600'
              }`}
              title="Show leads with all selected tags"
            >
              All
            </button>
          </div>
          {orgLeadTags.map((tag) => {
            const active = (filters.tagIds || []).includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTagFilter(tag.id)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  active ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-200'
                }`}
                style={active ? { backgroundColor: tag.color } : undefined}
                title={tag.name}
              >
                {tag.name}
              </button>
            )
          })}
        </div>
      )}

      {expanded && (
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-3">
          <p className="text-[10px] text-gray-600">
            Choose city/state from your pipeline data, then click <strong>Search</strong> (matches
            Mumbai, MUMBAI, mumbai the same way).
          </p>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">Stage</p>
            <div className="flex flex-wrap gap-1.5">
              <FilterChip
                active={statusFilter === 'all'}
                onClick={() => onStatusFilterChange?.('all')}
                label="All stages"
              />
              {statusOptions.map((s) => (
                <FilterChip
                  key={s.id}
                  active={statusFilter === s.id}
                  onClick={() => onStatusFilterChange?.(s.id)}
                  label={s.label}
                />
              ))}
            </div>
          </div>

          {orgLeadTags.length > 0 && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Tags</p>
                <label className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span>Match</span>
                  <select
                    value={filters.tagMode || 'any'}
                    onChange={(e) => set({ tagMode: e.target.value })}
                    className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white"
                  >
                    <option value="any">Any selected</option>
                    <option value="all">All selected</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {orgLeadTags.map((tag) => {
                  const active = (filters.tagIds || []).includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTagFilter(tag.id)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        active ? 'text-white border-transparent' : 'bg-white text-gray-700 border-gray-200'
                      }`}
                      style={active ? { backgroundColor: tag.color } : undefined}
                    >
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[10px] font-medium text-gray-500 mb-0.5 block">City</span>
              <select
                value={filters.city}
                onChange={(e) => set({ city: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">All cities</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-medium text-gray-500 mb-0.5 block">State</span>
              <select
                value={filters.state}
                onChange={(e) => set({ state: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">All states</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-medium text-gray-500 mb-0.5 block">Contact</span>
              <select
                value={filters.contact}
                onChange={(e) => set({ contact: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                {CONTACT_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleApply}
              disabled={applying}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white disabled:opacity-50"
            >
              {applying ? 'Searching…' : 'Apply filters'}
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {CONTACT_FILTER_OPTIONS.filter((o) => o.id !== 'any').map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => set({ contact: filters.contact === opt.id ? 'any' : opt.id })}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  filters.contact === opt.id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { DEFAULT_PIPELINE_FILTERS }
