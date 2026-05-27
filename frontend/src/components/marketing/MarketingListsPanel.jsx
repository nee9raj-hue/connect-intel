import { useEffect, useMemo, useState } from 'react'
import { CRM_STATUSES } from '../../lib/crmConstants'
import FilterDropdown from '../crm/FilterDropdown'
import MarketingListBuilder from './MarketingListBuilder'
import MarketingListDetail from './MarketingListDetail'
import MarketingCreatorBadge from './MarketingCreatorBadge'

const UNASSIGNED = '__unassigned__'

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
}) {
  const [selectedListId, setSelectedListId] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [listSearch, setListSearch] = useState('')

  const [listChannel, setListChannel] = useState('email')
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [pipelineStage, setPipelineStage] = useState('all')

  const isCompany = Boolean(user?.accountType === 'company' && user?.organizationId)
  const isCompanyAdmin = Boolean(
    isCompany && (user?.isOrgAdmin || user?.orgRole === 'org_admin')
  )

  useEffect(() => {
    if (isCompany) refreshTeam?.()
  }, [isCompany, refreshTeam])

  useEffect(() => {
    if (!isCompany || isCompanyAdmin || !user?.id) return
    setAssigneeUserId(user.id)
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

  const filteredLists = useMemo(() => {
    const q = listSearch.trim().toLowerCase()
    return (lists || [])
      .filter((l) => (l.channel || 'email') === listChannel)
      .filter((l) => {
        if (!q) return true
        return String(l.name || '').toLowerCase().includes(q)
      })
  }, [lists, listChannel, listSearch])

  const selectedList = useMemo(
    () => (lists || []).find((l) => l.id === selectedListId) || null,
    [lists, selectedListId]
  )

  const totalContacts = useMemo(
    () => filteredLists.reduce((sum, l) => sum + (l.leadIds?.length || 0), 0),
    [filteredLists]
  )

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
    (isCompanyAdmin ? 'Select member' : '')

  const stageLabel =
    pipelineStage === 'all'
      ? 'All stages'
      : CRM_STATUSES.find((s) => s.id === pipelineStage)?.label || pipelineStage

  return (
    <div className="crm-content-card flex flex-col min-h-0 flex-1 overflow-hidden">
      <div className="crm-toolbar shrink-0 border-b border-[#dfe3eb] px-4 pt-3 pb-2 bg-white">
        <div className="crm-toolbar-row">
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

          {isCompany && (
            <FilterDropdown
              label="Team member"
              value={assigneeUserId}
              displayValue={assigneeLabel}
              options={repOptionsForDropdown}
              onChange={(v) => setAssigneeUserId(v || '')}
              emptyLabel="Select member…"
            />
          )}

          <FilterDropdown
            label="Stage"
            value={pipelineStage !== 'all' ? pipelineStage : ''}
            displayValue={stageLabel}
            options={stageOptions}
            onChange={(v) => setPipelineStage(v || 'all')}
            emptyLabel="All stages"
          />

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
              placeholder="Search saved lists…"
              className="crm-search-input"
              aria-label="Search lists"
            />
          </div>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="crm-btn crm-btn-primary"
          >
            + Create list
          </button>
        </div>

        <div className="crm-toolbar-footer">
          <span className="crm-toolbar-count">
            {filteredLists.length} list{filteredLists.length === 1 ? '' : 's'} ·{' '}
            {totalContacts.toLocaleString()} contacts
            {listChannel === 'whatsapp' ? ' · WhatsApp' : ' · Email'}
          </span>
          <span className="text-xs text-[#7c98b6] hidden sm:inline">
            Filters apply when creating lists · click a list below to edit
          </span>
        </div>
      </div>

      <div className="crm-split-card flex-1 min-h-0 border-0 rounded-none shadow-none">
        <aside className={`crm-split-sidebar ${selectedListId ? 'is-hidden-mobile' : ''}`}>
          <div className="crm-list-header">Saved lists</div>
          <div className="crm-list-scroll">
            {!filteredLists.length && (
              <div className="crm-empty-state py-8">
                <p>No {listChannel} lists yet</p>
                <p className="crm-empty-hint">Use Create list above.</p>
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

        <section className={`crm-split-main ${selectedListId ? 'is-full-mobile' : ''}`}>
          {selectedListId ? (
            <MarketingListDetail
              list={selectedList}
              savedLeads={savedLeads}
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              setNotice={setNotice}
              onClose={() => setSelectedListId(null)}
              onUpdated={(list) => {
                setLists((prev) => prev.map((x) => (x.id === list.id ? { ...x, ...list } : x)))
              }}
              onDeleted={() => {
                setSelectedListId(null)
                onListsReload?.()
              }}
            />
          ) : (
            <div className="crm-empty-state h-full">
              <p>Select a list</p>
              <p className="crm-empty-hint">
                Choose a saved list to edit name, add or remove contacts.
              </p>
            </div>
          )}
        </section>
      </div>

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
                onAssigneeChange={setAssigneeUserId}
                pipelineStage={pipelineStage}
                onPipelineStageChange={setPipelineStage}
              />
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
