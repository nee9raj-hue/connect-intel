import { useState } from 'react'

const FILTER_SECTIONS = {
  jobTitles: {
    label: 'Job Titles',
    options: [
      'CEO',
      'Founder',
      'CMO',
      'VP Marketing',
      'Head of Growth',
      'Marketing Manager',
      'Director of Sales',
      'Business Development',
    ],
  },
  locations: {
    label: 'Location',
    options: [
      'San Francisco',
      'New York',
      'Austin',
      'Boston',
      'Chicago',
      'Seattle',
      'Miami',
      'Los Angeles',
    ],
  },
  industries: {
    label: 'Industry',
    options: [
      'Software',
      'Marketing & Advertising',
      'Information Technology',
      'Healthcare',
      'E-commerce',
      'Financial Services',
      'Retail',
      'Data & Analytics',
    ],
  },
  companySizes: {
    label: 'Company Size',
    options: ['1-10', '11-50', '51-200', '201-500', '501-1000'],
  },
}

export default function FilterSidebar({ filters, onChange, onSearch, loading }) {
  const [expanded, setExpanded] = useState({
    jobTitles: true,
    locations: true,
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

  const activeCount = Object.values(filters).flat().length

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
          {activeCount > 0 && (
            <button
              onClick={() =>
                onChange({
                  jobTitles: [],
                  locations: [],
                  industries: [],
                  companySizes: [],
                  keywords: filters.keywords || '',
                })
              }
              className="text-xs text-apollo-dark font-medium hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500">{activeCount} filters applied</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {Object.entries(FILTER_SECTIONS).map(([key, section]) => (
          <FilterSection
            key={key}
            label={section.label}
            options={section.options}
            selected={filters[key] || []}
            expanded={expanded[key]}
            onToggleExpand={() => setExpanded((e) => ({ ...e, [key]: !e[key] }))}
            onToggleOption={(val) => toggleFilter(key, val)}
          />
        ))}
      </div>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={onSearch}
          disabled={loading}
          className="w-full py-2.5 bg-apollo-yellow text-apollo-dark font-bold text-sm rounded-lg hover:bg-apollo-yellow-hover disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-apollo-dark/30 border-t-apollo-dark rounded-full animate-spin" />
              Searching...
            </>
          ) : (
            <>Search leads</>
          )}
        </button>
      </div>
    </aside>
  )
}

function FilterSection({ label, options, selected, expanded, onToggleExpand, onToggleOption }) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden mb-2">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
      >
        {label}
        {selected.length > 0 && (
          <span className="text-[10px] font-bold bg-apollo-yellow text-apollo-dark px-1.5 rounded-full mr-1">
            {selected.length}
          </span>
        )}
        <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-2 pb-2 space-y-0.5 max-h-40 overflow-y-auto">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer text-sm text-gray-700"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onToggleOption(opt)}
                className="rounded border-gray-300 text-apollo-dark focus:ring-apollo-yellow"
              />
              <span className="truncate">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
