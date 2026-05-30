import { useCallback, useEffect, useRef, useState } from 'react'
import useIsMobile from '../../hooks/useIsMobile'
import usePipelineFilterMobile from '../../hooks/usePipelineFilterMobile'
import { api } from '../../lib/api'
import {
  BRAND_ICON_ADVANCE_FILTER,
  BRAND_ICON_CITY,
  BRAND_ICON_CONTACT,
  BRAND_ICON_LEAD_STATUS,
  BRAND_ICON_STATE,
} from '../../lib/brandAssets'
import { CONTACT_FILTER_OPTIONS, DEFAULT_PIPELINE_FILTERS, getFilterCities, getFilterStates } from '../../lib/pipelineFilters'
import FilterDropdown, { FilterChipButton } from './FilterDropdown'
import LeadTag from '../ui/LeadTag'
import FilterToolbarIcon from '../ui/FilterToolbarIcon'
import PipelineMobileFiltersSheet from './PipelineMobileFiltersSheet'
import { SettingsIcon } from '../ui/icons'

const SMART_TAG_OPTIONS = [
  { id: 'not_touched', label: 'Not touched' },
  { id: 'hot_score', label: 'Hot (Score 70+)' },
]

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
}) {
  const [savedViews, setSavedViews] = useState([])
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [mobileSheet, setMobileSheet] = useState(null)
  const advancedRef = useRef(null)
  const advancedPanelRef = useRef(null)
  const advancedOpenedAtRef = useRef(0)
  const isMobile = useIsMobile()
  const useMobileFilterSheet = usePipelineFilterMobile()
  const set = (patch) => onFiltersChange({ ...filters, ...patch })

  const closeAdvanced = useCallback(() => setAdvancedOpen(false), [])

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

  useEffect(() => {
    if (!advancedOpen) return undefined
    const onDoc = (e) => {
      if (Date.now() - advancedOpenedAtRef.current < 320) return
      const t = e.target
      if (advancedRef.current?.contains(t)) return
      if (advancedPanelRef.current?.contains(t)) return
      closeAdvanced()
    }
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onDoc, true)
      document.addEventListener('touchstart', onDoc, { capture: true, passive: true })
    }, 280)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onDoc, true)
      document.removeEventListener('touchstart', onDoc, true)
    }
  }, [advancedOpen, closeAdvanced])

  useEffect(() => {
    if (!advancedOpen || !isMobile) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [advancedOpen, isMobile])

  useEffect(() => {
    if (!mobileSheet || !useMobileFilterSheet) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileSheet, useMobileFilterSheet])

  const handleApply = () => onApplyFilters?.()

  const cityOptions = cities.map((c) => ({ label: c, value: c }))
  const stateOptions = states.map((s) => ({ label: s, value: s }))
  const stageOptions = statusOptions.map((s) => ({ label: s.label, value: s.id }))
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

  const mobileFiltersActiveCount =
    (appliedFilters.tagIds?.length || 0) +
    (appliedFilters.smartTags?.length || 0) +
    getFilterCities(appliedFilters).length +
    getFilterStates(appliedFilters).length +
    (appliedFilters.contact && appliedFilters.contact !== 'any' ? 1 : 0) +
    (!stageListMode && statusFilter !== 'all' ? 1 : 0) +
    (activeSmartViewId ? 1 : 0)

  const openMobileFilters = () => {
    setMobileSheet({
      draft: {
        filters: { ...filters },
        statusFilter,
      },
    })
  }

  const closeMobileFilters = () => {
    setMobileSheet(null)
  }

  const applyMobileFilters = () => {
    if (!mobileSheet?.draft) return
    onFiltersChange(mobileSheet.draft.filters)
    onStatusFilterChange?.(mobileSheet.draft.statusFilter || 'all')
    handleApply()
    closeMobileFilters()
  }

  const clearMobileFilters = () => {
    onClearFilters?.()
    closeMobileFilters()
  }

  const updateMobileDraft = (nextDraft) => {
    setMobileSheet((prev) => (prev ? { ...prev, draft: nextDraft } : prev))
  }

  const activeStageLabel = statusOptions.find((s) => s.id === statusFilter)?.label
  const activeContactLabel = CONTACT_FILTER_OPTIONS.find((o) => o.id === appliedFilters.contact)?.label

  const advancedPanel = advancedOpen ? (
    <div
      ref={advancedPanelRef}
      className={`hs-advanced-filter-panel ${isMobile ? 'hs-advanced-filter-panel--mobile-sheet' : ''}`}
      role="dialog"
      aria-label="Advanced filters"
      style={
        isMobile
          ? {
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              top: 'auto',
              zIndex: 1200,
              width: '100%',
              maxWidth: '100%',
            }
          : undefined
      }
    >
      {isMobile && (
        <div className="crm-filter-menu-header crm-filter-menu-header--sheet">
          <span className="crm-filter-menu-header-title">Advanced filters</span>
          <button type="button" className="crm-filter-menu-sheet-close" onClick={closeAdvanced} aria-label="Close">
            ×
          </button>
        </div>
      )}
      {savedViews.length > 0 && (
        <div className="hs-advanced-filter-section">
          <p className="hs-advanced-filter-label">Saved views</p>
          <FilterDropdown
            compact
            label="Saved view"
            value={activeSmartViewId || ''}
            displayValue={savedViews.find((v) => v.id === activeSmartViewId)?.name}
            options={savedViewOptions}
            onChange={(viewId) => {
              const view = savedViews.find((v) => v.id === viewId)
              if (view) onApplySmartView?.(view)
            }}
            emptyLabel="None"
          />
        </div>
      )}

      {orgLeadTags.length > 0 && (
        <div className="hs-advanced-filter-section">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="hs-advanced-filter-label mb-0">Tags</p>
            <select
              value={filters.tagMode || 'any'}
              onChange={(e) => set({ tagMode: e.target.value })}
              className="crm-select-sm crm-select-sm--hubspot"
            >
              <option value="any">Any</option>
              <option value="all">All</option>
            </select>
          </div>
          <FilterDropdown
            compact
            label="Tags"
            multiSelect
            wide
            values={filters.tagIds || []}
            onMultiChange={(v) => set({ tagIds: v })}
            options={tagOptions}
            searchable
            placeholder="Search tags…"
            emptyLabel="Any tag"
          />
        </div>
      )}

      <div className="hs-advanced-filter-section">
        <p className="hs-advanced-filter-label">Smart</p>
        <FilterDropdown
          compact
          label="Smart"
          multiSelect
          values={filters.smartTags || []}
          onMultiChange={(v) => set({ smartTags: v })}
          options={smartOptions}
          emptyLabel="Any"
        />
      </div>

      <div className="hs-advanced-filter-footer">
        <button type="button" className="crm-filter-link-btn" onClick={onClearFilters}>
          Clear all
        </button>
        <button
          type="button"
          className="crm-filter-menu-footer-apply"
          onClick={() => {
            handleApply()
            closeAdvanced()
          }}
        >
          Apply
        </button>
      </div>
    </div>
  ) : null

  const showActiveChips =
    appliedSearch ||
    appliedCities.length ||
    appliedStates.length ||
    (appliedFilters.tagIds?.length || 0) > 0 ||
    (appliedFilters.smartTags?.length || 0) > 0 ||
    (!stageListMode && statusFilter !== 'all') ||
    (appliedFilters.contact && appliedFilters.contact !== 'any')

  return (
    <div className="crm-toolbar crm-toolbar--hubspot">
      <div className="hs-filter-bar-top">
        <div className="crm-search-wrap crm-search-wrap--hubspot hs-filter-search">
          <svg className="crm-search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M8.5 3a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 8.5a6.5 6.5 0 1111.436 4.23l3.07 3.07a.75.75 0 11-1.06 1.06l-3.07-3.07A6.5 6.5 0 012 8.5z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleApply()
              }
            }}
            placeholder="Type / to search"
            className="crm-search-input crm-search-input--hubspot"
            aria-label="Search pipeline"
          />
        </div>

        <div className="hs-filter-icon-strip" role="toolbar" aria-label="Lead filters">
          {useMobileFilterSheet ? (
            <FilterToolbarIcon
              src={BRAND_ICON_ADVANCE_FILTER}
              label="Filters"
              active={Boolean(mobileSheet) || mobileFiltersActiveCount > 0}
              badge={mobileFiltersActiveCount > 0}
              aria-expanded={Boolean(mobileSheet)}
              onClick={openMobileFilters}
            />
          ) : (
            <>
              {!stageListMode && (
                <FilterDropdown
                  iconOnly
                  iconSrc={BRAND_ICON_LEAD_STATUS}
                  label="Lead status"
                  value={statusFilter !== 'all' ? statusFilter : ''}
                  displayValue={statusOptions.find((s) => s.id === statusFilter)?.label}
                  options={stageOptions}
                  onChange={(v) => onStatusFilterChange?.(v || 'all')}
                  emptyLabel="All statuses"
                />
              )}

              <FilterDropdown
                iconOnly
                iconSrc={BRAND_ICON_CITY}
                label="City"
                multiSelect
                values={filters.cities || []}
                onMultiChange={(v) => set({ cities: v })}
                options={cityOptions}
                searchable
                placeholder="Search cities…"
                emptyLabel="All cities"
              />

              <FilterDropdown
                iconOnly
                iconSrc={BRAND_ICON_STATE}
                label="State"
                multiSelect
                values={filters.states || []}
                onMultiChange={(v) => set({ states: v })}
                options={stateOptions}
                searchable
                placeholder="Search states…"
                emptyLabel="All states"
              />

              <FilterDropdown
                iconOnly
                iconSrc={BRAND_ICON_CONTACT}
                label="Contact"
                value={filters.contact !== 'any' ? filters.contact : ''}
                displayValue={CONTACT_FILTER_OPTIONS.find((o) => o.id === filters.contact)?.label}
                options={contactOptions}
                onChange={(v) => set({ contact: v || 'any' })}
                emptyLabel="All contacts"
              />

              <div className="hs-advanced-filter-wrap hs-filter-icon-wrap" ref={advancedRef}>
                <FilterToolbarIcon
                  src={BRAND_ICON_ADVANCE_FILTER}
                  label="Advanced filters"
                  active={advancedOpen || advancedActiveCount > 0}
                  badge={advancedActiveCount > 0}
                  aria-expanded={advancedOpen}
                  onClick={() => {
                    setAdvancedOpen((v) => {
                      if (!v) advancedOpenedAtRef.current = Date.now()
                      return !v
                    })
                  }}
                />

                {advancedOpen && advancedPanel}
              </div>
            </>
          )}
        </div>

        <PipelineMobileFiltersSheet
          sheet={useMobileFilterSheet ? mobileSheet : null}
          onClose={closeMobileFilters}
          onApply={applyMobileFilters}
          onClear={clearMobileFilters}
          onDraftChange={updateMobileDraft}
          stageListMode={stageListMode}
          statusOptions={statusOptions}
          cities={cities}
          states={states}
          orgLeadTags={orgLeadTags}
          savedViews={savedViews}
          onApplySmartView={onApplySmartView}
          activeSmartViewId={activeSmartViewId}
          smartOptions={smartOptions}
        />

        <button
          type="button"
          onClick={handleApply}
          disabled={applying}
          className={`crm-filter-action-btn shrink-0 ${filtersDirty ? 'is-primary' : ''}`}
        >
          {applying ? '…' : 'Search'}
        </button>

        <span className="hs-filter-bar-spacer hidden sm:block" aria-hidden />

        <button type="button" className="hs-filter-gear-btn shrink-0" onClick={onOpenViewSettings} aria-label="View settings">
          <SettingsIcon className="w-4 h-4" />
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
