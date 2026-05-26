import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { isAllCitiesSelected, isAllStatesSelected } from '../../lib/filterOptions'
import {
  buildSearchEmptyMessage,
  getResultsBadge,
  softenNotice,
  PRODUCT,
  sanitizeCustomerText,
} from '../../lib/productCopy'
import { searchLeads } from '../../lib/searchService'
import SearchFiltersBar from './SearchFiltersBar'
import SearchResultsView, { FULL_DETAIL_PREVIEW_COUNT } from './SearchResultsView'
import ResultsTable from './ResultsTable'
import RechargeWalletModal from './RechargeWalletModal'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'
import useIsMobile from '../../hooks/useIsMobile'

const CREDIT_COST_PAISE = 100

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
  const [searchMetaOpen, setSearchMetaOpen] = useState(false)
  const [rechargeOpen, setRechargeOpen] = useState(false)
  const [listSaving, setListSaving] = useState(false)
  const isMobile = useIsMobile()

  const walletPaise = user?.creditsPaise ?? 0
  const walletRupees = user?.creditBalanceRupees ?? Number((walletPaise / 100).toFixed(2))

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

  const saveToMarketingList = async () => {
    const leads = displayLeads
      .filter((l) => (selected.length ? selected.includes(l.id) : true))
      .filter((l) => String(l.email || '').includes('@'))
    if (!leads.length) {
      setSearchError('Select at least one lead with an email address.')
      return
    }
    const defaultName = `Search ${new Date().toLocaleDateString()}`
    const name = window.prompt('Marketing list name', defaultName)
    if (!name?.trim()) return

    setListSaving(true)
    setSearchError(null)
    try {
      await api.createMarketingList({
        name: name.trim(),
        searchLeads: leads.map((l) => ({
          id: l.id,
          firstName: l.firstName,
          lastName: l.lastName,
          title: l.title,
          company: l.company,
          email: l.email,
          phone: l.phone,
          city: l.city,
          state: l.state,
          industry: l.industry,
          companyDomain: l.companyDomain,
          website: l.website,
          linkedin: l.linkedin,
          score: l.score,
          source: l.source || 'search',
        })),
      })
      onNavigate?.('marketing')
    } catch (error) {
      setSearchError(error.message || 'Could not create marketing list')
    } finally {
      setListSaving(false)
    }
  }

  const handleRevealField = async (lead, field) => {
    if (walletPaise < CREDIT_COST_PAISE) {
      setRechargeOpen(true)
      setSearchError('Recharge your credit wallet first — each reveal costs 1 credit (₹1).')
      return
    }

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
      if (error.status === 402 || error.message?.toLowerCase().includes('recharge')) {
        setRechargeOpen(true)
      }
      setSearchError(error.message || 'Could not reveal contact')
    } finally {
      setRevealingKey(null)
    }
  }

  const friendlyNotice = softenNotice(results?.notice)
  const friendlyDiscoveryError = sanitizeCustomerText(results?.discoveryError)
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

  const showMetaBlock =
    (hasSearched && results?.leads?.length > 0 && countTab !== 'saved') ||
    friendlyNotice ||
    filterSummary ||
    searchError ||
    results?.discoveryError ||
    results?.parsedSearch?.summary

  const metaCollapsedOnMobile = isMobile && hasSearched && displayLeads.length > 0 && countTab !== 'saved'

  return (
    <div className="panel-shell bg-[#f6f7f9]">
      <RechargeWalletModal
        open={rechargeOpen}
        onClose={() => setRechargeOpen(false)}
        balanceRupees={walletRupees}
      />
      <header className="shrink-0 bg-white border-b border-gray-200 px-3 sm:px-5 py-2 md:py-2.5">
        <div className="flex items-center justify-between gap-2 md:gap-3">
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-semibold text-gray-900 truncate">AI prospect search</h1>
            <p className="text-[10px] sm:text-[11px] text-gray-500 truncate hidden sm:block">
              {PRODUCT.databaseLine}
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => walletPaise < CREDIT_COST_PAISE && setRechargeOpen(true)}
              className={`hidden sm:inline text-xs font-medium px-2 py-1 rounded-full border ${
                walletPaise < CREDIT_COST_PAISE
                  ? 'text-red-800 bg-red-50 border-red-200'
                  : 'text-[#5b4a00] bg-[#fff6d6] border-[#ffe48a]'
              }`}
            >
              {walletPaise < CREDIT_COST_PAISE ? 'Recharge wallet' : `${walletRupees} credits`}
            </button>
            <span className="hidden md:inline text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
              {user?.aiDiscoverySearchesLeft ?? 3} live AI searches
            </span>
            <button
              type="button"
              onClick={saveToMarketingList}
              disabled={!displayLeads.length || listSaving}
              className="text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 sm:py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40"
            >
              {listSaving ? '…' : 'List'}
            </button>
            <button
              type="button"
              onClick={exportCSV}
              disabled={!displayLeads.length}
              className="text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-1 sm:py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40"
            >
              Export
            </button>
          </div>
        </div>
      </header>

      <div className="shrink-0 bg-white border-b border-gray-200">
        <SearchFiltersBar
          filters={filters}
          onChange={setFilters}
          onSearch={handleSearch}
          loading={loading}
          filtersExpanded={filtersExpanded}
          onToggleFilters={() => setFiltersExpanded((v) => !v)}
        />

        <div className="px-3 sm:px-5 pb-2 flex flex-wrap items-center gap-1.5 border-t border-gray-100">
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
          <span className={`ml-auto text-[10px] sm:text-xs font-medium ${resultBadge.className}`}>
            <strong>{displayLeads.length}</strong> shown
            {results.total > displayLeads.length ? (
              <>
                {' '}
                · <strong>{results.total}+</strong> matched
              </>
            ) : null}
          </span>
        )}
        </div>

        {showMetaBlock && metaCollapsedOnMobile && (
          <button
            type="button"
            onClick={() => setSearchMetaOpen((v) => !v)}
            className="w-full text-left text-[10px] font-semibold text-gray-600 px-3 py-1.5 border-t border-gray-100 hover:bg-gray-50"
          >
            {searchMetaOpen ? 'Hide' : 'Show'} search notes &amp; tips
          </button>
        )}

        {showMetaBlock && (!metaCollapsedOnMobile || searchMetaOpen) && (
          <div className="panel-chrome-scroll px-3 sm:px-5 py-2 space-y-1.5 bg-white border-t border-gray-100">
            {hasSearched && results?.leads?.length > 0 && countTab !== 'saved' && (
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs bg-[#fffbeb] border border-[#fde68a] rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2">
                <span className="font-semibold text-[#5b4a00]">
                  {results.usedLiveAi ? PRODUCT.liveAiResults : `${displayLeads.length} prospects`}
                  {results.total >= 50 ? ' · 50+ matched' : ''}
                </span>
                <span className="text-gray-600 hidden sm:inline">
                  · Top <strong>{fullPreviewCount}</strong> full contact · 1 credit each after
                </span>
                {walletPaise < CREDIT_COST_PAISE && (
                  <span className="text-red-800 font-medium"> · Recharge to reveal</span>
                )}
              </div>
            )}
            {results?.parsedSearch?.summary && hasSearched && countTab !== 'saved' && (
              <p className="text-[10px] sm:text-xs text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                Understood as: <span className="font-medium">{results.parsedSearch.summary}</span>
              </p>
            )}
            {filterSummary && hasSearched && countTab !== 'saved' && (
              <p className="text-[10px] sm:text-xs text-gray-600">
                Active filters: <span className="font-medium">{filterSummary}</span>
              </p>
            )}
            {friendlyNotice && countTab !== 'saved' && (
              <p className="text-[10px] sm:text-xs text-gray-600">{friendlyNotice}</p>
            )}
            {friendlyDiscoveryError && countTab !== 'saved' && (
              <p className="text-[10px] sm:text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                {friendlyDiscoveryError}
              </p>
            )}
            {searchError && (
              <p className="text-[10px] sm:text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1.5">
                {searchError}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="panel-body-scroll pipeline-scroll-area bg-white">
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
            sub={buildSearchEmptyMessage(results)}
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
    <div className="min-h-[min(70vh,520px)] flex flex-col items-center justify-center p-6 sm:p-8 text-center">
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
    <LoadingExperience
      message={LOADING_MESSAGES.search}
      subtitle="Up to 50 matches · full details on the top 10"
      showQuote={false}
      className="bg-white min-h-[min(70vh,520px)]"
    />
  )
}
