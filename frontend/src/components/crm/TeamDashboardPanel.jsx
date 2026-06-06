import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
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
import { formatDelta, formatHours, formatShortDate } from '../../lib/teamIntelligenceConstants'
import {
  ActivityMixPie,
  ActivityTrendChart,
  PipelineFunnelChart,
  TeamHoursBarChart,
} from './TeamIntelligenceCharts'

const TEAM_KPIS = [
  { key: 'hoursInApp', label: 'Hours in app', intelKey: 'hoursInApp', format: 'hours', icon: 'team', nav: null },
  { key: 'contactsOpened', label: 'Contacts worked', intelKey: 'contactsOpened', icon: 'people', nav: 'pipeline' },
  { key: 'emails', label: 'Emails sent', intelKey: 'emails', icon: 'mail', nav: 'crm-log' },
  { key: 'calls', label: 'Calls logged', intelKey: 'calls', icon: 'log', nav: 'crm-log' },
  { key: 'tasksCreated', label: 'Tasks created', intelKey: 'tasksCreated', icon: 'task', nav: 'crm-calendar' },
  { key: 'meetings', label: 'Meetings set', intelKey: 'meetings', icon: 'calendar', nav: 'crm-calendar' },
  { key: 'pipelineValue', label: 'Pipeline value', summaryKey: 'pipelineValue', format: 'currency', icon: 'chart', nav: 'pipeline' },
  { key: 'wonValue', label: 'Won value', summaryKey: 'wonValue', format: 'currency', icon: 'chart', nav: 'pipeline', filter: 'won' },
]

const INSIGHT_STYLES = {
  highlight: 'intel-insight--highlight',
  concern: 'intel-insight--concern',
  metric: 'intel-insight--metric',
  transparency: 'intel-insight--info',
}

