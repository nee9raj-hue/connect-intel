import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { searchLeads } from '../../lib/searchService'
import FilterSidebar from './FilterSidebar'
import ResultsTable from './ResultsTable'

const EMPTY_FILTERS = {
  jobTitles: [],
  locations: [],
  industries: [],
  companySizes: [],
  keywords: '',
}

export default function PeopleSearch() {
  const { addSearchHistory, toggleSaveLead } = useApp()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [tab, setTab] = useState('people')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [selected, setSelected] = useState([])
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async () => {
    setLoading(true)
    setHasSearched(true)
    setSelected([])
    try {
      const data = await searchLeads(filters, 'claude')
      setResults(data)
      addSearchHistory({
        filters: { ...filters },
        count: data.leads.length,
        total: data.total,
        at: new Date().toISOString(),
      })
    } catch (e) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (!results) return
    setSelected(
      selected.length === results.leads.length ? [] : results.leads.map((l) => l.id)
    )
  }

  const handleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const exportCSV = () => {
    const leads = results?.leads.filter((l) => selected.includes(l.id)) || results?.leads || []
    if (!leads.length) return
    const hdr = ['First Name', 'Last Name', 'Title', 'Company', 'Email', 'Phone', 'Location', 'Industry', 'Score']
    const rows = leads.map((l) => [
      l.firstName,
      l.lastName,
      l.title,
      l.company,
      l.email,
      l.phone,
      l.location,
      l.industry,
      l.score,
    ])
    const csv = [hdr, ...rows].map((r) => r.map((v) => `"${v || ''}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `connect-intel-leads-${Date.now()}.csv`
    a.click()
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <FilterSidebar
        filters={filters}
        onChange={setFilters}
        onSearch={handleSearch}
        loading={loading}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Search toolbar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm font-medium">
              {['people', 'companies'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 capitalize transition-colors ${
                    tab === t
                      ? 'bg-ci-nav text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === 'companies' && (
              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded font-medium">
                Company search coming soon
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Search keywords — company, title, industry..."
                value={filters.keywords}
                onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ci-yellow/40 focus:border-ci-yellow"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-5 py-2.5 bg-ci-yellow text-ci-dark font-bold text-sm rounded-md hover:bg-ci-yellow-hover disabled:opacity-60"
            >
              Search
            </button>
          </div>

          {results && (
            <div className="flex items-center gap-4 mt-3">
              <StatPill label="Total" value={results.total.toLocaleString()} active />
              <StatPill label="Net New" value={results.netNew.toLocaleString()} />
              <StatPill label="Showing" value={results.leads.length} />
              <div className="ml-auto flex gap-2">
                {selected.length > 0 && (
                  <button
                    onClick={exportCSV}
                    className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Export {selected.length} selected
                  </button>
                )}
                <button
                  onClick={exportCSV}
                  className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Export all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results area */}
        {!hasSearched ? (
          <EmptySearch />
        ) : loading ? (
          <LoadingState />
        ) : results?.leads.length === 0 ? (
          <NoResults onRetry={handleSearch} />
        ) : (
          <ResultsTable
            leads={results.leads}
            selected={selected}
            onSelectAll={handleSelectAll}
            onSelect={handleSelect}
            onSave={toggleSaveLead}
          />
        )}
      </div>
    </div>
  )
}

function StatPill({ label, value, active }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
        active ? 'bg-ci-yellow/25 border border-ci-yellow/50' : 'bg-gray-100'
      }`}
    >
      <span className="text-gray-500 text-xs font-medium">{label}</span>
      <span className="font-bold text-gray-900">{value}</span>
    </div>
  )
}

function EmptySearch() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white">
      <div className="text-5xl mb-4">👥</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Search for your ideal prospects</h3>
      <p className="text-sm text-gray-500 max-w-md leading-relaxed">
        Use filters on the left to narrow by job title, location, industry, and company size —
        then click Search. Results are powered by Claude AI (demo data until API is connected).
      </p>
      <div className="mt-8 grid grid-cols-3 gap-4 text-left max-w-lg w-full">
        {[
          { icon: '🎯', t: 'Filter', d: 'Job title, location, industry & more' },
          { icon: '🤖', t: 'AI Search', d: 'Claude finds matching leads' },
          { icon: '📋', t: 'Save & Export', d: 'Build lists, export CSV' },
        ].map((item) => (
          <div key={item.t} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
            <div className="text-xl mb-2">{item.icon}</div>
            <div className="text-sm font-semibold text-gray-800">{item.t}</div>
            <div className="text-xs text-gray-500 mt-0.5">{item.d}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white">
      <div className="w-10 h-10 border-3 border-apollo-yellow/30 border-t-apollo-yellow rounded-full animate-spin mb-4" />
      <p className="font-semibold text-gray-800">Claude AI is searching...</p>
      <p className="text-sm text-gray-500 mt-1">Finding leads that match your filters</p>
    </div>
  )
}

function NoResults({ onRetry }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-white">
      <div className="text-4xl mb-3">🔍</div>
      <h3 className="font-semibold text-gray-900 mb-1">No leads match your filters</h3>
      <p className="text-sm text-gray-500 mb-4">Try broadening your search criteria</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-apollo-dark text-white text-sm font-semibold rounded-lg"
      >
        Search again
      </button>
    </div>
  )
}
