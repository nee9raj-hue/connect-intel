import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { CRM_STATUSES, formatCrmDate, getStatusMeta, getVisiblePipelineColumns } from '../../lib/crmConstants'
import { canAssignPipelineLeads } from '../../lib/pipelineAssignAccess'
import {
  getDefaultPipelineId,
  getVisiblePipelineColumnsForSettings,
  pipelinesFromSettings,
} from '../../lib/crmPipelines'
import { PipelineIcon, PlusIcon, SettingsGearIcon, UploadIcon, ListIcon, SearchIcon } from '../ui/icons'
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
  filterRepPipelineLeads,
  getFilterCities,
  getFilterStates,
  leadMatchesAssignee,
  normalizeLocationKey,
  pipelineServerFilterExtras,
} from '../../lib/pipelineFilters'
import { tagMapById } from '../../lib/orgLeadTags'
import { leadHasCallablePhone } from '../../lib/phoneUtils'
import LeadPhoneCall from './LeadPhoneCall'
import { leadHasSendableEmail, getLeadEmail } from '../../lib/emailUtils'
import { getLeadCity, getLeadState } from '../../lib/pipelineFilters'
import PipelineDealsView from './PipelineDealsView'
import { isFreightDealOrg } from '../../lib/freightDeal'
import { getDealStageMeta } from '../../lib/crmConstants'
import {
  evaluateBulkAssign,
  evaluateBulkEdit,
  evaluateExport,
  evaluatePipelineEmail,
} from '../../lib/resourceProtection.js'
import { useUsagePolicies } from '../../hooks/useUsagePolicies.js'
import {
  BulkAssignConfirmModal,
  BulkEditReviewModal,
  ExportPrepareModal,
  PipelineEmailGuideModal,
} from '../guardrails/ResourceProtectionModals.jsx'
import {
  AudienceCreatedModal,
  BatchListsCreatedModal,
  CreateAudienceModal,
  CreateBatchListsModal,
  SaveFilterAudienceModal,
} from '../guardrails/CreateAudienceFlow.jsx'
import { serverFiltersToSegmentFilterJson, hasSavablePipelineAudienceFilter } from '../../../../lib/pipelineFilterToAudience.js'
import { segmentFilterSummary } from '../../../../lib/marketingSegmentFilters.js'
import EmailValidationIcon from './EmailValidationIcon'

import { hasActiveTextSelection } from '../../lib/keyboardShortcuts'
import useIsMobile from '../../hooks/useIsMobile'
import usePipelineFilterMobile, { usePipelineNarrowViewport } from '../../hooks/usePipelineFilterMobile'
import MyDayReturnBar from '../overview/MyDayReturnBar'
import { buildPipelineBreadcrumb, pipelineFilterParts } from '../../lib/pipelineListBreadcrumb'
import {
  loadPipelineColumnPrefs,
  loadPipelineHoverActionsPref,
  savePipelineColumnPrefs,
  savePipelineHoverActionsPref,
} from '../../lib/pipelineColumnPrefs'
import { useDebouncedPipelineSearch } from '../../hooks/useDebouncedPipelineSearch'

