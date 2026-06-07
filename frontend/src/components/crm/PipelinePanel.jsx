import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { formatCrmDate, getStatusMeta, getVisiblePipelineColumns } from '../../lib/crmConstants'
import { PipelineIcon, PlusIcon, UploadIcon } from '../ui/icons'
import LeadWorkspace from './LeadWorkspace'
import PipelineImportModal from './PipelineImportModal'
import BulkEmailModal from './BulkEmailModal'
import AddLeadModal from './AddLeadModal'
import PipelineBulkActionsBar from './PipelineBulkActionsBar'
import { PipelineBulkAssignModal, PipelineBulkEditModal } from './PipelineBulkModals'
import BulkLeadTagsModal from './BulkLeadTagsModal'
import PipelineViewSettings from './PipelineViewSettings'
import PipelineLeadsTable from './PipelineLeadsTable'
import LeadTagDots from './LeadTagDots'
import PipelineFiltersBar, { DEFAULT_PIPELINE_FILTERS } from './PipelineFiltersBar'
import PipelineMobileHeaderChrome from './PipelineMobileHeaderChrome'
import BulkWhatsAppModal from './BulkWhatsAppModal'
import {
  applyPipelineFilters,
  collectLocationOptions,
  countActiveFilters,
  getFilterCities,
  getFilterStates,
  leadMatchesAssignee,
  normalizeLocationKey,
} from '../../lib/pipelineFilters'
import { tagMapById } from '../../lib/orgLeadTags'
import { leadHasCallablePhone } from '../../lib/phoneUtils'
import LeadPhoneCall from './LeadPhoneCall'
import { leadHasSendableEmail, getLeadEmail } from '../../lib/emailUtils'
import { getLeadCity, getLeadState } from '../../lib/pipelineFilters'
import PipelineDealsView from './PipelineDealsView'
import { isFreightDealOrg } from '../../lib/freightDeal'
import { getDealStageMeta } from '../../lib/crmConstants'
import EmailValidationIcon from './EmailValidationIcon'

