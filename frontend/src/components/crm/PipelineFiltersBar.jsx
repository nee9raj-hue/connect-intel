import { useCallback, useEffect, useMemo, useState } from 'react'
import usePipelineFilterMobile from '../../hooks/usePipelineFilterMobile'
import { useApp } from '../../context/AppContext'
import { PIPELINE_SEARCH_ID } from '../../hooks/useAppKeyboardShortcuts'
import { api } from '../../lib/api'
import { CONTACT_FILTER_OPTIONS, DEFAULT_PIPELINE_FILTERS, getFilterCities, getFilterStates } from '../../lib/pipelineFilters'
import { FilterChipButton } from './FilterDropdown'
import { DEAL_MONTH_OPTIONS, dealYearOptions, formatDealPeriodLabel } from '../../lib/pipelineDealsFilter'
import { lastShipmentMonthValues, lastShipmentPeriodLabel } from '../../../../lib/leadLastShipmentFilter.js'
import {
  displayTagIdsForFilters,
  mergeTeamScopedTagFilters,
  teamIdsFromHierarchyForUser,
} from '../../../../lib/pipelineMemberVisibility.js'
import { isFreightDealOrg } from '../../lib/freightDeal'
import { FREIGHT_CRM_PIPELINE_COLUMNS } from '../../lib/crmConstants'
import LeadTag from '../ui/LeadTag'
import ErpTagChip from '../ui/ErpTagChip'
import PipelineFilterPopup from './PipelineFilterPopup'
import PipelineFilterToolbarButton from './PipelineFilterToolbarButton'
import PipelineMobileFilterSheet, { SearchableMultiList, SingleSelectList } from './PipelineMobileFilterSheet'
import {
  ListIcon,
  MailIcon,
  MapIcon,
  MapPinIcon,
  PeopleIcon,
  SearchIcon,
  CalendarIcon,
} from '../ui/icons'

const SMART_TAG_OPTIONS = [
  { id: 'not_touched', label: 'Not touched' },
  { id: 'hot_score', label: 'Hot (Score 70+)' },
]

function memberIdsForTeams(teams, teamIds) {
  const wanted = new Set((teamIds || []).map(String).filter(Boolean))
  if (!wanted.size) return []
  const ids = []
  for (const team of teams || []) {
    if (!wanted.has(String(team.id))) continue
    for (const id of team.memberIds || []) {
      if (id) ids.push(String(id))
    }
  }
  return [...new Set(ids)]
}

const MOBILE_FILTER_TITLES = {
  owner: 'Lead owner',
  status: 'Lead status',
  city: 'City',
  state: 'State',
  contact: 'Contact',
  lastShipment: 'Last shipment',
  advanced: 'More filters',
}

const MOBILE_FILTER_SUBTITLES = {}

