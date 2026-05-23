import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { isAllCitiesSelected, isAllStatesSelected } from '../../lib/filterOptions'
import { getResultsBadge, softenNotice, PRODUCT } from '../../lib/productCopy'
import { searchLeads } from '../../lib/searchService'
import SearchFiltersBar from './SearchFiltersBar'
import SearchResultsView, { FULL_DETAIL_PREVIEW_COUNT } from './SearchResultsView'
import ResultsTable from './ResultsTable'

const EMPTY_FILTERS = {
  states: [],
  cities: [],
  industries: [],
  companySizes: [],
  keywords: '',
}

const SEARCH_FETCH_COUNT = 50

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
  const [revealingKey, setRevealingKey] = useState(null)
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  const handleSearch = async () => {
    setLoading(true)
    setHasSearched(true)
    setSelected([])
    setSearchError(null)
    setFiltersExpanded(false)
    try {
      const data = await searchLeads(filters, 'free', SEARCH_FETCH_COUNT)
      setResults(data)
      if (data.user) {
        updateUser({
          searchesLeft: data.user.searchesLeft,
          creditsPaise: data.user.creditsPaise,
          creditBalanceRupees: data.user.creditBalanceRupees,
          aiDiscoverySearchesLeft: data.aiDiscoverySearchesLeft ?? data.user.aiDiscoverySearchesLeft,
        })
      }
      if (data.aiDiscoverySearchesLeft != null) {
        updateUser({ aiDiscoverySearchesLeft: data.aiDiscoverySearchesLeft })
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
      const authProblem =
        e.status === 401 ||
        /authentication required/i.test(message) ||
        /session out of date/i.test(message) ||
        /sign in again/i.test(message)
      if (authProblem) {
        try {
          const session = await refreshSession()
          if (session) {
            setSearchError('Session refreshed — please run your search again.')
            return
          }
        } catch {
          // fall through to sign-in
        }
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

  const fullPreviewCount = results?.fullPreviewCount ?? FULL_DETAIL_PREVIEW_COUNT
  const maskedCount = results?.maskedCount ?? Math.max(0, displayLeads.length - fullPreviewCount)

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

  const handleRevealField = async (lead, field) => {
    const key = `${lead.id}:${field}`
    setRevealingKey(key)
    setSearchError(null)

    try {
      const data = await api.unlockLead(lead, field)
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
        creditBalanceRupees: data.user.creditBalanceRupees ?? Number(((data.user.creditsPaise || 0) / 100).toFixed(2)),
      }))

      await refreshSession()
    } catch (error) {
      setSearchError(error.message || 'Could not reveal contact')
    } finally {
      setRevealingKey(null)
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

  const allLeadsSelected =
    displayLeads.length > 0 && selected.length === displayLeads.length

  const resultsHandlers = {
    selected,
    allSelected: allLeadsSelected,
    onSelectAll: handleSelectAll,
    onSelect: (id) =>
      setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    onSave: toggleSaveLead,
    onWorkOnLead: workOnLead,
    onRevealField: handleRevealField,
    revealingKey,
    fullPreviewCount,
  }

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
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 sm:px-5 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-gray-900 truncate">AI prospect search</h1>
            <p className="text-[11px] text-gray-500 truncate">{PRODUCT.databaseLine}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-xs font-medium text-[#5b4a00] bg-[#fff6d6] px-2 py-1 rounded-full border border-[#ffe48a]">
              ₹{user?.creditBalanceRupees ?? ((user?.creditsPaise || 0) / 100).toFixed(0)} wallet
            </span>
            <span className="hidden md:inline text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
              {user?.aiDiscoverySearchesLeft ?? 3} live AI searches
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

      <SearchFiltersBar
        filters={filters}
        onChange={setFilters}
        onSearch={handleSearch}
        loading={loading}
        filtersExpanded={filtersExpanded}
        onToggleFilters={() => setFiltersExpanded((v) => !v)}
      />

      <div className="shrink-0 bg-white border-b border-gray-200 px-4 sm:px-5 py-2 flex flex-wrap items-center gap-2">
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
            <strong>{displayLeads.length}</strong> shown
            {results.total > displayLeads.length ? (
              <>
                {' '}
                · <strong>{results.total}+</strong> matched
              </>
            ) : null}{' '}
            · {resultBadge.text}
          </span>
        )}
      </div>

      {(hasSearched && results?.leads?.length > 0 && countTab !== 'saved') ||
      friendlyNotice ||
      filterSummary ||
      searchError ||
      results?.discoveryError ||
      results?.parsedSearch?.summary ? (
        <div className="shrink-0 px-4 sm:px-5 py-2 space-y-1.5 bg-white border-b border-gray-100 max-h-[28vh] overflow-y-auto">
          {hasSearched && results?.leads?.length > 0 && countTab !== 'saved' && (
            <div className="flex flex-wrap items-center gap-2 text-xs bg-[#fffbeb] border border-[#fde68a] rounded-lg px-3 py-2">
              <span className="font-semibold text-[#5b4a00]">
                {results.usedLiveAi ? 'Live Perplexity AI results' : `${displayLeads.length} prospects`}
                {results.total >= 50 ? ' · 50+ matched' : ''}
              </span>
              <span className="text-gray-600">
                · Top <strong>{Math.min(fullPreviewCount, displayLeads.length)}</strong> show full email & phone on
                live AI search · Reveal others at <strong>₹1</strong> per email or phone
              </span>
              {(user?.aiDiscoverySearchesLeft ?? results?.aiDiscoverySearchesLeft ?? 0) <= 0 && (
                <span className="text-amber-800 font-medium">
                  · No free live AI searches left — recharge wallet for more
                </span>
              )}
            </div>
          )}
          {results?.parsedSearch?.summary && hasSearched && countTab !== 'saved' && (
            <p className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              Understood as: <span className="font-medium">{results.parsedSearch.summary}</span>
            </p>
          )}
          {filterSummary && hasSearched && countTab !== 'saved' && (
            <p className="text-xs text-gray-600">
              Active filters: <span className="font-medium">{filterSummary}</span>
            </p>
          )}
          {friendlyNotice && countTab !== 'saved' && (
            <p className="text-xs text-gray-600">{friendlyNotice}</p>
          )}
          {results?.discoveryError && countTab !== 'saved' && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              AI: {results.discoveryError}
            </p>
          )}
          {searchError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5">{searchError}</p>
          )}
        </div>
      ) : null}

      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {countTab === 'saved' ? (
          displayLeads.length ? (
            <ResultsTable {...resultsHandlers} leads={displayLeads} allSelected={allLeadsSelected} />
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
            sub='Type who you need above and press Search. Results fill this page — full contacts for the top 10, more matches listed below.'
          />
        ) : loading ? (
          <LoadingState />
        ) : displayLeads.length === 0 ? (
          <EmptyState
            title="No matches for these filters"
            sub={
              results?.discoveryError
                ? `Database had no matches. AI: ${results.discoveryError}. Try a clearer sentence with product + location.`
                : 'Try a specific product or company type with a state or city, or import more companies in Admin / Team.'
            }
            action={handleSearch}
          />
        ) : (
          <SearchResultsView leads={displayLeads} {...resultsHandlers} />
        )}
      </div>
    </div>
  )
}

function EmptyState({ title, sub, action, actionLabel = 'Search again' }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
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
    <div className="flex-1 flex flex-col items-center justify-center px-6 bg-white">
      <div className="w-10 h-10 border-2 border-[#ffcb2b]/30 border-t-[#ffcb2b] rounded-full animate-spin mb-3" />
      <p className="text-sm font-medium text-gray-800">Searching our B2B database…</p>
      <p className="text-xs text-gray-500 mt-1">Up to 50 matches · full details on the top 10</p>
    </div>
  )
}
