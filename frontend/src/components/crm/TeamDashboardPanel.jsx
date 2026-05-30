import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { getStatusMeta } from '../../lib/crmConstants'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'
import { formatDealValue } from '../../lib/crmTimeline'
import {
  DashboardShell,
  DashboardKpiCard,
  DashboardSection,
  DashboardSegmented,
  DashboardEmpty,
} from '../dashboard/dashboardUi'
import { hasWorkspaceFeature } from '../../lib/workspaceFeatures'

const KPI = [
  { key: 'totalLeads', label: 'Pipeline leads', nav: 'pipeline', icon: 'pipeline' },
  { key: 'pipelineValue', label: 'Pipeline value', nav: 'pipeline', format: 'currency', icon: 'chart' },
  {
    key: 'weightedPipelineValue',
    label: 'Weighted forecast',
    nav: 'pipeline',
    format: 'currency',
    icon: 'chart',
  },
  { key: 'wonValue', label: 'Won value', nav: 'pipeline', filter: 'won', format: 'currency', icon: 'chart' },
  { key: 'avgLeadScore', label: 'Avg lead score', nav: 'pipeline', icon: 'pipeline' },
  { key: 'staleLeads', label: 'Stale 7d+', nav: 'pipeline', icon: 'pipeline' },
  { key: 'activitiesInPeriod', label: 'Activities', nav: 'crm-log', icon: 'log' },
  { key: 'emailsSent', label: 'Emails sent', nav: 'crm-log', icon: 'mail' },
  { key: 'meetingsUpcoming', label: 'Upcoming meetings', nav: 'crm-calendar', icon: 'calendar' },
  { key: 'needsFollowUp', label: 'Follow-up due', nav: 'pipeline', filter: 'follow_up', icon: 'task' },
  { key: 'won', label: 'Won deals', nav: 'pipeline', filter: 'won', icon: 'pipeline' },
]

