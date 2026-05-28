import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { formatCrmDate, getStatusMeta, getVisiblePipelineColumns } from '../../lib/crmConstants'
import LeadWorkspace from './LeadWorkspace'
import PipelineImportModal from './PipelineImportModal'
import BulkEmailModal from './BulkEmailModal'
import AddLeadModal from './AddLeadModal'
import PipelineBulkActionsBar from './PipelineBulkActionsBar'
import PipelineFiltersBar, { DEFAULT_PIPELINE_FILTERS } from './PipelineFiltersBar'
import BulkWhatsAppModal from './BulkWhatsAppModal'
import {
  applyPipelineFilters,
  collectLocationOptions,
  countActiveFilters,
  normalizeLocationKey,
} from '../../lib/pipelineFilters'
import { tagMapById } from '../../lib/orgLeadTags'
import { leadHasCallablePhone } from '../../lib/phoneUtils'
import { leadHasSendableEmail } from '../../lib/emailUtils'
import { getLeadCity, getLeadState } from '../../lib/pipelineFilters'

function useIsMobile(breakpointPx = 768) {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(max-width: ${breakpointPx - 1}px)`).matches
  })
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    const onChange = () => setMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [breakpointPx])
  return mobile
}

export default function PipelinePanel({ onNavigate, panelOptions }) {
  const {
    user,
    savedLeads,
    pipelineLoad,
    pipelineSummary,
    loadPipelineList,
    loadMorePipelineLeads,
    toggleSaveLead,
    pipelineLeadId,
    setPipelineLeadId,
    openPipelineLead,
    refreshSavedLeads,
    pipelineAssigneeFilter,
    setPipelineAssigneeFilter,
    teamMembers,
    refreshTeam,
    bulkUpdatePipeline,
    orgLeadTags,
  } = useApp()

  const columns = useMemo(() => getVisiblePipelineColumns(user), [user])
  const isMobile = useIsMobile()
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      return 'list'
    }
    return 'board'
  })
  const [filter, setFilter] = useState(panelOptions?.status || 'all')
  const [search, setSearch] = useState('')
  const [advancedFilters, setAdvancedFilters] = useState({ ...DEFAULT_PIPELINE_FILTERS })
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedAdvanced, setAppliedAdvanced] = useState({ ...DEFAULT_PIPELINE_FILTERS })
  const [filterApplying, setFilterApplying] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [importOpen, setImportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkNotice, setBulkNotice] = useState(null)

  const canAssign = Boolean(user?.isOrgAdmin && user?.accountType === 'company')

  useEffect(() => {
    if (canAssign) refreshTeam?.()
  }, [canAssign, refreshTeam])

  useEffect(() => {
    if (panelOptions?.status) {
      setFilter(panelOptions.status)
      if (panelOptions.status !== 'all') setView('list')
      else if (!isMobile) setView('board')
    }
  }, [panelOptions?.status, isMobile])

  const [workspaceLead, setWorkspaceLead] = useState(null)

  useEffect(() => {
    if (!bulkNotice) return
    const timer = setTimeout(() => setBulkNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [bulkNotice])

  const assigneeName = useMemo(() => {
    if (!pipelineAssigneeFilter) return null
    const m = teamMembers.find((t) => t.userId === pipelineAssigneeFilter)
    return m?.name || 'Team member'
  }, [pipelineAssigneeFilter, teamMembers])

  const scopedLeads = useMemo(() => {
    if (!pipelineAssigneeFilter) return savedLeads
    return savedLeads.filter((l) => (l.assignedToUserId || l.savedByUserId) === pipelineAssigneeFilter)
  }, [savedLeads, pipelineAssigneeFilter])

  const locationOptions = useMemo(() => {
    const fromLoaded = collectLocationOptions(scopedLeads)
    const mergeNames = (summaryList, loadedList) => {
      const map = new Map()
      for (const name of [...(summaryList || []), ...(loadedList || [])]) {
        const key = normalizeLocationKey(name)
        if (key && !map.has(key)) map.set(key, name)
      }
      return [...map.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    }
    return {
      cities: mergeNames(pipelineSummary.cities, fromLoaded.cities),
      states: mergeNames(pipelineSummary.states, fromLoaded.states),
    }
  }, [scopedLeads, pipelineSummary.cities, pipelineSummary.states])
  const tagById = useMemo(() => tagMapById(orgLeadTags), [orgLeadTags])

  const [smartViewId, setSmartViewId] = useState(null)
  const [smartViewFilters, setSmartViewFilters] = useState({})

  const serverSidePipeline = pipelineSummary.total > 120
  const [boardLeadsByStatus, setBoardLeadsByStatus] = useState(null)
  const [boardColumnTotals, setBoardColumnTotals] = useState({})
  const [boardColumnLimits, setBoardColumnLimits] = useState({})

  const findLeadInLists = useCallback(
    (leadId) => {
      if (!leadId) return null
      const fromSaved = savedLeads.find((l) => l.id === leadId)
      if (fromSaved) return fromSaved
      if (boardLeadsByStatus) {
        for (const leads of Object.values(boardLeadsByStatus)) {
          const found = (leads || []).find((l) => l.id === leadId)
          if (found) return found
        }
      }
      return null
    },
    [savedLeads, boardLeadsByStatus]
  )

  const listLead = useMemo(
    () => findLeadInLists(pipelineLeadId),
    [findLeadInLists, pipelineLeadId]
  )

  useEffect(() => {
    if (!pipelineLeadId) {
      setWorkspaceLead(null)
      return
    }
    if (listLead) {
      if (!listLead.listLight) {
        setWorkspaceLead(listLead)
        return
      }
      let cancelled = false
      setWorkspaceLead(listLead)
      api
        .getPipelineLead(pipelineLeadId, { silent: true })
        .then((data) => {
          if (!cancelled && data?.lead) setWorkspaceLead(data.lead)
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }

    let cancelled = false
    setWorkspaceLead(null)
    api
      .getPipelineLead(pipelineLeadId, { silent: true })
      .then((data) => {
        if (!cancelled && data?.lead) setWorkspaceLead(data.lead)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [pipelineLeadId, listLead])

  const selectedLead = workspaceLead
  const stageListMode = filter !== 'all'

  const filtersDirty =
    search.trim() !== appliedSearch ||
    advancedFilters.city !== appliedAdvanced.city ||
    advancedFilters.state !== appliedAdvanced.state ||
    advancedFilters.contact !== appliedAdvanced.contact ||
    (advancedFilters.tagIds || []).join(',') !== (appliedAdvanced.tagIds || []).join(',') ||
    (advancedFilters.smartTags || []).join(',') !== (appliedAdvanced.smartTags || []).join(',')

  const buildServerFilters = useCallback(
    (adv, q) => ({
      status: filter !== 'all' ? filter : undefined,
      q: q || undefined,
      city: adv.city || undefined,
      state: adv.state || undefined,
      assigneeUserId: pipelineAssigneeFilter || undefined,
      tagIds: adv.tagIds?.length ? adv.tagIds : undefined,
    }),
    [filter, pipelineAssigneeFilter]
  )

  const serverFilters = useMemo(
    () => buildServerFilters(appliedAdvanced, appliedSearch),
    [buildServerFilters, appliedAdvanced, appliedSearch]
  )

  const applyFilters = useCallback(() => {
    setAppliedSearch(search.trim())
    setAppliedAdvanced({ ...advancedFilters })
  }, [search, advancedFilters])

  const removeAppliedFilter = useCallback(
    (patch) => {
      const nextAdv = { ...appliedAdvanced, ...patch }
      const nextSearch = patch.search !== undefined ? patch.search : appliedSearch
      setAdvancedFilters((f) => ({ ...f, ...patch }))
      setAppliedAdvanced(nextAdv)
      if (patch.search !== undefined) {
        setSearch(patch.search)
        setAppliedSearch(patch.search)
      }
      if (serverSidePipeline) {
        loadPipelineList(buildServerFilters(nextAdv, nextSearch), { append: false, silent: false }).catch(
          () => {}
        )
      }
    },
    [appliedAdvanced, appliedSearch, serverSidePipeline, loadPipelineList, buildServerFilters]
  )

  const pipelineFiltersBootRef = useRef(false)
  const lastServerFiltersRef = useRef('')
  useEffect(() => {
    if (!serverSidePipeline) return undefined
    const key = JSON.stringify(serverFilters)
    if (!pipelineFiltersBootRef.current) {
      pipelineFiltersBootRef.current = true
      lastServerFiltersRef.current = key
      return undefined
    }
    if (lastServerFiltersRef.current === key) return undefined
    lastServerFiltersRef.current = key
    setBoardColumnLimits({})
    setFilterApplying(true)
    loadPipelineList(serverFilters, { append: false, silent: false })
      .catch(() => {})
      .finally(() => setFilterApplying(false))
  }, [serverSidePipeline, serverFilters, loadPipelineList])

  useEffect(() => {
    if (!serverSidePipeline || view !== 'board' || stageListMode) {
      setBoardLeadsByStatus(null)
      return undefined
    }
    let cancelled = false
    api
      .fetchPipelineBoard({ ...serverFilters, columnLimits: boardColumnLimits })
      .then((data) => {
        if (!cancelled) {
          setBoardLeadsByStatus(data.board || {})
          setBoardColumnTotals(data.columnTotals || {})
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBoardLeadsByStatus({})
          setBoardColumnTotals({})
        }
      })
    return () => {
      cancelled = true
    }
  }, [serverSidePipeline, view, stageListMode, serverFilters, boardColumnLimits])

  const filtered = useMemo(() => {
    const base = serverSidePipeline ? savedLeads : scopedLeads
    return applyPipelineFilters(base, {
      status: serverSidePipeline ? 'all' : filter,
      city: serverSidePipeline ? '' : appliedAdvanced.city,
      state: serverSidePipeline ? '' : appliedAdvanced.state,
      contact: appliedAdvanced.contact,
      tagIds: serverSidePipeline ? [] : appliedAdvanced.tagIds,
      tagMode: appliedAdvanced.tagMode,
      search: serverSidePipeline ? '' : appliedSearch,
      smartTags: appliedAdvanced.smartTags,
      ...smartViewFilters,
    })
  }, [
    scopedLeads,
    filter,
    appliedAdvanced,
    appliedSearch,
    smartViewFilters,
    serverSidePipeline,
    savedLeads,
  ])

  const applySmartView = useCallback((view) => {
    if (!view) return
    setSmartViewId(view.id)
    const f = view.filters || {}
    setSmartViewFilters({
      minLeadScore: f.minLeadScore ?? null,
      minDealValue: f.minDealValue ?? null,
      staleDays: f.staleDays ?? null,
      overdueFollowUp: f.overdueFollowUp || false,
    })
    if (f.contact) {
      setAdvancedFilters((prev) => ({ ...prev, contact: f.contact }))
      setAppliedAdvanced((prev) => ({ ...prev, contact: f.contact }))
    }
    if (f.city) {
      setAdvancedFilters((prev) => ({ ...prev, city: f.city }))
      setAppliedAdvanced((prev) => ({ ...prev, city: f.city }))
    }
    if (f.state) {
      setAdvancedFilters((prev) => ({ ...prev, state: f.state }))
      setAppliedAdvanced((prev) => ({ ...prev, state: f.state }))
    }
    if (f.status && f.status !== 'all') setFilter(f.status)
    if (f.search) {
      setSearch(f.search)
      setAppliedSearch(f.search)
    }
  }, [])

  const activeFilterCount = useMemo(
    () => countActiveFilters(appliedAdvanced, appliedSearch),
    [appliedAdvanced, appliedSearch]
  )

  const selectedLeads = useMemo(
    () => savedLeads.filter((l) => selectedIds.has(l.id)),
    [savedLeads, selectedIds]
  )

  const selectedEmailCount = useMemo(
    () => selectedLeads.filter(leadHasSendableEmail).length,
    [selectedLeads]
  )

  const selectedPhoneCount = useMemo(
    () => selectedLeads.filter(leadHasCallablePhone).length,
    [selectedLeads]
  )

  const hasMoreLeads =
    pipelineLoad.hasMore ||
    (pipelineLoad.total > pipelineLoad.loaded && pipelineLoad.loaded > 0)

  const handleLoadMore = useCallback(() => {
    loadMorePipelineLeads(serverFilters)
  }, [loadMorePipelineLeads, serverFilters])

  const showMoreInColumn = useCallback((columnId) => {
    setBoardColumnLimits((prev) => ({
      ...prev,
      [columnId]: (prev[columnId] || 50) + 50,
    }))
  }, [])

  const byStatus = useMemo(() => {
    if (serverSidePipeline && boardLeadsByStatus) return boardLeadsByStatus
    const map = Object.fromEntries(columns.map((s) => [s.id, []]))
    const hidden = []
    for (const lead of filtered) {
      const st = lead.crm?.status || 'new'
      if (map[st]) map[st].push(lead)
      else hidden.push(lead)
    }
    if (hidden.length && map[columns[0]?.id]) {
      map[columns[0].id].push(...hidden)
    }
    return map
  }, [filtered, columns, serverSidePipeline, boardLeadsByStatus])

  const clearAllFilters = useCallback(() => {
    const empty = { ...DEFAULT_PIPELINE_FILTERS }
    setSearch('')
    setAdvancedFilters(empty)
    setAppliedSearch('')
    setAppliedAdvanced(empty)
  }, [])

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map((l) => l.id)))
  }

  const toggleSelect = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const selectAllInList = (checked) => {
    if (checked) setSelectedIds(new Set(filtered.map((l) => l.id)))
    else setSelectedIds(new Set())
  }

  const selectAllInColumn = (columnId, checked) => {
    const ids = (byStatus[columnId] || []).map((l) => l.id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  const runBulk = async (actions) => {
    if (!selectedIds.size) return
    const count = selectedIds.size
    setBulkBusy(true)
    setBulkNotice(null)
    try {
      await bulkUpdatePipeline([...selectedIds], actions)
      await refreshSavedLeads()
      if (actions.status) {
        setBulkNotice(
          count === 1
            ? 'Contact updated successfully.'
            : `${count} contacts updated successfully.`
        )
      } else if (actions.assignToUserId !== undefined) {
        setBulkNotice(
          actions.assignToUserId
            ? count === 1
              ? 'Contact assigned successfully.'
              : `${count} contacts assigned successfully.`
            : count === 1
              ? 'Contact unassigned.'
              : `${count} contacts unassigned.`
        )
      } else if (actions.markReplied) {
        setBulkNotice(
          count === 1
            ? 'Contact marked as replied.'
            : `${count} contacts marked as replied.`
        )
      }
      setSelectedIds(new Set())
    } catch (e) {
      setBulkNotice(null)
      window.alert(e.message || 'Bulk update failed')
    } finally {
      setBulkBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden relative bg-[var(--color-ci-page)]">
      <div
        className={`crm-workspace flex-1 min-w-0 min-h-0 flex flex-col ${
          selectedLead ? 'hidden md:flex' : 'flex'
        }`}
      >
        <header className="crm-page-header">
          <div className="crm-page-header-top">
            <div className="min-w-0">
              <h1 className="crm-page-title">
                {stageListMode ? getStatusMeta(filter).label : 'Pipeline'}
              </h1>
              <p className="crm-page-subtitle">
                {assigneeName ? (
                  <>
                    Viewing <strong>{assigneeName}</strong>
                    {' · '}
                    <button
                      type="button"
                      className="text-[#0091ae] hover:underline"
                      onClick={() => setPipelineAssigneeFilter?.(null)}
                    >
                      Clear assignee
                    </button>
                  </>
                ) : savedLeads.length === 0 ? (
                  'Add or import leads to get started'
                ) : (
                  <>
                    {pipelineSummary.total.toLocaleString()} leads
                    {hasMoreLeads &&
                      ` · ${pipelineLoad.loaded.toLocaleString()} loaded`}
                  </>
                )}
              </p>
            </div>
            <div className="crm-page-actions">
              {!stageListMode && (
                <div className="crm-view-tabs">
                  {[
                    { id: 'board', label: 'Board' },
                    { id: 'list', label: 'List' },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setView(v.id)}
                      className={`crm-view-tab ${view === v.id ? 'is-active' : ''}`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setImportOpen(true)} className="crm-btn crm-btn-secondary">
                Import
              </button>
              <button type="button" onClick={() => setAddOpen(true)} className="crm-btn crm-btn-primary">
                Add lead
              </button>
            </div>
          </div>

          {savedLeads.length > 0 && (
            <PipelineFiltersBar
              search={search}
              onSearchChange={setSearch}
              filters={advancedFilters}
              onFiltersChange={setAdvancedFilters}
              appliedFilters={appliedAdvanced}
              appliedSearch={appliedSearch}
              filtersDirty={filtersDirty}
              onApplyFilters={applyFilters}
              applying={filterApplying}
              cities={locationOptions.cities}
              states={locationOptions.states}
              statusFilter={filter}
              onStatusFilterChange={setFilter}
              statusOptions={columns}
              resultCount={filtered.length}
              totalCount={
                serverSidePipeline && (appliedSearch || appliedAdvanced.city || appliedAdvanced.state)
                  ? pipelineLoad.total || filtered.length
                  : scopedLeads.length
              }
              pipelineTotal={pipelineSummary.total}
              onSelectAllFiltered={selectAllFiltered}
              hasActiveFilters={activeFilterCount > 0 || filter !== 'all'}
              onClearFilters={() => {
                clearAllFilters()
                setFilter('all')
                setSmartViewId(null)
                setSmartViewFilters({})
              }}
              onApplySmartView={applySmartView}
              activeSmartViewId={smartViewId}
              orgLeadTags={orgLeadTags}
              stageListMode={stageListMode}
              onRemoveAppliedFilter={removeAppliedFilter}
            />
          )}
        </header>

        <div className="crm-page-body flex-1 min-h-0">
          <div className="crm-content-card flex-1 min-h-0">
            <PipelineBulkActionsBar
            count={selectedIds.size}
            statusOptions={columns}
            teamMembers={teamMembers}
            canAssign={canAssign}
            busy={bulkBusy}
            compact={isMobile}
            onApplyStatus={(status) => runBulk({ status })}
            onAssign={(assignToUserId) => runBulk({ assignToUserId })}
            onMarkReplied={() => runBulk({ markReplied: true })}
            onEmail={() => setBulkOpen(true)}
            onWhatsApp={() => setWaOpen(true)}
            emailCount={selectedEmailCount}
            phoneCount={selectedPhoneCount}
            onClear={() => setSelectedIds(new Set())}
          />

          {bulkNotice && (
            <div
              className="shrink-0 mx-2 md:mx-4 mb-1 text-xs md:text-sm font-medium text-green-900 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 md:px-3 md:py-2"
              role="status"
            >
              {bulkNotice}
            </div>
          )}

          <div
            className={`crm-content-scroll pipeline-scroll-area ${
              view === 'board' && !stageListMode ? 'crm-content-scroll-board' : ''
            }`}
          >
          {savedLeads.length === 0 ? (
            <EmptyPipeline
              onNavigate={onNavigate}
              onImport={() => setImportOpen(true)}
              onAdd={() => setAddOpen(true)}
              compact={isMobile}
            />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto px-4">
              <div className="w-16 h-16 rounded-full bg-[#eaf0f6] flex items-center justify-center mb-4 text-2xl text-[#7c98b6]">
                ⌕
              </div>
              <p className="text-[13px] font-semibold text-[#33475b]">No leads match your filters</p>
              <p className="text-xs text-[#516f90] mt-2">
                Try adjusting search or filters, or clear all to see your full pipeline.
              </p>
              <button
                type="button"
                onClick={() => {
                  clearAllFilters()
                  setFilter('all')
                  setSmartViewId(null)
                  setSmartViewFilters({})
                }}
                className="crm-btn crm-btn-secondary mt-6"
              >
                Clear all filters
              </button>
            </div>
          ) : view === 'board' && !stageListMode ? (
            <div className="crm-kanban-board min-w-0">
              {columns.map((col) => {
                const colLeads = byStatus[col.id] || []
                const colTotal = serverSidePipeline
                  ? boardColumnTotals[col.id] ?? colLeads.length
                  : colLeads.length
                const colHasMore = serverSidePipeline && colTotal > colLeads.length
                return (
                  <KanbanColumn
                    key={col.id}
                    column={col}
                    leads={colLeads}
                    totalInColumn={colTotal}
                    hasMoreInColumn={colHasMore}
                    onShowMore={() => showMoreInColumn(col.id)}
                    selectedId={pipelineLeadId}
                    selectedIds={selectedIds}
                    onSelect={openPipelineLead}
                    onToggleSelect={toggleSelect}
                    onSelectAllInColumn={(checked) => selectAllInColumn(col.id, checked)}
                    compact={isMobile}
                    tagById={tagById}
                  />
                )
              })}
            </div>
          ) : (
            <StagePipelineList
              leads={filtered}
              selectedId={pipelineLeadId}
              selectedIds={selectedIds}
              onSelect={openPipelineLead}
              onToggleSelect={toggleSelect}
              onToggleSaveLead={toggleSaveLead}
              showStatus={!stageListMode}
              tagById={tagById}
              compact={isMobile}
            />
          )}
          </div>
          {(view === 'list' || stageListMode) && hasMoreLeads && filtered.length > 0 && (
            <div className="crm-load-more-bar">
              <PipelineLoadMoreBar
                loaded={pipelineLoad.loaded}
                total={pipelineLoad.total || pipelineSummary.total}
                loading={pipelineLoad.loadingMore}
                onLoadMore={handleLoadMore}
              />
            </div>
          )}
          </div>
        </div>
      </div>

      {pipelineLeadId && !selectedLead && (
        <div className="hidden md:flex w-[min(420px,40%)] shrink-0 border-l border-gray-200 bg-white items-center justify-center text-xs text-gray-500">
          Loading lead…
        </div>
      )}

      {selectedLead && (
        <LeadWorkspace
          lead={selectedLead}
          statusOptions={columns}
          onClose={() => setPipelineLeadId(null)}
          onNavigate={onNavigate}
        />
      )}

      <AddLeadModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={() => refreshSavedLeads()}
      />
      <PipelineImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          refreshSavedLeads()
          setImportOpen(false)
        }}
      />
      <BulkEmailModal
        open={bulkOpen}
        leadIds={[...selectedIds]}
        leads={selectedLeads.filter(leadHasSendableEmail)}
        onClose={() => setBulkOpen(false)}
        onDone={() => {
          setBulkOpen(false)
          setSelectedIds(new Set())
          refreshSavedLeads()
        }}
      />
      <BulkWhatsAppModal open={waOpen} leads={selectedLeads} onClose={() => setWaOpen(false)} />
    </div>
  )
}

function PipelineLoadMoreBar({ loaded, total, loading, onLoadMore }) {
  return (
    <>
      <p className="text-sm text-[#516f90]">
        Showing <strong className="text-[#33475b]">{loaded.toLocaleString()}</strong> of{' '}
        <strong className="text-[#33475b]">{total.toLocaleString()}</strong> leads
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={onLoadMore}
        className="crm-btn crm-btn-primary"
      >
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </>
  )
}

function StagePipelineList({
  leads,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onToggleSaveLead,
  showStatus = true,
  tagById,
  compact = false,
}) {
  if (!leads.length) return null

  return (
    <ul className={`space-y-1.5 ${compact ? 'pb-2' : 'pb-3'}`}>
      {leads.map((lead) => {
        const meta = getStatusMeta(lead.crm?.status)
        const loc = [getLeadCity(lead), getLeadState(lead)].filter(Boolean).join(', ')
        const isSelected = selectedId === lead.id
        return (
          <li key={lead.id}>
            <div
              className={`crm-lead-card ${isSelected ? 'is-selected' : ''} ${
                selectedIds.has(lead.id) ? 'ring-1 ring-slate-300' : ''
              }`}
            >
              <div className="flex items-stretch gap-0 min-h-[52px]">
                <label className="flex items-center pl-2 pr-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={(e) => onToggleSelect(lead.id, e.target.checked)}
                    aria-label="Select lead"
                    className="w-3.5 h-3.5"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onSelect(lead.id)}
                  className="flex-1 min-w-0 text-left py-2 pr-1.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#1e2f3d] truncate leading-tight tracking-tight">
                        {lead.firstName} {lead.lastName}
                      </p>
                      <p className="text-[11px] text-[#4a6578] truncate mt-0.5 leading-snug">{lead.company || '—'}</p>
                    </div>
                    {showStatus && (
                      <span className={`shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded border ${meta.color}`}>
                        {meta.label}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-[#5f7d94] leading-snug">
                    {lead.email && <span className="truncate max-w-[200px]">{lead.email}</span>}
                    {lead.phone && <span>{lead.phone}</span>}
                    {loc && <span>{loc}</span>}
                    {lead.title && <span className="text-gray-400">{lead.title}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {leadHasSendableEmail(lead) && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-800 font-medium">
                        Email
                      </span>
                    )}
                    {leadHasCallablePhone(lead) && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-green-50 text-green-800 font-medium">
                        Phone
                      </span>
                    )}
                    {lead.crm?.responseReceived && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-violet-50 text-violet-800 font-medium">
                        Replied
                      </span>
                    )}
                    {lead.crm?.lastEmailSentAt && (
                      <span className="text-[9px] text-[#5f7d94]">
                        Emailed {formatCrmDate(lead.crm.lastEmailSentAt)}
                      </span>
                    )}
                    {lead.crm?.nextFollowUpAt && (
                      <span className="text-[9px] text-amber-800">
                        Follow-up {formatCrmDate(lead.crm.nextFollowUpAt)}
                      </span>
                    )}
                    <LeadTagDots lead={lead} tagById={tagById} />
                  </div>
                </button>
                <div className="flex flex-col justify-center gap-0.5 pr-2 shrink-0 border-l border-slate-100 pl-1.5">
                  <button
                    type="button"
                    onClick={() => onSelect(lead.id, 'overview')}
                    className="crm-btn crm-btn-sm crm-btn-primary"
                  >
                    Open
                  </button>
                  {leadHasSendableEmail(lead) && (
                    <button
                      type="button"
                      onClick={() => onSelect(lead.id, 'email')}
                      className="crm-btn crm-btn-sm crm-btn-secondary"
                    >
                      Email
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleSaveLead(lead)}
                    className="text-[9px] text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function KanbanColumn({
  column,
  leads,
  totalInColumn = 0,
  hasMoreInColumn = false,
  onShowMore,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onSelectAllInColumn,
  tagById,
  compact = false,
}) {
  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id))

  return (
    <div className={`crm-kanban-column ${compact ? 'w-[200px]' : ''}`}>
      <div className="crm-kanban-column-header flex items-center justify-between gap-1">
        <span className="truncate">{column.label}</span>
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAllInColumn(e.target.checked)}
            title={`Select all in ${column.label}`}
            aria-label={`Select all in ${column.label}`}
            className="w-3.5 h-3.5"
          />
          <span className="text-[10px] font-medium text-[#4a6578] bg-[#eaf0f6] px-1.5 py-0.5 rounded tabular-nums">
            {leads.length}
            {totalInColumn > leads.length ? ` / ${totalInColumn}` : ''}
          </span>
        </div>
      </div>
      <div className="crm-kanban-column-body">
        {leads.length === 0 ? (
          <p className="text-xs text-[#7c98b6] text-center py-6">No leads</p>
        ) : (
          leads.map((lead) => (
            <div
              key={lead.id}
              className={`crm-kanban-card ${selectedId === lead.id ? 'is-active' : ''} ${
                selectedIds.has(lead.id) ? 'ring-1 ring-slate-400' : ''
              }`}
            >
              <div className="flex items-start gap-1 p-1.5">
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={selectedIds.has(lead.id)}
                  onChange={(e) => onToggleSelect(lead.id, e.target.checked)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Select lead"
                />
                <button
                  type="button"
                  onClick={() => onSelect(lead.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="text-[11px] font-medium text-[#1e2f3d] truncate leading-tight">
                    {lead.firstName} {lead.lastName}
                  </div>
                  <div className="text-[10px] text-[#4a6578] truncate mt-0.5 leading-snug">{lead.company}</div>
                  <LeadTagDots lead={lead} tagById={tagById} />
                  {lead.crm?.lastEmailSentAt && (
                    <div className="text-[10px] text-gray-400 mt-1">
                      Emailed {formatCrmDate(lead.crm.lastEmailSentAt)}
                    </div>
                  )}
                  {lead.crm?.responseReceived && (
                    <div className="text-[10px] text-violet-700 mt-0.5 font-medium">Replied</div>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {hasMoreInColumn && onShowMore && (
        <div className="shrink-0 p-2 border-t border-[#dfe3eb]">
          <button type="button" onClick={onShowMore} className="crm-btn crm-btn-secondary w-full text-xs py-2">
            Show more ({totalInColumn - leads.length} left)
          </button>
        </div>
      )}
    </div>
  )
}

function LeadTagDots({ lead, tagById }) {
  if (!tagById?.size) return null
  const tags = (lead.crm?.tagIds || []).map((id) => tagById.get(id)).filter(Boolean)
  if (!tags.length) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.slice(0, 4).map((tag) => (
        <span
          key={tag.id}
          className="text-[9px] font-semibold px-1.5 py-0 rounded text-white max-w-[72px] truncate"
          style={{ backgroundColor: tag.color }}
          title={tag.name}
        >
          {tag.name}
        </span>
      ))}
      {tags.length > 4 && <span className="text-[9px] text-gray-400">+{tags.length - 4}</span>}
    </div>
  )
}

function EmptyPipeline({ onNavigate, onImport, onAdd, compact = false }) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center max-w-lg mx-auto px-2 ${
        compact ? 'py-8' : 'py-16'
      }`}
    >
      <div
        className={`w-full rounded-2xl border border-gray-200 bg-white shadow-sm ${
          compact ? 'p-5' : 'p-8'
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8a6600] mb-2">Step 1 — CRM</p>
        <h3 className="text-[13px] font-semibold text-gray-900 mb-2">Build your pipeline first</h3>
        <p className="text-sm text-gray-500 leading-relaxed">
          Connect Intel is your team CRM. Add or import the leads you are already working, assign owners, and
          track follow-ups. When your pipeline is ready, use AI prospect search to find new opportunities.
        </p>
        <div className="flex flex-col gap-2 mt-6">
          <button
            type="button"
            onClick={() => onAdd?.()}
            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg"
          >
            Add lead manually
          </button>
          <button
            type="button"
            onClick={onImport}
            className="px-5 py-2.5 border-2 border-[#ffcb2b] text-[#242424] text-sm font-semibold rounded-lg"
          >
            Import CSV / Excel
          </button>
        </div>
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Step 2 — AI</p>
          <button
            type="button"
            onClick={() => onNavigate?.('search')}
            className="w-full px-5 py-2.5 border border-gray-200 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-50"
          >
            Search prospects with AI
          </button>
          <p className="text-[11px] text-gray-400 mt-2">50+ matches · 10 full previews · unlock with credits</p>
        </div>
      </div>
    </div>
  )
}