export default function TeamDashboardPanel({ onNavigate }) {
  const { user, teamMembers, pipelineAssigneeFilter, setPipelineAssigneeFilter, openPipelineLead } = useApp()
  const [period, setPeriod] = useState('week')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedMember, setExpandedMember] = useState(null)

  const memberUserId = pipelineAssigneeFilter || ''
  const intel = data?.teamIntelligence
  const rollup = intel?.rollup || {}

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

  const drillTo = (nav, options = {}) => {
    preserveAssignee()
    if (options.filter) {
      onNavigate?.(nav, { status: options.filter })
      return
    }
    if (nav === 'crm-calendar') {
      onNavigate?.(nav, { upcomingOnly: true })
      return
    }
    onNavigate?.(nav, options)
  }

  const onMemberRow = (m) => {
    setPipelineAssigneeFilter?.(m.userId)
    setExpandedMember((prev) => (prev === m.userId ? null : m.userId))
  }

  const onMemberDrill = (m) => {
    setPipelineAssigneeFilter?.(m.userId)
    onNavigate?.('pipeline')
  }

  const onMemberSelect = (e) => {
    const v = e.target.value
    setPipelineAssigneeFilter?.(v || null)
    setExpandedMember(null)
  }

  const onInsightClick = (insight) => {
    if (insight.userId) {
      setPipelineAssigneeFilter?.(insight.userId)
      onNavigate?.('pipeline')
      return
    }
    if (insight.userIds?.length === 1) {
      setPipelineAssigneeFilter?.(insight.userIds[0])
      onNavigate?.('pipeline')
    }
  }

  const summary = data?.summary || {}
  const comparison = intel?.comparison || {}
  const statusBreakdown = (data?.statusBreakdown || []).filter((r) => r.count > 0)

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
        <h2 className="text-lg font-semibold text-[#33475b] mb-2">Team intelligence not enabled</h2>
        <p className="leading-relaxed">
          Company admins can enable this under <strong>Team → Workspace modules</strong>.
        </p>
        <button type="button" className="mt-4 crm-btn crm-btn-primary" onClick={() => onNavigate?.('team')}>
          Workspace settings
        </button>
      </div>
    )
  }

  return (
    <DashboardShell
      title="Team intelligence"
      subtitle="Weekly review dashboard — activity, pipeline, and marketing for team calls"
      actions={headerActions}
    >
      {memberUserId && memberName ? (
        <div className="dashboard-team-filter-banner" role="status">
          <span>
            Reviewing <strong>{memberName}</strong>
          </span>
          <button
            type="button"
            className="dashboard-team-filter-banner__clear"
            onClick={() => {
              setPipelineAssigneeFilter?.(null)
              setExpandedMember(null)
            }}
          >
            View all team
          </button>
        </div>
      ) : null}

      {data?.isAdmin ? (
        <div className="intel-transparency-banner" role="note">
          <strong>Manager view.</strong> Team members can see their own stats. Admins see everyone — use this
          dashboard for weekly 1:1s and team syncs.
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
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 md:gap-3">
            {TEAM_KPIS.map((item) => {
              const intelVal = item.intelKey ? rollup[item.intelKey] : null
              const summaryVal = item.summaryKey ? summary[item.summaryKey] : null
              const raw = intelVal ?? summaryVal ?? 0
              let value = raw.toLocaleString()
              if (item.format === 'currency') value = formatDealValue(raw)
              if (item.format === 'hours') value = formatHours(raw)
              const delta = item.intelKey && comparison[item.intelKey]?.delta
              return (
                <DashboardKpiCard
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  value={value}
                  hint={delta != null ? `${formatDelta(delta)} vs prev period` : null}
                  onClick={() => item.nav && drillTo(item.nav, { filter: item.filter })}
                />
              )
            })}
          </div>

          {intel?.weeklyReview?.length ? (
            <DashboardSection title="Weekly review insights" subtitle="Talking points for your team call">
              <ul className="intel-insights-grid">
                {intel.weeklyReview.map((insight, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className={`intel-insight ${INSIGHT_STYLES[insight.kind] || ''}`}
                      onClick={() => onInsightClick(insight)}
                    >
                      <span className="intel-insight__title">{insight.title}</span>
                      <span className="intel-insight__body">{insight.body}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </DashboardSection>
          ) : null}

          <div className="intel-layout-main">
            <DashboardSection title="Activity trend" subtitle={`Stacked by channel · ${intel?.periodLabel || period}`}>
              <ActivityTrendChart data={data?.activityByDay || []} />
            </DashboardSection>

            <DashboardSection title="Activity mix">
              <ActivityMixPie data={intel?.activityMix || []} />
            </DashboardSection>
          </div>

          <div className="intel-layout-main">
            <DashboardSection
              title={data?.isAdmin && !memberUserId ? 'Team hours vs CRM actions' : 'Your activity profile'}
            >
              <TeamHoursBarChart members={intel?.members || []} />
            </DashboardSection>

            <DashboardSection title="Pipeline funnel" actionLabel="Open pipeline" onAction={() => drillTo('pipeline')}>
              <PipelineFunnelChart
                rows={statusBreakdown.map((r) => ({
                  status: r.status,
                  label: getStatusMeta(r.status)?.label || r.status,
                  count: r.count,
                }))}
                onClick={(status) => drillTo('pipeline', { filter: status })}
              />
            </DashboardSection>
          </div>

          {intel?.members?.length ? (
            <DashboardSection
              title={memberUserId ? `${memberName || 'Member'} detail` : 'Team performance table'}
              subtitle="Click a row to expand metrics or drill into pipeline"
              actionLabel="Activity log"
              onAction={() => drillTo('crm-log')}
            >
              <div className="dashboard-table-wrap -mx-4 -mb-1">
                <table className="dashboard-table intel-team-table">
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Hours</th>
                      <th>Contacts</th>
                      <th>Emails</th>
                      <th>Calls</th>
                      <th>Tasks</th>
                      <th>Meetings</th>
                      <th>CRM actions</th>
                      <th>Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {intel.members.map((m) => (
                      <Fragment key={m.userId}>
                        <tr
                          className={expandedMember === m.userId ? 'is-expanded' : ''}
                          onClick={() => onMemberRow(m)}
                        >
                          <td>
                            <span className="block font-medium">{m.name}</span>
                            <span className="block text-[0.6875rem] text-[#647185] mt-0.5">{m.email}</span>
                          </td>
                          <td className="tabular">{formatHours(m.hoursInApp)}</td>
                          <td className="tabular">{m.contactsOpened}</td>
                          <td className="tabular">{m.emails}</td>
                          <td className="tabular">{m.calls}</td>
                          <td className="tabular">
                            {m.tasksCreated}
                            {m.tasksCompleted ? ` / ${m.tasksCompleted}✓` : ''}
                          </td>
                          <td className="tabular">{m.meetings}</td>
                          <td className="tabular font-semibold text-[#00a4bd]">{m.activitiesTotal}</td>
                          <td className="text-[0.75rem]">{formatShortDate(m.lastActiveAt)}</td>
                        </tr>
                        {expandedMember === m.userId ? (
                          <tr className="intel-member-detail-row">
                            <td colSpan={9}>
                              <div className="intel-member-detail">
                                <div className="intel-member-detail__stats">
                                  <span>Active days: {m.activeDays}</span>
                                  <span>Leads touched: {m.leadsTouched}</span>
                                  <span>Notes: {m.notes}</span>
                                  <span>WhatsApp: {m.whatsapp}</span>
                                  <span>AI searches: {m.aiSearches}</span>
                                  <span>New leads: {m.newLeads}</span>
                                </div>
                                <div className="intel-member-detail__actions">
                                  <button type="button" className="crm-btn crm-btn-sm" onClick={() => onMemberDrill(m)}>
                                    Pipeline
                                  </button>
                                  <button
                                    type="button"
                                    className="crm-btn crm-btn-sm crm-btn-secondary"
                                    onClick={() => {
                                      setPipelineAssigneeFilter?.(m.userId)
                                      drillTo('crm-log')
                                    }}
                                  >
                                    Activity log
                                  </button>
                                  <button
                                    type="button"
                                    className="crm-btn crm-btn-sm crm-btn-secondary"
                                    onClick={() => {
                                      setPipelineAssigneeFilter?.(m.userId)
                                      drillTo('crm-calendar')
                                    }}
                                  >
                                    Calendar
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </DashboardSection>
          ) : null}

          <div className="intel-layout-main">
            {intel?.marketing ? (
              <DashboardSection
                title="Marketing snapshot"
                actionLabel="Campaign reports"
                onAction={() => drillTo('marketing', { tab: 'reports' })}
              >
                <div className="intel-marketing-grid">
                  <div className="intel-marketing-stat">
                    <span className="intel-marketing-stat__value">{intel.marketing.sent.toLocaleString()}</span>
                    <span className="intel-marketing-stat__label">Emails sent (all time)</span>
                  </div>
                  <div className="intel-marketing-stat">
                    <span className="intel-marketing-stat__value">{intel.marketing.openRate}%</span>
                    <span className="intel-marketing-stat__label">Open rate</span>
                  </div>
                  <div className="intel-marketing-stat">
                    <span className="intel-marketing-stat__value">{intel.marketing.clickRate}%</span>
                    <span className="intel-marketing-stat__label">Click rate</span>
                  </div>
                  <div className="intel-marketing-stat">
                    <span className="intel-marketing-stat__value">{intel.marketing.campaignCount}</span>
                    <span className="intel-marketing-stat__label">Campaigns</span>
                  </div>
                </div>
              </DashboardSection>
            ) : null}

            <DashboardSection
              title="Quick drill-down"
              subtitle="Jump to CRM areas for live review on calls"
            >
              <div className="intel-quick-nav">
                {[
                  { label: 'Pipeline', panel: 'pipeline', icon: 'pipeline' },
                  { label: 'Activity log', panel: 'crm-log', icon: 'log' },
                  { label: 'Calendar', panel: 'crm-calendar', icon: 'calendar' },
                  { label: 'Marketing', panel: 'marketing', icon: 'mail', opts: { tab: 'campaigns' } },
                  { label: 'Team hub', panel: 'chithi', icon: 'team' },
                  { label: 'Active customers', panel: 'active-customers', icon: 'people' },
                ].map((item) => (
                  <button
                    key={item.panel}
                    type="button"
                    className="intel-quick-nav__btn"
                    onClick={() => drillTo(item.panel, item.opts)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </DashboardSection>
          </div>

          {data?.teamSnapshot?.communication?.recent?.length ? (
            <DashboardSection
              title="Recent team communication"
              actionLabel="View all"
              onAction={() => drillTo('crm-log')}
            >
              <ul className="intel-recent-list">
                {data.teamSnapshot.communication.recent.map((row, i) => (
                  <li key={`${row.leadId}-${i}`}>
                    <button
                      type="button"
                      className="intel-recent-row"
                      onClick={() => {
                        preserveAssignee()
                        if (row.leadId) openPipelineLead(row.leadId)
                        else onNavigate?.('pipeline')
                      }}
                    >
                      <span className="intel-recent-row__lead">{row.leadName}</span>
                      <span className="intel-recent-row__summary">{row.summary || row.type}</span>
                      <span className="intel-recent-row__date">{formatShortDate(row.at)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </DashboardSection>
          ) : null}

          {intel?.trackingNote ? (
            <p className="intel-tracking-note">{intel.trackingNote}</p>
          ) : null}

          {!intel?.members?.length && !loading ? (
            <DashboardEmpty>No team activity for this period yet. Log calls, emails, and tasks in the pipeline.</DashboardEmpty>
          ) : null}
        </>
      )}
    </DashboardShell>
  )
}
