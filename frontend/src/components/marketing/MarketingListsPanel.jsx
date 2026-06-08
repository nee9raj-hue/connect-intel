import { useEffect, useMemo, useState } from 'react'
import useIsMobile from '../../hooks/useIsMobile'
import FullScreenDetailModal from '../ui/FullScreenDetailModal'
import { CRM_STATUSES } from '../../lib/crmConstants'
import FilterDropdown from '../crm/FilterDropdown'
import MarketingListBuilder from './MarketingListBuilder'
import MarketingSmartListBuilder from './MarketingSmartListBuilder'
import MarketingListDetail from './MarketingListDetail'
import MarketingListsFiltersSheet from './MarketingListsFiltersSheet'
import MarketingCreatorBadge from './MarketingCreatorBadge'

const UNASSIGNED = '__unassigned__'

const DEFAULT_LIST_FILTERS = {
  assigneeUserId: '',
  pipelineStage: 'all',
}

function listMatchesAssignee(list, assigneeUserId) {
  if (!assigneeUserId) return true
  if (assigneeUserId === UNASSIGNED) return !list.assigneeUserId
  return list.assigneeUserId === assigneeUserId || list.createdByUserId === assigneeUserId
}

function listMatchesStage(list, pipelineStage) {
  if (!pipelineStage || pipelineStage === 'all') return true
  if (list.pipelineStatus) return list.pipelineStatus === pipelineStage
  return false
}

