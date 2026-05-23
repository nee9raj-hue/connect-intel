import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'

export default function CrmCalendarPanel({ onNavigate }) {
  const { openPipelineLead } = useApp()
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getCrmCalendar()
      setReminders(data.reminders || [])
    } catch {
      setReminders([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f6f7f9]">
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 md:px-5 py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Calendar & reminders</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Meetings and follow-ups · browser reminder 30 minutes before
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Refresh
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-5 max-w-3xl space-y-3">
        {loading && <p className="text-sm text-gray-500">Loading…</p>}
        {!loading && reminders.length === 0 && (
          <p className="text-sm text-gray-500">No upcoming meetings. Schedule from a lead in Pipeline.</p>
        )}
        {reminders.map((item) => (
          <div
            key={`${item.leadId}-${item.meetingId || item.scheduledAt}`}
            className="bg-white border border-gray-200 rounded-xl p-4"
          >
            <p className="text-[10px] font-bold uppercase text-gray-400">
              {item.kind === 'meeting' ? item.type?.replace('_', ' ') || 'meeting' : 'follow up'}
            </p>
            <p className="text-sm font-semibold text-gray-900 mt-1">{item.title}</p>
            <p className="text-xs text-gray-600 mt-0.5">{item.leadName}</p>
            <p className="text-xs text-[#5b4a00] font-medium mt-2">{formatDateTime(item.scheduledAt)}</p>
            {item.location && <p className="text-xs text-gray-500 mt-1">{item.location}</p>}
            <button
              type="button"
              onClick={() => {
                openPipelineLead(item.leadId)
                onNavigate?.('pipeline')
              }}
              className="mt-3 text-xs font-semibold text-gray-800 underline"
            >
              Open lead
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