export default function PipelineFiltersBar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  appliedFilters = DEFAULT_PIPELINE_FILTERS,
  appliedSearch = '',
  filtersDirty = false,
  onApplyFilters,
  applying = false,
  cities = [],
  states = [],
  statusFilter = 'all',
  onStatusFilterChange,
  statusOptions = [],
  resultCount = 0,
  onSelectAllFiltered,
  hasActiveFilters = false,
  onClearFilters,
  onApplySmartView,
  activeSmartViewId,
  orgLeadTags = [],
  erpTagOptions = [],
  refreshOrgLeadTags,
  stageListMode = false,
  onRemoveAppliedFilter,
  canSaveAsAudience = false,
  onSaveAsAudience,
  canSaveReport = false,
  onSaveReport,
  onRunSavedReport,
  canExportFunnel = false,
  onExportFunnel,
  canShowOwnerFilter = false,
  ownerFilter = null,
  ownerOptions = [],
  onOwnerFilterChange,
  statusCounts = {},
}) {
  const { user } = useApp()
  const [savedViews, setSavedViews] = useState([])
  const [savedReports, setSavedReports] = useState([])
  const [activeFilter, setActiveFilter] = useState(null)
  const [orgTeams, setOrgTeams] = useState([])
  const [hierarchyDepartments, setHierarchyDepartments] = useState([])
  const useMobileFilterSheet = usePipelineFilterMobile()

  const loadViews = useCallback(async () => {
    try {
      const data = await api.getPipelineSavedViews()
      setSavedViews(data.views || [])
    } catch {
      setSavedViews([])
    }
  }, [])

  const loadReports = useCallback(async () => {
    try {
      const data = await api.getReportDefinitions('pipeline')
      setSavedReports(data.reports || [])
    } catch {
      setSavedReports([])
    }
  }, [])

  useEffect(() => {
    loadViews()
    loadReports()
  }, [loadViews, loadReports])

  useEffect(() => {
    let cancelled = false
    api
      .getOrgHierarchy({ skipLeadCounts: true, silent: true })
      .then((data) => {
        if (cancelled) return
        const teams = (data?.departments || []).flatMap((dept) =>
          (dept.teams || []).map((team) => ({
            id: String(team.id),
            label: dept.name ? `${team.name} (${dept.name})` : team.name,
            name: team.name,
            memberIds: (team.members || [])
              .map((m) => String(m.userId || m.legacyUserId || ''))
              .filter(Boolean),
          }))
        )
        setOrgTeams(teams)
        setHierarchyDepartments(data?.departments || [])
        void refreshOrgLeadTags?.()
      })
      .catch(() => {
        if (!cancelled) {
          setOrgTeams([])
          setHierarchyDepartments([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshOrgLeadTags])

  const handleApply = () => onApplyFilters?.()

  const commitFilters = useCallback(
    (nextFilters) => {
      onFiltersChange(nextFilters)
      onApplyFilters?.({ advanced: nextFilters })
    },
    [onFiltersChange, onApplyFilters]
  )

  const shipmentYearOptions = useMemo(() => dealYearOptions(new Date(), []), [])
  const shipmentYear = String(appliedFilters.lastShipmentYear || filters.lastShipmentYear || '')
  const shipmentMonths = lastShipmentMonthValues(appliedFilters.lastShipmentYear ? appliedFilters : filters).map(String)
  const shipmentDisplay =
    formatDealPeriodLabel({
      year: shipmentYear,
      months: shipmentMonths,
    }) || shipmentYear || null

  const cityOptions = cities.map((c) => ({ label: c, value: c }))
  const stateOptions = states.map((s) => ({ label: s, value: s }))
  const stageOptions = statusOptions.map((s) => ({
    label: statusCounts[s.id] != null ? `${s.label} (${statusCounts[s.id]})` : s.label,
    value: s.id,
  }))
  const ownerSelectOptions = ownerOptions.map((m) => ({
    label:
      m.userId === '__unassigned__'
        ? m.name || 'Unassigned leads'
        : m.name || m.email || 'Team member',
    value: m.userId,
  }))
  const contactOptions = CONTACT_FILTER_OPTIONS.filter((o) => o.id !== 'any').map((o) => ({
    label: o.label,
    value: o.id,
  }))
  const isOrgAdmin = Boolean(user?.isOrgAdmin || user?.orgRole === 'org_admin')
  const memberTeamIds = useMemo(
    () => teamIdsFromHierarchyForUser(hierarchyDepartments, user?.id, user?.teamId),
    [hierarchyDepartments, user?.id, user?.teamId]
  )
  const tagOptions = orgLeadTags.map((t) => {
    const locked =
      !isOrgAdmin &&
      Boolean(t.teamId || t.source === 'org_team') &&
      !memberTeamIds.includes(String(t.teamId || ''))
    return {
      label: t.name,
      value: t.id,
      disabled: locked,
      hint: locked ? 'Only this team can use this tag' : undefined,
    }
  })
  const erpTagSelectOptions = erpTagOptions.map((t) => ({
    label: t.name,
    value: t.name,
  }))
  const showErpTagFilter = erpTagSelectOptions.length > 0 || isFreightDealOrg(user)
  const freightOrg = isFreightDealOrg(user)
  const crmStageOptions = freightOrg
    ? FREIGHT_CRM_PIPELINE_COLUMNS.map((s) => ({ label: s.label, value: s.id }))
    : []
  const teamOptions = orgTeams.map((t) => {
    const locked = !isOrgAdmin && !memberTeamIds.includes(String(t.id))
    return {
      label: t.label,
      value: t.id,
      disabled: locked,
      hint: locked ? "You don't have access to this team" : undefined,
    }
  })
  const smartOptions = SMART_TAG_OPTIONS.map((o) => ({ label: o.label, value: o.id }))
  const savedViewOptions = savedViews.map((v) => ({
    label: v.shared ? `${v.name} (Team)` : v.name,
    value: v.id,
  }))

  const appliedCities = getFilterCities(appliedFilters)
  const appliedStates = getFilterStates(appliedFilters)

  const advancedActiveCount =
    (appliedFilters.tagIds?.length || 0) +
    (appliedFilters.erpTagNames?.length || 0) +
    (appliedFilters.crmStageIds?.length || 0) +
    (appliedFilters.smartTags?.length || 0) +
    (appliedFilters.teamIds?.length || 0) +
    (activeSmartViewId ? 1 : 0)

  const openFilter = (type) => {
    if (type === 'advanced') void loadReports()
    setActiveFilter({
      type,
      draft: {
        filters: {
          ...filters,
          tagIds: displayTagIdsForFilters(filters, orgLeadTags),
        },
        statusFilter,
        ownerFilter: ownerFilter || '',
        smartViewId: activeSmartViewId || '',
      },
    })
  }

  const closeFilter = () => {
    setActiveFilter(null)
  }

  const updateFilterDraft = (patch) => {
    setActiveFilter((prev) =>
      prev
        ? {
            ...prev,
            draft: {
              ...prev.draft,
              filters: { ...prev.draft.filters, ...patch },
            },
          }
        : prev
    )
  }

  const updateFilterDraftStatus = (statusId) => {
    setActiveFilter((prev) =>
      prev
        ? {
            ...prev,
            draft: {
              ...prev.draft,
              statusFilter: statusId || 'all',
            },
          }
        : prev
    )
  }

  const updateFilterDraftOwner = (ownerId) => {
    setActiveFilter((prev) =>
      prev
        ? {
            ...prev,
            draft: {
              ...prev.draft,
              ownerFilter: ownerId || '',
            },
          }
        : prev
    )
  }

  const updateFilterDraftSmartView = (viewId) => {
    setActiveFilter((prev) =>
      prev
        ? {
            ...prev,
            draft: {
              ...prev.draft,
              smartViewId: viewId || '',
            },
          }
        : prev
    )
  }

  const applyActiveFilter = () => {
    if (!activeFilter?.draft) return
    const { type, draft } = activeFilter

    switch (type) {
      case 'owner':
        onOwnerFilterChange?.(draft.ownerFilter || null)
        onApplyFilters?.()
        break
      case 'status':
        onStatusFilterChange?.(draft.statusFilter || 'all')
        onApplyFilters?.()
        break
      case 'city':
        commitFilters({ ...filters, cities: draft.filters.cities || [] })
        break
      case 'state':
        commitFilters({ ...filters, states: draft.filters.states || [] })
        break
      case 'contact':
        commitFilters({ ...filters, contact: draft.filters.contact || 'any' })
        break
      case 'lastShipment': {
        const lastShipmentYear = String(draft.filters.lastShipmentYear || '')
        const lastShipmentMonths = lastShipmentYear
          ? lastShipmentMonthValues(draft.filters).map(String)
          : []
        commitFilters({
          ...filters,
          lastShipmentYear,
          lastShipmentMonths,
          lastShipmentMonth: lastShipmentMonths.join(','),
        })
        break
      }
      case 'advanced': {
        const next = { ...draft.filters }
        const scoped = mergeTeamScopedTagFilters(next, orgLeadTags, memberTeamIds, { isOrgAdmin })
        next.teamMemberUserIds = memberIdsForTeams(orgTeams, scoped.teamIds || [])
        commitFilters(next)
        const view = savedViews.find((v) => v.id === draft.smartViewId)
        if (view) onApplySmartView?.(view)
        break
      }
      default:
        break
    }

    closeFilter()
  }

  const filterDraft = activeFilter?.draft

  const renderFilterContent = () => {
    if (!activeFilter || !filterDraft) return null

    switch (activeFilter.type) {
      case 'owner':
        return (
          <SingleSelectList
            options={ownerSelectOptions}
            value={filterDraft.ownerFilter || ''}
            emptyLabel="All owners"
            onChange={updateFilterDraftOwner}
          />
        )
      case 'status':
        return (
          <SingleSelectList
            statusStyle
            options={stageOptions}
            value={filterDraft.statusFilter !== 'all' ? filterDraft.statusFilter : ''}
            emptyLabel="All statuses"
            onChange={updateFilterDraftStatus}
          />
        )
      case 'city':
        return (
          <SearchableMultiList
            options={cityOptions}
            values={filterDraft.filters.cities || []}
            onChange={(v) => updateFilterDraft({ cities: v })}
            placeholder="Search cities…"
            emptyLabel="All cities"
          />
        )
      case 'state':
        return (
          <SearchableMultiList
            options={stateOptions}
            values={filterDraft.filters.states || []}
            onChange={(v) => updateFilterDraft({ states: v })}
            placeholder="Search states…"
            emptyLabel="All states"
          />
        )
      case 'contact':
        return (
          <SingleSelectList
            options={contactOptions}
            value={filterDraft.filters.contact !== 'any' ? filterDraft.filters.contact : ''}
            emptyLabel="All contacts"
            onChange={(v) => updateFilterDraft({ contact: v || 'any' })}
          />
        )
      case 'lastShipment':
        return (
          <div className="pipeline-filter-popout-sections">
            <section className="pipeline-filter-popout-section">
              <p className="hs-advanced-filter-label">Year</p>
              <SingleSelectList
                options={shipmentYearOptions}
                value={String(filterDraft.filters.lastShipmentYear || '')}
                emptyLabel="Any year"
                onChange={(year) =>
                  updateFilterDraft({
                    lastShipmentYear: year || '',
                    lastShipmentMonth: year ? filterDraft.filters.lastShipmentMonth || '' : '',
                    lastShipmentMonths: year
                      ? lastShipmentMonthValues(filterDraft.filters).map(String)
                      : [],
                  })
                }
              />
            </section>
            <section className="pipeline-filter-popout-section">
              <p className="hs-advanced-filter-label">Months</p>
              {filterDraft.filters.lastShipmentYear ? (
                <SearchableMultiList
                  options={DEAL_MONTH_OPTIONS}
                  values={lastShipmentMonthValues(filterDraft.filters).map(String)}
                  emptyLabel="All months"
                  onChange={(months) =>
                    updateFilterDraft({
                      lastShipmentMonths: months,
                      lastShipmentMonth: months.join(','),
                    })
                  }
                />
              ) : (
                <p className="pipeline-filter-popout-hint">Choose a year to filter by month.</p>
              )}
            </section>
          </div>
        )
      case 'advanced':
        return (
          <div className="pipeline-filter-popout-sections">
            {savedViews.length > 0 ? (
              <section className="pipeline-filter-popout-section">
                <p className="hs-advanced-filter-label">Saved views</p>
                <SingleSelectList
                  options={savedViewOptions}
                  value={filterDraft.smartViewId || ''}
                  emptyLabel="None"
                  onChange={updateFilterDraftSmartView}
                />
              </section>
            ) : null}
            {savedReports.length > 0 ? (
              <section className="pipeline-filter-popout-section">
                <p className="hs-advanced-filter-label">Saved reports</p>
                <ul className="pipeline-saved-reports-list">
                  {savedReports.map((report) => (
                    <li key={report.id}>
                      <button
                        type="button"
                        className="crm-filter-link-btn text-left w-full"
                        onClick={() => onRunSavedReport?.(report)}
                      >
                        Export {report.shared ? `${report.name} (Team)` : report.name}
                        {report.schedule?.enabled
                          ? ` · ${report.schedule.cadence === 'weekly' ? 'Weekly' : 'Daily'} email`
                          : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {orgLeadTags.length > 0 ? (
              <section className="pipeline-filter-popout-section">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="hs-advanced-filter-label mb-0">Tags</p>
                  <select
                    value={filterDraft.filters.tagMode || 'any'}
                    onChange={(e) => updateFilterDraft({ tagMode: e.target.value })}
                    className="crm-select-sm crm-select-sm--hubspot"
                  >
                    <option value="any">Any</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <SearchableMultiList
                  options={tagOptions}
                  values={filterDraft.filters.tagIds || []}
                  onChange={(v) => updateFilterDraft({ tagIds: v })}
                  placeholder="Search tags…"
                  emptyLabel="Any tag"
                />
              </section>
            ) : null}
            {showErpTagFilter ? (
              <section className="pipeline-filter-popout-section">
                <p className="hs-advanced-filter-label">ERP tags</p>
                <SearchableMultiList
                  options={erpTagSelectOptions}
                  values={filterDraft.filters.erpTagNames || []}
                  onChange={(v) => updateFilterDraft({ erpTagNames: v })}
                  placeholder="Search ERP tags…"
                  emptyLabel="Any ERP tag"
                />
              </section>
            ) : null}
            {crmStageOptions.length ? (
              <section className="pipeline-filter-popout-section">
                <p className="hs-advanced-filter-label">CRM stages</p>
                <p className="pipeline-filter-popout-hint">
                  Adds CRM pipeline leads even when ERP tags or last shipment filters are on.
                </p>
                <SearchableMultiList
                  options={crmStageOptions}
                  values={filterDraft.filters.crmStageIds || []}
                  onChange={(v) => updateFilterDraft({ crmStageIds: v })}
                  placeholder="Search CRM stages…"
                  emptyLabel="Any CRM stage"
                />
              </section>
            ) : null}
            {teamOptions.length > 0 ? (
              <section className="pipeline-filter-popout-section">
                <p className="hs-advanced-filter-label">Teams</p>
                <SearchableMultiList
                  options={teamOptions}
                  values={filterDraft.filters.teamIds || []}
                  onChange={(v) => updateFilterDraft({ teamIds: v })}
                  placeholder="Search teams…"
                  emptyLabel="All teams"
                />
              </section>
            ) : null}
            <section className="pipeline-filter-popout-section">
              <p className="hs-advanced-filter-label">Date added</p>
              <div className="pipeline-filter-popout-dates">
                <label>
                  From
                  <input
                    type="date"
                    value={filterDraft.filters.addedFrom || ''}
                    onChange={(e) => updateFilterDraft({ addedFrom: e.target.value })}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={filterDraft.filters.addedTo || ''}
                    onChange={(e) => updateFilterDraft({ addedTo: e.target.value })}
                  />
                </label>
              </div>
            </section>
            <section className="pipeline-filter-popout-section">
              <p className="hs-advanced-filter-label">Last activity</p>
              <div className="pipeline-filter-popout-dates">
                <label>
                  From
                  <input
                    type="date"
                    value={filterDraft.filters.lastActivityFrom || ''}
                    onChange={(e) => updateFilterDraft({ lastActivityFrom: e.target.value })}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={filterDraft.filters.lastActivityTo || ''}
                    onChange={(e) => updateFilterDraft({ lastActivityTo: e.target.value })}
                  />
                </label>
              </div>
            </section>
            <section className="pipeline-filter-popout-section">
              <p className="hs-advanced-filter-label">Lead score</p>
              <div className="pipeline-filter-popout-score">
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Min"
                  value={filterDraft.filters.minLeadScore ?? ''}
                  onChange={(e) =>
                    updateFilterDraft({
                      minLeadScore: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Max"
                  value={filterDraft.filters.maxLeadScore ?? ''}
                  onChange={(e) =>
                    updateFilterDraft({
                      maxLeadScore: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            </section>
            <section className="pipeline-filter-popout-section">
              <p className="hs-advanced-filter-label">Source</p>
              <select
                value={filterDraft.filters.sourceFilter || ''}
                onChange={(e) => updateFilterDraft({ sourceFilter: e.target.value })}
                className="pipeline-filter-popout-select"
              >
                <option value="">All sources</option>
                <option value="manual">Manual entry</option>
                <option value="import">Import</option>
                <option value="referral">Referral</option>
                <option value="website">Website</option>
              </select>
            </section>
            <section className="pipeline-filter-popout-section">
              <label className="pipeline-filter-popout-check">
                <input
                  type="checkbox"
                  checked={Boolean(filterDraft.filters.stuckLeads)}
                  onChange={(e) => updateFilterDraft({ stuckLeads: e.target.checked })}
                />
                Stuck leads (no activity 7+ days)
              </label>
            </section>
            <section className="pipeline-filter-popout-section">
              <p className="hs-advanced-filter-label">Smart</p>
              <SearchableMultiList
                options={smartOptions}
                values={filterDraft.filters.smartTags || []}
                onChange={(v) => updateFilterDraft({ smartTags: v })}
                placeholder="Search…"
                emptyLabel="Any"
              />
            </section>
          </div>
        )
      default:
        return null
    }
  }

  const activeStageLabel = statusOptions.find((s) => s.id === statusFilter)?.label
  const activeContactLabel = CONTACT_FILTER_OPTIONS.find((o) => o.id === appliedFilters.contact)?.label

  const showActiveChips =
    appliedSearch ||
    appliedCities.length ||
    appliedStates.length ||
    (appliedFilters.tagIds?.length || 0) > 0 ||
    (appliedFilters.erpTagNames?.length || 0) > 0 ||
    (appliedFilters.crmStageIds?.length || 0) > 0 ||
    (appliedFilters.smartTags?.length || 0) > 0 ||
    (appliedFilters.teamIds?.length || 0) > 0 ||
    (!stageListMode && statusFilter !== 'all') ||
    (appliedFilters.contact && appliedFilters.contact !== 'any') ||
    Boolean(appliedFilters.lastShipmentYear)

  const filterToolbar = (
    <>
      {canShowOwnerFilter ? (
        <PipelineFilterToolbarButton
          icon={PeopleIcon}
          iconTone="owner"
          label="Owner"
          compact={useMobileFilterSheet}
          displayValue={ownerSelectOptions.find((o) => String(o.value) === String(ownerFilter))?.label}
          active={Boolean(ownerFilter)}
          aria-expanded={activeFilter?.type === 'owner'}
          onClick={() => openFilter('owner')}
        />
      ) : null}

      {!stageListMode ? (
        <PipelineFilterToolbarButton
          icon={ListIcon}
          iconTone="status"
          label="Status"
          compact={useMobileFilterSheet}
          displayValue={statusOptions.find((s) => s.id === statusFilter)?.label}
          active={statusFilter !== 'all'}
          aria-expanded={activeFilter?.type === 'status'}
          onClick={() => openFilter('status')}
        />
      ) : null}

      <PipelineFilterToolbarButton
        icon={MapPinIcon}
        iconTone="city"
        label="City"
        compact={useMobileFilterSheet}
        displayValue={
          appliedCities.length > 0
            ? appliedCities.length === 1
              ? appliedCities[0]
              : `${appliedCities.length} cities`
            : undefined
        }
        active={appliedCities.length > 0}
        aria-expanded={activeFilter?.type === 'city'}
        onClick={() => openFilter('city')}
      />

      <PipelineFilterToolbarButton
        icon={MapIcon}
        iconTone="state"
        label="State"
        compact={useMobileFilterSheet}
        displayValue={
          appliedStates.length > 0
            ? appliedStates.length === 1
              ? appliedStates[0]
              : `${appliedStates.length} states`
            : undefined
        }
        active={appliedStates.length > 0}
        aria-expanded={activeFilter?.type === 'state'}
        onClick={() => openFilter('state')}
      />

      <PipelineFilterToolbarButton
        icon={MailIcon}
        iconTone="contact"
        label="Contact"
        compact={useMobileFilterSheet}
        displayValue={CONTACT_FILTER_OPTIONS.find((o) => o.id === filters.contact)?.label}
        active={Boolean(filters.contact && filters.contact !== 'any')}
        aria-expanded={activeFilter?.type === 'contact'}
        onClick={() => openFilter('contact')}
      />

      <PipelineFilterToolbarButton
        icon={CalendarIcon}
        iconTone="shipment"
        label="Last shipment"
        compact={useMobileFilterSheet}
        displayValue={shipmentDisplay}
        active={Boolean(shipmentYear)}
        aria-expanded={activeFilter?.type === 'lastShipment'}
        onClick={() => openFilter('lastShipment')}
      />

      <PipelineFilterToolbarButton
        variant="more"
        iconTone="more"
        label="More filters"
        compact={useMobileFilterSheet}
        active={activeFilter?.type === 'advanced' || advancedActiveCount > 0}
        badgeCount={advancedActiveCount}
        aria-expanded={activeFilter?.type === 'advanced'}
        onClick={() => openFilter('advanced')}
      />
    </>
  )

  return (
    <div className="crm-toolbar crm-toolbar--hubspot pipeline-filter-labeled pipeline-filter-command-bar">
      <div className="pipeline-filter-command-bar__shell">
        <div className="pipeline-filter-command-bar__search">
          <SearchIcon className="pipeline-filter-command-bar__search-icon" aria-hidden />
          <input
            id={PIPELINE_SEARCH_ID}
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleApply()
              }
            }}
            placeholder="Search by name, email, or phone…"
            className="pipeline-filter-command-bar__search-input"
            aria-label="Search pipeline leads"
          />
          {search ? (
            <button
              type="button"
              className="pipeline-filter-command-bar__search-clear"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
            >
              ×
            </button>
          ) : null}
        </div>

        <div className="pipeline-filter-command-bar__filters" role="toolbar" aria-label="Lead filters">
          {filterToolbar}
        </div>

        {!useMobileFilterSheet && (
          <PipelineFilterPopup
            open={Boolean(activeFilter)}
            title={activeFilter ? MOBILE_FILTER_TITLES[activeFilter.type] || 'Filter' : 'Filter'}
            wide={activeFilter?.type === 'advanced'}
            onClose={closeFilter}
            onApply={applyActiveFilter}
          >
            {renderFilterContent()}
          </PipelineFilterPopup>
        )}

        <PipelineMobileFilterSheet
          open={Boolean(useMobileFilterSheet && activeFilter)}
          title={activeFilter ? MOBILE_FILTER_TITLES[activeFilter.type] || 'Filter' : 'Filter'}
          subtitle={activeFilter ? MOBILE_FILTER_SUBTITLES[activeFilter.type] : undefined}
          onClose={closeFilter}
          onSave={applyActiveFilter}
          saveLabel="Apply"
        >
          {renderFilterContent()}
        </PipelineMobileFilterSheet>

        {filtersDirty ? (
          <div className="pipeline-filter-command-bar__meta">
            <button type="button" className="pipeline-filter-command-bar__apply" onClick={handleApply} disabled={applying}>
              {applying ? 'Applying…' : 'Apply filters'}
            </button>
          </div>
        ) : null}
      </div>

      <div className="hs-filter-bar-meta flex flex-wrap items-center gap-2 px-0 pt-0.5 pb-0.5 lg:hidden">
        {(appliedSearch || hasActiveFilters) && (
          <button type="button" onClick={onClearFilters} className="crm-filter-link-btn text-xs">
            Clear all
          </button>
        )}
        {resultCount > 0 && (
          <button type="button" onClick={onSelectAllFiltered} className="crm-filter-link-btn text-xs">
            Select all
          </button>
        )}
      </div>

      {showActiveChips && (
        <div className="crm-active-filters crm-active-filters--hubspot">
          {canSaveAsAudience ? (
            <button type="button" className="crm-filter-link-btn" onClick={onSaveAsAudience}>
              Save as audience
            </button>
          ) : (
            <button type="button" className="crm-filter-link-btn is-locked" disabled title="You don't have access to this">
              Save as audience
            </button>
          )}
          {canSaveReport ? (
            <button type="button" className="crm-filter-link-btn" onClick={onSaveReport}>
              Save as report
            </button>
          ) : (
            <button type="button" className="crm-filter-link-btn is-locked" disabled title="You don't have access to this">
              Save as report
            </button>
          )}
          {canExportFunnel ? (
            <button type="button" className="crm-filter-link-btn" onClick={onExportFunnel}>
              Export funnel CSV
            </button>
          ) : (
            <button
              type="button"
              className="crm-filter-link-btn is-locked"
              disabled
              title="You don't have access to this"
            >
              Export funnel CSV
            </button>
          )}
          {appliedSearch && (
            <FilterChipButton
              label={`Search: “${appliedSearch}”`}
              onRemove={() => onRemoveAppliedFilter?.({ search: '' })}
            />
          )}
          {appliedCities.map((c) => (
            <FilterChipButton
              key={`city-${c}`}
              label={`City: ${c}`}
              onRemove={() =>
                onRemoveAppliedFilter?.({
                  cities: appliedCities.filter((x) => x !== c),
                })
              }
            />
          ))}
          {appliedStates.map((s) => (
            <FilterChipButton
              key={`state-${s}`}
              label={`State: ${s}`}
              onRemove={() =>
                onRemoveAppliedFilter?.({
                  states: appliedStates.filter((x) => x !== s),
                })
              }
            />
          ))}
          {!stageListMode && statusFilter !== 'all' && activeStageLabel && (
            <FilterChipButton label={activeStageLabel} onRemove={() => onStatusFilterChange?.('all')} />
          )}
          {appliedFilters.contact && appliedFilters.contact !== 'any' && activeContactLabel && (
            <FilterChipButton
              label={activeContactLabel}
              onRemove={() => onRemoveAppliedFilter?.({ contact: 'any' })}
            />
          )}
          {appliedFilters.lastShipmentYear ? (
            <FilterChipButton
              label={
                lastShipmentPeriodLabel(appliedFilters) ||
                formatDealPeriodLabel({
                  year: appliedFilters.lastShipmentYear,
                  month: appliedFilters.lastShipmentMonth,
                })
              }
              onRemove={() =>
                onRemoveAppliedFilter?.({
                  lastShipmentYear: '',
                  lastShipmentMonth: '',
                  lastShipmentMonths: [],
                })
              }
            />
          ) : null}
          {(appliedFilters.teamIds || []).map((teamId) => {
            const team = orgTeams.find((t) => t.id === teamId)
            return (
              <FilterChipButton
                key={`team-${teamId}`}
                label={`Team: ${team?.name || teamId}`}
                onRemove={() => {
                  const teamIds = (appliedFilters.teamIds || []).filter((id) => id !== teamId)
                  onRemoveAppliedFilter?.({
                    teamIds,
                    teamMemberUserIds: memberIdsForTeams(orgTeams, teamIds),
                  })
                }}
              />
            )
          })}
          {(displayTagIdsForFilters(appliedFilters, orgLeadTags) || []).map((tagId) => {
            const tag = orgLeadTags.find((t) => t.id === tagId)
            if (!tag) return null
            return (
              <span key={tagId} className="crm-filter-chip crm-filter-chip--tag">
                <LeadTag name={tag.name} />
                <button
                  type="button"
                  onClick={() => {
                    const tag = orgLeadTags.find((t) => String(t.id) === String(tagId))
                    const nextTagIds = (appliedFilters.tagIds || []).filter((id) => id !== tagId)
                    const teamId = String(tag?.teamId || '').trim()
                    const nextTeamIds = teamId
                      ? (appliedFilters.teamIds || []).filter((id) => String(id) !== teamId)
                      : appliedFilters.teamIds || []
                    onRemoveAppliedFilter?.({
                      tagIds: nextTagIds,
                      teamIds: nextTeamIds,
                      teamMemberUserIds: memberIdsForTeams(orgTeams, nextTeamIds),
                    })
                  }}
                  className="crm-filter-chip-x"
                  aria-label="Remove tag filter"
                >
                  ×
                </button>
              </span>
            )
          })}
          {(appliedFilters.erpTagNames || []).map((name) => {
            const tag = erpTagOptions.find((t) => t.name === name) || { name, color: '#64748b' }
            return (
              <span key={`erp-${name}`} className="crm-filter-chip crm-filter-chip--tag">
                <ErpTagChip name={tag.name} color={tag.color} type={tag.type} />
                <button
                  type="button"
                  onClick={() =>
                    onRemoveAppliedFilter?.({
                      erpTagNames: (appliedFilters.erpTagNames || []).filter((n) => n !== name),
                    })
                  }
                  className="crm-filter-chip-x"
                  aria-label="Remove ERP tag filter"
                >
                  ×
                </button>
              </span>
            )
          })}
          {(appliedFilters.crmStageIds || []).map((id) => {
            const opt = crmStageOptions.find((s) => s.value === id) || {
              label: FREIGHT_CRM_PIPELINE_COLUMNS.find((s) => s.id === id)?.label || id,
              value: id,
            }
            return (
              <FilterChipButton
                key={`crm-stage-${id}`}
                label={`CRM: ${opt.label}`}
                onRemove={() =>
                  onRemoveAppliedFilter?.({
                    crmStageIds: (appliedFilters.crmStageIds || []).filter((x) => x !== id),
                  })
                }
              />
            )
          })}
          {(appliedFilters.smartTags || []).map((id) => {
            const opt = SMART_TAG_OPTIONS.find((o) => o.id === id)
            if (!opt) return null
            return (
              <FilterChipButton
                key={id}
                label={opt.label}
                onRemove={() =>
                  onRemoveAppliedFilter?.({
                    smartTags: (appliedFilters.smartTags || []).filter((x) => x !== id),
                  })
                }
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

export { DEFAULT_PIPELINE_FILTERS }
