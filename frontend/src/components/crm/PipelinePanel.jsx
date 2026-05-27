import { useCallback, useEffect, useDeferredValue, useMemo, useRef, useState } from 'react'
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
} from '../../lib/pipelineFilters'
import { tagMapById } from '../../lib/orgLeadTags'
import { leadHasCallablePhone } from '../../lib/phoneUtils'
import { leadHasSendableEmail } from '../../lib/emailUtils'
import { formatDealValue } from '../../lib/crmTimeline'
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
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)
  const [filter, setFilter] = useState(panelOptions?.status || 'all')
  const [search, setSearch] = useState('')
  const [advancedFilters, setAdvancedFilters] = useState({ ...DEFAULT_PIPELINE_FILTERS })
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
    if (panelOptions?.status) setFilter(panelOptions.status)
  }, [panelOptions?.status])

  const listLead = useMemo(
    () => savedLeads.find((l) => l.id === pipelineLeadId) || null,
    [savedLeads, pipelineLeadId]
  )

  const [workspaceLead, setWorkspaceLead] = useState(null)

  useEffect(() => {
    if (!pipelineLeadId) {
      setWorkspaceLead(null)
      return
    }
    if (!listLead) {
      setWorkspaceLead(null)
      return
    }
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
  }, [pipelineLeadId, listLead])

  const selectedLead = workspaceLead

  useEffect(() => {
    if (pipelineLeadId && !listLead) {
      setPipelineLeadId(null)
    }
  }, [pipelineLeadId, listLead, setPipelineLeadId])

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

  const locationOptions = useMemo(() => collectLocationOptions(scopedLeads), [scopedLeads])
  const tagById = useMemo(() => tagMapById(orgLeadTags), [orgLeadTags])

  const [smartViewId, setSmartViewId] = useState(null)
  const [smartViewFilters, setSmartViewFilters] = useState({})

  const serverSidePipeline = pipelineSummary.total > 120
  const [boardLeadsByStatus, setBoardLeadsByStatus] = useState(null)

  const deferFilters = !serverSidePipeline && scopedLeads.length > 60
  const deferredSearch = useDeferredValue(search)
  const deferredAdvancedFilters = useDeferredValue(advancedFilters)
  const filterSearch = deferFilters ? deferredSearch : search
  const filterAdvanced = deferFilters ? deferredAdvancedFilters : advancedFilters
  const isFilterPending =
    deferFilters && (search !== deferredSearch || advancedFilters !== deferredAdvancedFilters)

  const serverFilters = useMemo(
    () => ({
      status: filter !== 'all' ? filter : undefined,
      q: search.trim() || undefined,
      assigneeUserId: pipelineAssigneeFilter || undefined,
      tagIds: filterAdvanced.tagIds?.length ? filterAdvanced.tagIds : undefined,
    }),
    [filter, search, pipelineAssigneeFilter, filterAdvanced.tagIds]
  )

  const pipelineFiltersBootRef = useRef(false)
  useEffect(() => {
    if (!serverSidePipeline) return undefined
    if (!pipelineFiltersBootRef.current) {
      pipelineFiltersBootRef.current = true
      return undefined
    }
    const timer = setTimeout(() => {
      loadPipelineList(serverFilters, { append: false, silent: true }).catch(() => {})
    }, 350)
    return () => clearTimeout(timer)
  }, [serverSidePipeline, serverFilters, loadPipelineList])

  useEffect(() => {
    if (!serverSidePipeline || view !== 'board') {
      setBoardLeadsByStatus(null)
      return undefined
    }
    let cancelled = false
    api
      .fetchPipelineBoard(serverFilters)
      .then((data) => {
        if (!cancelled) setBoardLeadsByStatus(data.board || {})
      })
      .catch(() => {
        if (!cancelled) setBoardLeadsByStatus({})
      })
    return () => {
      cancelled = true
    }
  }, [serverSidePipeline, view, serverFilters])

  const filtered = useMemo(
    () => {
      if (serverSidePipeline) return savedLeads
      return applyPipelineFilters(scopedLeads, {
        status: filter,
        city: filterAdvanced.city,
        state: filterAdvanced.state,
        contact: filterAdvanced.contact,
        tagIds: filterAdvanced.tagIds,
        tagMode: filterAdvanced.tagMode,
        search: filterSearch,
        ...smartViewFilters,
      })
    },
    [scopedLeads, filter, filterAdvanced, filterSearch, smartViewFilters, serverSidePipeline, savedLeads]
  )

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
    if (f.contact) setAdvancedFilters((prev) => ({ ...prev, contact: f.contact }))
    if (f.city) setAdvancedFilters((prev) => ({ ...prev, city: f.city }))
    if (f.state) setAdvancedFilters((prev) => ({ ...prev, state: f.state }))
    if (f.status && f.status !== 'all') setFilter(f.status)
    if (f.search) setSearch(f.search)
  }, [])

  const activeFilterCount = useMemo(
    () => countActiveFilters(advancedFilters, search),
    [advancedFilters, search]
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
    (pipelineSummary.total > savedLeads.length && savedLeads.length > 0)

  const handleLoadMore = useCallback(() => {
    if (view === 'board') setView('list')
    loadMorePipelineLeads(serverFilters)
  }, [view, loadMorePipelineLeads, serverFilters])

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

  const clearAllFilters = () => {
    setSearch('')
    setAdvancedFilters({ ...DEFAULT_PIPELINE_FILTERS })
  }

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map((l) => l.id)))
  }

  const stats = useMemo(
    () => ({
      total: scopedLeads.length,
      contacted: scopedLeads.filter((l) => l.crm?.lastEmailSentAt).length,
      replied: scopedLeads.filter((l) => l.crm?.responseReceived).length,
    }),
    [scopedLeads]
  )

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
    <div className="flex h-full min-h-0 w-full overflow-hidden relative">
      <div
        className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden ${
          selectedLead ? 'hidden md:flex' : 'flex'
        }`}
      >
        <header className="shrink-0 bg-white border-b border-gray-200 px-2.5 py-2 md:px-4 md:py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-sm md:text-base font-semibold text-gray-900">Pipeline</h1>
              {assigneeName ? (
                <p className="text-[10px] md:text-[11px] text-[#8a6600] mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="truncate">
                    <strong>{assigneeName}</strong>
                  </span>
                  <button
                    type="button"
                    className="underline shrink-0"
                    onClick={() => setPipelineAssigneeFilter?.(null)}
                  >
                    Clear
                  </button>
                </p>
              ) : (
                <p className="text-[10px] md:text-[11px] text-gray-500 mt-0.5 truncate">
                  {savedLeads.length === 0
                    ? 'Add or import leads'
                    : hasMoreLeads
                      ? `${savedLeads.length.toLocaleString()} loaded · ${pipelineSummary.total.toLocaleString()} total — use Load more below`
                      : `${filtered.length} shown · ${pipelineSummary.total.toLocaleString()} in pipeline`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="text-[11px] md:text-xs font-semibold px-2 py-1 md:px-3 md:py-1.5 bg-gray-900 text-white rounded-md"
              >
                + Add
              </button>
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="text-[11px] md:text-xs font-medium px-2 py-1 md:px-3 md:py-1.5 border border-[#ffcb2b] bg-[#fffbeb] rounded-md"
              >
                Import
              </button>
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setMobileActionsOpen((v) => !v)}
                  className="text-[11px] font-medium px-2 py-1 border border-gray-200 rounded-md bg-white"
                  aria-expanded={mobileActionsOpen}
                >
                  ⋯
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('marketing')}
                    className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    Bulk email
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate?.('search')}
                    className="text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
                  >
                    AI search
                  </button>
                </>
              )}
            </div>
          </div>

          {isMobile && mobileActionsOpen && (
            <div className="mt-2 flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => {
                  onNavigate?.('marketing')
                  setMobileActionsOpen(false)
                }}
                className="text-[10px] font-medium px-2 py-1 border border-gray-200 rounded-md bg-gray-50"
              >
                Bulk email
              </button>
              <button
                type="button"
                onClick={() => {
                  onNavigate?.('search')
                  setMobileActionsOpen(false)
                }}
                className="text-[10px] font-medium px-2 py-1 border border-gray-200 rounded-md bg-gray-50"
              >
                AI search
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5 mt-1.5 md:mt-2">
            <div className="hidden sm:flex gap-1 text-[10px] md:text-[11px] overflow-x-auto no-scrollbar">
              <MiniStat label="Saved" value={stats.total} compact />
              <MiniStat label="Sent" value={stats.contacted} compact />
              <MiniStat label="Reply" value={stats.replied} compact />
            </div>
            <div className="flex gap-0.5 ml-auto shrink-0">
              {[
                { id: 'list', label: 'List' },
                { id: 'board', label: 'Board' },
              ].map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  className={`px-2 py-0.5 md:px-2.5 md:py-1 rounded-md text-[10px] md:text-xs font-semibold ${
                    view === v.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {savedLeads.length > 0 && (
            <PipelineFiltersBar
              compact={isMobile}
              search={search}
              onSearchChange={setSearch}
              filters={advancedFilters}
              onFiltersChange={setAdvancedFilters}
              cities={locationOptions.cities}
              states={locationOptions.states}
              statusFilter={filter}
              onStatusFilterChange={setFilter}
              statusOptions={columns}
              resultCount={filtered.length}
              totalCount={scopedLeads.length}
              onSelectAllFiltered={selectAllFiltered}
              selectableCount={filtered.length}
              hasActiveFilters={activeFilterCount > 0 || filter !== 'all' || Boolean(search.trim())}
              onClearFilters={() => {
                clearAllFilters()
                setFilter('all')
                setSmartViewId(null)
                setSmartViewFilters({})
              }}
              onApplySmartView={applySmartView}
              activeSmartViewId={smartViewId}
              orgLeadTags={orgLeadTags}
            />
          )}
        </header>

        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
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

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pipeline-scroll-area px-2 pb-3 pt-1 md:px-4 md:pb-4 md:pt-2 touch-pan-y">
          {savedLeads.length === 0 ? (
            <EmptyPipeline
              onNavigate={onNavigate}
              onImport={() => setImportOpen(true)}
              onAdd={() => setAddOpen(true)}
              compact={isMobile}
            />
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 md:py-16 text-center max-w-md mx-auto px-2">
              <p className="text-sm font-medium text-gray-900">No leads match your filters</p>
              <p className="text-xs text-gray-500 mt-2">Try clearing search or contact filters.</p>
              <button
                type="button"
                onClick={() => {
                  clearAllFilters()
                  setFilter('all')
                  setSmartViewId(null)
                  setSmartViewFilters({})
                }}
                className="mt-4 text-xs font-semibold px-4 py-2 border border-gray-200 rounded-lg hover:bg-white"
              >
                Clear all filters
              </button>
            </div>
          ) : view === 'board' ? (
            <div
              className={`flex gap-2 md:gap-3 overflow-x-auto overflow-y-hidden pb-1 ${
                isMobile ? 'h-[min(68dvh,560px)] min-h-[300px]' : 'h-full min-h-[min(100%,520px)]'
              }`}
            >
              {columns.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  leads={byStatus[col.id] || []}
                  selectedId={pipelineLeadId}
                  selectedIds={selectedIds}
                  onSelect={openPipelineLead}
                  onToggleSelect={toggleSelect}
                  onSelectAllInColumn={(checked) => selectAllInColumn(col.id, checked)}
                  compact={isMobile}
                  tagById={tagById}
                />
              ))}
            </div>
          ) : isMobile ? (
            <MobilePipelineList
              leads={filtered}
              columns={columns}
              selectedId={pipelineLeadId}
              selectedIds={selectedIds}
              onSelect={openPipelineLead}
              onToggleSelect={toggleSelect}
              onToggleSaveLead={toggleSaveLead}
            />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden min-h-0 flex flex-col">
              <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-10 px-2 py-3">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && filtered.every((l) => selectedIds.has(l.id))}
                        onChange={(e) => selectAllInList(e.target.checked)}
                        aria-label="Select all in list"
                      />
                    </th>
                    {['Name', 'Company', 'Location', 'Status', 'Last email', 'Response', ''].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead) => {
                    const meta = getStatusMeta(lead.crm?.status)
                    return (
                      <tr
                        key={lead.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                          pipelineLeadId === lead.id ? 'bg-[#fffbeb]' : ''
                        }`}
                        onClick={() => openPipelineLead(lead.id)}
                      >
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(lead.id)}
                            onChange={(e) => toggleSelect(lead.id, e.target.checked)}
                            aria-label="Select lead"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            <span>
                              {lead.firstName} {lead.lastName}
                            </span>
                            <span className="flex gap-1 shrink-0">
                              {leadHasSendableEmail(lead) && (
                                <span
                                  className="text-[9px] font-bold px-1 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100"
                                  title="Has email"
                                >
                                  ✉
                                </span>
                              )}
                              {leadHasCallablePhone(lead) && (
                                <span
                                  className="text-[9px] font-bold px-1 py-0.5 rounded bg-green-50 text-green-700 border border-green-100"
                                  title="Has phone"
                                >
                                  ☎
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{lead.company}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {[lead.city, lead.state].filter(Boolean).join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${meta.color}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {formatCrmDate(lead.crm?.lastEmailSentAt)}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {lead.crm?.responseReceived ? (
                            <span className="text-green-700 font-medium">Yes</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSaveLead(lead)
                            }}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
          </div>
          {hasMoreLeads && savedLeads.length > 0 && filtered.length > 0 && (
            <PipelineLoadMoreBar
              loaded={savedLeads.length}
              total={pipelineSummary.total}
              loading={pipelineLoad.loadingMore}
              view={view}
              onLoadMore={handleLoadMore}
            />
          )}
        </div>
      </div>

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

function PipelineLoadMoreBar({ loaded, total, loading, view, onLoadMore }) {
  return (
    <div
      className="shrink-0 z-10 border-t border-[#ffcb2b]/40 bg-[#fffbeb] px-3 py-2.5 md:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-[0_-6px_16px_rgba(0,0,0,0.06)]"
      role="region"
      aria-label="Load more pipeline leads"
    >
      <p className="text-xs text-gray-800">
        Showing <strong>{loaded.toLocaleString()}</strong> of{' '}
        <strong>{total.toLocaleString()}</strong> leads
        {view === 'board' ? (
          <span className="block sm:inline sm:ml-1 text-[10px] text-gray-600 font-normal">
            (board shows up to 50 per stage — load more opens list view)
          </span>
        ) : null}
      </p>
      <button
        type="button"
        disabled={loading}
        onClick={onLoadMore}
        className="text-xs font-semibold px-4 py-2 rounded-lg bg-gray-900 text-white disabled:opacity-50 shrink-0 w-full sm:w-auto"
      >
        {loading ? 'Loading…' : 'Load more leads'}
      </button>
    </div>
  )
}

function MobilePipelineList({
  leads,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onToggleSaveLead,
}) {
  return (
    <ul className="space-y-1.5 pb-2">
      {leads.map((lead) => {
        const meta = getStatusMeta(lead.crm?.status)
        const loc = [getLeadCity(lead), getLeadState(lead)].filter(Boolean).join(', ')
        return (
          <li key={lead.id}>
            <div
              className={`rounded-lg border bg-white ${
                selectedId === lead.id ? 'border-[#ffcb2b] ring-1 ring-[#ffcb2b]/40' : 'border-gray-200'
              } ${selectedIds.has(lead.id) ? 'ring-1 ring-gray-300' : ''}`}
            >
              <div className="flex items-stretch gap-0">
                <label className="flex items-center pl-2 pr-0.5 py-2 shrink-0">
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
                  className="flex-1 min-w-0 text-left py-2 pr-2"
                >
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-semibold text-gray-900 truncate leading-tight">
                      {lead.firstName} {lead.lastName}
                    </p>
                    <span
                      className={`shrink-0 text-[9px] font-bold px-1 py-0.5 rounded border ${meta.color}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate mt-0.5">{lead.company || '—'}</p>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    {leadHasSendableEmail(lead) && (
                      <span className="text-[9px] px-1 rounded bg-blue-50 text-blue-700">✉</span>
                    )}
                    {leadHasCallablePhone(lead) && (
                      <span className="text-[9px] px-1 rounded bg-green-50 text-green-700">☎</span>
                    )}
                    {lead.crm?.leadScore != null && (
                      <span className="text-[9px] text-gray-500">Score {lead.crm.leadScore}</span>
                    )}
                    {lead.crm?.dealValue > 0 && (
                      <span className="text-[9px] font-medium text-gray-700">
                        {formatDealValue(lead.crm.dealValue)}
                      </span>
                    )}
                  </div>
                  {loc && <p className="text-[9px] text-gray-400 truncate mt-0.5">{loc}</p>}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSaveLead(lead)}
                  className="shrink-0 px-2 text-[10px] text-red-500 border-l border-gray-100"
                  aria-label="Remove from pipeline"
                >
                  ×
                </button>
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
    <div
      className={`${
        compact ? 'w-[168px]' : 'w-[220px]'
      } shrink-0 flex flex-col h-full min-h-0 max-h-full bg-gray-100/80 rounded-xl border border-gray-200/80`}
    >
      <div className="shrink-0 px-2.5 py-2 md:px-3 md:py-2.5 border-b border-gray-200/60 flex items-center justify-between gap-1">
        <span className="text-xs font-semibold text-gray-700">{column.label}</span>
        <div className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAllInColumn(e.target.checked)}
            title={`Select all in ${column.label}`}
            aria-label={`Select all in ${column.label}`}
            className="w-3.5 h-3.5"
          />
          <span className="text-[10px] font-bold text-gray-500 bg-white px-1.5 py-0.5 rounded">
            {leads.length}
          </span>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-2 space-y-2 overflow-y-auto">
        {leads.length === 0 ? (
          <p className="text-[10px] text-gray-400 text-center py-4">No leads</p>
        ) : (
          leads.map((lead) => (
            <div
              key={lead.id}
              className={`rounded-lg border bg-white transition-colors ${
                selectedId === lead.id ? 'border-[#ffcb2b] ring-1 ring-[#ffcb2b]/30' : 'border-gray-200'
              } ${selectedIds.has(lead.id) ? 'ring-1 ring-gray-400' : ''}`}
            >
              <div className="flex items-start gap-1 p-2">
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
                  <div className="text-xs font-semibold text-gray-900 truncate">
                    {lead.firstName} {lead.lastName}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate mt-0.5">{lead.company}</div>
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
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Build your pipeline first</h3>
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

function MiniStat({ label, value, compact = false }) {
  return (
    <span
      className={`rounded-md bg-gray-100 text-gray-700 font-medium whitespace-nowrap ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      }`}
    >
      {label}: <strong>{value}</strong>
    </span>
  )
}

