import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { ACTIVITY_LABELS, formatDateTime } from '../../lib/crmUiConstants'

export default function CrmActivityLogPanel({ onNavigate }) {
  const { openPipelineLead } = useApp()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .getCrmActivityLog()
      .then((data) => {
        if (!cancelled) setActivities(data.activities || [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f6f7f9]">
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 md:px-5 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Activity log</h1>
        <p className="text-xs text-gray-500 mt-0.5">Notes, emails, calls, visits, and assignments across your pipeline</p>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-5 max-w-3xl">
        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
        {!loading && activities.length === 0 && (
          <p className="text-sm text-gray-500">No activity yet. Open a lead in Pipeline to add notes or schedule meetings.</p>
        )}
        <ul className="space-y-2">
          {activities.map((act) => (
            <li key={act.id} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#8a6600]">
                    {ACTIVITY_LABELS[act.type] || act.type}
                  </span>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">
                    {act.leadName}
                    {act.company ? ` · ${act.company}` : ''}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{act.summary}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {act.createdByName} · {formatDateTime(act.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    openPipelineLead(act.leadId)
                    onNavigate?.('pipeline')
                  }}
                  className="shrink-0 text-xs font-semibold text-[#5b4a00] hover:underline"
                >
                  Open
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
