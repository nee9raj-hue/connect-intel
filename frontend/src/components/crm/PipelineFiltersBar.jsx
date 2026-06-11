import { useCallback, useEffect, useState } from 'react'
import usePipelineFilterMobile from '../../hooks/usePipelineFilterMobile'
import { PIPELINE_SEARCH_ID } from '../../hooks/useAppKeyboardShortcuts'
import { api } from '../../lib/api'
import { CONTACT_FILTER_OPTIONS, DEFAULT_PIPELINE_FILTERS, getFilterCities, getFilterStates } from '../../lib/pipelineFilters'
import { FilterChipButton } from './FilterDropdown'
import LeadTag from '../ui/LeadTag'
import PipelineFilterToolbarButton from './PipelineFilterToolbarButton'
import PipelineMobileFilterSheet, { SearchableMultiList, SingleSelectList } from './PipelineMobileFilterSheet'
import { SettingsGearIcon } from '../ui/icons'

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
  const [filterPopup, setFilterPopup] = useState(null)
  const useMobileFilterSheet = usePipelineFilterMobile()
  const set = (patch) => onFiltersChange({ ...filters, ...patch })

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
  const showOwnerFilter = canShowOwnerFilter || ownerSelectOptions.length > 0
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

  const openFilterPopup = (type) => {
    setFilterPopup({
      type,
      draft: {
        filters: { ...filters },
        statusFilter,
        ownerFilter: ownerFilter || '',
        smartViewId: activeSmartViewId || '',
      },
    })
  }

  const closeFilterPopup = () => {
    setFilterPopup(null)
  }

  const updateMobileDraftFilters = (patch) => {
    setFilterPopup((prev) =>
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
    setFilterPopup((prev) =>
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
    setFilterPopup((prev) =>
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
    setFilterPopup((prev) =>
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

  const applyFilterPopup = () => {
    if (!filterPopup?.draft) return
    const { type, draft } = filterPopup

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

    closeFilterPopup()
  }

  const filterDraft = filterPopup?.draft

  const renderFilterPopupContent = () => {
    if (!filterPopup || !filterDraft) return null

    switch (filterPopup.type) {
      case 'owner':
        return (
          <SingleSelectList
            options={ownerSelectOptions}
            value={filterDraft.ownerFilter || ''}
            emptyLabel="All owners"
            onChange={updateMobileDraftOwner}
          />
        )
      case 'status':
        return (
          <SingleSelectList
            statusStyle
            options={stageOptions}
            value={filterDraft.statusFilter !== 'all' ? filterDraft.statusFilter : ''}
            emptyLabel="All statuses"
            onChange={updateMobileDraftStatus}
          />
        )
      case 'city':
        return (
          <SearchableMultiList
            options={cityOptions}
            values={filterDraft.filters.cities || []}
            onChange={(v) => updateMobileDraftFilters({ cities: v })}
            placeholder="Search cities…"
            emptyLabel="All cities"
          />
        )
      case 'state':
        return (
          <SearchableMultiList
            options={stateOptions}
            values={filterDraft.filters.states || []}
            onChange={(v) => updateMobileDraftFilters({ states: v })}
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
                  value={filterDraft.smartViewId || ''}
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
                    value={filterDraft.filters.tagMode || 'any'}
                    onChange={(e) => updateMobileDraftFilters({ tagMode: e.target.value })}
                    className="crm-select-sm crm-select-sm--hubspot"
                  >
                    <option value="any">Any</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <SearchableMultiList
                  options={tagOptions}
                  values={filterDraft.filters.tagIds || []}
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
                    value={filterDraft.filters.addedFrom || ''}
                    onChange={(e) => updateMobileDraftFilters({ addedFrom: e.target.value })}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={filterDraft.filters.addedTo || ''}
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
                    value={filterDraft.filters.lastActivityFrom || ''}
                    onChange={(e) => updateMobileDraftFilters({ lastActivityFrom: e.target.value })}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={filterDraft.filters.lastActivityTo || ''}
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
                  value={filterDraft.filters.minLeadScore ?? ''}
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
                  value={filterDraft.filters.maxLeadScore ?? ''}
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
                value={filterDraft.filters.sourceFilter || ''}
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
                  checked={Boolean(filterDraft.filters.stuckLeads)}
                  onChange={(e) => updateMobileDraftFilters({ stuckLeads: e.target.checked })}
                />
                Stuck leads (no activity 7+ days)
              </label>
            </section>
            <section className="pipeline-filter-popout-section">
              <p className="hs-advanced-filter-label">Smart</p>
              <SearchableMultiList
                options={smartOptions}
                values={filterDraft.filters.smartTags || []}
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
    (appliedFilters.contact && appliedFilters.contact !== 'any') ||
    Boolean(ownerFilter)

  const filterToolbarButtons = (
    <>
      {showOwnerFilter && (
        <PipelineFilterToolbarButton
          label="Owner"
          active={filterPopup?.type === 'owner' || Boolean(ownerFilter)}
          aria-expanded={filterPopup?.type === 'owner'}
          onClick={() => openFilterPopup('owner')}
        />
      )}

      {!stageListMode && (
        <PipelineFilterToolbarButton
          label="Status"
          active={filterPopup?.type === 'status' || statusFilter !== 'all'}
          aria-expanded={filterPopup?.type === 'status'}
          onClick={() => openFilterPopup('status')}
        />
      )}

      <PipelineFilterToolbarButton
        label="City"
        active={filterPopup?.type === 'city' || (appliedCities.length || 0) > 0}
        aria-expanded={filterPopup?.type === 'city'}
        onClick={() => openFilterPopup('city')}
      />

      <PipelineFilterToolbarButton
        label="State"
        active={filterPopup?.type === 'state' || (appliedStates.length || 0) > 0}
        aria-expanded={filterPopup?.type === 'state'}
        onClick={() => openFilterPopup('state')}
      />

      <PipelineFilterToolbarButton
        label="Contact"
        active={
          filterPopup?.type === 'contact' ||
          (appliedFilters.contact && appliedFilters.contact !== 'any')
        }
        aria-expanded={filterPopup?.type === 'contact'}
        onClick={() => openFilterPopup('contact')}
      />

      <PipelineFilterToolbarButton
        label="More filters"
        variant="more"
        active={filterPopup?.type === 'advanced' || advancedActiveCount > 0}
        aria-expanded={filterPopup?.type === 'advanced'}
        onClick={() => openFilterPopup('advanced')}
      />
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
          className={`hs-filter-toolbar-strip ${useMobileFilterSheet ? 'hs-filter-toolbar-strip--scroll' : ''}`}
          role="toolbar"
          aria-label="Lead filters"
        >
          {filterToolbarButtons}
        </div>

        <PipelineMobileFilterSheet
          open={Boolean(filterPopup)}
          narrow={['owner', 'status', 'contact'].includes(filterPopup?.type)}
          title={filterPopup ? MOBILE_FILTER_TITLES[filterPopup.type] || 'Filter' : 'Filter'}
          subtitle={filterPopup ? MOBILE_FILTER_SUBTITLES[filterPopup.type] : undefined}
          onClose={closeFilterPopup}
          onSave={applyFilterPopup}
          saveLabel="Apply"
        >
          {renderFilterPopupContent()}
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
          {ownerFilter && (
            <FilterChipButton
              label={`Owner: ${
                ownerSelectOptions.find((o) => String(o.value) === String(ownerFilter))?.label || 'Selected'
              }`}
              onRemove={() => onOwnerFilterChange?.(null)}
            />
          )}
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
