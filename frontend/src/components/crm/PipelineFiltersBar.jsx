import { useCallback, useEffect, useState } from 'react'
import usePipelineFilterMobile from '../../hooks/usePipelineFilterMobile'
import { PIPELINE_SEARCH_ID } from '../../hooks/useAppKeyboardShortcuts'
import { api } from '../../lib/api'
import { CONTACT_FILTER_OPTIONS, DEFAULT_PIPELINE_FILTERS, getFilterCities, getFilterStates } from '../../lib/pipelineFilters'
import { FilterChipButton } from './FilterDropdown'
import LeadTag from '../ui/LeadTag'
import FilterToolbarIcon from '../ui/FilterToolbarIcon'
import PipelineFilterPopup from './PipelineFilterPopup'
import PipelineFilterToolbarButton from './PipelineFilterToolbarButton'
import PipelineMobileFilterSheet, { SearchableMultiList, SingleSelectList } from './PipelineMobileFilterSheet'
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
  const [activeFilter, setActiveFilter] = useState(null)
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

  const openFilter = (type) => {
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
    (!stageListMode && statusFilter !== 'all') ||
    (appliedFilters.contact && appliedFilters.contact !== 'any')

  const filterToolbar = (
    <>
      {canShowOwnerFilter &&
        (useMobileFilterSheet ? (
          <FilterToolbarIcon
            icon={PeopleIcon}
            label="Owner"
            showLabel
            active={activeFilter?.type === 'owner' || Boolean(ownerFilter)}
            badge={Boolean(ownerFilter)}
            aria-expanded={activeFilter?.type === 'owner'}
            onClick={() => openFilter('owner')}
          />
        ) : (
          <PipelineFilterToolbarButton
            label="Owner"
            active={activeFilter?.type === 'owner' || Boolean(ownerFilter)}
            aria-expanded={activeFilter?.type === 'owner'}
            onClick={() => openFilter('owner')}
          />
        ))}

      {!stageListMode &&
        (useMobileFilterSheet ? (
          <FilterToolbarIcon
            icon={ListIcon}
            label="Status"
            showLabel
            active={activeFilter?.type === 'status' || statusFilter !== 'all'}
            badge={statusFilter !== 'all'}
            aria-expanded={activeFilter?.type === 'status'}
            onClick={() => openFilter('status')}
          />
        ) : (
          <PipelineFilterToolbarButton
            label="Status"
            active={activeFilter?.type === 'status' || statusFilter !== 'all'}
            aria-expanded={activeFilter?.type === 'status'}
            onClick={() => openFilter('status')}
          />
        ))}

      {useMobileFilterSheet ? (
        <FilterToolbarIcon
          icon={MapPinIcon}
          label="City"
          showLabel
          active={activeFilter?.type === 'city' || (filters.cities?.length || 0) > 0}
          badge={(filters.cities?.length || 0) > 0}
          aria-expanded={activeFilter?.type === 'city'}
          onClick={() => openFilter('city')}
        />
      ) : (
        <PipelineFilterToolbarButton
          label="City"
          active={activeFilter?.type === 'city' || (filters.cities?.length || 0) > 0}
          aria-expanded={activeFilter?.type === 'city'}
          onClick={() => openFilter('city')}
        />
      )}

      {useMobileFilterSheet ? (
        <FilterToolbarIcon
          icon={MapIcon}
          label="State"
          showLabel
          active={activeFilter?.type === 'state' || (filters.states?.length || 0) > 0}
          badge={(filters.states?.length || 0) > 0}
          aria-expanded={activeFilter?.type === 'state'}
          onClick={() => openFilter('state')}
        />
      ) : (
        <PipelineFilterToolbarButton
          label="State"
          active={activeFilter?.type === 'state' || (filters.states?.length || 0) > 0}
          aria-expanded={activeFilter?.type === 'state'}
          onClick={() => openFilter('state')}
        />
      )}

      {useMobileFilterSheet ? (
        <FilterToolbarIcon
          icon={PeopleIcon}
          label="Contact"
          showLabel
          active={activeFilter?.type === 'contact' || (filters.contact && filters.contact !== 'any')}
          badge={Boolean(filters.contact && filters.contact !== 'any')}
          aria-expanded={activeFilter?.type === 'contact'}
          onClick={() => openFilter('contact')}
        />
      ) : (
        <PipelineFilterToolbarButton
          label="Contact"
          active={activeFilter?.type === 'contact' || (filters.contact && filters.contact !== 'any')}
          aria-expanded={activeFilter?.type === 'contact'}
          onClick={() => openFilter('contact')}
        />
      )}

      {useMobileFilterSheet ? (
        <FilterToolbarIcon
          icon={SlidersIcon}
          label="More filters"
          showLabel
          active={activeFilter?.type === 'advanced' || advancedActiveCount > 0}
          badge={advancedActiveCount > 0}
          aria-expanded={activeFilter?.type === 'advanced'}
          onClick={() => openFilter('advanced')}
        />
      ) : (
        <PipelineFilterToolbarButton
          variant="more"
          label="More filters"
          active={activeFilter?.type === 'advanced' || advancedActiveCount > 0}
          aria-expanded={activeFilter?.type === 'advanced'}
          onClick={() => openFilter('advanced')}
        />
      )}
    </>
  )

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
            placeholder="Search name, email, phone… (comma = multiple names)"
            className="crm-search-input crm-search-input--hubspot"
            aria-label="Search pipeline leads"
          />
        </div>

        <div
          className={`hs-filter-icon-strip ${useMobileFilterSheet ? 'hs-filter-icon-strip--mobile-fill' : ''}`}
          role="toolbar"
          aria-label="Lead filters"
        >
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
