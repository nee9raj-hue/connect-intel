import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { hasWorkspaceFeature } from '../../lib/workspaceFeatures'
import {
  currentMonthKey,
  exportFieldVisitsCsv,
  formatInr,
  monthLabel,
} from '../../lib/fieldVisitExpenses'
import { formatDateTime } from '../../lib/crmUiConstants'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'

export default function FieldExpensesPanel({ onNavigate }) {
  const { user, teamMembers, openPipelineLead, refreshTeam } = useApp()
  const enabled = hasWorkspaceFeature(user, 'fieldVisitExpenses')
  const [month, setMonth] = useState(currentMonthKey())
  const [userId, setUserId] = useState('')
  const [visits, setVisits] = useState([])
  const [totals, setTotals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const canViewTeam = Boolean(user?.isOrgAdmin)

  const load = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ month })
      if (userId) q.set('userId', userId)
      const data = await api.getFieldVisitExpenses(q.toString())
      setVisits(data.visits || [])
      setTotals(data.totals || null)
    } catch (err) {
      setError(err.message)
      setVisits([])
      setTotals(null)
    } finally {
      setLoading(false)
    }
  }, [enabled, month, userId])

  useEffect(() => {
    if (enabled && user?.isOrgAdmin) refreshTeam?.()
  }, [enabled, user?.isOrgAdmin, refreshTeam])

  useEffect(() => {
    load()
  }, [load])

  const memberName = useMemo(() => {
    if (!userId) return null
    return teamMembers.find((m) => String(m.userId) === String(userId))?.name || 'Team member'
  }, [userId, teamMembers])

  if (!enabled) {
    return (
      <div className="panel-shell">
        <header className="shrink-0 bg-white border-b border-gray-200 px-4 md:px-5 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Field expenses</h1>
        </header>
        <div className="panel-body-scroll p-4 md:p-5 max-w-lg">
          <p className="text-sm text-[#516f90] leading-relaxed">
            Field visit & travel claims are not enabled for your workspace. Ask a company admin to turn
            on <strong>Field visit & travel claims</strong> under Team → Workspace modules.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="panel-shell field-expenses-panel">
      <header className="shrink-0 bg-white border-b border-[#dfe3eb] px-4 md:px-5 py-4">
        <h1 className="text-lg font-semibold text-[#33475b]">Field expenses</h1>
        <p className="text-xs text-[#516f90] mt-0.5">
          Logged field visits, travel distance, and claim totals for month-end HR export.
        </p>
        <div className="flex flex-wrap gap-2 mt-3 items-end">
          <label className="text-xs">
            <span className="block font-semibold text-[#516f90] mb-1">Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="text-sm border border-[#cbd6e2] rounded-md px-2 py-1.5"
            />
          </label>
          {canViewTeam ? (
            <label className="text-xs min-w-[10rem]">
              <span className="block font-semibold text-[#516f90] mb-1">Team member</span>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full text-sm border border-[#cbd6e2] rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">All team</option>
                {teamMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => exportFieldVisitsCsv(visits, month)}
            disabled={!visits.length}
            className="crm-btn crm-btn-secondary text-xs py-2"
          >
            Export CSV
          </button>
        </div>
      </header>

      <div className="panel-body-scroll p-4 md:p-5">
        {memberName ? (
          <div className="dashboard-team-filter-banner mb-4" role="status">
            <span>
              Showing <strong>{memberName}</strong> · {monthLabel(month)}
            </span>
            <button type="button" className="dashboard-team-filter-banner__clear" onClick={() => setUserId('')}>
              View all team
            </button>
          </div>
        ) : null}

        {totals ? (
          <div className="field-expenses-kpis mb-4">
            <div className="field-expenses-kpi">
              <span className="field-expenses-kpi__value">{totals.visitCount}</span>
              <span className="field-expenses-kpi__label">Visits</span>
            </div>
            <div className="field-expenses-kpi">
              <span className="field-expenses-kpi__value">{totals.totalKm}</span>
              <span className="field-expenses-kpi__label">Km (bike/car)</span>
            </div>
            <div className="field-expenses-kpi field-expenses-kpi--accent">
              <span className="field-expenses-kpi__value">{formatInr(totals.totalClaim)}</span>
              <span className="field-expenses-kpi__label">Total claim</span>
            </div>
          </div>
        ) : null}

        {loading ? (
          <LoadingExperience messages={LOADING_MESSAGES} />
        ) : error ? (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        ) : visits.length === 0 ? (
          <p className="text-sm text-[#516f90]">
            No field visits recorded for {monthLabel(month)}. Log visits from a lead&apos;s Tasks & meetings tab.
          </p>
        ) : (
          <div className="crm-content-card overflow-hidden">
            <table className="field-expenses-table w-full text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Lead</th>
                  <th>Route</th>
                  <th>Travel</th>
                  <th className="text-right">Claim</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td>{v.visitAt ? formatDateTime(v.visitAt) : '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="text-[#0091ae] hover:underline text-left"
                        onClick={() => openPipelineLead?.(v.leadId, 'schedule')}
                      >
                        {v.leadName}
                      </button>
                      {v.company ? <span className="block text-xs text-[#7c98b6]">{v.company}</span> : null}
                    </td>
                    <td className="text-xs text-[#516f90] max-w-[14rem]">
                      {v.startLocation || v.travel?.startLabel ? (
                        <span>{v.startLocation || v.travel?.startLabel} → </span>
                      ) : null}
                      {v.destination}
                    </td>
                    <td className="text-xs">
                      {v.travel?.modeLabel || '—'}
                      {v.travel?.distanceKm > 0 ? ` · ${v.travel.distanceKm} km` : ''}
                    </td>
                    <td className="text-right font-medium tabular-nums">
                      {v.claimAmount > 0 ? formatInr(v.claimAmount) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