export default function MarketingListsPanel({
  user,
  teamMembers,
  refreshTeam,
  savedLeads,
  lists,
  setLists,
  busy,
  setBusy,
  setError,
  setNotice,
  onListsReload,
  orgLeadTags = [],
}) {
  const [selectedListId, setSelectedListId] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createMode, setCreateMode] = useState('smart')
  const [listSearch, setListSearch] = useState('')
  const [listChannel, setListChannel] = useState('email')
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_LIST_FILTERS)
  const [draftFilters, setDraftFilters] = useState(DEFAULT_LIST_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const isMobile = useIsMobile()

  const isCompany = Boolean(user?.accountType === 'company' && user?.organizationId)
  const isCompanyAdmin = Boolean(
    isCompany && (user?.isOrgAdmin || user?.orgRole === 'org_admin')
  )

  useEffect(() => {
    if (isCompany) refreshTeam?.()
  }, [isCompany, refreshTeam])

  useEffect(() => {
    if (!isCompany || isCompanyAdmin || !user?.id) return
    setAppliedFilters((prev) => ({ ...prev, assigneeUserId: user.id }))
  }, [isCompany, isCompanyAdmin, user?.id])

  const repOptions = useMemo(() => {
    if (!isCompanyAdmin && user?.id) {
      return [{ userId: user.id, name: user.name || user.email || 'My leads' }]
    }
    const active = (teamMembers || []).filter((m) => m.status !== 'inactive')
    return [
      { userId: UNASSIGNED, name: 'Unassigned leads' },
      ...active.map((m) => ({ userId: m.userId, name: m.name || m.email || 'Team member' })),
    ]
  }, [teamMembers, isCompanyAdmin, user?.id, user?.name, user?.email])

  const stageOptions = useMemo(
    () => CRM_STATUSES.map((s) => ({ label: s.label, value: s.id })),
    []
  )

  const repOptionsForDropdown = useMemo(
    () => repOptions.map((r) => ({ label: r.name, value: r.userId })),
    [repOptions]
  )

  const { assigneeUserId, pipelineStage } = appliedFilters

  const filteredLists = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    return (lists || [])
      .filter((l) => (l.channel || 'email') === listChannel)
      .filter((l) => listMatchesAssignee(l, assigneeUserId))
      .filter((l) => listMatchesStage(l, pipelineStage))
      .filter((l) => {
        if (!q) return true
        return String(l.name || '').toLowerCase().includes(q)
      })
  }, [lists, listChannel, listSearch, assigneeUserId, pipelineStage])

  const selectedList = useMemo(
    () => (lists || []).find((l) => l.id === selectedListId) || null,
    [lists, selectedListId]
  )

  const totalContacts = useMemo(
    () => filteredLists.reduce((sum, l) => sum + (l.leadIds?.length || 0), 0),
    [filteredLists]
  )

  const filtersActive =
    Boolean(assigneeUserId) || (pipelineStage && pipelineStage !== 'all')

  const handleListsCreated = async (result) => {
    await onListsReload?.()
    const pickId = result?.list?.id || result?.lists?.[0]?.id
    if (pickId) {
      setSelectedListId(pickId)
      setCreateOpen(false)
    }
  }

  const assigneeLabel =
    repOptions.find((r) => r.userId === assigneeUserId)?.name ||
    (isCompanyAdmin ? 'All members' : '')

  const stageLabel =
    pipelineStage === 'all'
      ? 'All stages'
      : CRM_STATUSES.find((s) => s.id === pipelineStage)?.label || pipelineStage

  const openFilters = () => {
    setDraftFilters({ ...appliedFilters })
    setFiltersOpen(true)
  }

  const closeFilters = () => setFiltersOpen(false)

  const applyFilters = () => {
    setAppliedFilters({ ...draftFilters })
    setFiltersOpen(false)
  }

  const closeListDetail = () => setSelectedListId(null)

  const listDetail = selectedList ? (
    <MarketingListDetail
      list={selectedList}
      savedLeads={savedLeads}
      busy={busy}
      setBusy={setBusy}
      setError={setError}
      setNotice={setNotice}
      onClose={closeListDetail}
      embeddedInModal={isMobile}
      onUpdated={(list) => {
        setLists((prev) => prev.map((x) => (x.id === list.id ? { ...x, ...list } : x)))
      }}
      onDeleted={() => {
        setSelectedListId(null)
        onListsReload?.()
      }}
    />
  ) : null

  return (
    <div className="crm-content-card flex flex-col min-h-0 flex-1 overflow-hidden">
      <div className="crm-toolbar crm-toolbar--compact marketing-lists-toolbar shrink-0 border-b border-[#dfe3eb] px-3 pt-2 pb-1.5 bg-white">
        <div className="crm-toolbar-primary">
          <div className="crm-view-tabs">
            {[
              { id: 'email', label: 'Email' },
              { id: 'whatsapp', label: 'WhatsApp' },
            ].map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  setListChannel(ch.id)
                  setSelectedListId(null)
                }}
                className={`crm-view-tab ${listChannel === ch.id ? 'is-active' : ''}`}
              >
                {ch.label}
              </button>
            ))}
          </div>

          <div className="crm-search-wrap flex-1 min-w-[140px] max-w-[240px]">
            <svg className="crm-search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M8.5 3a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 8.5a6.5 6.5 0 1111.436 4.23l3.07 3.07a.75.75 0 11-1.06 1.06l-3.07-3.07A6.5 6.5 0 012 8.5z"
                clipRule="evenodd"
              />
            </svg>
            <input
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search lists…"
              className="crm-search-input"
              aria-label="Search lists"
            />
          </div>

          {isMobile ? (
            <button
              type="button"
              onClick={openFilters}
              className={`crm-btn crm-btn-sm crm-btn-secondary marketing-lists-filter-btn ${filtersActive ? 'is-active' : ''}`}
            >
              Filters{filtersActive ? ' · on' : ''}
            </button>
          ) : (
            <div className="marketing-lists-toolbar-filters flex flex-wrap items-center gap-2">
              {isCompany && (
                <FilterDropdown
                  label="Team member"
                  value={assigneeUserId}
                  displayValue={assigneeLabel}
                  options={repOptionsForDropdown}
                  onChange={(v) =>
                    setAppliedFilters((prev) => ({ ...prev, assigneeUserId: v || '' }))
                  }
                  emptyLabel="All members"
                />
              )}

              <FilterDropdown
                label="Stage"
                value={pipelineStage !== 'all' ? pipelineStage : ''}
                displayValue={stageLabel}
                options={stageOptions}
                onChange={(v) =>
                  setAppliedFilters((prev) => ({ ...prev, pipelineStage: v || 'all' }))
                }
                emptyLabel="All stages"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="crm-btn crm-btn-sm crm-btn-primary"
          >
            + List
          </button>

          <span className="crm-toolbar-count crm-toolbar-count--inline">
            {filteredLists.length} list{filteredLists.length === 1 ? '' : 's'} ·{' '}
            {totalContacts.toLocaleString()} contacts
          </span>
        </div>
      </div>

      <div className="crm-split-card flex-1 min-h-0 border-0 rounded-none shadow-none">
        <aside className="crm-split-sidebar">
          <div className="crm-list-header">Saved lists</div>
          <div className="crm-list-scroll">
            {!filteredLists.length && (
              <div className="crm-empty-state py-8">
                <p>No {listChannel} lists match</p>
                <p className="crm-empty-hint">
                  {filtersActive ? 'Try changing filters or create a new list.' : 'Use Create list above.'}
                </p>
              </div>
            )}
            {filteredLists.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSelectedListId(l.id)}
                className={`crm-list-item ${selectedListId === l.id ? 'is-selected' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="crm-list-item-name">{l.name}</p>
                  <MarketingCreatorBadge name={l.createdByName} isOwn={l.isOwn} />
                </div>
                <p className="crm-list-item-meta">{l.leadIds?.length || 0} contacts</p>
              </button>
            ))}
          </div>
        </aside>

        {!isMobile && (
          <section className="crm-split-main">
            {selectedListId ? (
              listDetail
            ) : (
              <div className="crm-empty-state h-full">
                <p>Select a list</p>
                <p className="crm-empty-hint">
                  Choose a saved list to edit name, add or remove contacts.
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      {isMobile && selectedListId && selectedList ? (
        <FullScreenDetailModal
          open
          onClose={closeListDetail}
          title={selectedList.name}
          subtitle={`${selectedList.leadIds?.length || 0} contacts · ${listChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}`}
        >
          {listDetail}
        </FullScreenDetailModal>
      ) : null}

      <MarketingListsFiltersSheet
        open={isMobile && filtersOpen}
        onClose={closeFilters}
        onApply={applyFilters}
        draft={draftFilters}
        onDraftChange={setDraftFilters}
        isCompany={isCompany}
        isCompanyAdmin={isCompanyAdmin}
        repOptions={repOptions}
      />

      {createOpen && (
        <div
          className="crm-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-list-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false)
          }}
        >
          <div className="crm-modal-dialog crm-modal-dialog-lg" onClick={(e) => e.stopPropagation()}>
            <header className="crm-modal-header">
              <div>
                <h2 id="create-list-title">Create list</h2>
                <p className="text-xs text-[#516f90] mt-0.5">
                  {listChannel === 'whatsapp' ? 'WhatsApp' : 'Email'} · {assigneeLabel || '—'} ·{' '}
                  {stageLabel}
                </p>
                <div className="crm-view-tabs mt-2">
                  {[
                    { id: 'smart', label: 'Smart list' },
                    { id: 'manual', label: 'Pick leads' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`crm-view-tab ${createMode === m.id ? 'is-active' : ''}`}
                      onClick={() => setCreateMode(m.id)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="crm-modal-close"
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className="crm-modal-body crm-modal-body-padded">
              {createMode === 'smart' ? (
                <MarketingSmartListBuilder
                  user={user}
                  teamMembers={teamMembers}
                  listChannel={listChannel}
                  assigneeUserId={assigneeUserId}
                  busy={busy}
                  setBusy={setBusy}
                  setError={setError}
                  setNotice={setNotice}
                  onListsCreated={handleListsCreated}
                  onSegmentSaved={() => setCreateOpen(false)}
                  orgLeadTags={orgLeadTags}
                />
              ) : (
                <MarketingListBuilder
                  hideSetupFields
                  user={user}
                  teamMembers={teamMembers}
                  refreshTeam={refreshTeam}
                  savedLeads={savedLeads}
                  busy={busy}
                  setBusy={setBusy}
                  setError={setError}
                  setNotice={setNotice}
                  onListsCreated={handleListsCreated}
                  listChannel={listChannel}
                  onListChannelChange={setListChannel}
                  assigneeUserId={assigneeUserId}
                  onAssigneeChange={(v) =>
                    setAppliedFilters((prev) => ({ ...prev, assigneeUserId: v || '' }))
                  }
                  pipelineStage={pipelineStage}
                  onPipelineStageChange={(v) =>
                    setAppliedFilters((prev) => ({ ...prev, pipelineStage: v || 'all' }))
                  }
                />
              )}
            </div>
            <footer className="crm-modal-footer">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="crm-btn crm-btn-secondary"
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
