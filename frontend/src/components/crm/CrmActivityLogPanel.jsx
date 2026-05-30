import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { ACTIVITY_LABELS, formatDateTime } from '../../lib/crmUiConstants'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'

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
    <div className="panel-shell">
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 md:px-5 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Activity log</h1>
        <p className="text-xs text-gray-500 mt-0.5">Notes, emails, calls, visits, and assignments across your pipeline</p>
      </header>

      <div className="panel-body-scroll p-4 md:p-5 max-w-3xl">
        {loading ? (
          <LoadingExperience message={LOADING_MESSAGES.activity} fill={false} className="rounded-xl border border-gray-200 min-h-[200px]" />
        ) : null}
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
                  className="shrink-0 text-xs font-semibold text-[#FF773D] hover:underline"
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
