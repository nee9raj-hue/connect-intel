import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { CRM_STATUSES, getStatusMeta } from '../../lib/crmConstants'
import { leadDisplayName, leadHasSendableEmail } from '../../lib/emailUtils'
import { leadHasCallablePhone } from '../../lib/phoneUtils'
import {
  MARKETING_SEND_BATCH_SIZE,
  previewBatchNames,
} from '../../../../lib/marketingListBatches.js'

const UNASSIGNED = '__unassigned__'

function leadMatchesAssignee(lead, assigneeUserId) {
  if (!assigneeUserId) return false
  if (assigneeUserId === UNASSIGNED) return !lead.assignedToUserId
  return lead.assignedToUserId === assigneeUserId
}

function leadMatchesStage(lead, pipelineStage) {
  if (!pipelineStage || pipelineStage === 'all') return true
  return (lead.crm?.status || 'new') === pipelineStage
}

function leadEligibleForChannel(lead, channel) {
  return channel === 'whatsapp' ? leadHasCallablePhone(lead) : leadHasSendableEmail(lead)
}

function defaultNamePrefix(repName, pipelineStage, channel) {
  const base = String(repName || '').trim()
  const ch = channel === 'whatsapp' ? 'WhatsApp' : 'Email'
  if (!pipelineStage || pipelineStage === 'all') {
    return base ? `${base} · ${ch}` : ch
  }
  const label = getStatusMeta(pipelineStage).label
  return base ? `${base} · ${ch} · ${label}` : `${ch} · ${label}`
}

