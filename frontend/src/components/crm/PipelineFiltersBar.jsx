import { useCallback, useEffect, useMemo, useState } from 'react'
import usePipelineFilterMobile from '../../hooks/usePipelineFilterMobile'
import { PIPELINE_SEARCH_ID } from '../../hooks/useAppKeyboardShortcuts'
import { api } from '../../lib/api'
import { CONTACT_FILTER_OPTIONS, DEFAULT_PIPELINE_FILTERS, getFilterCities, getFilterStates } from '../../lib/pipelineFilters'
import { FilterChipButton } from './FilterDropdown'
import { DEAL_MONTH_OPTIONS, dealYearOptions, formatDealPeriodLabel } from '../../lib/pipelineDealsFilter'
import { lastShipmentPeriodLabel } from '../../../../lib/leadLastShipmentFilter.js'
import LeadTag from '../ui/LeadTag'
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
  TeamIcon,
  CalendarIcon,
} from '../ui/icons'

const SMART_TAG_OPTIONS = [
  { id: 'not_touched', label: 'Not touched' },
  { id: 'hot_score', label: 'Hot (Score 70+)' },
]

const MOBILE_FILTER_TITLES = {
  owner: 'Lead owner',
  status: 'Lead status',
  team: 'Team',
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
  const [savedViews, setSavedViews] = useState([])
  const [savedReports, setSavedReports] = useState([])
  const [activeFilter, setActiveFilter] = useState(null)
  const [orgTeams, setOrgTeams] = useState([])
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
          }))
        )
        setOrgTeams(teams)
        void refreshOrgLeadTags?.()
      })
      .catch(() => {
        if (!cancelled) setOrgTeams([])
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
  const shipmentMonth = String(appliedFilters.lastShipmentMonth || filters.lastShipmentMonth || '')
  const shipmentDisplay =
    formatDealPeriodLabel({
      year: shipmentYear,
      month: shipmentMonth,
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
  const tagOptions = orgLeadTags.map((t) => ({ label: t.name, value: t.id }))
  const teamOptions = orgTeams.map((t) => ({ label: t.label, value: t.id }))
  const smartOptions = SMART_TAG_OPTIONS.map((o) => ({ label: o.label, value: o.id }))
  const savedViewOptions = savedViews.map((v) => ({
    label: v.shared ? `${v.name} (Team)` : v.name,
    value: v.id,
  }))

  const appliedCities = getFilterCities(appliedFilters)
  const appliedStates = getFilterStates(appliedFilters)

  const advancedActiveCount =
    (appliedFilters.tagIds?.length || 0) +
    (appliedFilters.smartTags?.length || 0) +
    (activeSmartViewId ? 1 : 0)

  const openFilter = (type) => {
    if (type === 'advanced') void loadReports()
    setActiveFilter({
      type,
      draft: {
        filters: { ...filters },
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
      case 'team':
        commitFilters({ ...filters, teamIds: draft.filters.teamIds || [] })
        break
      case 'lastShipment': {
        const lastShipmentYear = String(draft.filters.lastShipmentYear || '')
        const lastShipmentMonth = lastShipmentYear ? String(draft.filters.lastShipmentMonth || '') : ''
        commitFilters({ ...filters, lastShipmentYear, lastShipmentMonth })
        break
      }
      case 'advanced': {
        commitFilters({ ...draft.filters })
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
      case 'team':
        return (
          <SearchableMultiList
            options={teamOptions}
            values={filterDraft.filters.teamIds || []}
            onChange={(v) => updateFilterDraft({ teamIds: v })}
            placeholder="Search teams…"
            emptyLabel="All teams"
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
                  })
                }
              />
            </section>
            <section className="pipeline-filter-popout-section">
              <p className="hs-advanced-filter-label">Month</p>
              {filterDraft.filters.lastShipmentYear ? (
                <SingleSelectList
                  options={DEAL_MONTH_OPTIONS}
                  value={String(filterDraft.filters.lastShipmentMonth || '')}
                  emptyLabel="All months"
                  onChange={(month) => updateFilterDraft({ lastShipmentMonth: month || '' })}
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

      {teamOptions.length > 0 ? (
        <PipelineFilterToolbarButton
          icon={TeamIcon}
          iconTone="owner"
          label="Team"
          compact={useMobileFilterSheet}
          displayValue={
            (appliedFilters.teamIds || []).length === 1
              ? orgTeams.find((t) => t.id === appliedFilters.teamIds[0])?.name
              : (appliedFilters.teamIds || []).length > 1
                ? `${appliedFilters.teamIds.length} teams`
                : undefined
          }
          active={(appliedFilters.teamIds || []).length > 0}
          aria-expanded={activeFilter?.type === 'team'}
          onClick={() => openFilter('team')}
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
          ) : null}
          {canSaveReport ? (
            <button type="button" className="crm-filter-link-btn" onClick={onSaveReport}>
              Save as report
            </button>
          ) : null}
          {canExportFunnel ? (
            <button type="button" className="crm-filter-link-btn" onClick={onExportFunnel}>
              Export funnel CSV
            </button>
          ) : null}
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
                onRemoveAppliedFilter?.({ lastShipmentYear: '', lastShipmentMonth: '' })
              }
            />
          ) : null}
          {(appliedFilters.teamIds || []).map((teamId) => {
            const team = orgTeams.find((t) => t.id === teamId)
            return (
              <FilterChipButton
                key={`team-${teamId}`}
                label={`Team: ${team?.name || teamId}`}
                onRemove={() =>
                  onRemoveAppliedFilter?.({
                    teamIds: (appliedFilters.teamIds || []).filter((id) => id !== teamId),
                  })
                }
              />
            )
          })}
          {(appliedFilters.tagIds || []).map((tagId) => {
            const tag = orgLeadTags.find((t) => t.id === tagId)
            if (!tag) return null
            return (
              <span key={tagId} className="crm-filter-chip crm-filter-chip--tag">
                <LeadTag name={tag.name} />
                <button
                  type="button"
                  onClick={() =>
                    onRemoveAppliedFilter?.({
                      tagIds: (appliedFilters.tagIds || []).filter((id) => id !== tagId),
                    })
                  }
                  className="crm-filter-chip-x"
                  aria-label="Remove tag filter"
                >
                  ×
                </button>
              </span>
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