export default function PipelinePanel({ onNavigate, panelOptions }) {
  const {
    user,
    savedLeads,
    pipelineLoad,
    pipelineSummary,
    loadPipelineList,
    loadMorePipelineLeads,
    refreshPipelineSummary,
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
    patchLead,
    orgLeadTags,
    notifications,
  } = useApp()

  const [tableColumns, setTableColumns] = useState(() => loadPipelineColumnPrefs())
  const [hoverActionsEnabled, setHoverActionsEnabled] = useState(() => loadPipelineHoverActionsPref())

  const [crmSettings, setCrmSettings] = useState(null)
  const [activePipelineId, setActivePipelineId] = useState('default')

  useEffect(() => {
    if (user?.accountType !== 'company') return
    api
      .getCrmSettings()
      .then((d) => {
        setCrmSettings(d.settings)
        setActivePipelineId(getDefaultPipelineId(d.settings))
      })
      .catch(() => {})
  }, [user?.accountType, user?.id])

  const orgPipelines = useMemo(() => pipelinesFromSettings(crmSettings), [crmSettings])
  const columns = useMemo(() => {
    if (crmSettings && user?.accountType === 'company') {
      return getVisiblePipelineColumnsForSettings(user, crmSettings, activePipelineId)
    }
    return getVisiblePipelineColumns(user)
  }, [user, crmSettings, activePipelineId])

  const pipelineScopedLeads = useMemo(() => {
    if (!crmSettings?.pipelines?.length || orgPipelines.length <= 1) return savedLeads
    return (savedLeads || []).filter(
      (e) => (e.crm?.pipelineId || getDefaultPipelineId(crmSettings)) === activePipelineId
    )
  }, [savedLeads, crmSettings, activePipelineId, orgPipelines.length])
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
  const [addLeadStatus, setAddLeadStatus] = useState('new')
  const [addLeadToast, setAddLeadToast] = useState(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkTagsOpen, setBulkTagsOpen] = useState(false)
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkNotice, setBulkNotice] = useState(null)
  const policies = useUsagePolicies()
  const [emailGuide, setEmailGuide] = useState({ open: false, variant: 'guide_marketing' })
  const [createAudienceOpen, setCreateAudienceOpen] = useState(false)
  const [saveFilterAudienceOpen, setSaveFilterAudienceOpen] = useState(false)
  const [batchListsOpen, setBatchListsOpen] = useState(false)
  const [batchListsCreated, setBatchListsCreated] = useState(null)
  const [audienceCreated, setAudienceCreated] = useState(null)
  const [assignGuard, setAssignGuard] = useState({ open: false, variant: 'confirm', pending: null })
  const [editReview, setEditReview] = useState({
    open: false,
    actions: null,
    currentLabel: '',
    targetLabel: '',
  })
  const [exportGuard, setExportGuard] = useState({ open: false, mode: 'instant', preparing: false })

  const isOrgAdmin = Boolean(
    (user?.isOrgAdmin || user?.orgRole === 'org_admin') && user?.accountType === 'company'
  )
  const isTeamManager = Boolean(
    user?.accountType === 'company' && !isOrgAdmin && user?.pipelineRole === 'manager'
  )

  useEffect(() => {
    if (isOrgAdmin || isTeamManager) refreshTeam?.()
  }, [isOrgAdmin, isTeamManager, refreshTeam])

  const managerTeamUserIds = useMemo(() => {
    if (!isTeamManager || !user?.id) return new Set()
    const myTeamId = teamMembers.find((m) => String(m.userId) === String(user.id))?.teamId
    if (!myTeamId) return new Set([String(user.id)])
    const ids = new Set([String(user.id)])
    for (const m of teamMembers) {
      if (m.teamId && String(m.teamId) === String(myTeamId)) ids.add(String(m.userId))
    }
    return ids
  }, [isTeamManager, user?.id, teamMembers])

  useEffect(() => {
    const po = panelOptions || {}
    if (po.scopeOwner === 'me' && user?.id) {
      setPipelineAssigneeFilter?.(String(user.id))
      return
    }
    if (po.hierarchyTeam === 'mine' || po.scope === 'all') {
      setPipelineAssigneeFilter?.(null)
      return
    }
    if (po.userId === undefined && po.assigneeUserId === undefined) return
    const id = po.userId || po.assigneeUserId ? String(po.userId || po.assigneeUserId) : null
    setPipelineAssigneeFilter?.(id)
  }, [
    panelOptions?.userId,
    panelOptions?.assigneeUserId,
    panelOptions?.scopeOwner,
    panelOptions?.hierarchyTeam,
    panelOptions?.scope,
    user?.id,
    setPipelineAssigneeFilter,
  ])

  const effectiveAssigneeFilter = useMemo(() => {
    if (panelOptions?.hierarchyTeam === 'mine' || panelOptions?.scope === 'all') {
      if (pipelineAssigneeFilter && isTeamManager && !managerTeamUserIds.has(String(pipelineAssigneeFilter))) {
        return null
      }
      return pipelineAssigneeFilter || null
    }
    if (pipelineAssigneeFilter) {
      if (isTeamManager && !managerTeamUserIds.has(String(pipelineAssigneeFilter))) {
        return null
      }
      return pipelineAssigneeFilter
    }
    if (panelOptions?.scopeOwner === 'me' && user?.id) return String(user.id)
    if (isTeamManager) return null
    // Reps: null = my assigned leads + team unassigned pool (server-scoped)
    return null
  }, [
    pipelineAssigneeFilter,
    panelOptions?.hierarchyTeam,
    panelOptions?.scope,
    panelOptions?.scopeOwner,
    user?.accountType,
    user?.id,
    isOrgAdmin,
    isTeamManager,
    managerTeamUserIds,
  ])

  const freightOrg = isFreightDealOrg(user)
  const isDealsView = freightOrg && panelOptions?.view === 'deals'
  const dealsStage = panelOptions?.dealStage || 'all'

  const teamMemberIdsForFilter = useMemo(() => {
    const teamId = panelOptions?.teamId
    if (!teamId) return null
    const ids = (teamMembers || [])
      .filter((m) => String(m.teamId) === String(teamId))
      .map((m) => String(m.userId))
    return ids.length ? ids : null
  }, [panelOptions?.teamId, teamMembers])

  const unreadLeadIds = useMemo(() => {
    if (!panelOptions?.unreadOnly && panelOptions?.activityFilter !== 'unread') return null
    const ids = [...new Set((notifications || []).filter((n) => n.unread && n.leadId).map((n) => String(n.leadId)))]
    return ids.length ? ids : ['__none__']
  }, [notifications, panelOptions?.unreadOnly, panelOptions?.activityFilter])

  const marketingCampaignFilter = useMemo(() => {
    const po = panelOptions || {}
    const campaignId = po.campaignId || po.openedCampaignId || po.clickedCampaignId
    if (!campaignId) return null
    const filter =
      po.campaignRecipientFilter ||
      (po.openedCampaignId ? 'opened' : po.clickedCampaignId ? 'clicked' : 'all')
    return { campaignId, filter }
  }, [panelOptions])

  const [marketingLeadIds, setMarketingLeadIds] = useState(null)
  const [marketingSliceLeads, setMarketingSliceLeads] = useState(null)
  const [marketingSliceLoading, setMarketingSliceLoading] = useState(false)

  useEffect(() => {
    if (!marketingCampaignFilter || panelOptions?.leadIds?.length) {
      setMarketingLeadIds(null)
      return undefined
    }
    let cancelled = false
    api
      .getMarketingCampaignRecipientLeadIds(
        marketingCampaignFilter.campaignId,
        marketingCampaignFilter.filter,
        { silent: true }
      )
      .then((data) => {
        if (cancelled) return
        const ids = (data?.leadIds || []).map(String)
        setMarketingLeadIds(ids.length ? ids : ['__none__'])
      })
      .catch(() => {
        if (!cancelled) setMarketingLeadIds(['__none__'])
      })
    return () => {
      cancelled = true
    }
  }, [marketingCampaignFilter, panelOptions?.leadIds])

  const dashboardLeadIds = useMemo(() => {
    if (panelOptions?.leadIds?.length) return panelOptions.leadIds.map(String)
    if (marketingLeadIds?.length) return marketingLeadIds
    return unreadLeadIds
  }, [panelOptions?.leadIds, marketingLeadIds, unreadLeadIds])

  const activeMarketingLeadIds = useMemo(() => {
    if (!marketingCampaignFilter) return null
    const ids = (dashboardLeadIds || []).filter((id) => id && id !== '__none__')
    return ids.length ? ids : null
  }, [marketingCampaignFilter, dashboardLeadIds])

  useEffect(() => {
    if (!activeMarketingLeadIds?.length) {
      setMarketingSliceLeads(null)
      setMarketingSliceLoading(false)
      return undefined
    }
    let cancelled = false
    setMarketingSliceLoading(true)
    api
      .fetchPipelineLeads({
        leadIds: activeMarketingLeadIds,
        limit: Math.min(activeMarketingLeadIds.length, 500),
        silent: true,
      })
      .then((data) => {
        if (cancelled) return
        setMarketingSliceLeads(data.leads || [])
        setMarketingSliceLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setMarketingSliceLeads([])
          setMarketingSliceLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeMarketingLeadIds])

  useEffect(() => {
    const po = panelOptions || {}
    if (po.view === 'deals') {
      if (po.status) setFilter(po.status)
      return
    }

    const adv = { ...DEFAULT_PIPELINE_FILTERS }
    if (po.overdueFollowUp) adv.overdueFollowUp = true
    if (po.followUpDue) adv.followUpDue = true
    if (po.closingThisWeek || po.closing === 'this-month') adv.closingThisWeek = true
    if (po.stuck) adv.staleDays = 7
    if (po.scoreMin != null && po.scoreMin !== '') adv.minLeadScore = Number(po.scoreMin)
    if (po.smartTags?.length) adv.smartTags = po.smartTags

    const hasMarketingFilter =
      po.campaignId ||
      po.openedCampaignId ||
      po.clickedCampaignId ||
      po.campaignRecipientFilter

    const hasDashExtras =
      po.assignedAfter ||
      po.lastActivity ||
      po.wonThisMonth ||
      po.tasksDueToday ||
      po.unreadOnly ||
      po.activityFilter === 'unread' ||
      po.teamId ||
      po.leadIds?.length ||
      hasMarketingFilter

    const hasAdv =
      po.overdueFollowUp ||
      po.followUpDue ||
      po.closingThisWeek ||
      po.closing === 'this-month' ||
      po.stuck ||
      po.scoreMin != null ||
      (po.smartTags?.length > 0) ||
      hasDashExtras

    if (hasAdv) {
      setSmartViewId(null)
      const smartExtras = {}
      if (adv.staleDays != null) smartExtras.staleDays = adv.staleDays
      if (adv.minLeadScore != null) smartExtras.minLeadScore = adv.minLeadScore
      setSmartViewFilters(smartExtras)
      setAdvancedFilters(adv)
      setAppliedAdvanced(adv)
      setView('list')
      setListStatusFilter('all')
    } else if (po.status && !po.returnTo && !hasMarketingFilter) {
      const empty = { ...DEFAULT_PIPELINE_FILTERS }
      setAdvancedFilters(empty)
      setAppliedAdvanced(empty)
      setAppliedSearch('')
      setSearch('')
      setSmartViewFilters({})
      setSmartViewId(null)
    }

    if (po.tasksDueToday || (po.view === 'tasks' && po.due === 'today')) {
      setView('list')
      setListStatusFilter('all')
      setFilter('all')
    }

    if (po.status) {
      setFilter(po.status)
      if (po.status !== 'all') {
        setView('list')
        setListStatusFilter('all')
      }
    } else if (hasAdv) {
      setFilter('all')
    }
  }, [
    panelOptions?.status,
    panelOptions?.view,
    panelOptions?.due,
    panelOptions?.overdueFollowUp,
    panelOptions?.followUpDue,
    panelOptions?.closingThisWeek,
    panelOptions?.closing,
    panelOptions?.stuck,
    panelOptions?.scoreMin,
    panelOptions?.smartTags,
    panelOptions?.assignedAfter,
    panelOptions?.lastActivity,
    panelOptions?.wonThisMonth,
    panelOptions?.tasksDueToday,
    panelOptions?.unreadOnly,
    panelOptions?.activityFilter,
    panelOptions?.teamId,
    panelOptions?.leadIds,
    panelOptions?.returnTo,
    panelOptions?.campaignId,
    panelOptions?.openedCampaignId,
    panelOptions?.clickedCampaignId,
    panelOptions?.campaignRecipientFilter,
  ])

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

  const openPipelineLeadRow = useCallback(
    (lead, tab = null) => {
      if (lead) setWorkspaceLead(lead)
      openPipelineLead(lead?.id, tab)
    },
    [openPipelineLead]
  )

  useEffect(() => {
    if (!bulkNotice) return
    const timer = setTimeout(() => setBulkNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [bulkNotice])

  const assigneeName = useMemo(() => {
    if (!effectiveAssigneeFilter) return null
    const m = teamMembers.find((t) => String(t.userId) === String(effectiveAssigneeFilter))
    if (m?.name) return m.name
    if (String(effectiveAssigneeFilter) === String(user?.id)) {
      return user?.name || user?.email || 'You'
    }
    return 'Team member'
  }, [effectiveAssigneeFilter, teamMembers, user?.id, user?.name, user?.email])

  const canFilterByOwner = user?.accountType === 'company'

  const ownerFilterOptions = useMemo(() => {
    if (!canFilterByOwner) return teamMembers
    const unassigned = { userId: '__unassigned__', name: 'Unassigned leads' }
    if (isOrgAdmin || isTeamManager) return [unassigned, ...teamMembers]
    const me = user?.id
      ? [{ userId: user.id, name: user.name ? `${user.name} (me)` : 'My leads' }]
      : []
    return [unassigned, ...me]
  }, [canFilterByOwner, isOrgAdmin, isTeamManager, teamMembers, user?.id, user?.name])

  const handleOwnerFilter = useCallback(
    (userId) => {
      if (!canFilterByOwner) return
      setPipelineAssigneeFilter?.(String(userId))
    },
    [canFilterByOwner, setPipelineAssigneeFilter]
  )

  const serverSidePipeline = pipelineSummary.total > 120

  const scopedLeads = useMemo(() => {
    let base = marketingSliceLeads ?? pipelineScopedLeads
    if (!effectiveAssigneeFilter && !isOrgAdmin && !isTeamManager) {
      base = filterRepPipelineLeads(base, user)
    }
    if (!effectiveAssigneeFilter) return base
    // Large orgs fetch owner-scoped pages from the server; client re-filter drops rows after unfiltered refreshes.
    if (serverSidePipeline) return base
    return base.filter((l) => leadMatchesAssignee(l, effectiveAssigneeFilter))
  }, [
    marketingSliceLeads,
    pipelineScopedLeads,
    effectiveAssigneeFilter,
    serverSidePipeline,
    isOrgAdmin,
    isTeamManager,
    user,
  ])

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

  const [boardLeadsByStatus, setBoardLeadsByStatus] = useState(null)
  const [boardColumnTotals, setBoardColumnTotals] = useState({})
  const [boardColumnLimits, setBoardColumnLimits] = useState({})

  const findLeadInLists = useCallback(
    (leadId) => {
      if (!leadId) return null
      const id = String(leadId)
      const match = (l) => String(l?.id) === id
      const fromScoped = pipelineScopedLeads.find(match)
      if (fromScoped) return fromScoped
      if (boardLeadsByStatus) {
        for (const leads of Object.values(boardLeadsByStatus)) {
          const found = (leads || []).find(match)
          if (found) return found
        }
      }
      return null
    },
    [pipelineScopedLeads, boardLeadsByStatus]
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
      setWorkspaceLead((prev) => {
        const base = prev?.id === listLead.id ? prev : listLead
        return {
          ...base,
          ...listLead,
          commercialEmailOptIn:
            listLead.commercialEmailOptIn ??
            (listLead.commercialEmailConsentAt ? true : base.commercialEmailOptIn),
          commercialEmailConsentAt:
            listLead.commercialEmailConsentAt ?? base.commercialEmailConsentAt ?? null,
          commercialEmailConsentSource:
            listLead.commercialEmailConsentSource ?? base.commercialEmailConsentSource ?? null,
        }
      })
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
    (advancedFilters.smartTags || []).join(',') !== (appliedAdvanced.smartTags || []).join(',') ||
    advancedFilters.minLeadScore !== appliedAdvanced.minLeadScore ||
    advancedFilters.maxLeadScore !== appliedAdvanced.maxLeadScore ||
    advancedFilters.addedFrom !== appliedAdvanced.addedFrom ||
    advancedFilters.addedTo !== appliedAdvanced.addedTo ||
    advancedFilters.lastActivityFrom !== appliedAdvanced.lastActivityFrom ||
    advancedFilters.lastActivityTo !== appliedAdvanced.lastActivityTo ||
    advancedFilters.sourceFilter !== appliedAdvanced.sourceFilter ||
    advancedFilters.stuckLeads !== appliedAdvanced.stuckLeads

  const buildServerFilters = useCallback(
    (adv, q) => ({
      status:
        filter !== 'all' ? filter : listStatusFilter !== 'all' ? listStatusFilter : undefined,
      q: q || undefined,
      cities: getFilterCities(adv).length ? getFilterCities(adv) : undefined,
      states: getFilterStates(adv).length ? getFilterStates(adv) : undefined,
      assigneeUserId: effectiveAssigneeFilter || undefined,
      teamId: panelOptions?.teamId || undefined,
      tagIds: adv.tagIds?.length ? adv.tagIds : undefined,
      tagMode: adv.tagMode || 'any',
      ...pipelineServerFilterExtras(adv, smartViewFilters),
    }),
    [filter, listStatusFilter, effectiveAssigneeFilter, smartViewFilters, panelOptions?.teamId]
  )

  const serverFilters = useMemo(
    () => buildServerFilters(appliedAdvanced, appliedSearch),
    [buildServerFilters, appliedAdvanced, appliedSearch]
  )

  const hasActiveServerFilters = useMemo(
    () =>
      Boolean(
        serverFilters.assigneeUserId ||
          serverFilters.teamId ||
          serverFilters.status ||
          serverFilters.q ||
          serverFilters.cities?.length ||
          serverFilters.states?.length ||
          serverFilters.tagIds?.length ||
          serverFilters.minLeadScore != null ||
          serverFilters.followUpDue ||
          serverFilters.overdueFollowUp
      ),
    [serverFilters]
  )

  const canSaveAsAudience = useMemo(
    () => hasSavablePipelineAudienceFilter(serverFilters, appliedAdvanced),
    [serverFilters, appliedAdvanced]
  )

  const pipelineAudienceFilterJson = useMemo(
    () => serverFiltersToSegmentFilterJson(serverFilters, appliedAdvanced),
    [serverFilters, appliedAdvanced]
  )

  const pipelineAudienceFilterSummary = useMemo(() => {
    const summary = segmentFilterSummary(pipelineAudienceFilterJson)
    return summary === 'All pipeline contacts' ? 'Pipeline filters applied' : summary
  }, [pipelineAudienceFilterJson])

  const applyFilters = useCallback((opts) => {
    const nextAdv = opts?.advanced ? { ...opts.advanced } : { ...advancedFilters }
    const nextSearch =
      opts?.search !== undefined ? String(opts.search).trim() : search.trim()
    if (opts?.advanced) setAdvancedFilters(nextAdv)
    if (opts?.search !== undefined) setSearch(String(opts.search))
    setAppliedSearch(nextSearch)
    setAppliedAdvanced(nextAdv)
  }, [search, advancedFilters])

  useDebouncedPipelineSearch(search, (q) => {
    if (q === appliedSearch) return
    applyFilters({ search: q })
  })

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
        loadPipelineList(buildServerFilters(nextAdv, nextSearch), { append: false, silent: true }).catch(
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
    loadPipelineList(serverFilters, { append: false, silent: true })
      .catch(() => {})
      .finally(() => setFilterApplying(false))
  }, [serverSidePipeline, serverFilters, loadPipelineList, hasActiveServerFilters])

  useEffect(() => {
    if (!serverSidePipeline) return undefined
    void refreshPipelineSummary({
      assigneeUserId: serverFilters.assigneeUserId,
      tagIds: serverFilters.tagIds,
      q: serverFilters.q,
      cities: serverFilters.cities,
      states: serverFilters.states,
    })
  }, [
    serverSidePipeline,
    refreshPipelineSummary,
    serverFilters.assigneeUserId,
    serverFilters.tagIds,
    serverFilters.q,
    serverFilters.cities,
    serverFilters.states,
  ])

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
    const base = scopedLeads
    const closingThisMonth = panelOptions?.closing === 'this-month'
    return applyPipelineFilters(base, {
      status: pipelineStatusFilter,
      cities: serverSidePipeline ? [] : getFilterCities(appliedAdvanced),
      states: serverSidePipeline ? [] : getFilterStates(appliedAdvanced),
      contact: appliedAdvanced.contact,
      tagIds: appliedAdvanced.tagIds,
      tagMode: appliedAdvanced.tagMode,
      search: serverSidePipeline ? '' : appliedSearch,
      smartTags: appliedAdvanced.smartTags,
      overdueFollowUp: appliedAdvanced.overdueFollowUp,
      followUpDue: appliedAdvanced.followUpDue,
      closingThisWeek: appliedAdvanced.closingThisWeek && !closingThisMonth,
      closingThisMonth,
      minLeadScore: appliedAdvanced.minLeadScore ?? smartViewFilters.minLeadScore,
      maxLeadScore: appliedAdvanced.maxLeadScore,
      addedFrom: appliedAdvanced.addedFrom,
      addedTo: appliedAdvanced.addedTo,
      lastActivityFrom: appliedAdvanced.lastActivityFrom,
      lastActivityTo: appliedAdvanced.lastActivityTo,
      sourceFilter: appliedAdvanced.sourceFilter,
      stuckLeads: appliedAdvanced.stuckLeads,
      staleDays: appliedAdvanced.staleDays ?? smartViewFilters.staleDays,
      assignedAfter: panelOptions?.assignedAfter || null,
      lastActivity: panelOptions?.lastActivity || null,
      wonThisMonth: Boolean(panelOptions?.wonThisMonth),
      tasksDueToday: Boolean(
        panelOptions?.tasksDueToday || (panelOptions?.view === 'tasks' && panelOptions?.due === 'today')
      ),
      leadIds: dashboardLeadIds,
      teamMemberIds: teamMemberIdsForFilter,
      ...smartViewFilters,
    })
  }, [
    scopedLeads,
    pipelineStatusFilter,
    appliedAdvanced,
    appliedSearch,
    smartViewFilters,
    effectiveAssigneeFilter,
    panelOptions?.assignedAfter,
    panelOptions?.lastActivity,
    panelOptions?.wonThisMonth,
    panelOptions?.tasksDueToday,
    panelOptions?.view,
    panelOptions?.due,
    panelOptions?.closing,
    dashboardLeadIds,
    teamMemberIdsForFilter,
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

  const listBreadcrumb = useMemo(() => {
    const statusLabel =
      listStatusFilter !== 'all'
        ? columns.find((c) => c.id === listStatusFilter)?.label
        : stageListMode
          ? getStatusMeta(filter).label
          : null
    const parts = pipelineFilterParts({
      statusLabel: statusLabel && statusLabel !== 'All' ? statusLabel : null,
      assigneeName,
      cityLabels: getFilterCities(appliedAdvanced),
      stateLabels: getFilterStates(appliedAdvanced),
      search: appliedSearch,
    })
    if (!statusLabel && !stageListMode && listStatusFilter === 'all') {
      parts.push('All statuses')
    }
    const total = pipelineSummary.total || 0
    const showing = filtered.length
    const hasFilters =
      activeFilterCount > 0 ||
      filter !== 'all' ||
      listStatusFilter !== 'all' ||
      Boolean(appliedSearch?.trim()) ||
      Boolean(assigneeName)
    const paginated =
      pipelineLoad.hasMore ||
      (pipelineLoad.total > pipelineLoad.loaded && pipelineLoad.loaded > 0)
    const matchTotal =
      serverSidePipeline && hasFilters
        ? pipelineLoad.total ?? showing
        : showing
    return buildPipelineBreadcrumb({
      total,
      showing: paginated ? 0 : Math.min(showing, pipelineLoad.loaded || showing),
      parts,
      hasActiveFilters: hasFilters,
      filteredTotal: hasFilters ? matchTotal : null,
    })
  }, [
    listStatusFilter,
    columns,
    stageListMode,
    filter,
    assigneeName,
    appliedAdvanced,
    appliedSearch,
    pipelineSummary.total,
    filtered.length,
    pipelineLoad.loaded,
    pipelineLoad.hasMore,
    pipelineLoad.total,
    activeFilterCount,
    serverSidePipeline,
  ])

  const handleLeadStatusChange = useCallback(
    async (leadId, nextStatus) => {
      const lead = findLeadInLists(leadId)
      if (!lead) return
      try {
        await patchLead(leadId, { crm: { ...(lead.crm || {}), status: nextStatus } })
        await refreshPipelineLead?.(leadId)
      } catch {
        setBulkNotice('Could not update status')
      }
    },
    [findLeadInLists, patchLead, refreshPipelineLead]
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
    pipelineHasLeads && filtered.length === 0 && !filterApplying && !marketingSliceLoading
  const showPipelineFilters = pipelineHasLeads || hasPipelineFiltersActive

  const selectedLeads = useMemo(() => {
    const byId = new Map()
    const index = (list) => {
      for (const lead of list || []) {
        if (lead?.id && selectedIds.has(lead.id) && !byId.has(lead.id)) {
          byId.set(lead.id, lead)
        }
      }
    }
    index(savedLeads)
    index(filtered)
    if (boardLeadsByStatus) {
      for (const columnLeads of Object.values(boardLeadsByStatus)) {
        index(columnLeads)
      }
    }
    return [...selectedIds].map((id) => byId.get(id)).filter(Boolean)
  }, [savedLeads, filtered, boardLeadsByStatus, selectedIds])

  const canAssign = useMemo(
    () => canAssignPipelineLeads(user, selectedLeads),
    [user, selectedLeads]
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
    !activeMarketingLeadIds &&
    (pipelineLoad.hasMore ||
      (pipelineLoad.total > pipelineLoad.loaded && pipelineLoad.loaded > 0))

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

  const boardAwareStatusCounts = useMemo(() => {
    if (
      serverSidePipeline &&
      view === 'board' &&
      !stageListMode &&
      boardColumnTotals &&
      Object.keys(boardColumnTotals).length
    ) {
      return boardColumnTotals
    }
    return (
      pipelineSummary?.byStatus?.reduce?.((acc, row) => {
        if (row?.status) acc[row.status] = row.count
        return acc
      }, {}) || {}
    )
  }, [serverSidePipeline, view, stageListMode, boardColumnTotals, pipelineSummary?.byStatus])

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
      } else if (actions.approveEmailConsent) {
        setBulkNotice(
          count === 1
            ? 'Email consent approved for 1 contact.'
            : `Email consent approved for ${count} contacts.`
        )
      }
      setSelectedIds(new Set())
      setBulkAssignOpen(false)
      setBulkEditOpen(false)
      setBulkTagsOpen(false)
    } catch (e) {
      setBulkNotice(null)
      if (/timed out/i.test(e?.message || '')) {
        try {
          await refreshSavedLeads()
          window.alert(
            'Update may still be processing. The list was refreshed — check if your changes applied.'
          )
        } catch {
          window.alert(e.message || 'Bulk update failed')
        }
      } else {
        window.alert(e.message || 'Bulk update failed')
      }
    } finally {
      setBulkBusy(false)
    }
  }

  const openBulkEmail = useCallback(() => {
    const count = selectedIds.size
    const verdict = evaluatePipelineEmail(count, user, policies)
    if (verdict === 'allow') {
      setBulkOpen(true)
      return
    }
    setEmailGuide({ open: true, variant: verdict })
  }, [selectedIds.size, user, policies])

  const openCreateAudienceFlow = useCallback(() => {
    setEmailGuide({ open: false })
    setCreateAudienceOpen(true)
  }, [])

  const openBatchListsFlow = useCallback(() => {
    if (!selectedIds.size) return
    setBatchListsOpen(true)
  }, [selectedIds.size])

  const launchCampaignForAudience = useCallback(
    (listId) => {
      setAudienceCreated(null)
      onNavigate?.('marketing', {
        tab: 'campaigns',
        launchListId: listId,
        audienceTab: 'studio',
      })
    },
    [onNavigate]
  )

  const openBulkAssign = useCallback(() => {
    const verdict = evaluateBulkAssign(selectedIds.size, user, policies)
    if (verdict === 'manager_required') {
      setAssignGuard({ open: true, variant: 'manager_required', pending: null })
      return
    }
    setBulkAssignOpen(true)
  }, [selectedIds.size, user, policies])

  const submitBulkAssign = useCallback(
    (assignToUserId) => {
      const verdict = evaluateBulkAssign(selectedIds.size, user, policies)
      if (verdict === 'manager_required') {
        setAssignGuard({ open: true, variant: 'manager_required', pending: assignToUserId })
        return
      }
      if (verdict === 'confirm') {
        setAssignGuard({ open: true, variant: 'confirm', pending: assignToUserId })
        return
      }
      runBulk({ assignToUserId })
    },
    [selectedIds.size, user, policies, runBulk]
  )

  const submitBulkEdit = useCallback(
    (actions) => {
      if (actions.status && evaluateBulkEdit(selectedIds.size, policies) === 'review') {
        const statuses = new Set(selectedLeads.map((l) => l.crm?.status || 'new'))
        const currentLabel =
          statuses.size === 1 ? getStatusMeta([...statuses][0]).label : 'Mixed stages'
        const targetLabel = getStatusMeta(actions.status).label
        setEditReview({ open: true, actions, currentLabel, targetLabel })
        return
      }
      runBulk(actions)
    },
    [selectedIds.size, selectedLeads, policies, runBulk]
  )

  const downloadLeadsCsv = useCallback((rows) => {
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
  }, [])

  const exportVisibleLeads = useCallback(() => {
    const rows = filtered
    if (!rows.length) return
    const mode = evaluateExport(rows.length, user, policies)
    if (mode === 'instant') {
      downloadLeadsCsv(rows)
      return
    }
    setExportGuard({ open: true, mode, preparing: mode === 'background' })
  }, [filtered, user, policies, downloadLeadsCsv])

  const runProtectedExport = useCallback(() => {
    const rows = filtered
    const mode = exportGuard.mode
    if (mode === 'prepare') {
      setExportGuard((g) => ({ ...g, preparing: true }))
      window.setTimeout(() => {
        downloadLeadsCsv(rows)
        setExportGuard({ open: false, mode: 'instant', preparing: false })
      }, 600)
      return
    }
    if (mode === 'background') {
      window.setTimeout(() => {
        downloadLeadsCsv(rows)
        setExportGuard({ open: false, mode: 'instant', preparing: false })
        setBulkNotice('Your export is ready — check your downloads.')
      }, 1200)
    }
  }, [filtered, exportGuard.mode, downloadLeadsCsv])

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
        } ${useHubSpotList ? 'pipeline-list-workspace pipeline-page-premium' : ''}`}
      >
        <MyDayReturnBar panelOptions={panelOptions} onNavigate={onNavigate} />
        <header className="crm-page-header pipeline-page-header pipeline-v2-header">
          <div className="pipeline-v2-header__row">
            {!usePipelineNarrow && !isDealsView ? (
              <div className="pipeline-v2-header__brand min-w-0">
                <div className="pipeline-v2-header__icon-wrap" aria-hidden>
                  <PipelineIcon className="pipeline-v2-header__icon" />
                </div>
                <div className="min-w-0">
                  <h1 className="pipeline-v2-header__title">Pipeline</h1>
                  <p className="pipeline-v2-header__breadcrumb">
                    {listBreadcrumb}
                    {assigneeName ? (
                      <>
                        <button
                          type="button"
                          className="crm-filter-link-btn"
                          onClick={() => setPipelineAssigneeFilter?.(null)}
                        >
                          Clear owner
                        </button>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            ) : null}
            <div className="crm-page-actions pipeline-page-actions">
              {!stageListMode && !usePipelineNarrow && !isDealsView ? (
                <div className="pipeline-v2-view-toggle" role="tablist" aria-label="Pipeline view">
                  {[
                    { id: 'board', label: 'Board', Icon: PipelineIcon },
                    { id: 'list', label: 'List', Icon: ListIcon },
                  ].map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      role="tab"
                      aria-selected={view === v.id}
                      onClick={() => setView(v.id)}
                      className={`pipeline-v2-view-toggle__btn ${view === v.id ? 'is-active' : ''}`}
                    >
                      <v.Icon aria-hidden />
                      {v.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {showPipelineFilters && !isDealsView ? (
                <button
                  type="button"
                  className="pipeline-v2-view-settings-btn"
                  onClick={() => setViewSettingsOpen(true)}
                  aria-label="View settings"
                  title="Columns and list view settings"
                >
                  <SettingsGearIcon className="pipeline-v2-view-settings-btn__icon" aria-hidden />
                  <span>View settings</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="pipeline-v2-btn-import"
                aria-label="Import leads"
              >
                <UploadIcon className="pipeline-action-btn__icon w-4 h-4" aria-hidden />
                <span>Import</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddLeadStatus('new')
                  setAddOpen(true)
                }}
                className="pipeline-v2-btn-add"
                aria-label="Add lead"
              >
                <PlusIcon className="pipeline-action-btn__icon w-4 h-4" aria-hidden />
                <span>Add lead</span>
              </button>
            </div>
          </div>

          {orgPipelines.length > 1 && !isDealsView && (
            <div className="px-4 pb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Pipeline</span>
              {orgPipelines.map((pipe) => (
                <button
                  key={pipe.id}
                  type="button"
                  onClick={() => setActivePipelineId(pipe.id)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    activePipelineId === pipe.id
                      ? 'bg-[#fff4ee] border-[#ffd4b8] text-[#FF773D]'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {pipe.name}
                </button>
              ))}
            </div>
          )}

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
              onSelectAllFiltered={selectAllFiltered}
              hasActiveFilters={activeFilterCount > 0 || filter !== 'all' || listStatusFilter !== 'all'}
              onClearFilters={resetAllPipelineFilters}
              onApplySmartView={applySmartView}
              activeSmartViewId={smartViewId}
              orgLeadTags={orgLeadTags}
              stageListMode={stageListMode}
              onRemoveAppliedFilter={removeAppliedFilter}
              canSaveAsAudience={canSaveAsAudience}
              onSaveAsAudience={() => setSaveFilterAudienceOpen(true)}
              canShowOwnerFilter={canFilterByOwner}
              ownerFilter={effectiveAssigneeFilter}
              ownerOptions={ownerFilterOptions}
              onOwnerFilterChange={(id) => setPipelineAssigneeFilter?.(id)}
              statusCounts={boardAwareStatusCounts}
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
              onAssign={openBulkAssign}
              onEdit={() => setBulkEditOpen(true)}
              onTags={orgLeadTags?.length ? () => setBulkTagsOpen(true) : undefined}
              onMarkReplied={() => runBulk({ markReplied: true })}
              onApproveEmailConsent={() => {
                const n = selectedIds.size
                const ok = window.confirm(
                  `Approve commercial email consent for ${n} selected contact${n === 1 ? '' : 's'}? They can receive pipeline and bulk email after this.`
                )
                if (ok) runBulk({ approveEmailConsent: true })
              }}
              onEmail={openBulkEmail}
              onCreateBatchLists={openBatchListsFlow}
              onWhatsApp={() => setWaOpen(true)}
              emailCount={selectedEmailCount}
              phoneCount={selectedPhoneCount}
              onClear={() => setSelectedIds(new Set())}
              onExport={() => downloadLeadsCsv(selectedLeads)}
              onDelete={async () => {
                if (
                  !window.confirm(
                    `Remove ${selectedIds.size} lead${selectedIds.size === 1 ? '' : 's'} from pipeline?`
                  )
                ) {
                  return
                }
                setBulkBusy(true)
                try {
                  for (const id of selectedIds) {
                    const lead = findLeadInLists(id)
                    if (lead) await toggleSaveLead(lead)
                  }
                  setSelectedIds(new Set())
                  await refreshSavedLeads()
                } finally {
                  setBulkBusy(false)
                }
              }}
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
          {isDealsView ? (
            <div className="p-3 md:p-4">
              <PipelineDealsView
                dealStage={dealsStage}
                assigneeFilter={effectiveAssigneeFilter}
                onOpenLead={openDealFromPipeline}
              />
            </div>
          ) : showPipelineOnboarding ? (
            <EmptyPipeline
              onImport={() => setImportOpen(true)}
              onAdd={() => setAddOpen(true)}
              compact={isMobile}
            />
          ) : showNoFilterMatches ? (
            <PipelineNoMatches
              onClearFilters={resetAllPipelineFilters}
              onAdd={() => setAddOpen(true)}
              filterSummary={listBreadcrumb}
            />
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
                    onStatusChange={handleLeadStatusChange}
                    onAddLead={() => {
                      setAddLeadStatus(col.id)
                      setAddOpen(true)
                    }}
                    compact={isMobile}
                    tagById={tagById}
                    teamMembers={teamMembers}
                  />
                )
              })}
            </div>
          ) : (
            <PipelineLeadsTable
              leads={filtered}
              showHoverActions={hoverActionsEnabled}
              selectedId={pipelineLeadId}
              selectedIds={selectedIds}
              onSelect={(leadId) => {
                const lead = findLeadInLists(leadId) || filtered.find((l) => String(l.id) === String(leadId))
                openPipelineLeadRow(lead || { id: leadId })
              }}
              onToggleSelect={toggleSelect}
              onSelectAllVisible={selectAllVisible}
              visibleColumns={tableColumns}
              statusOptions={columns}
              tagById={tagById}
              teamMembers={teamMembers}
              onStatusChange={handleLeadStatusChange}
              onOwnerFilter={handleOwnerFilter}
              canFilterByOwner={canFilterByOwner}
              onQuickCall={(lead) => openPipelineLeadRow(lead, 'overview')}
              onQuickEmail={(lead) => openPipelineLeadRow(lead, 'email')}
              onQuickTask={(lead) => openPipelineLeadRow(lead, 'schedule')}
              onQuickWhatsApp={(lead) => openPipelineLeadRow(lead, 'whatsapp')}
              canAssign={canAssign}
              onDeleteLead={async (lead) => {
                if (!window.confirm(`Remove ${lead.firstName || lead.company || 'this lead'} from pipeline?`)) {
                  return
                }
                await toggleSaveLead(lead)
                await refreshSavedLeads()
              }}
              onChangeOwner={(lead) => {
                setBulkAssignOpen(true)
                setSelectedIds(new Set([lead.id]))
              }}
              onChangeStatus={(lead) => {
                setBulkEditOpen(true)
                setSelectedIds(new Set([lead.id]))
              }}
            />
          )}
          </div>
          {(view === 'list' || stageListMode) &&
            filtered.length > 0 &&
            hasMoreLeads &&
            serverSidePipeline && (
              <div className="pipeline-load-more-foot">
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
        initialStatus={addLeadStatus}
        onClose={() => {
          setAddOpen(false)
          setAddLeadStatus('new')
        }}
        onAdded={(lead) => {
          refreshSavedLeads()
          if (lead?.id) {
            const label =
              [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() ||
              lead.company ||
              'Lead'
            setAddLeadToast({ id: lead.id, label })
          }
        }}
      />
      {addLeadToast ? (
        <div className="pipeline-add-toast" role="status">
          <span>Lead added</span>
          <button
            type="button"
            className="pipeline-add-toast__link"
            onClick={() => {
              openPipelineLead(addLeadToast.id)
              setAddLeadToast(null)
            }}
          >
            Open lead →
          </button>
          <button
            type="button"
            className="pipeline-add-toast__dismiss"
            onClick={() => setAddLeadToast(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}
      <PipelineImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          refreshSavedLeads()
          setImportOpen(false)
        }}
      />
      <PipelineEmailGuideModal
        open={emailGuide.open}
        variant={emailGuide.variant}
        onCreateAudience={openCreateAudienceFlow}
        onClose={() => setEmailGuide({ open: false, variant: 'guide_marketing' })}
      />
      <CreateAudienceModal
        open={createAudienceOpen}
        count={selectedIds.size}
        leadIds={[...selectedIds]}
        onClose={() => setCreateAudienceOpen(false)}
        onCreated={(data) => {
          setCreateAudienceOpen(false)
          setAudienceCreated(data)
        }}
      />
      <SaveFilterAudienceModal
        open={saveFilterAudienceOpen}
        filterSummary={pipelineAudienceFilterSummary}
        filterJson={pipelineAudienceFilterJson}
        onClose={() => setSaveFilterAudienceOpen(false)}
        onCreated={(data) => {
          setSaveFilterAudienceOpen(false)
          setAudienceCreated(data)
        }}
      />
      <CreateBatchListsModal
        open={batchListsOpen}
        count={selectedIds.size}
        leadIds={[...selectedIds]}
        emailCount={selectedEmailCount}
        onClose={() => setBatchListsOpen(false)}
        onCreated={(data) => {
          setBatchListsOpen(false)
          setBatchListsCreated(data)
          setBulkNotice(
            `Created ${data.batchCount} static list(s) · ${data.totalLeads.toLocaleString()} contacts`
          )
        }}
      />
      <BatchListsCreatedModal
        open={Boolean(batchListsCreated)}
        result={batchListsCreated}
        onViewLists={() => {
          setBatchListsCreated(null)
          onNavigate?.('marketing', { tab: 'audiences', audienceTab: 'lists' })
        }}
        onLaunchCampaign={(listId) => {
          setBatchListsCreated(null)
          launchCampaignForAudience(listId)
        }}
        onClose={() => setBatchListsCreated(null)}
      />
      <AudienceCreatedModal
        open={Boolean(audienceCreated)}
        audience={audienceCreated?.audience || audienceCreated?.list}
        onLaunchCampaign={() => {
          const listId = audienceCreated?.list?.id || audienceCreated?.audience?.listId
          const segmentId = audienceCreated?.segment?.id || audienceCreated?.audience?.segmentId
          if (listId) {
            launchCampaignForAudience(listId)
            return
          }
          if (segmentId) {
            setAudienceCreated(null)
            onNavigate?.('marketing', {
              tab: 'campaigns',
              launchSegmentId: segmentId,
              audienceTab: 'studio',
            })
          }
        }}
        onClose={() => setAudienceCreated(null)}
      />
      <BulkAssignConfirmModal
        open={assignGuard.open}
        count={selectedIds.size}
        variant={assignGuard.variant}
        onContinue={() => {
          const pending = assignGuard.pending
          setAssignGuard({ open: false, variant: 'confirm', pending: null })
          if (pending !== null) runBulk({ assignToUserId: pending })
        }}
        onReview={() => {
          setAssignGuard({ open: false, variant: 'confirm', pending: null })
          setSelectedIds(new Set())
        }}
        onClose={() => setAssignGuard({ open: false, variant: 'confirm', pending: null })}
      />
      <BulkEditReviewModal
        open={editReview.open}
        count={selectedIds.size}
        currentStageLabel={editReview.currentLabel}
        targetStageLabel={editReview.targetLabel}
        onConfirm={() => {
          const actions = editReview.actions
          setEditReview({ open: false, actions: null, currentLabel: '', targetLabel: '' })
          if (actions) runBulk(actions)
        }}
        onClose={() =>
          setEditReview({ open: false, actions: null, currentLabel: '', targetLabel: '' })
        }
      />
      <ExportPrepareModal
        open={exportGuard.open}
        count={filtered.length}
        mode={exportGuard.mode}
        preparing={exportGuard.preparing}
        onContinue={runProtectedExport}
        onClose={() => setExportGuard({ open: false, mode: 'instant', preparing: false })}
      />
      <BulkEmailModal
        open={bulkOpen}
        leadIds={[...selectedIds]}
        leads={selectedLeads}
        onClose={() => setBulkOpen(false)}
        onNavigate={onNavigate}
        onDone={() => {
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
        onSubmit={submitBulkAssign}
      />
      <PipelineBulkEditModal
        open={bulkEditOpen}
        count={selectedIds.size}
        statusOptions={columns}
        teamMembers={teamMembers}
        canAssign={canAssign}
        busy={bulkBusy}
        onClose={() => setBulkEditOpen(false)}
        onSubmit={submitBulkEdit}
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
        visibleColumns={tableColumns}
        onColumnsChange={(cols) => {
          setTableColumns(cols)
          savePipelineColumnPrefs(cols)
        }}
        hoverActionsEnabled={hoverActionsEnabled}
        onHoverActionsChange={(enabled) => {
          setHoverActionsEnabled(enabled)
          savePipelineHoverActionsPref(enabled)
        }}
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
    <div className="pipeline-load-more-bar">
      <span className="pipeline-load-more-bar__meta">
        {loaded.toLocaleString()} / {total.toLocaleString()}
      </span>
      <button type="button" disabled={loading} onClick={onLoadMore} className="pipeline-load-more-bar__btn">
        {loading ? '…' : 'More'}
      </button>
    </div>
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
  onStatusChange,
  onAddLead,
  tagById,
  teamMembers = [],
  compact = false,
}) {
  const [dropTarget, setDropTarget] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id))

  const ownerName = (lead) => {
    const id = lead.assignedToUserId
    if (!id) return null
    const m = (teamMembers || []).find((t) => t.userId === id)
    return m?.name || 'Owner'
  }

  return (
    <div className={`crm-kanban-column ${compact ? 'w-[200px]' : ''}`}>
      <div className="crm-kanban-column-header flex items-center justify-between gap-1">
        <span className="truncate">{column.label}</span>
        <div className="flex items-center gap-1 shrink-0">
          {onAddLead ? (
            <button
              type="button"
              className="pipeline-kanban-col-add"
              onClick={onAddLead}
              aria-label={`Add lead to ${column.label}`}
              title="Add lead"
            >
              +
            </button>
          ) : null}
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAllInColumn(e.target.checked)}
            title={`Select all in ${column.label}`}
            aria-label={`Select all in ${column.label}`}
            className="w-3.5 h-3.5"
          />
          <span
            className="text-xs font-medium tabular-nums px-2 py-0.5 rounded-full"
            style={{ background: '#64748B', color: '#fff' }}
          >
            {totalInColumn > leads.length ? totalInColumn : leads.length}
          </span>
        </div>
      </div>
      <div
        className={`crm-kanban-column-body ${dropTarget ? 'pipeline-kanban-column--drop-target' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDropTarget(true)
        }}
        onDragLeave={() => setDropTarget(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDropTarget(false)
          const leadId = e.dataTransfer.getData('text/lead-id')
          if (leadId && onStatusChange) onStatusChange(leadId, column.id)
        }}
      >
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
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/lead-id', lead.id)
                e.dataTransfer.effectAllowed = 'move'
                setDraggingId(lead.id)
              }}
              onDragEnd={() => setDraggingId(null)}
              className={`crm-kanban-card ${selectedId === lead.id ? 'is-active' : ''} ${
                selectedIds.has(lead.id) ? 'is-checked' : ''
              } ${draggingId === lead.id ? 'pipeline-kanban-card--dragging' : ''}`}
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
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className="pipeline-hs-avatar pipeline-hs-avatar--sm shrink-0" aria-hidden>
                      {(lead.firstName?.[0] || lead.company?.[0] || '?').toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-[#33475b] truncate leading-tight ci-selectable-text">
                      {primaryLabel}
                    </span>
                    <span className={`pipeline-hs-status ${getStatusMeta(lead.crm?.status).color} shrink-0`}>
                      {getStatusMeta(lead.crm?.status).label}
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
                  {ownerName(lead) ? (
                    <p className="text-xs text-[#7c98b6] mt-1 truncate">{ownerName(lead)}</p>
                  ) : null}
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
                      <span className="text-sm pipeline-hs-email-text truncate">{getLeadEmail(lead)}</span>
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

function PipelineEmptyGraphic({ Icon }) {
  return (
    <div className="pipeline-empty-v2__graphic" aria-hidden>
      <span className="pipeline-empty-v2__graphic-ring" />
      <div className="pipeline-empty-v2__graphic-core">
        <Icon />
      </div>
    </div>
  )
}

function PipelineNoMatches({ onClearFilters, onAdd, filterSummary = '' }) {
  return (
    <div className="pipeline-empty-v2 pipeline-empty-v2--premium">
      <PipelineEmptyGraphic Icon={SearchIcon} />
      <h3 className="pipeline-empty-v2__title">No leads match this view</h3>
      {filterSummary ? <p className="pipeline-empty-v2__filters">{filterSummary}</p> : null}
      <p className="pipeline-empty-v2__sub">
        Broaden your filters or search to surface more results.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" onClick={onClearFilters} className="crm-btn crm-btn-secondary">
          Reset filters
        </button>
        <button type="button" onClick={onAdd} className="pipeline-v2-btn-add">
          Add lead
        </button>
      </div>
    </div>
  )
}

function EmptyPipeline({ onImport, onAdd, compact = false }) {
  return (
    <div className={`pipeline-empty-v2 pipeline-empty-v2--premium ${compact ? 'py-8' : ''}`}>
      <PipelineEmptyGraphic Icon={PipelineIcon} />
      <h3 className="pipeline-empty-v2__title">Your pipeline is ready</h3>
      <p className="pipeline-empty-v2__sub">
        Add your first lead or import a CSV to start moving deals forward.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" onClick={() => onAdd?.()} className="pipeline-v2-btn-add">
          <PlusIcon className="w-4 h-4" aria-hidden />
          Add first lead
        </button>
        <button type="button" onClick={onImport} className="pipeline-v2-btn-import">
          <UploadIcon className="w-4 h-4" aria-hidden />
          Import CSV
        </button>
      </div>
    </div>
  )
}