export default function TeamDashboardPanel({ onNavigate }) {
  const { user, teamMembers, pipelineAssigneeFilter, setPipelineAssigneeFilter } = useApp()
  const [period, setPeriod] = useState('week')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const memberUserId = pipelineAssigneeFilter || ''

  const memberName = useMemo(() => {
    if (!memberUserId) return null
    const fromOptions = data?.memberOptions?.find((m) => String(m.userId) === String(memberUserId))
    if (fromOptions?.name) return fromOptions.name
    const fromTeam = teamMembers.find((m) => String(m.userId) === String(memberUserId))
    return fromTeam?.name || 'Team member'
  }, [memberUserId, data?.memberOptions, teamMembers])

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
    setData(null)
    load()
  }, [load])

  const preserveAssignee = () => {
    if (memberUserId) setPipelineAssigneeFilter?.(memberUserId)
  }

  const onKpiClick = (item) => {
    preserveAssignee()
    if (item.nav === 'crm-calendar') {
      onNavigate?.('crm-calendar', { upcomingOnly: true })
      return
    }
    if (item.filter) {
      onNavigate?.(item.nav, { status: item.filter })
      return
    }
    onNavigate?.(item.nav)
  }

  const onFunnelClick = (status) => {
    preserveAssignee()
    onNavigate?.('pipeline', { status })
  }

  const onMemberRow = (m) => {
    setPipelineAssigneeFilter?.(m.userId)
    onNavigate?.('pipeline')
  }

  const onMemberSelect = (e) => {
    const v = e.target.value
    setPipelineAssigneeFilter?.(v || null)
  }

  const summary = data?.summary || {}
  const maxActivity = Math.max(1, ...(data?.activityByDay || []).map((d) => d.count))

  const headerActions = (
    <>
      <DashboardSegmented
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'week', label: 'This week' },
          { value: 'month', label: 'This month' },
        ]}
      />
      {data?.isAdmin && data?.memberOptions?.length > 0 ? (
        <select
          value={memberUserId}
          onChange={onMemberSelect}
          className="dashboard-select"
          aria-label="Filter by team member"
        >
          <option value="">All team members</option>
          {data.memberOptions.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
      ) : null}
    </>
  )

  if (user && !hasWorkspaceFeature(user, 'homeTeamMetrics')) {
    return (
      <div className="p-8 text-center text-sm text-[#516f90] max-w-md mx-auto">
        <h2 className="text-lg font-semibold text-[#33475b] mb-2">Team metrics not enabled</h2>
        <p className="leading-relaxed">
          This page is optional. Company admins can enable it under <strong>Team → Workspace modules</strong>.
        </p>
        <button
          type="button"
          className="mt-4 crm-btn crm-btn-primary"
          onClick={() => onNavigate?.('team')}
        >
          Workspace settings
        </button>
      </div>
    )
  }

  return (
    <DashboardShell title="Team metrics" actions={headerActions}>
      {memberUserId && memberName ? (
        <div className="dashboard-team-filter-banner" role="status">
          <span>
            Viewing <strong>{memberName}</strong>&apos;s metrics
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

      {error ? (
        <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2 font-medium">
          {error}
        </p>
      ) : null}

      {loading && !data ? (
        <LoadingExperience
          message={LOADING_MESSAGES.team}
          fill={false}
          className="rounded-2xl border border-[#dde3ea] min-h-[240px] bg-white"
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
            {KPI.map((item) => (
              <DashboardKpiCard
                key={item.key}
                icon={item.icon}
                label={item.label}
                value={
                  item.format === 'currency'
                    ? formatDealValue(summary[item.key])
                    : (summary[item.key] ?? 0).toLocaleString()
                }
                onClick={() => onKpiClick(item)}
              />
            ))}
          </div>

          <div className="dashboard-layout-2-1">
            <DashboardSection title={`Activity (${period === 'week' ? '7 days' : '30 days'})`}>
              <div className="dashboard-chart-bars">
                {(data?.activityByDay || []).map((day) => (
                  <div key={day.date} className="dashboard-chart-bar" title={`${day.count} activities`}>
                    <div
                      className="dashboard-chart-bar__fill"
                      style={{ height: `${Math.max(4, (day.count / maxActivity) * 100)}%` }}
                    />
                    <span className="dashboard-chart-bar__label">{day.label}</span>
                  </div>
                ))}
              </div>
              {summary.activitiesInPeriod === 0 && summary.totalLeads > 0 ? (
                <p className="text-[0.6875rem] font-medium text-[#647185] mt-3">No activity</p>
              ) : null}
            </DashboardSection>

            <DashboardSection title="Pipeline funnel">
              <ul className="space-y-2.5">
                {(data?.statusBreakdown || []).map((row) => {
                  const meta = getStatusMeta(row.status)
                  const total = summary.totalLeads || 1
                  const pct = Math.min(100, Math.round((row.count / total) * 100))
                  return (
                    <li key={row.status}>
                      <button
                        type="button"
                        className="dashboard-funnel-row dashboard-funnel-row--clickable w-full text-left"
                        onClick={() => onFunnelClick(row.status)}
                      >
                        <div className="dashboard-funnel-row__head">
                          <span>{meta?.label || row.status}</span>
                          <span>{row.count}</span>
                        </div>
                        <div className="dashboard-funnel-row__track">
                          <div className="dashboard-funnel-row__fill" style={{ width: `${pct}%` }} />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {!data?.statusBreakdown?.length ? (
                <DashboardEmpty>No pipeline data for this period.</DashboardEmpty>
              ) : null}
            </DashboardSection>
          </div>

          {data?.members?.length > 0 ? (
            <DashboardSection title={memberUserId ? `${memberName || 'Member'} performance` : 'Team performance'}>
              <div className="dashboard-table-wrap -mx-4 -mb-1">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Leads</th>
                      <th>Activities</th>
                      <th>Emails</th>
                      <th>Follow-ups</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((m) => (
                      <tr key={m.userId} onClick={() => onMemberRow(m)}>
                        <td>
                          <span className="block">{m.name}</span>
                          <span className="block text-[0.6875rem] font-medium text-[#647185] mt-0.5">
                            {m.email}
                          </span>
                        </td>
                        <td className="tabular">{m.totalLeads}</td>
                        <td className="tabular">{m.activitiesInPeriod}</td>
                        <td className="tabular">{m.emailsSent}</td>
                        <td className="tabular">{m.needsFollowUp}</td>
                        <td className="text-[0.75rem]">{m.needsHelp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DashboardSection>
          ) : null}
        </>
      )}
    </DashboardShell>
  )
}
