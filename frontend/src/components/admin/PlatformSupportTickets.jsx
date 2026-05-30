import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'

const STATUS_FILTERS = [
  { id: 'active', label: 'Active' },
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'waiting_customer', label: 'Waiting on customer' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'all', label: 'All' },
]

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed']

function statusBadge(status) {
  const map = {
    open: 'bg-amber-100 text-amber-900 border-amber-200',
    in_progress: 'bg-blue-100 text-blue-900 border-blue-200',
    waiting_customer: 'bg-violet-100 text-violet-900 border-violet-200',
    resolved: 'bg-green-100 text-green-900 border-green-200',
    closed: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  return map[status] || map.open
}

export default function PlatformSupportTickets({ onSelectCustomer }) {
  const [statusFilter, setStatusFilter] = useState('active')
  const [query, setQuery] = useState('')
  const [metrics, setMetrics] = useState(null)
  const [tickets, setTickets] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listAdminSupportTickets({ status: statusFilter, q: query })
      setMetrics(data.metrics || null)
      setTickets(data.tickets || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, query])

  const loadDetail = useCallback(async () => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    setDetailLoading(true)
    try {
      const data = await api.getAdminSupportTicket(selectedId)
      setDetail(data.ticket)
    } catch (e) {
      setError(e.message)
    } finally {
      setDetailLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    const t = setTimeout(loadList, 200)
    return () => clearTimeout(t)
  }, [loadList])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const runAction = async (payload) => {
    setBusy(true)
    setError(null)
    try {
      const data = await api.adminSupportTicketAction(payload)
      setDetail(data.ticket)
      setNotice('Saved')
      await loadList()
      if (payload.action === 'reply') setReply('')
      if (payload.action === 'internal_note') setInternalNote('')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 px-4 py-3 bg-amber-50 border-b border-amber-100">
        <p className="text-xs text-amber-950">
          <strong>Support desk</strong> — no live calls. Reply to customers by email from here. SLA target:{' '}
          <strong>24–48 business hours</strong>.
        </p>
        {metrics && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-900">
              Active: {metrics.active}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full border ${metrics.overdue > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-amber-200 text-amber-900'}`}
            >
              Over SLA: {metrics.overdue}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-900">
              New 24h: {metrics.openLast24h}
            </span>
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 py-2 flex flex-wrap items-center gap-2 bg-white border-b border-gray-200">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatusFilter(f.id)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
              statusFilter === f.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ticket #, email, subject…"
          className="ml-auto text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-full sm:w-56"
        />
      </div>

      {(error || notice) && (
        <div className="shrink-0 px-4 pt-2">
          {error && <p className="text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          {notice && (
            <p className="text-xs text-green-900 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mt-1">{notice}</p>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 grid lg:grid-cols-[minmax(260px,320px)_1fr]">
        <aside className="border-r border-gray-200 bg-white overflow-y-auto">
          {loading ? (
            <LoadingExperience message={LOADING_MESSAGES.customers} compact fill={false} className="m-2 rounded-lg border" />
          ) : !tickets.length ? (
            <p className="p-4 text-sm text-gray-500">No tickets in this view.</p>
          ) : (
            tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 ${
                  selectedId === t.id ? 'bg-[#fff4ee] border-l-2 border-l-[#FF773D]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-gray-900">{t.ticketNumber}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${statusBadge(t.status)}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 truncate mt-1">{t.subject}</p>
                <p className="text-xs text-gray-500 truncate">{t.userEmail}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDateTime(t.createdAt)}
                  {t.overdue ? ' · overdue' : ''}
                </p>
              </button>
            ))
          )}
        </aside>

        <main className="overflow-y-auto p-4">
          {detailLoading ? (
            <LoadingExperience message="Loading ticket…" compact fill={false} className="rounded-xl border" />
          ) : !detail ? (
            <p className="text-sm text-gray-500 text-center py-12">Select a ticket to review and respond.</p>
          ) : (
            <div className="max-w-3xl space-y-4">
              <section className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-mono font-bold text-[#FF773D]">{detail.ticketNumber}</p>
                    <h2 className="text-lg font-semibold text-gray-900 mt-1">{detail.subject}</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      {detail.userName} · {detail.userEmail}
                      {detail.organizationName ? ` · ${detail.organizationName}` : ''}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Opened {formatDateTime(detail.createdAt)} · SLA due {formatDateTime(detail.slaDueAt)} ·{' '}
                      {detail.category} · via {detail.source}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      value={detail.status}
                      disabled={busy}
                      onChange={(e) =>
                        runAction({ ticketId: detail.id, action: 'set_status', status: e.target.value })
                      }
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    {onSelectCustomer && (
                      <button
                        type="button"
                        onClick={() => onSelectCustomer(detail.userId)}
                        className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                      >
                        Open customer
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-800 whitespace-pre-wrap">{detail.description}</p>
                {detail.context && (
                  <p className="mt-2 text-xs text-gray-500">
                    Pipeline {detail.context.pipelineLeadCount} leads · Gmail{' '}
                    {detail.context.gmailConnected ? 'on' : 'off'} · Credits ₹{detail.context.prospectCredits}
                  </p>
                )}
              </section>

              {detail.transcript?.length > 0 && (
                <section className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Assistant transcript</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                    {detail.transcript.map((m, i) => (
                      <p key={i} className="text-gray-700">
                        <span className="font-semibold">{m.role}:</span> {m.content}
                      </p>
                    ))}
                  </div>
                </section>
              )}

              <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Timeline</h3>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {(detail.updates || []).map((u) => (
                    <div
                      key={u.id}
                      className={`text-xs rounded-lg px-3 py-2 border ${
                        u.visibleToCustomer ? 'bg-white border-gray-100' : 'bg-gray-100 border-gray-200 text-gray-600'
                      }`}
                    >
                      <p className="font-semibold text-gray-700">
                        {u.authorType}
                        {!u.visibleToCustomer && ' (internal)'} · {formatDateTime(u.createdAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-gray-800">{u.message}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Reply to customer (emails {detail.userEmail})</h3>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  placeholder="Your message — customer receives this by email…"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
                <button
                  type="button"
                  disabled={busy || !reply.trim()}
                  onClick={() =>
                    runAction({ ticketId: detail.id, action: 'reply', message: reply.trim() })
                  }
                  className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#FF773D] text-[#242424] hover:bg-[#e5652f] disabled:opacity-40"
                >
                  Send reply
                </button>
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Internal note</h3>
                <textarea
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
                <button
                  type="button"
                  disabled={busy || !internalNote.trim()}
                  onClick={() =>
                    runAction({
                      ticketId: detail.id,
                      action: 'internal_note',
                      internalNote: internalNote.trim(),
                    })
                  }
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200"
                >
                  Save note
                </button>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
