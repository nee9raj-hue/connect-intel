import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { isAllCitiesSelected, isAllStatesSelected } from '../../lib/filterOptions'
import { getResultsBadge, softenNotice, PRODUCT } from '../../lib/productCopy'
import { searchLeads } from '../../lib/searchService'
import SearchFiltersBar from './SearchFiltersBar'
import ResultsTable from './ResultsTable'

const EMPTY_FILTERS = {
  states: [],
  cities: [],
  industries: [],
  companySizes: [],
  keywords: '',
}

export default function PeopleSearch({ onNavigate }) {
  const {
    addSearchHistory,
    toggleSaveLead,
    savedLeads,
    user,
    updateUser,
    refreshSession,
    setScreen,
    logout,
    openPipelineLead,
  } = useApp()
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [countTab, setCountTab] = useState('total')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [selected, setSelected] = useState([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [unlockingLeadId, setUnlockingLeadId] = useState(null)

  const handleSearch = async () => {
    setLoading(true)
    setHasSearched(true)
    setSelected([])
    setSearchError(null)
    try {
      const data = await searchLeads(filters, 'free', 25)
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

  const workOnLead = (lead) => {
    openPipelineLead(lead.id)
    onNavigate?.('pipeline')
  }

  const filterSummary = useMemo(() => {
    const parts = []
    if (filters.keywords?.trim()) parts.push(`“${filters.keywords.trim()}”`)
    if (!filters.states?.length || isAllStatesSelected(filters.states)) {
      parts.push('All India')
    } else if (filters.states?.length) {
      parts.push(filters.states.length > 3 ? `${filters.states.length} states` : filters.states.join(', '))
    }
    if (filters.cities?.length && !isAllCitiesSelected(filters.states, filters.cities)) {
      parts.push(filters.cities.length > 3 ? `${filters.cities.length} cities` : filters.cities.join(', '))
    }
    if (filters.industries?.length) parts.push(`${filters.industries.length} industry`)
    return parts.length ? parts.join(' · ') : null
  }, [filters])

  const canSearch = user?.canSearch !== false

  if (!canSearch) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center bg-[#f6f7f9]">
        <h1 className="text-lg font-semibold text-gray-900">Search not enabled</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-md">
          Your company admin can enable lead search for your account from Team settings. You can still work on
          pipeline leads assigned to you.
        </p>
        <button
          type="button"
          onClick={() => onNavigate?.('pipeline')}
          className="mt-4 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md"
        >
          Open pipeline
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f6f7f9]">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-3">
        <div className="flex items-center justify-between gap-4">
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
      </header>

      <div className="shrink-0 max-h-[42vh] overflow-y-auto border-b border-gray-100">
        <SearchFiltersBar
          filters={filters}
          onChange={setFilters}
          onSearch={handleSearch}
          loading={loading}
        />
      </div>

      <div className="shrink-0 bg-white border-b border-gray-200 px-5 py-2 flex flex-wrap items-center gap-2">
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

      {(friendlyNotice || filterSummary || searchError || results?.discoveryError) && (
        <div className="shrink-0 px-5 py-2 space-y-1.5 bg-white border-b border-gray-100">
          {filterSummary && hasSearched && countTab !== 'saved' && (
            <p className="text-xs text-gray-600">
              Active filters: <span className="font-medium">{filterSummary}</span>
            </p>
          )}
          {friendlyNotice && countTab !== 'saved' && (
            <p className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
              {friendlyNotice}
            </p>
          )}
          {results?.discoveryError && countTab !== 'saved' && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Perplexity: {results.discoveryError}
            </p>
          )}
          {searchError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5">
              {searchError}
            </p>
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-white">
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
              onWorkOnLead={workOnLead}
              onUnlock={handleUnlockLead}
              unlockingLeadId={unlockingLeadId}
            />
          ) : (
            <EmptyState
              title="No saved leads"
              sub="Save prospects from search, then open Pipeline to email and track status."
              action={() => onNavigate?.('pipeline')}
              actionLabel="Open pipeline"
            />
          )
        ) : !hasSearched ? (
          <EmptyState
            title="Search your B2B database"
            sub='Enter keywords plus state or city for best matches. Each result has email or phone (or both) — scroll the table below.'
          />
        ) : loading ? (
          <LoadingState />
          ) : displayLeads.length === 0 ? (
            <EmptyState
              title="No matches for these filters"
              sub={
                results?.discoveryError
                  ? `Database had no matches. Perplexity: ${results.discoveryError}. Try keyword "exporter" only or fewer cities.`
                  : 'Try keyword "exporter" with one state (e.g. Rajasthan). Contacts need at least email or phone.'
              }
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
            onWorkOnLead={workOnLead}
            onUnlock={handleUnlockLead}
            unlockingLeadId={unlockingLeadId}
          />
        )}
      </div>
    </div>
  )
}

function EmptyState({ title, sub, action, actionLabel = 'Search again' }) {
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
          {actionLabel}
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
      <p className="text-xs text-gray-500 mt-1">Matching keywords and location</p>
    </div>
  )
}
