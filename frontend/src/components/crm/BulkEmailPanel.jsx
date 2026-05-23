import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { getStatusMeta, getVisiblePipelineColumns } from '../../lib/crmConstants'
import { leadDisplayName, leadHasSendableEmail } from '../../lib/emailUtils'
import BulkEmailCompose from './BulkEmailCompose'

export default function BulkEmailPanel() {
  const { user, savedLeads } = useApp()
  const columns = useMemo(() => getVisiblePipelineColumns(user), [user])

  const [audience, setAudience] = useState('all')
  const [statusFilter, setStatusFilter] = useState('new')
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [search, setSearch] = useState('')

  const filteredLeads = useMemo(() => {
    let list = savedLeads
    if (audience === 'status') {
      list = list.filter((l) => (l.crm?.status || 'new') === statusFilter)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((l) => {
        const name = leadDisplayName(l).toLowerCase()
        const company = String(l.company || '').toLowerCase()
        const email = String(l.email || '').toLowerCase()
        return name.includes(q) || company.includes(q) || email.includes(q)
      })
    }
    return list
  }, [savedLeads, audience, statusFilter, search])

  const selectable = useMemo(() => filteredLeads.filter(leadHasSendableEmail), [filteredLeads])

  const selectedLeads = useMemo(
    () => savedLeads.filter((l) => selectedIds.has(l.id)),
    [savedLeads, selectedIds]
  )

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllFiltered = () => {
    setSelectedIds(new Set(selectable.map((l) => l.id)))
  }

  const clearSelection = () => setSelectedIds(new Set())

  const selectByStatus = (statusId) => {
    const ids = savedLeads.filter(
      (l) => (l.crm?.status || 'new') === statusId && leadHasSendableEmail(l)
    )
    setSelectedIds(new Set(ids.map((l) => l.id)))
    setAudience('status')
    setStatusFilter(statusId)
  }

  const allWithEmailCount = savedLeads.filter(leadHasSendableEmail).length

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 bg-[#f6f7f9]">
      <div className="flex-1 flex flex-col min-w-0 min-h-0 border-r border-gray-200">
        <header className="shrink-0 bg-white border-b border-gray-200 px-4 md:px-5 py-4 space-y-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Bulk email</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Filter pipeline leads, select recipients, compose on the right — sends via your connected Gmail or
              company email
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <AudienceBtn active={audience === 'all'} onClick={() => setAudience('all')}>
              All pipeline ({allWithEmailCount} with email)
            </AudienceBtn>
            <AudienceBtn
              active={audience === 'status'}
              onClick={() => setAudience('status')}
            >
              By stage
            </AudienceBtn>
          </div>

          {audience === 'status' && (
            <div className="flex flex-wrap gap-1.5">
              {columns.map((col) => {
                const count = savedLeads.filter(
                  (l) => (l.crm?.status || 'new') === col.id && leadHasSendableEmail(l)
                ).length
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setStatusFilter(col.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                      statusFilter === col.id
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {col.label} ({count})
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, company, email…"
              className="flex-1 min-w-[160px] text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            />
            <button
              type="button"
              onClick={selectAllFiltered}
              className="text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Select all shown ({selectable.length})
            </button>
            <button
              type="button"
              onClick={() => selectByStatus('new')}
              className="text-xs font-medium px-2 py-1.5 text-gray-600 hover:underline"
            >
              Quick: all New
            </button>
            {selectedIds.size > 0 && (
              <button type="button" onClick={clearSelection} className="text-xs text-gray-500 underline">
                Clear ({selectedIds.size})
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
              <tr className="text-left text-[11px] font-semibold text-gray-500 uppercase">
                <th className="w-10 py-2.5 pl-4">
                  <input
                    type="checkbox"
                    checked={selectable.length > 0 && selectable.every((l) => selectedIds.has(l.id))}
                    onChange={(e) => (e.target.checked ? selectAllFiltered() : clearSelection())}
                    className="rounded"
                  />
                </th>
                <th className="py-2.5 pr-2">Lead</th>
                <th className="py-2.5 pr-2 min-w-[200px]">Email</th>
                <th className="py-2.5 pr-4">Stage</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500 text-sm">
                    No leads match this filter.
                  </td>
                </tr>
              )}
              {filteredLeads.map((lead) => {
                const hasEmail = leadHasSendableEmail(lead)
                const st = getStatusMeta(lead.crm?.status || 'new')
                const checked = selectedIds.has(lead.id)
                return (
                  <tr
                    key={lead.id}
                    className={`border-b border-gray-100 ${checked ? 'bg-[#fffbeb]/60' : 'hover:bg-gray-50'} ${!hasEmail ? 'opacity-50' : ''}`}
                  >
                    <td className="py-2.5 pl-4 align-top">
                      <input
                        type="checkbox"
                        disabled={!hasEmail}
                        checked={checked}
                        onChange={() => toggleOne(lead.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="py-2.5 pr-2 align-top">
                      <p className="font-medium text-gray-900">{leadDisplayName(lead)}</p>
                      <p className="text-xs text-gray-500">{lead.company}</p>
                    </td>
                    <td className="py-2.5 pr-2 align-top font-mono text-xs text-gray-700">
                      {hasEmail ? lead.email : <span className="text-gray-400">No email</span>}
                    </td>
                    <td className="py-2.5 pr-4 align-top">
                      <span
                        className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st?.color || ''}`}
                      >
                        {st?.label || lead.crm?.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="w-full lg:w-[380px] xl:w-[420px] shrink-0 flex flex-col min-h-[320px] lg:min-h-0 bg-white border-t lg:border-t-0 border-gray-200">
        {selectedIds.size === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <p className="text-sm text-gray-500">
              Select leads using the checkboxes, or use <strong>Select all shown</strong> / filter by stage above.
            </p>
          </div>
        ) : (
          <BulkEmailCompose
            leadIds={[...selectedIds]}
            leads={selectedLeads}
            onDone={() => {
              clearSelection()
            }}
          />
        )}
      </aside>
    </div>
  )
}

function AudienceBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
        active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
      }`}
    >
      {children}
    </button>
  )
}
