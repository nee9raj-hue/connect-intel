import { useCallback, useEffect, useState } from 'react'
import usePipelineFilterMobile from '../../hooks/usePipelineFilterMobile'
import { PIPELINE_SEARCH_ID } from '../../hooks/useAppKeyboardShortcuts'
import { api } from '../../lib/api'
import { CONTACT_FILTER_OPTIONS, DEFAULT_PIPELINE_FILTERS, getFilterCities, getFilterStates } from '../../lib/pipelineFilters'
import { FilterChipButton } from './FilterDropdown'
import LeadTag from '../ui/LeadTag'
import FilterToolbarIcon from '../ui/FilterToolbarIcon'
import PipelineMobileFilterSheet, { SearchableMultiList, SingleSelectList } from './PipelineMobileFilterSheet'
import PipelineFilterPopout from './PipelineFilterPopout'
import {
  ListIcon,
  MapIcon,
  MapPinIcon,
  PeopleIcon,
  SettingsGearIcon,
  SlidersIcon,
} from '../ui/icons'

const SMART_TAG_OPTIONS = [
  { id: 'not_touched', label: 'Not touched' },
  { id: 'hot_score', label: 'Hot (Score 70+)' },
]

const MOBILE_FILTER_TITLES = {
  owner: 'Lead owner',
  status: 'Lead status',
  city: 'City',
  state: 'State',
  contact: 'Contact',
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
  totalCount = 0,
  pipelineTotal = 0,
  onSelectAllFiltered,
  hasActiveFilters = false,
  onClearFilters,
  onApplySmartView,
  activeSmartViewId,
  orgLeadTags = [],
  stageListMode = false,
  onRemoveAppliedFilter,
  onOpenViewSettings,
  canSaveAsAudience = false,
  onSaveAsAudience,
  canShowOwnerFilter = false,
  ownerFilter = null,
  ownerOptions = [],
  onOwnerFilterChange,
  statusCounts = {},
}) {
  const [savedViews, setSavedViews] = useState([])
  const [mobileSheet, setMobileSheet] = useState(null)
  const useMobileFilterSheet = usePipelineFilterMobile()

  const loadViews = useCallback(async () => {
    try {
      const data = await api.getPipelineSavedViews()
      setSavedViews(data.views || [])
    } catch {
      setSavedViews([])
    }
  }, [])

  useEffect(() => {
    loadViews()
  }, [loadViews])

  const handleApply = () => onApplyFilters?.()

  const commitFilters = useCallback(
    (nextFilters) => {
      onFiltersChange(nextFilters)
      onApplyFilters?.({ advanced: nextFilters })
    },
    [onFiltersChange, onApplyFilters]
  )

  const cityOptions = cities.map((c) => ({ label: c, value: c }))
  const stateOptions = states.map((s) => ({ label: s, value: s }))
  const stageOptions = statusOptions.map((s) => ({
    label: statusCounts[s.id] != null ? `${s.label} (${statusCounts[s.id]})` : s.label,
    value: s.id,
  }))
  const ownerSelectOptions = ownerOptions.map((m) => ({
    label: m.name || m.email || 'Team member',
    value: m.userId,
  }))
  const contactOptions = CONTACT_FILTER_OPTIONS.filter((o) => o.id !== 'any').map((o) => ({
    label: o.label,
    value: o.id,
  }))
  const tagOptions = orgLeadTags.map((t) => ({ label: t.name, value: t.id }))
  const smartOptions = SMART_TAG_OPTIONS.map((o) => ({ label: o.label, value: o.id }))
  const savedViewOptions = savedViews.map((v) => ({ label: v.name, value: v.id }))

  const appliedCities = getFilterCities(appliedFilters)
  const appliedStates = getFilterStates(appliedFilters)

  const advancedActiveCount =
    (appliedFilters.tagIds?.length || 0) +
    (appliedFilters.smartTags?.length || 0) +
    (activeSmartViewId ? 1 : 0)

  const openMobileFilter = (type) => {
    setMobileSheet({
      type,
      draft: {
        filters: { ...filters },
        statusFilter,
        ownerFilter: ownerFilter || '',
        smartViewId: activeSmartViewId || '',
      },
    })
  }

  const closeMobileFilter = () => {
    setMobileSheet(null)
  }

  const updateMobileDraftFilters = (patch) => {
    setMobileSheet((prev) =>
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

  const updateMobileDraftStatus = (statusId) => {
    setMobileSheet((prev) =>
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

  const updateMobileDraftOwner = (ownerId) => {
    setMobileSheet((prev) =>
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

  const updateMobileDraftSmartView = (viewId) => {
    setMobileSheet((prev) =>
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

  const applyMobileFilter = () => {
    if (!mobileSheet?.draft) return
    const { type, draft } = mobileSheet

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
      case 'advanced': {
        commitFilters({ ...draft.filters })
        const view = savedViews.find((v) => v.id === draft.smartViewId)
        if (view) onApplySmartView?.(view)
        break
      }
      default:
        break
    }

    closeMobileFilter()
  }

  const mobileDraft = mobileSheet?.draft

  const renderMobileFilterContent = () => {
    if (!mobileSheet || !mobileDraft) return null

    switch (mobileSheet.type) {
      case 'owner':
        return (
          <SingleSelectList
            options={ownerSelectOptions}
            value={mobileDraft.ownerFilter || ''}
            emptyLabel="All owners"
            onChange={updateMobileDraftOwner}
          />
        )
      case 'status':
        return (
          <SingleSelectList
            statusStyle
            options={stageOptions}
            value={mobileDraft.statusFilter !== 'all' ? mobileDraft.statusFilter : ''}
            emptyLabel="All statuses"
            onChange={updateMobileDraftStatus}
          />
        )
      case 'city':
        return (
          <SearchableMultiList
            options={cityOptions}
            values={mobileDraft.filters.cities || []}
            onChange={(v) => updateMobileDraftFilters({ cities: v })}
            placeholder="Search cities…"
            emptyLabel="All cities"
          />
        )
      case 'state':
        return (
          <SearchableMultiList
            options={stateOptions}
            values={mobileDraft.filters.states || []}
            onChange={(v) => updateMobileDraftFilters({ states: v })}
            placeholder="Search states…"
            emptyLabel="All states"
          />
        )
      case 'contact':
        return (
          <SingleSelectList
            options={contactOptions}
            value={mobileDraft.filters.contact !== 'any' ? mobileDraft.filters.contact : ''}
            emptyLabel="All contacts"
            onChange={(v) => updateMobileDraftFilters({ contact: v || 'any' })}
          />
        )
      case 'advanced':
        return (
          <div className="pipeline-filter-popout-sections">
            {savedViews.length > 0 ? (
              <section className="pipeline-filter-popout-section">
                <p className="hs-advanced-filter-label">Saved views</p>
                <SingleSelectList
                  options={savedViewOptions}
                  value={mobileDraft.smartViewId || ''}
                  emptyLabel="None"
                  onChange={updateMobileDraftSmartView}
                />
              </section>
            ) : null}
            {orgLeadTags.length > 0 ? (
              <section className="pipeline-filter-popout-section">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="hs-advanced-filter-label mb-0">Tags</p>
                  <select
                    value={mobileDraft.filters.tagMode || 'any'}
                    onChange={(e) => updateMobileDraftFilters({ tagMode: e.target.value })}
                    className="crm-select-sm crm-select-sm--hubspot"
                  >
                    <option value="any">Any</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <SearchableMultiList
                  options={tagOptions}
                  values={mobileDraft.filters.tagIds || []}
                  onChange={(v) => updateMobileDraftFilters({ tagIds: v })}
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
                    value={mobileDraft.filters.addedFrom || ''}
                    onChange={(e) => updateMobileDraftFilters({ addedFrom: e.target.value })}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={mobileDraft.filters.addedTo || ''}
                    onChange={(e) => updateMobileDraftFilters({ addedTo: e.target.value })}
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
                    value={mobileDraft.filters.lastActivityFrom || ''}
                    onChange={(e) => updateMobileDraftFilters({ lastActivityFrom: e.target.value })}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={mobileDraft.filters.lastActivityTo || ''}
                    onChange={(e) => updateMobileDraftFilters({ lastActivityTo: e.target.value })}
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
                  value={mobileDraft.filters.minLeadScore ?? ''}
                  onChange={(e) =>
                    updateMobileDraftFilters({
                      minLeadScore: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Max"
                  value={mobileDraft.filters.maxLeadScore ?? ''}
                  onChange={(e) =>
                    updateMobileDraftFilters({
                      maxLeadScore: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            </section>
            <section className="pipeline-filter-popout-section">
              <p className="hs-advanced-filter-label">Source</p>
              <select
                value={mobileDraft.filters.sourceFilter || ''}
                onChange={(e) => updateMobileDraftFilters({ sourceFilter: e.target.value })}
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
                  checked={Boolean(mobileDraft.filters.stuckLeads)}
                  onChange={(e) => updateMobileDraftFilters({ stuckLeads: e.target.checked })}
                />
                Stuck leads (no activity 7+ days)
              </label>
            </section>
            <section className="pipeline-filter-popout-section">
              <p className="hs-advanced-filter-label">Smart</p>
              <SearchableMultiList
                options={smartOptions}
                values={mobileDraft.filters.smartTags || []}
                onChange={(v) => updateMobileDraftFilters({ smartTags: v })}
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
    (!stageListMode && statusFilter !== 'all') ||
    (appliedFilters.contact && appliedFilters.contact !== 'any')

  const filterToolbarIcons = (
    <>
      {canShowOwnerFilter && (
        <FilterToolbarIcon
          icon={PeopleIcon}
          label="Owner"
          showLabel
          active={mobileSheet?.type === 'owner' || Boolean(ownerFilter)}
          badge={Boolean(ownerFilter)}
          aria-expanded={mobileSheet?.type === 'owner'}
          onClick={() => openMobileFilter('owner')}
        />
      )}

      {!stageListMode && (
        <FilterToolbarIcon
          icon={ListIcon}
          label="Status"
          showLabel
          active={mobileSheet?.type === 'status' || statusFilter !== 'all'}
          badge={statusFilter !== 'all'}
          aria-expanded={mobileSheet?.type === 'status'}
          onClick={() => openMobileFilter('status')}
        />
      )}

      <FilterToolbarIcon
        icon={MapPinIcon}
        label="City"
        showLabel
        active={mobileSheet?.type === 'city' || (filters.cities?.length || 0) > 0}
        badge={(filters.cities?.length || 0) > 0}
        aria-expanded={mobileSheet?.type === 'city'}
        onClick={() => openMobileFilter('city')}
      />

      <FilterToolbarIcon
        icon={MapIcon}
        label="State"
        showLabel
        active={mobileSheet?.type === 'state' || (filters.states?.length || 0) > 0}
        badge={(filters.states?.length || 0) > 0}
        aria-expanded={mobileSheet?.type === 'state'}
        onClick={() => openMobileFilter('state')}
      />

      <FilterToolbarIcon
        icon={PeopleIcon}
        label="Contact"
        showLabel
        active={mobileSheet?.type === 'contact' || (filters.contact && filters.contact !== 'any')}
        badge={Boolean(filters.contact && filters.contact !== 'any')}
        aria-expanded={mobileSheet?.type === 'contact'}
        onClick={() => openMobileFilter('contact')}
      />

      <FilterToolbarIcon
        icon={SlidersIcon}
        label="More filters"
        showLabel
        active={mobileSheet?.type === 'advanced' || advancedActiveCount > 0}
        badge={advancedActiveCount > 0}
        aria-expanded={mobileSheet?.type === 'advanced'}
        onClick={() => openMobileFilter('advanced')}
      />
    </>
  )

  const filterSheetTitle = mobileSheet ? MOBILE_FILTER_TITLES[mobileSheet.type] || 'Filter' : 'Filter'
  const filterSheetSubtitle = mobileSheet ? MOBILE_FILTER_SUBTITLES[mobileSheet.type] : undefined
  const filterSheetOpen = Boolean(mobileSheet)

  return (
    <div className="crm-toolbar crm-toolbar--hubspot pipeline-filter-labeled">
      <div className="hs-filter-bar-top">
        <div className="crm-search-wrap crm-search-wrap--hubspot hs-filter-search hs-filter-search--compact">
          <svg className="crm-search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M8.5 3a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 8.5a6.5 6.5 0 1111.436 4.23l3.07 3.07a.75.75 0 11-1.06 1.06l-3.07-3.07A6.5 6.5 0 012 8.5z"
              clipRule="evenodd"
            />
          </svg>
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
            placeholder="Search by name, email, phone, company…"
            className="crm-search-input crm-search-input--hubspot"
            aria-label="Search pipeline leads"
          />
        </div>

        <div
          className={`hs-filter-icon-strip ${useMobileFilterSheet ? 'hs-filter-icon-strip--mobile-fill' : ''}`}
          role="toolbar"
          aria-label="Lead filters"
        >
          {filterToolbarIcons}
        </div>

        {useMobileFilterSheet ? (
          <PipelineMobileFilterSheet
            open={filterSheetOpen}
            title={filterSheetTitle}
            subtitle={filterSheetSubtitle}
            onClose={closeMobileFilter}
            onSave={applyMobileFilter}
            saveLabel="Apply"
          >
            {renderMobileFilterContent()}
          </PipelineMobileFilterSheet>
        ) : (
          <PipelineFilterPopout
            open={filterSheetOpen}
            title={filterSheetTitle}
            subtitle={filterSheetSubtitle}
            onClose={closeMobileFilter}
            onApply={applyMobileFilter}
            onClear={
              mobileSheet?.type === 'advanced'
                ? () => {
                    onClearFilters?.()
                    closeMobileFilter()
                  }
                : undefined
            }
            applyLabel="Apply"
          >
            {renderMobileFilterContent()}
          </PipelineFilterPopout>
        )}

        <span className="hs-filter-bar-spacer hidden sm:block" aria-hidden />

        <button type="button" className="hs-filter-gear-btn shrink-0" onClick={onOpenViewSettings} aria-label="View settings">
          <SettingsGearIcon className="w-4 h-4" />
        </button>
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
