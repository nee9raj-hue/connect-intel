import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { leadDisplayName, leadHasSendableEmail } from '../../lib/emailUtils'
import { leadHasCallablePhone } from '../../lib/phoneUtils'

export default function MarketingListDetail({
  list,
  savedLeads,
  onUpdated,
  onDeleted,
  onClose,
  busy,
  setBusy,
  setError,
  setNotice,
}) {
  const [search, setSearch] = useState('')
  const [addSearch, setAddSearch] = useState('')
  const [unsubPrompt, setUnsubPrompt] = useState(null)

  const channel = list?.channel || 'email'
  const eligible = (lead) =>
    channel === 'whatsapp' ? leadHasCallablePhone(lead) : leadHasSendableEmail(lead)

  const members = useMemo(() => {
    const ids = new Set(list?.leadIds || [])
    return (savedLeads || []).filter((l) => ids.has(l.id))
  }, [list?.leadIds, savedLeads])

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter((l) => {
      const name = leadDisplayName(l).toLowerCase()
      const email = String(l.email || '').toLowerCase()
      const phone = String(l.phone || '').toLowerCase()
      return name.includes(q) || email.includes(q) || phone.includes(q)
    })
  }, [members, search])

  const addCandidates = useMemo(() => {
    const inList = new Set(list?.leadIds || [])
    const q = addSearch.trim().toLowerCase()
    return (savedLeads || [])
      .filter((l) => !inList.has(l.id) && eligible(l))
      .filter((l) => {
        if (!q) return true
        const name = leadDisplayName(l).toLowerCase()
        return name.includes(q) || String(l.email || '').toLowerCase().includes(q)
      })
      .slice(0, 80)
  }, [savedLeads, list?.leadIds, addSearch, channel])

  const removeLeads = async (leadIds) => {
    if (!leadIds.length) return
    setBusy(true)
    setError(null)
    try {
      const data = await api.removeMarketingListLeads(list.id, leadIds)
      onUpdated?.(data.list)
      setNotice(`Removed ${leadIds.length} contact${leadIds.length === 1 ? '' : 's'} from list.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const addLeads = async (leadIds) => {
    if (!leadIds.length) return
    setBusy(true)
    setError(null)
    setUnsubPrompt(null)
    try {
      const data = await api.addMarketingListLeads(list.id, leadIds)
      onUpdated?.(data.list)
      if (data.skippedUnsubscribed?.length) {
        const emails = data.skippedUnsubscribed.map((b) => b.email).join(', ')
        setUnsubPrompt(
          `Added ${data.added || leadIds.length} contact(s). Skipped unsubscribed: ${emails}`
        )
      } else {
        setNotice(`Added ${data.added || leadIds.length} to the list.`)
      }
    } catch (e) {
      if (e.blocked?.length) {
        setUnsubPrompt(
          e.message ||
            `These contacts unsubscribed from your email list and cannot be re-added: ${e.blocked.map((b) => b.email).join(', ')}`
        )
      } else {
        setError(e.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const saveListMeta = async () => {
    if (!list?.id || savingMeta) return
    const name = editName.trim()
    if (!name) {
      setError('List name is required')
      return
    }
    setSavingMeta(true)
    setError(null)
    try {
      const data = await api.updateMarketingList({
        id: list.id,
        name,
        description: editDescription.trim(),
      })
      onUpdated?.(data.list)
      setNotice('List updated')
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingMeta(false)
    }
  }

  const deleteList = async () => {
    if (!window.confirm(`Delete list "${list.name}"?`)) return
    setBusy(true)
    try {
      await api.deleteMarketingList(list.id)
      onDeleted?.()
      setNotice('List deleted.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!list) return null

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 px-4 py-3 border-b border-[#dfe3eb] bg-[#f5f8fa] space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="crm-field-label mb-0">Edit list</p>
          <div className="flex items-center gap-2 shrink-0">
            {onClose && (
              <button type="button" onClick={onClose} className="crm-btn crm-btn-secondary">
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={deleteList}
              disabled={busy}
              className="crm-btn crm-btn-ghost text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>
        <div className="crm-form-grid">
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="List name"
            className="crm-input"
          />
          <input
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Description (optional)"
            className="crm-input"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveListMeta}
            disabled={savingMeta || busy || !editName.trim()}
            className="crm-btn crm-btn-primary"
          >
            {savingMeta ? 'Saving…' : 'Save list'}
          </button>
          <p className="text-xs text-[#516f90]">
            {channel === 'whatsapp' ? 'WhatsApp' : 'Email'} · {list.leadIds?.length || 0} contacts
          </p>
        </div>
      </div>

      {unsubPrompt && (
        <p className="shrink-0 mx-4 mt-3 crm-alert crm-alert-error">{unsubPrompt}</p>
      )}

      <div className="flex-1 min-h-0 grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#dfe3eb]">
        <section className="flex flex-col min-h-0">
          <div className="shrink-0 px-4 py-2.5 border-b border-[#eaf0f6] bg-white">
            <p className="text-xs font-semibold text-[#33475b]">On this list</p>
            <p className="text-[11px] text-[#7c98b6]">Remove contacts you no longer want to target</p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members…"
              className="crm-input mt-2 text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 crm-list-scroll">
            {!filteredMembers.length && (
              <p className="text-xs text-[#7c98b6] p-6 text-center">No contacts on this list yet.</p>
            )}
            {filteredMembers.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs border-b border-[#eaf0f6] hover:bg-[#f5f8fa]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#33475b] truncate">{leadDisplayName(l)}</p>
                  <p className="text-[#7c98b6] truncate">{l.email || l.phone}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeLeads([l.id])}
                  className="crm-link-btn p-0 text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col min-h-0">
          <div className="shrink-0 px-4 py-2.5 border-b border-[#eaf0f6] bg-white">
            <p className="text-xs font-semibold text-[#33475b]">Add from pipeline</p>
            <p className="text-[11px] text-[#7c98b6]">Search and add leads to this list</p>
            <input
              value={addSearch}
              onChange={(e) => setAddSearch(e.target.value)}
              placeholder="Search leads to add…"
              className="crm-input mt-2 text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 crm-list-scroll">
            {!addCandidates.length && (
              <p className="text-xs text-[#7c98b6] p-6 text-center">No matching leads to add.</p>
            )}
            {addCandidates.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs border-b border-[#eaf0f6] hover:bg-[#f5f8fa]"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#33475b] truncate">{leadDisplayName(l)}</p>
                  <p className="text-[#7c98b6] truncate">{l.email || l.phone}</p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => addLeads([l.id])}
                  className="crm-link-btn p-0 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
