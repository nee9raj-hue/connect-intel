import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { getStatusMeta } from '../../lib/crmConstants'

const KPI = [
  { key: 'totalLeads', label: 'Pipeline leads', nav: 'pipeline' },
  { key: 'activitiesInPeriod', label: 'Activities', nav: 'crm-log' },
  { key: 'emailsSent', label: 'Emails sent', nav: 'crm-log' },
  { key: 'meetingsUpcoming', label: 'Upcoming meetings', nav: 'crm-calendar' },
  { key: 'needsFollowUp', label: 'Follow-up due', nav: 'pipeline', filter: 'follow_up' },
  { key: 'won', label: 'Won', nav: 'pipeline', filter: 'won' },
]

export default function TeamDashboardPanel({ onNavigate }) {
  const { user, setPipelineAssigneeFilter } = useApp()
  const [period, setPeriod] = useState('week')
  const [memberUserId, setMemberUserId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ period })
      if (memberUserId) q.set('userId', memberUserId)
      const res = await api.getCrmTeamDashboard(q.toString())
      setData(res)
    } catch (e) {
      setError(e.message || 'Could not load dashboard')
    } finally {
      setLoading(false)
    }
  }, [period, memberUserId])

  useEffect(() => {
    load()
  }, [load])

  const onKpiClick = (item) => {
    if (memberUserId) setPipelineAssigneeFilter?.(memberUserId)
    onNavigate?.(item.nav)
  }

  const onMemberRow = (m) => {
    setMemberUserId(m.userId)
    setPipelineAssigneeFilter?.(m.userId)
    onNavigate?.('pipeline')
  }

  const summary = data?.summary || {}
  const maxActivity = Math.max(1, ...(data?.activityByDay || []).map((d) => d.count))

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f6f7f9]">
      <header className="shrink-0 bg-white border-b border-gray-200 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Team dashboard</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Weekly and monthly activity — click any metric to open pipeline or logs
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
              {['week', 'month'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 capitalize ${
                    period === p ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p === 'week' ? 'This week' : 'This month'}
                </button>
              ))}
            </div>
            {data?.isAdmin && (data?.memberOptions?.length > 0) && (
              <select
                value={memberUserId}
                onChange={(e) => setMemberUserId(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white min-w-[160px]"
                aria-label="Filter by team member"
              >
                <option value="">All team members</option>
                {data.memberOptions.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        {loading && !data ? (
          <p className="text-sm text-gray-500">Loading team metrics…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {KPI.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onKpiClick(item)}
                  className="text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-[#ffcb2b] hover:shadow-sm transition-all"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">
                    {summary[item.key] ?? 0}
                  </p>
                </button>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              <section className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Activity ({period === 'week' ? '7 days' : '30 days'})</h2>
                <div className="flex items-end gap-1 h-36">
                  {(data?.activityByDay || []).map((day) => (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <div
                        className="w-full max-w-[28px] rounded-t bg-[#ffcb2b] transition-all"
                        style={{ height: `${Math.max(4, (day.count / maxActivity) * 100)}%` }}
                        title={`${day.count} activities`}
                      />
                      <span className="text-[9px] text-gray-500 truncate w-full text-center">{day.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2">
                  Email, call, and WhatsApp touchpoints logged in CRM
                </p>
              </section>

              <section className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Pipeline funnel</h2>
                <ul className="space-y-2">
                  {(data?.statusBreakdown || []).map((row) => {
                    const meta = getStatusMeta(row.status)
                    const total = summary.totalLeads || 1
                    const pct = Math.round((row.count / total) * 100)
                    return (
                      <li key={row.status}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="font-medium text-gray-700">{meta?.label || row.status}</span>
                          <span className="text-gray-500 tabular-nums">{row.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gray-800"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </div>

            {data?.members?.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h2 className="text-sm font-semibold text-gray-900">Team performance</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Click a row to view that member&apos;s pipeline</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-[11px] font-semibold text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-2.5">Member</th>
                        <th className="px-4 py-2.5">Leads</th>
                        <th className="px-4 py-2.5">Activities</th>
                        <th className="px-4 py-2.5">Emails</th>
                        <th className="px-4 py-2.5">Follow-ups</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.members.map((m) => (
                        <tr
                          key={m.userId}
                          className="border-t border-gray-100 hover:bg-[#fffbeb]/50 cursor-pointer"
                          onClick={() => onMemberRow(m)}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{m.name}</p>
                            <p className="text-[11px] text-gray-500">{m.email}</p>
                          </td>
                          <td className="px-4 py-3 tabular-nums">{m.totalLeads}</td>
                          <td className="px-4 py-3 tabular-nums">{m.activitiesInPeriod}</td>
                          <td className="px-4 py-3 tabular-nums">{m.emailsSent}</td>
                          <td className="px-4 py-3 tabular-nums">{m.needsFollowUp}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{m.needsHelp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {data?.personal && (
              <p className="text-xs text-gray-500 text-center">
                Individual account — metrics reflect your assigned pipeline only.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
