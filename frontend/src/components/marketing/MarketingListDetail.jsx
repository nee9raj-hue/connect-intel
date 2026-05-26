import { useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { leadDisplayName, leadHasSendableEmail } from '../../lib/emailUtils'
import { leadHasCallablePhone } from '../../lib/phoneUtils'

export default function MarketingListDetail({ list, savedLeads, onUpdated, onDeleted, busy, setBusy, setError, setNotice }) {
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
      .slice(0, 40)
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
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{list.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {channel === 'whatsapp' ? 'WhatsApp' : 'Email'} · {list.leadIds?.length || 0} contacts
          </p>
        </div>
        <button
          type="button"
          onClick={deleteList}
          disabled={busy}
          className="text-xs font-semibold text-red-700 underline disabled:opacity-50"
        >
          Delete list
        </button>
      </div>

      {unsubPrompt && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {unsubPrompt}
        </p>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1">People on this list</p>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members…"
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2"
        />
        <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
          {!filteredMembers.length && (
            <p className="text-xs text-gray-400 p-3 text-center">No contacts on this list yet.</p>
          )}
          {filteredMembers.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{leadDisplayName(l)}</p>
                <p className="text-gray-400 truncate">{l.email || l.phone}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeLeads([l.id])}
                className="shrink-0 text-red-700 font-semibold hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1">Add from pipeline</p>
        <input
          value={addSearch}
          onChange={(e) => setAddSearch(e.target.value)}
          placeholder="Search leads to add…"
          className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2"
        />
        <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
          {!addCandidates.length && (
            <p className="text-xs text-gray-400 p-3 text-center">No matching leads to add.</p>
          )}
          {addCandidates.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{leadDisplayName(l)}</p>
                <p className="text-gray-400 truncate">{l.email || l.phone}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => addLeads([l.id])}
                className="shrink-0 text-gray-900 font-semibold hover:underline disabled:opacity-50"
              >
                Add
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
