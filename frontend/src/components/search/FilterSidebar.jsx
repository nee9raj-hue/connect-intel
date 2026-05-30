import { useState } from 'react'
import { FILTER_SECTIONS } from '../../lib/filterOptions'

export default function FilterSidebar({ filters, onChange, onSearch, loading, collapsed, onToggleCollapse }) {
  const [expanded, setExpanded] = useState({
    jobTitles: true,
    states: true,
    cities: false,
    industries: true,
    companySizes: false,
  })

  const toggleFilter = (key, value) => {
    const current = filters[key] || []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onChange({ ...filters, [key]: next })
  }

  const activeCount =
    (filters.jobTitles?.length || 0) +
    (filters.states?.length || 0) +
    (filters.cities?.length || 0) +
    (filters.industries?.length || 0) +
    (filters.companySizes?.length || 0)

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        className="w-10 shrink-0 border-r border-gray-200 bg-white text-xs text-gray-500 hover:bg-gray-50 writing-mode-vertical"
        title="Show filters"
      >
        Filters
      </button>
    )
  }

  return (
    <aside className="w-[260px] shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-gray-900">Filters</span>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  jobTitles: [],
                  states: [],
                  cities: [],
                  industries: [],
                  companySizes: [],
                  keywords: filters.keywords || '',
                })
              }
              className="text-xs text-blue-600 hover:underline"
            >
              Clear all
            </button>
          )}
          <button type="button" onClick={onToggleCollapse} className="text-xs text-gray-400 hover:text-gray-600">
            Hide
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {Object.entries(FILTER_SECTIONS).map(([key, section]) => (
          <FilterSection
            key={key}
            icon={section.icon}
            label={section.label}
            options={section.options}
            selected={filters[key] || []}
            expanded={expanded[key]}
            onToggleExpand={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
            onToggleOption={(val) => toggleFilter(key, val)}
          />
        ))}
      </div>

      <div className="p-3 border-t border-gray-100 shrink-0 space-y-2">
        <button
          type="button"
          onClick={onSearch}
          disabled={loading}
          className="w-full py-2.5 bg-[#FF773D] hover:bg-[#e5652f] text-[#242424] font-semibold text-sm rounded-md disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-[#242424]/30 border-t-[#242424] rounded-full animate-spin" />
              Searching…
            </>
          ) : (
            <>Search leads</>
          )}
        </button>
        <p className="text-[10px] text-center text-gray-400 leading-snug">
          Powered by AI · India & global B2B data
        </p>
      </div>
    </aside>
  )
}

function FilterSection({ icon, label, options, selected, expanded, onToggleExpand, onToggleOption }) {
  return (
    <div className="border-b border-gray-100">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium text-gray-800 hover:bg-gray-50"
      >
        <span className="text-base opacity-70">{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        {selected.length > 0 && (
          <span className="text-[10px] font-bold bg-[#FF773D] text-[#242424] px-1.5 rounded-full">
            {selected.length}
          </span>
        )}
        <span className="text-gray-400 text-[10px]">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 max-h-44 overflow-y-auto">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-start gap-2 py-1.5 px-1 rounded hover:bg-gray-50 cursor-pointer text-[13px] text-gray-700"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onToggleOption(opt)}
                className="mt-0.5 rounded border-gray-300 text-gray-900 focus:ring-[#FF773D]"
              />
              <span className="leading-snug">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