export default function MarketingListBuilder({
  user,
  teamMembers,
  refreshTeam,
  savedLeads,
  busy,
  setBusy,
  setError,
  setNotice,
  onListsCreated,
  hideSetupFields = false,
  listChannel: listChannelProp,
  onListChannelChange,
  assigneeUserId: assigneeProp,
  onAssigneeChange,
  pipelineStage: stageProp,
  onPipelineStageChange,
}) {
  const [listChannelInternal, setListChannelInternal] = useState('email')
  const [assigneeInternal, setAssigneeInternal] = useState('')
  const [pipelineStageInternal, setPipelineStageInternal] = useState('all')
  const listChannel = listChannelProp ?? listChannelInternal
  const setListChannel = onListChannelChange ?? setListChannelInternal
  const assigneeUserId = assigneeProp ?? assigneeInternal
  const setAssigneeUserId = onAssigneeChange ?? setAssigneeInternal
  const pipelineStage = stageProp ?? pipelineStageInternal
  const setPipelineStage = onPipelineStageChange ?? setPipelineStageInternal
  const [namePrefix, setNamePrefix] = useState('')
  const [prefixTouched, setPrefixTouched] = useState(false)
  const [listForm, setListForm] = useState({ name: '', description: '', leadIds: [] })
  const [search, setSearch] = useState('')

  const isCompany = Boolean(user?.accountType === 'company' && user?.organizationId)
  const isCompanyAdmin = Boolean(
    isCompany && (user?.isOrgAdmin || user?.orgRole === 'org_admin')
  )

  useEffect(() => {
    if (isCompany) refreshTeam?.()
  }, [isCompany, refreshTeam])

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

  useEffect(() => {
    if (!isCompany || isCompanyAdmin || !user?.id) return
    setAssigneeUserId(user.id)
    setNamePrefix((prev) => prev || user.name || user.email?.split('@')[0] || 'My lists')
  }, [isCompany, isCompanyAdmin, user?.id, user?.name, user?.email])

  const repLeads = useMemo(() => {
    if (!assigneeUserId) return []
    return (savedLeads || []).filter(
      (l) =>
        leadEligibleForChannel(l, listChannel) &&
        leadMatchesAssignee(l, assigneeUserId) &&
        leadMatchesStage(l, pipelineStage)
    )
  }, [savedLeads, assigneeUserId, pipelineStage, listChannel])

  const stageCounts = useMemo(() => {
    if (!assigneeUserId) return []
    const base = (savedLeads || []).filter(
      (l) => leadEligibleForChannel(l, listChannel) && leadMatchesAssignee(l, assigneeUserId)
    )
    return CRM_STATUSES.map((st) => ({
      id: st.id,
      label: st.label,
      count: base.filter((l) => leadMatchesStage(l, st.id)).length,
    })).filter((row) => row.count > 0)
  }, [savedLeads, assigneeUserId, listChannel])

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return repLeads
    return repLeads.filter((l) => {
      const name = leadDisplayName(l).toLowerCase()
      const company = String(l.company || '').toLowerCase()
      const email = String(l.email || '').toLowerCase()
      const phone = String(l.phone || '').toLowerCase()
      return (
        name.includes(q) ||
        company.includes(q) ||
        email.includes(q) ||
        phone.includes(q)
      )
    })
  }, [repLeads, search])

  const selectedCount = listForm.leadIds.length

  const batchPreview = useMemo(() => {
    const ids = listForm.leadIds.length ? listForm.leadIds : repLeads.map((l) => l.id)
    return previewBatchNames(namePrefix.trim() || 'List', ids.length)
  }, [listForm.leadIds, repLeads, namePrefix])

  useEffect(() => {
    if (!assigneeUserId || prefixTouched) return
    const rep = repOptions.find((r) => r.userId === assigneeUserId)
    setNamePrefix(defaultNamePrefix(rep?.name, pipelineStage, listChannel))
  }, [assigneeUserId, pipelineStage, repOptions, prefixTouched, listChannel])

  const onChannelChange = (channel) => {
    setListChannel(channel)
    setPipelineStage('all')
    setListForm({ name: '', description: '', leadIds: [] })
    setSearch('')
    setPrefixTouched(false)
    const rep = repOptions.find((r) => r.userId === assigneeUserId)
    setNamePrefix(defaultNamePrefix(rep?.name, 'all', channel))
  }

  const onRepChange = (userId) => {
    setAssigneeUserId(userId)
    setPipelineStage('all')
    setListForm({ name: '', description: '', leadIds: [] })
    setSearch('')
    setPrefixTouched(false)
    const rep = repOptions.find((r) => r.userId === userId)
    setNamePrefix(defaultNamePrefix(rep?.name, 'all', listChannel))
  }

  const handleStageChange = (stageId) => {
    setPipelineStage(stageId)
    setListForm((prev) => ({ ...prev, leadIds: [] }))
    if (!prefixTouched) {
      const rep = repOptions.find((r) => r.userId === assigneeUserId)
      setNamePrefix(defaultNamePrefix(rep?.name, stageId, listChannel))
    }
  }

  const toggleLead = (leadId) => {
    setListForm((prev) => {
      const set = new Set(prev.leadIds)
      if (set.has(leadId)) set.delete(leadId)
      else set.add(leadId)
      return { ...prev, leadIds: [...set] }
    })
  }

  const selectFirstN = (n) => {
    const ids = repLeads.slice(0, n).map((l) => l.id)
    setListForm((prev) => ({ ...prev, leadIds: ids }))
  }

  const selectAllRep = () => {
    setListForm((prev) => ({ ...prev, leadIds: repLeads.map((l) => l.id) }))
  }

  const clearSelection = () => {
    setListForm((prev) => ({ ...prev, leadIds: [] }))
  }

  const saveSingleList = async () => {
    if (!listForm.name.trim()) return setError('List name is required')
    const ids = listForm.leadIds.length ? listForm.leadIds : repLeads.map((l) => l.id)
    if (!ids.length) {
      return setError(
        listChannel === 'whatsapp'
          ? 'Select at least one lead with a valid mobile number'
          : 'Select at least one lead with email'
      )
    }
    setBusy(true)
    setError(null)
    try {
      const data = await api.createMarketingList({
        name: listForm.name.trim(),
        description: listForm.description.trim(),
        leadIds: ids,
        channel: listChannel,
        assigneeUserId: isCompany && assigneeUserId ? assigneeUserId : undefined,
      })
      setListForm({ name: '', description: '', leadIds: [] })
      setNotice('List saved')
      await onListsCreated?.(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const createBatchLists = async () => {
    if (!assigneeUserId) return setError('Select a sales leader first')
    const prefix = namePrefix.trim()
    if (!prefix) return setError('Enter a name prefix for batch lists')
    const leadIds = listForm.leadIds.length ? listForm.leadIds : repLeads.map((l) => l.id)
    if (!leadIds.length) {
      return setError(
        listChannel === 'whatsapp'
          ? 'No leads with a valid mobile number for this rep'
          : 'No leads with email for this rep'
      )
    }
    if (
      !window.confirm(
        `Create ${batchPreview.length} list(s) of up to ${MARKETING_SEND_BATCH_SIZE} leads each?\n\n${batchPreview
          .map((b) => `• ${b.name} (${b.leadCount})`)
          .join('\n')}`
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      const data = await api.createMarketingListBatches({
        assigneeUserId,
        namePrefix: prefix,
        leadIds,
        pipelineStatus: pipelineStage === 'all' ? null : pipelineStage,
        channel: listChannel,
      })
      setListForm({ name: '', description: '', leadIds: [] })
      setNotice(
        `Created ${data.batchCount} list(s) · ${data.totalLeads} leads (max ${MARKETING_SEND_BATCH_SIZE} per send batch)`
      )
      await onListsCreated?.(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!isCompany) {
    return (
      <SimpleListForm
        pipelineLeads={savedLeads || []}
        listForm={listForm}
        setListForm={setListForm}
        onToggleLead={toggleLead}
        busy={busy}
        onSave={saveSingleList}
        listChannel={listChannel}
        onChannelChange={onChannelChange}
        hideSetupFields={hideSetupFields}
      />
    )
  }

  const contactLabel = listChannel === 'whatsapp' ? 'mobile number' : 'email address'
  const showSetup = !hideSetupFields
  const canPickLeads = assigneeUserId || (!isCompanyAdmin && user?.id)

  return (
    <div className="space-y-3">
      {showSetup && (
        <>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">List channel</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'email', label: 'Email list' },
                { id: 'whatsapp', label: 'WhatsApp list' },
              ].map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => onChannelChange(ch.id)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                    listChannel === ch.id
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">
              {listChannel === 'whatsapp'
                ? 'Only pipeline leads with a valid phone number appear. Use this list for WhatsApp campaigns.'
                : 'Only pipeline leads with a valid email appear. Use this list for email campaigns.'}
            </p>
          </div>

          <label className="block text-xs font-medium text-gray-600">
            {isCompanyAdmin ? 'Team member (whose pipeline)' : 'Lead owner'}
            <select
              value={assigneeUserId}
              onChange={(e) => onRepChange(e.target.value)}
              disabled={!isCompanyAdmin}
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white disabled:bg-gray-50 disabled:text-gray-600"
            >
              {isCompanyAdmin && <option value="">Select team member…</option>}
              {repOptions.map((r) => (
                <option key={r.userId} value={r.userId}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {canPickLeads ? (
        <>
          {showSetup && (
            <label className="block text-xs font-medium text-gray-600">
              Pipeline stage
              <select
                value={pipelineStage}
                onChange={(e) => handleStageChange(e.target.value)}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
              >
                <option value="all">All stages</option>
                {CRM_STATUSES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {showSetup && stageCounts.length > 0 && (
            <p className="text-[11px] text-gray-500 leading-relaxed">
              {stageCounts.map((row) => (
                <span key={row.id} className="inline-block mr-2">
                  {row.label}: {row.count}
                </span>
              ))}
            </p>
          )}

          <p className="text-xs text-gray-600">
            <strong>{repLeads.length}</strong> leads with {contactLabel}
            {pipelineStage !== 'all' ? ` in ${getStatusMeta(pipelineStage).label}` : ''}
            {selectedCount > 0 ? ` · ${selectedCount} selected` : ' · none selected (uses all filtered)'}
          </p>

          <label className="block text-xs font-medium text-gray-600">
            Batch list name prefix
            <input
              value={namePrefix}
              onChange={(e) => {
                setPrefixTouched(true)
                setNamePrefix(e.target.value)
              }}
              placeholder="e.g. Rajesh — March outreach"
              className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !repLeads.length}
              onClick={() => selectFirstN(MARKETING_SEND_BATCH_SIZE)}
              className="text-xs font-medium px-2.5 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Select first {MARKETING_SEND_BATCH_SIZE}
            </button>
            <button
              type="button"
              disabled={busy || !repLeads.length}
              onClick={selectAllRep}
              className="text-xs font-medium px-2.5 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Select all
            </button>
            <button
              type="button"
              disabled={busy || !selectedCount}
              onClick={clearSelection}
              className="text-xs font-medium px-2.5 py-1.5 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              listChannel === 'whatsapp'
                ? 'Search name, company, phone…'
                : 'Search name, company, email…'
            }
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
          />

          <div className="max-h-52 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
            {filteredLeads.map((l) => (
              <label
                key={l.id}
                className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={listForm.leadIds.includes(l.id)}
                  onChange={() => onToggleLead(l.id)}
                />
                <span className="truncate">
                  {leadDisplayName(l)} · {getStatusMeta(l.crm?.status).label} ·{' '}
                  {listChannel === 'whatsapp' ? l.phone : l.email}
                </span>
              </label>
            ))}
            {!filteredLeads.length && (
              <p className="text-xs text-gray-400 px-3 py-4">
                No matching leads with {contactLabel}.
              </p>
            )}
          </div>

          {batchPreview.length > 0 && (
            <div className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 space-y-1">
              <p className="font-medium text-gray-800">Batch preview ({batchPreview.length} list(s))</p>
              {batchPreview.slice(0, 6).map((b) => (
                <p key={b.name}>
                  {b.name} — {b.leadCount} leads
                </p>
              ))}
              {batchPreview.length > 6 && (
                <p className="text-gray-400">+ {batchPreview.length - 6} more…</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy || !repLeads.length}
              onClick={createBatchLists}
              className="text-xs font-semibold px-3 py-2 bg-[#FF773D] text-[#242424] rounded-lg disabled:opacity-50"
            >
              Create batch lists ({MARKETING_SEND_BATCH_SIZE}/each)
            </button>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-2">
            <p className="text-xs font-medium text-gray-700">Or save one custom list</p>
            <input
              value={listForm.name}
              onChange={(e) => setListForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Single list name"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
            />
            <button
              type="button"
              disabled={busy}
              onClick={saveSingleList}
              className="text-xs font-semibold px-3 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50"
            >
              Save single list
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-[#516f90]">
          {hideSetupFields
            ? 'Select a team member in the toolbar above to load pipeline leads.'
            : 'Choose a sales leader to load their pipeline leads.'}
        </p>
      )}
    </div>
  )
}

function SimpleListForm({
  pipelineLeads,
  listForm,
  setListForm,
  onToggleLead,
  busy,
  onSave,
  listChannel,
  onChannelChange,
  hideSetupFields = false,
}) {
  const eligible = pipelineLeads.filter((l) => leadEligibleForChannel(l, listChannel))
  return (
    <div className="space-y-3">
      {!hideSetupFields && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">List channel</p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'email', label: 'Email list' },
              { id: 'whatsapp', label: 'WhatsApp list' },
            ].map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => onChannelChange(ch.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                  listChannel === ch.id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <input
        value={listForm.name}
        onChange={(e) => setListForm((p) => ({ ...p, name: e.target.value }))}
        placeholder="List name"
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
      />
      <p className="text-xs text-gray-500">
        Select pipeline leads with {listChannel === 'whatsapp' ? 'phone' : 'email'} (
        {listForm.leadIds.length} selected)
      </p>
      <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
        {eligible.map((l) => (
          <label
            key={l.id}
            className="flex items-center gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={listForm.leadIds.includes(l.id)}
              onChange={() => onToggleLead(l.id)}
            />
            <span className="truncate">
              {leadDisplayName(l)} · {listChannel === 'whatsapp' ? l.phone : l.email}
            </span>
          </label>
        ))}
        {!eligible.length && (
          <p className="text-xs text-gray-400 px-3 py-4">
            No leads with {listChannel === 'whatsapp' ? 'phone' : 'email'} in your pipeline.
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onSave}
        className="text-xs font-semibold px-3 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50"
      >
        Save list
      </button>
    </div>
  )
}
