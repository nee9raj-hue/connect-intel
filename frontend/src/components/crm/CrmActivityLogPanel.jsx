import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { ACTIVITY_LABELS, formatDateTime } from '../../lib/crmUiConstants'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'

export default function CrmActivityLogPanel({ onNavigate }) {
  const { openPipelineLead, pipelineAssigneeFilter, setPipelineAssigneeFilter, teamMembers } = useApp()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const assigneeName = useMemo(() => {
    if (!pipelineAssigneeFilter) return null
    const m = teamMembers.find((t) => String(t.userId) === String(pipelineAssigneeFilter))
    return m?.name || 'Team member'
  }, [pipelineAssigneeFilter, teamMembers])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams()
      if (pipelineAssigneeFilter) q.set('userId', pipelineAssigneeFilter)
      const data = await api.getCrmActivityLog(q.toString())
      setActivities(data.activities || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [pipelineAssigneeFilter])

  useEffect(() => {
    setActivities([])
    load()
  }, [load])

  return (
    <div className="panel-shell">
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 md:px-5 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Activity log</h1>
        <p className="text-xs text-gray-500 mt-0.5">Notes, emails, calls, visits, and assignments across your pipeline</p>
      </header>

      <div className="panel-body-scroll p-4 md:p-5 max-w-3xl">
        {pipelineAssigneeFilter && assigneeName ? (
          <div className="dashboard-team-filter-banner mb-4" role="status">
            <span>
              Viewing <strong>{assigneeName}</strong>&apos;s activity
            </span>
            <button
              type="button"
              className="dashboard-team-filter-banner__clear"
              onClick={() => setPipelineAssigneeFilter?.(null)}
            >
              View all team
            </button>
          </div>
        ) : null}

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
                  <span className="text-xs font-bold uppercase tracking-wide text-[#8a6600]">
                    {ACTIVITY_LABELS[act.type] || act.type}
                  </span>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">
                    {act.leadName}
                    {act.company ? ` · ${act.company}` : ''}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{act.summary}</p>
                  <p className="text-xs text-gray-400 mt-1">
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
