import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { getResultsBadge, softenNotice, PRODUCT } from '../../lib/productCopy'
import { searchLeads } from '../../lib/searchService'
import FilterSidebar from './FilterSidebar'
import ResultsTable from './ResultsTable'

const EMPTY_FILTERS = {
  jobTitles: [],
  states: [],
  cities: [],
  industries: [],
  companySizes: [],
  keywords: '',
}

export default function PeopleSearch() {
  const { addSearchHistory, toggleSaveLead, savedLeads, user, updateUser, refreshSession, setScreen, logout } =
    useApp()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [countTab, setCountTab] = useState('total')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [selected, setSelected] = useState([])
  const [hasSearched, setHasSearched] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [searchError, setSearchError] = useState(null)
  const [unlockingLeadId, setUnlockingLeadId] = useState(null)

  const handleSearch = async () => {
    setLoading(true)
    setHasSearched(true)
    setSelected([])
    setSearchError(null)
    try {
      const data = await searchLeads(filters, 'free', 10)
      setResults(data)
      if (data.user?.searchesLeft != null) {
        updateUser({ searchesLeft: data.user.searchesLeft })
      }
      addSearchHistory({
        filters: { ...filters },
        count: data.leads.length,
        total: data.total,
        at: new Date().toISOString(),
        provider: data.provider,
      })
    } catch (e) {
      const message = e.message || 'Search failed'
      setSearchError(message)
      setResults(null)
      if (e.status === 401 || /authentication required/i.test(message)) {
        await logout()
        setScreen('auth')
      }
    } finally {
      setLoading(false)
    }
  }

  const displayLeads = useMemo(() => {
    if (countTab === 'saved') return savedLeads
    const leads = results?.leads || []
    if (countTab === 'netNew') {
      const savedIds = new Set(savedLeads.map((entry) => entry.id))
      return leads.filter((entry) => !savedIds.has(entry.id))
    }
    return leads
  }, [countTab, savedLeads, results])

  const handleSelectAll = () => {
    const list = displayLeads
    setSelected(selected.length === list.length ? [] : list.map((l) => l.id))
  }

  const exportCSV = () => {
    const leads = displayLeads.filter((l) => (selected.length ? selected.includes(l.id) : true))
    if (!leads.length) return
    const hdr = ['First Name', 'Last Name', 'Title', 'Company', 'Email', 'Phone', 'Location', 'Industry', 'Score', 'Source']
    const rows = leads.map((l) => [
      l.firstName, l.lastName, l.title, l.company, l.email, l.phone, l.location, l.industry, l.score, l.source || '',
    ])
    const csv = [hdr, ...rows].map((r) => r.map((v) => `"${v || ''}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `connect-intel-leads-${Date.now()}.csv`
    a.click()
  }

  const handleUnlockLead = async (lead) => {
    setUnlockingLeadId(lead.id)
    setSearchError(null)

    try {
      const data = await api.unlockLead(lead)
      setResults((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          leads: prev.leads.map((entry) => (entry.id === lead.id ? data.lead : entry)),
        }
      })

      updateUser((prev) => ({
        ...prev,
        creditsPaise: data.user.creditsPaise,
        creditBalanceRupees: Number(((data.user.creditsPaise || 0) / 100).toFixed(2)),
      }))

      await refreshSession()
    } catch (error) {
      setSearchError(error.message)
    } finally {
      setUnlockingLeadId(null)
    }
  }

  const friendlyNotice = softenNotice(results?.notice)
  const resultBadge = results ? getResultsBadge(results.provider) : null

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-3">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Find people</h1>
            <p className="text-xs text-gray-500 mt-0.5">{PRODUCT.databaseLine}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5b4a00] bg-[#fff6d6] px-2.5 py-1 rounded-full border border-[#ffe48a]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ffcb2b]" />
              {PRODUCT.poweredBy}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200">
              Searches left: {user?.searchesLeft ?? 0}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7a5f00] bg-[#fffbeb] px-2.5 py-1 rounded-full border border-[#fde68a]">
              Credits: Rs {((user?.creditsPaise ?? 0) / 100).toFixed(0)}
            </span>
            <button
              type="button"
              onClick={exportCSV}
              disabled={!displayLeads.length}
              className="text-xs font-medium px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40"
            >
              Export
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            className="text-xs font-medium px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            {filtersOpen ? 'Hide filters' : 'Show filters'}
          </button>
          <div className="flex-1 min-w-[200px] relative max-w-xl">
            <input
              type="text"
              placeholder="Search exporters, industries, cities — e.g. Jaipur, pharma, textiles…"
              value={filters.keywords}
              onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#ffcb2b]/50 focus:border-[#ffcb2b]"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || (user?.searchesLeft ?? 0) <= 0}
            className="px-4 py-2 bg-[#ffcb2b] hover:bg-[#f0bc00] text-[#242424] text-sm font-semibold rounded-md disabled:opacity-60"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {[
            { id: 'total', label: 'Total', value: results?.total },
            { id: 'netNew', label: 'Net new', value: results?.netNew },
            { id: 'saved', label: 'Saved', value: savedLeads.length },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCountTab(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                countTab === tab.id
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.value != null && (
                <span className="ml-1 opacity-80">
                  ({typeof tab.value === 'number' ? tab.value.toLocaleString() : tab.value})
                </span>
              )}
            </button>
          ))}
          {hasSearched && results && countTab !== 'saved' && resultBadge && (
            <span className={`ml-auto text-xs font-medium ${resultBadge.className}`}>
              Showing <strong>{results.leads.length}</strong> · {resultBadge.text}
            </span>
          )}
        </div>

        {friendlyNotice && countTab !== 'saved' && (
          <p className="mt-2 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            {friendlyNotice}
          </p>
        )}
        {countTab !== 'saved' && (
          <p className="mt-2 text-xs text-gray-500">
            {PRODUCT.searchHint}. First 5 results include full contact details; unlock more for Rs 10 each.
          </p>
        )}
        {searchError && (
          <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5">
            {searchError}
          </p>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        <FilterSidebar
          filters={filters}
          onChange={setFilters}
          onSearch={handleSearch}
          loading={loading}
          collapsed={!filtersOpen}
          onToggleCollapse={() => setFiltersOpen((o) => !o)}
        />

        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {countTab === 'saved' ? (
            displayLeads.length ? (
              <ResultsTable
                leads={displayLeads}
                selected={selected}
                onSelectAll={handleSelectAll}
                onSelect={(id) =>
                  setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
                }
                onSave={toggleSaveLead}
                onUnlock={handleUnlockLead}
                unlockingLeadId={unlockingLeadId}
              />
            ) : (
              <EmptyState title="No saved leads" sub="Save prospects from your search results to build lists." />
            )
          ) : !hasSearched ? (
            <EmptyState
              title="Search your B2B database"
              sub="Filter by state, city, or industry — then search for exporters, buyers, and decision-makers across India."
            />
          ) : loading ? (
            <LoadingState />
          ) : displayLeads.length === 0 ? (
            <EmptyState
              title="No matches yet"
              sub="Try broader keywords (e.g. exporter, textile) or another city. Your team can add more companies in Admin."
              action={handleSearch}
            />
          ) : (
            <ResultsTable
              leads={displayLeads}
              selected={selected}
              onSelectAll={handleSelectAll}
              onSelect={(id) =>
                setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
              }
              onSave={toggleSaveLead}
              onUnlock={handleUnlockLead}
              unlockingLeadId={unlockingLeadId}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ title, sub, action }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <p className="font-medium text-gray-900">{title}</p>
      <p className="text-sm text-gray-500 mt-1 max-w-md leading-relaxed">{sub}</p>
      {action && (
        <button
          type="button"
          onClick={action}
          className="mt-4 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md"
        >
          Search again
        </button>
      )}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-10 h-10 border-2 border-[#ffcb2b]/30 border-t-[#ffcb2b] rounded-full animate-spin mb-3" />
      <p className="text-sm font-medium text-gray-800">Searching our B2B database…</p>
      <p className="text-xs text-gray-500 mt-1">AI-powered matching across companies & contacts</p>
    </div>
  )
}