import { hasActiveTextSelection } from '../../lib/keyboardShortcuts'
import useIsMobile from '../../hooks/useIsMobile'
import usePipelineFilterMobile, { usePipelineNarrowViewport } from '../../hooks/usePipelineFilterMobile'

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
    closePipelineLead,
    openPipelineLead,
    refreshSavedLeads,
    refreshPipelineLead,
    pipelineLeadDetailAt,
    pipelineAssigneeFilter,
    setPipelineAssigneeFilter,
    teamMembers,
    refreshTeam,
    bulkUpdatePipeline,
    orgLeadTags,
  } = useApp()

  const columns = useMemo(() => getVisiblePipelineColumns(user), [user])
  const isMobile = useIsMobile()
  const useMobileFilterSheet = usePipelineFilterMobile()
  const usePipelineNarrow = usePipelineNarrowViewport()
  const [view, setView] = useState('list')
  const [filter, setFilter] = useState(panelOptions?.status || 'all')
  /** Status picked from toolbar on All Leads — does not change sidebar stage navigation. */
  const [listStatusFilter, setListStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [advancedFilters, setAdvancedFilters] = useState({ ...DEFAULT_PIPELINE_FILTERS })
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedAdvanced, setAppliedAdvanced] = useState({ ...DEFAULT_PIPELINE_FILTERS })
  const [filterApplying, setFilterApplying] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [importOpen, setImportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkTagsOpen, setBulkTagsOpen] = useState(false)
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkNotice, setBulkNotice] = useState(null)

  const canAssign = Boolean(
    (user?.isOrgAdmin || user?.orgRole === 'org_admin') && user?.accountType === 'company'
  )

  useEffect(() => {
    if (canAssign) refreshTeam?.()
  }, [canAssign, refreshTeam])

  const freightOrg = isFreightDealOrg(user)
  const isDealsView = freightOrg && panelOptions?.view === 'deals'
  const dealsStage = panelOptions?.dealStage || 'all'

  useEffect(() => {
    if (panelOptions?.view === 'deals') return
    if (panelOptions?.status) {
      setFilter(panelOptions.status)
      if (panelOptions.status !== 'all') {
        setView('list')
        setListStatusFilter('all')
      }
    }
  }, [panelOptions?.status, panelOptions?.view])

  const dealsStageLabel = useMemo(() => {
    if (dealsStage === 'all') return 'All open deals'
    return getDealStageMeta(dealsStage, { freightOrg: true }).label
  }, [dealsStage])

  const openDealFromPipeline = useCallback(
    (leadId, tab = 'deals') => {
      openPipelineLead(leadId, tab)
    },
    [openPipelineLead]
  )

  const [workspaceLead, setWorkspaceLead] = useState(null)

  useEffect(() => {
    if (!bulkNotice) return
    const timer = setTimeout(() => setBulkNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [bulkNotice])

  const assigneeName = useMemo(() => {
    if (!pipelineAssigneeFilter) return null
    const m = teamMembers.find((t) => String(t.userId) === String(pipelineAssigneeFilter))
    return m?.name || 'Team member'
  }, [pipelineAssigneeFilter, teamMembers])

  const scopedLeads = useMemo(() => {
    if (!pipelineAssigneeFilter) return savedLeads
    return savedLeads.filter((l) => leadMatchesAssignee(l, pipelineAssigneeFilter))
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
          if (!cancelled && data?.lead) {
            setWorkspaceLead((prev) => ({
              ...data.lead,
              assignedToUserId:
                data.lead.assignedToUserId ?? prev?.assignedToUserId ?? listLead?.assignedToUserId ?? null,
              savedByUserId:
                data.lead.savedByUserId ?? prev?.savedByUserId ?? listLead?.savedByUserId ?? null,
            }))
          }
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
  }, [pipelineLeadId, listLead, pipelineLeadDetailAt])

  const selectedLead = workspaceLead
  const stageListMode = filter !== 'all'
  const pipelineStatusFilter = stageListMode ? filter : listStatusFilter

  const filtersDirty =
    search.trim() !== appliedSearch ||
    getFilterCities(advancedFilters).join('|') !== getFilterCities(appliedAdvanced).join('|') ||
    getFilterStates(advancedFilters).join('|') !== getFilterStates(appliedAdvanced).join('|') ||
    advancedFilters.contact !== appliedAdvanced.contact ||
    (advancedFilters.tagIds || []).join(',') !== (appliedAdvanced.tagIds || []).join(',') ||
    (advancedFilters.smartTags || []).join(',') !== (appliedAdvanced.smartTags || []).join(',')

  const buildServerFilters = useCallback(
    (adv, q) => ({
      status:
        filter !== 'all' ? filter : listStatusFilter !== 'all' ? listStatusFilter : undefined,
      q: q || undefined,
      cities: getFilterCities(adv).length ? getFilterCities(adv) : undefined,
      states: getFilterStates(adv).length ? getFilterStates(adv) : undefined,
      assigneeUserId: pipelineAssigneeFilter || undefined,
      tagIds: adv.tagIds?.length ? adv.tagIds : undefined,
    }),
    [filter, listStatusFilter, pipelineAssigneeFilter]
  )

  const serverFilters = useMemo(
    () => buildServerFilters(appliedAdvanced, appliedSearch),
    [buildServerFilters, appliedAdvanced, appliedSearch]
  )

  const hasActiveServerFilters = useMemo(
    () =>
      Boolean(
        serverFilters.assigneeUserId ||
          serverFilters.status ||
          serverFilters.q ||
          serverFilters.cities?.length ||
          serverFilters.states?.length ||
          serverFilters.tagIds?.length
      ),
    [serverFilters]
  )

  const applyFilters = useCallback((opts) => {
    const nextAdv = opts?.advanced ? { ...opts.advanced } : { ...advancedFilters }
    const nextSearch =
      opts?.search !== undefined ? String(opts.search).trim() : search.trim()
    if (opts?.advanced) setAdvancedFilters(nextAdv)
    if (opts?.search !== undefined) setSearch(String(opts.search))
    setAppliedSearch(nextSearch)
    setAppliedAdvanced(nextAdv)
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
    if (lastServerFiltersRef.current === key) return undefined

    const isInitialMount = !pipelineFiltersBootRef.current
    pipelineFiltersBootRef.current = true

    // Workspace bootstrap loads unfiltered leads; only skip the first fetch when no filters apply.
    if (isInitialMount && !hasActiveServerFilters) {
      lastServerFiltersRef.current = key
      return undefined
    }

    lastServerFiltersRef.current = key
    setBoardColumnLimits({})
    setFilterApplying(true)
    loadPipelineList(serverFilters, { append: false, silent: false })
      .catch(() => {})
      .finally(() => setFilterApplying(false))
  }, [serverSidePipeline, serverFilters, loadPipelineList, hasActiveServerFilters])

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
    const base =
      serverSidePipeline && pipelineAssigneeFilter ? scopedLeads : serverSidePipeline ? savedLeads : scopedLeads
    return applyPipelineFilters(base, {
      status: serverSidePipeline ? 'all' : pipelineStatusFilter,
      cities: serverSidePipeline ? [] : getFilterCities(appliedAdvanced),
      states: serverSidePipeline ? [] : getFilterStates(appliedAdvanced),
      contact: appliedAdvanced.contact,
      tagIds: serverSidePipeline ? [] : appliedAdvanced.tagIds,
      tagMode: appliedAdvanced.tagMode,
      search: serverSidePipeline ? '' : appliedSearch,
      smartTags: appliedAdvanced.smartTags,
      ...smartViewFilters,
    })
  }, [
    scopedLeads,
    pipelineStatusFilter,
    appliedAdvanced,
    appliedSearch,
    smartViewFilters,
    serverSidePipeline,
    savedLeads,
    pipelineAssigneeFilter,
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
      setAdvancedFilters((prev) => ({ ...prev, cities: [f.city] }))
      setAppliedAdvanced((prev) => ({ ...prev, cities: [f.city] }))
    }
    if (f.state) {
      setAdvancedFilters((prev) => ({ ...prev, states: [f.state] }))
      setAppliedAdvanced((prev) => ({ ...prev, states: [f.state] }))
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

  const pipelineHasLeads = pipelineSummary.total > 0
  const hasPipelineFiltersActive =
    hasActiveServerFilters ||
    activeFilterCount > 0 ||
    filter !== 'all' ||
    listStatusFilter !== 'all' ||
    Boolean(smartViewId)
  const showPipelineOnboarding = !pipelineHasLeads && !filterApplying
  const showNoFilterMatches =
    pipelineHasLeads && filtered.length === 0 && !filterApplying
  const showPipelineFilters = pipelineHasLeads || hasPipelineFiltersActive

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

  const mobileHeaderStats = useMemo(() => {
    if (assigneeName) return `Viewing ${assigneeName}`
    if (pipelineSummary.total === 0) return null
    const parts = []
    if (stageListMode) parts.push(getStatusMeta(filter).label)
    if (hasPipelineFiltersActive && savedLeads.length === 0) {
      parts.push('0 matches')
    } else {
      parts.push(`${(pipelineLoad.total || filtered.length || pipelineSummary.total).toLocaleString()} leads`)
    }
    if (hasMoreLeads) parts.push(`${pipelineLoad.loaded.toLocaleString()} loaded`)
    return parts.join(' · ')
  }, [
    assigneeName,
    pipelineSummary.total,
    savedLeads.length,
    filtered.length,
    hasPipelineFiltersActive,
    stageListMode,
    filter,
    pipelineLoad.total,
    hasMoreLeads,
    pipelineLoad.loaded,
  ])

  const [mobileHeaderSlot, setMobileHeaderSlot] = useState(null)

  useEffect(() => {
    if (!usePipelineNarrow) {
      setMobileHeaderSlot(null)
      document.documentElement.removeAttribute('data-pipeline-mobile')
      return undefined
    }
    document.documentElement.setAttribute('data-pipeline-mobile', '1')
    setMobileHeaderSlot(document.getElementById('ci-mobile-top-bar-slot'))
    return () => document.documentElement.removeAttribute('data-pipeline-mobile')
  }, [usePipelineNarrow])

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
    setListStatusFilter('all')
  }, [])

  const resetAllPipelineFilters = useCallback(() => {
    clearAllFilters()
    setFilter('all')
    setSmartViewId(null)
    setSmartViewFilters({})
  }, [clearAllFilters])

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
      } else if (actions.addTagIds?.length || actions.removeTagIds?.length) {
        setBulkNotice(
          count === 1 ? 'Tags updated on 1 lead.' : `Tags updated on ${count} leads.`
        )
      }
      setSelectedIds(new Set())
      setBulkAssignOpen(false)
      setBulkEditOpen(false)
      setBulkTagsOpen(false)
    } catch (e) {
      setBulkNotice(null)
      window.alert(e.message || 'Bulk update failed')
    } finally {
      setBulkBusy(false)
    }
  }

  const exportVisibleLeads = useCallback(() => {
    const rows = filtered
    if (!rows.length) return
    const headers = ['Name', 'Email', 'Phone', 'Company', 'Status', 'City', 'State']
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      headers.join(','),
      ...rows.map((l) =>
        [
          [l.firstName, l.lastName].filter(Boolean).join(' '),
          l.email,
          l.phone,
          l.company,
          l.crm?.status,
          getLeadCity(l),
          getLeadState(l),
        ]
          .map(escape)
          .join(',')
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pipeline-leads.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered])

  const listOrStageView = view === 'list' || stageListMode
  const useHubSpotList = listOrStageView

  const selectAllVisible = useCallback((checked, ids) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  return (
    <>
      {usePipelineNarrow && mobileHeaderSlot
        ? createPortal(
            <PipelineMobileHeaderChrome
              statsText={mobileHeaderStats}
              stageListMode={stageListMode}
              view={view}
              onViewChange={setView}
            />,
            mobileHeaderSlot
          )
        : null}
    <div
      className={`flex h-full min-h-0 w-full overflow-hidden relative bg-[var(--color-hs-canvas)] ${
        selectedLead && useHubSpotList ? 'pipeline-split-record' : ''
      }`}
    >
      <div
        className={`crm-workspace flex-1 min-w-0 min-h-0 flex flex-col ${
          selectedLead ? 'hidden md:flex' : 'flex'
        } ${useHubSpotList ? 'pipeline-list-workspace' : ''}`}
      >
        <header className="crm-page-header pipeline-page-header">
          <div
            className={`crm-page-header-top pipeline-page-header-top ${
              usePipelineNarrow ? 'pipeline-page-header-top--compact' : ''
            }`}
          >
            {!usePipelineNarrow ? (
            <div className="pipeline-page-heading min-w-0">
              <PipelineIcon className="pipeline-page-icon w-6 h-6 shrink-0 text-[#516f90]" aria-hidden />
              <p className="pipeline-page-stats">
                {assigneeName ? (
                  <>
                    <span className="sr-only">Pipeline — </span>
                    Viewing <strong>{assigneeName}</strong>
                    {pipelineLoad.total > 0 && (
                      <>
                        {' · '}
                        {(pipelineLoad.total || filtered.length).toLocaleString()} leads
                        {hasMoreLeads && ` · ${pipelineLoad.loaded.toLocaleString()} loaded`}
                      </>
                    )}
                    {' · '}
                    <button
                      type="button"
                      className="text-[#0091ae] hover:underline"
                      onClick={() => setPipelineAssigneeFilter?.(null)}
                    >
                      Clear assignee
                    </button>
                  </>
                ) : pipelineSummary.total === 0 ? (
                  <>
                    <span className="sr-only">Pipeline — </span>
                    Add or import leads to get started
                  </>
                ) : showNoFilterMatches ? (
                  <>
                    <span className="sr-only">Pipeline — </span>
                    <strong>0 matches</strong>
                    {' · '}
                    {pipelineSummary.total.toLocaleString()} leads in pipeline
                  </>
                ) : isDealsView ? (
                  <>
                    <span className="sr-only">Freight deals — </span>
                    <strong>{dealsStageLabel}</strong>
                    {' · shipment RFQs'}
                  </>
                ) : (
                  <>
                    <span className="sr-only">Pipeline — </span>
                    {stageListMode && (
                      <>
                        <strong>{getStatusMeta(filter).label}</strong>
                        {' · '}
                      </>
                    )}
                    {pipelineSummary.total.toLocaleString()} leads
                    {hasMoreLeads && ` · ${pipelineLoad.loaded.toLocaleString()} loaded`}
                  </>
                )}
              </p>
            </div>
            ) : null}
            <div className="crm-page-actions pipeline-page-actions">
              {!stageListMode && !usePipelineNarrow && !isDealsView ? (
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
              ) : null}
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="crm-btn crm-btn-secondary pipeline-action-btn"
                aria-label="Import leads"
              >
                <UploadIcon className="pipeline-action-btn__icon" aria-hidden />
                <span className="pipeline-action-btn__text">Import</span>
              </button>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="crm-btn crm-btn-primary pipeline-action-btn"
                aria-label="Add lead"
              >
                <PlusIcon className="pipeline-action-btn__icon" aria-hidden />
                <span className="pipeline-action-btn__text">Add lead</span>
              </button>
            </div>
          </div>

          {showPipelineFilters && !isDealsView && (
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
              statusFilter={listStatusFilter}
              onStatusFilterChange={setListStatusFilter}
              statusOptions={columns}
              resultCount={filtered.length}
              totalCount={
                serverSidePipeline &&
                (appliedSearch ||
                  getFilterCities(appliedAdvanced).length ||
                  getFilterStates(appliedAdvanced).length)
                  ? pipelineLoad.total || filtered.length
                  : scopedLeads.length
              }
              pipelineTotal={pipelineSummary.total}
              onSelectAllFiltered={selectAllFiltered}
              hasActiveFilters={activeFilterCount > 0 || filter !== 'all' || listStatusFilter !== 'all'}
              onClearFilters={resetAllPipelineFilters}
              onApplySmartView={applySmartView}
              activeSmartViewId={smartViewId}
              orgLeadTags={orgLeadTags}
              stageListMode={stageListMode}
              onRemoveAppliedFilter={removeAppliedFilter}
              onOpenViewSettings={() => setViewSettingsOpen(true)}
            />
          )}
        </header>

        <div className="crm-page-body flex-1 min-h-0">
          <div
            className={`crm-content-card flex-1 min-h-0 ${
              useHubSpotList
                ? 'crm-content-card--pipeline-table'
                : view === 'board' && !stageListMode
                  ? 'crm-content-card--pipeline-board'
                  : ''
            }`}
          >
            {selectedIds.size > 0 && (
              <PipelineBulkActionsBar
                count={selectedIds.size}
                canAssign={canAssign}
                busy={bulkBusy}
                onAssign={() => setBulkAssignOpen(true)}
                onEdit={() => setBulkEditOpen(true)}
                onTags={orgLeadTags?.length ? () => setBulkTagsOpen(true) : undefined}
                onMarkReplied={() => runBulk({ markReplied: true })}
                onEmail={() => setBulkOpen(true)}
                onWhatsApp={() => setWaOpen(true)}
                emailCount={selectedEmailCount}
                phoneCount={selectedPhoneCount}
                onClear={() => setSelectedIds(new Set())}
              />
            )}

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
          {filterApplying ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <p className="text-sm font-medium text-[#516f90]">Updating leads…</p>
            </div>
          ) : isDealsView ? (
            <div className="p-3 md:p-4">
              <PipelineDealsView
                dealStage={dealsStage}
                assigneeFilter={pipelineAssigneeFilter}
                onOpenLead={openDealFromPipeline}
              />
            </div>
          ) : showPipelineOnboarding ? (
            <EmptyPipeline
              onNavigate={onNavigate}
              onImport={() => setImportOpen(true)}
              onAdd={() => setAddOpen(true)}
              compact={isMobile}
            />
          ) : showNoFilterMatches ? (
            <PipelineNoMatches onClearFilters={resetAllPipelineFilters} onNavigate={onNavigate} />
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
            <PipelineLeadsTable
              leads={filtered}
              selectedId={pipelineLeadId}
              selectedIds={selectedIds}
              onSelect={openPipelineLead}
              onToggleSelect={toggleSelect}
              onSelectAllVisible={selectAllVisible}
              showStatus={!stageListMode}
              tagById={tagById}
              teamMembers={teamMembers}
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

      {pipelineLeadId && !selectedLead && useHubSpotList && (
        <div className="crm-record-panel crm-record-panel--loading hidden md:flex">
          Loading lead…
        </div>
      )}

      {selectedLead && (
        <LeadWorkspace
          lead={selectedLead}
          statusOptions={columns}
          onClose={() => closePipelineLead()}
          onNavigate={onNavigate}
          recordPanel={useHubSpotList}
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

      <PipelineBulkAssignModal
        open={bulkAssignOpen}
        count={selectedIds.size}
        teamMembers={teamMembers}
        canAssign={canAssign}
        busy={bulkBusy}
        onClose={() => setBulkAssignOpen(false)}
        onSubmit={(assignToUserId) => runBulk({ assignToUserId })}
      />
      <PipelineBulkEditModal
        open={bulkEditOpen}
        count={selectedIds.size}
        statusOptions={columns}
        teamMembers={teamMembers}
        canAssign={canAssign}
        busy={bulkBusy}
        onClose={() => setBulkEditOpen(false)}
        onSubmit={(actions) => runBulk(actions)}
      />
      <BulkLeadTagsModal
        open={bulkTagsOpen}
        count={selectedIds.size}
        leads={selectedLeads}
        orgLeadTags={orgLeadTags}
        busy={bulkBusy}
        onClose={() => setBulkTagsOpen(false)}
        onSubmit={(actions) => runBulk(actions)}
      />

      <PipelineViewSettings
        open={viewSettingsOpen}
        onClose={() => setViewSettingsOpen(false)}
        view={view}
        onViewChange={setView}
        stageListMode={stageListMode}
        onExport={exportVisibleLeads}
        onResetFilters={() => {
          clearAllFilters()
          setFilter('all')
          setListStatusFilter('all')
          setSmartViewId(null)
          setSmartViewFilters({})
        }}
      />
    </div>
    </>
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
          <span className="text-sm font-semibold text-[#516f90] bg-white border border-[#cbd6e2] px-1.5 py-0.5 rounded-sm tabular-nums">
            {leads.length}
            {totalInColumn > leads.length ? ` / ${totalInColumn}` : ''}
          </span>
        </div>
      </div>
      <div className="crm-kanban-column-body">
        {leads.length === 0 ? (
          <p className="text-xs text-[#7c98b6] text-center py-6">No leads</p>
        ) : (
          leads.map((lead) => {
            const nameLabel = [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim()
            const primaryLabel = nameLabel || lead.company || 'Unnamed lead'
            const showCompanyRow = Boolean(lead.company && nameLabel)

            return (
            <div
              key={lead.id}
              className={`crm-kanban-card ${selectedId === lead.id ? 'is-active' : ''} ${
                selectedIds.has(lead.id) ? 'is-checked' : ''
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
                  onClick={() => {
                    if (hasActiveTextSelection()) return
                    onSelect(lead.id)
                  }}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="pipeline-hs-avatar pipeline-hs-avatar--sm shrink-0" aria-hidden>
                      {(lead.firstName?.[0] || lead.company?.[0] || '?').toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-[#33475b] truncate leading-tight ci-selectable-text">
                      {primaryLabel}
                    </span>
                  </div>
                  {showCompanyRow ? (
                    <div className="flex items-center gap-1.5 min-w-0 mt-1">
                      <span
                        className="pipeline-hs-avatar pipeline-hs-avatar--co pipeline-hs-avatar--sm shrink-0"
                        aria-hidden
                      >
                        {lead.company[0]?.toUpperCase() || 'C'}
                      </span>
                      <span className="text-sm text-[#33475b] font-medium truncate leading-snug">
                        {lead.company}
                      </span>
                    </div>
                  ) : null}
                  <LeadTagDots lead={lead} tagById={tagById} />
                  {lead.crm?.lastEmailSentAt && (
                    <div className="text-sm text-gray-400 mt-1">
                      Emailed {formatCrmDate(lead.crm.lastEmailSentAt)}
                    </div>
                  )}
                  {lead.crm?.responseReceived && (
                    <div className="text-sm text-violet-700 mt-0.5 font-medium">Replied</div>
                  )}
                  {getLeadEmail(lead) ? (
                    <div className="mt-1 flex items-center gap-1 min-w-0">
                      <EmailValidationIcon lead={lead} />
                      <span className="text-sm text-[#33475b] truncate">{getLeadEmail(lead)}</span>
                    </div>
                  ) : null}
                  {lead.phone && leadHasCallablePhone(lead.phone) ? (
                    <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                      <LeadPhoneCall
                        phone={lead.phone}
                        leadId={lead.id}
                        numberClassName="text-sm text-[#33475b]"
                        pipelineCallIcon
                      />
                    </div>
                  ) : lead.phone ? (
                    <div className="mt-1.5 text-sm text-[#33475b]">{lead.phone}</div>
                  ) : null}
                </button>
              </div>
            </div>
            )
          })
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

function PipelineNoMatches({ onClearFilters, onNavigate }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto px-4">
      <div className="w-16 h-16 rounded-full bg-[#eaf0f6] flex items-center justify-center mb-4 text-2xl text-[#7c98b6]">
        ⌕
      </div>
      <p className="text-sm font-semibold text-[#33475b]">No leads match your filters</p>
      <p className="text-sm text-[#516f90] mt-2 leading-relaxed">
        No data available for this selection. Clear filters to see your full pipeline, or try AI search to
        find new prospects.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 mt-6 w-full sm:w-auto">
        <button type="button" onClick={onClearFilters} className="crm-btn crm-btn-secondary">
          Clear all filters
        </button>
        <button
          type="button"
          onClick={() => onNavigate?.('search')}
          className="crm-btn crm-btn-primary"
        >
          Search with AI
        </button>
      </div>
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
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Build your pipeline first</h3>
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
            className="px-5 py-2.5 border-2 border-[#FF773D] text-[#242424] text-sm font-semibold rounded-lg"
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
          <p className="text-sm text-gray-400 mt-2">50+ matches · 10 full previews · unlock with credits</p>
        </div>
      </div>
    </div>
  )
}
