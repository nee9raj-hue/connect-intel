import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { getStatusMeta } from '../../lib/crmConstants'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'
import { formatDealValue } from '../../lib/crmTimeline'
import {
  DashboardKpiCard,
  DashboardSection,
  DashboardSegmented,
  DashboardEmpty,
} from '../dashboard/dashboardUi'
import { formatDelta, formatHours, formatShortDate } from '../../lib/teamIntelligenceConstants'
import {
  ActivityMixPie,
  ActivityTrendChart,
  PipelineFunnelChart,
  TeamHoursBarChart,
} from './TeamIntelligenceCharts'

const TEAM_KPIS = [
  { key: 'hoursInApp', label: 'Hours in app', intelKey: 'hoursInApp', format: 'hours', icon: 'team', nav: null },
  {
    key: 'contactsOpened',
    label: 'Contacts worked',
    intelKey: 'contactsOpened',
    icon: 'people',
    nav: 'pipeline',
    navOptions: { status: 'all' },
  },
  {
    key: 'emails',
    label: 'Emails sent',
    intelKey: 'emails',
    icon: 'mail',
    nav: 'crm-log',
    navOptions: { activityType: 'email' },
  },
  {
    key: 'calls',
    label: 'Calls logged',
    intelKey: 'calls',
    icon: 'log',
    nav: 'crm-log',
    navOptions: { activityType: 'call' },
  },
  {
    key: 'tasksCreated',
    label: 'Tasks created',
    intelKey: 'tasksCreated',
    icon: 'task',
    nav: 'crm-calendar',
    navOptions: { upcomingOnly: true },
  },
  {
    key: 'meetings',
    label: 'Meetings set',
    intelKey: 'meetings',
    icon: 'calendar',
    nav: 'crm-calendar',
    navOptions: { upcomingOnly: true },
  },
  {
    key: 'pipelineValue',
    label: 'Pipeline value',
    summaryKey: 'pipelineValue',
    format: 'currency',
    icon: 'chart',
    nav: 'pipeline',
    navOptions: { status: 'all' },
  },
  {
    key: 'wonValue',
    label: 'Won value',
    summaryKey: 'wonValue',
    format: 'currency',
    icon: 'chart',
    nav: 'pipeline',
    navOptions: { status: 'won' },
  },
]

const INSIGHT_STYLES = {
  highlight: 'intel-insight--highlight',
  concern: 'intel-insight--concern',
  metric: 'intel-insight--metric',
  transparency: 'intel-insight--info',
}

/** Team metrics block — embedded on the main Dashboard for managers and reps. */
export default function TeamIntelligenceSection({ onNavigate, isActive = true }) {
  const { user, teamMembers, openPipelineLead, setPipelineAssigneeFilter } = useApp()
  const [period, setPeriod] = useState('week')
  const [intelMemberId, setIntelMemberId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedMember, setExpandedMember] = useState(null)

  const memberUserId = intelMemberId
  const intel = data?.teamIntelligence
  const rollup = intel?.rollup || {}

  const isManagerView = Boolean(
    user?.isOrgAdmin || user?.orgRole === 'org_admin' || data?.isAdmin
  )

  const memberOptions = useMemo(() => {
    if (data?.memberOptions?.length) return data.memberOptions
    return (teamMembers || []).map((m) => ({ userId: m.userId, name: m.name }))
  }, [data?.memberOptions, teamMembers])

  const memberName = useMemo(() => {
    if (!memberUserId) return null
    const fromOptions = memberOptions.find((m) => String(m.userId) === String(memberUserId))
    if (fromOptions?.name) return fromOptions.name
    return 'Team member'
  }, [memberUserId, memberOptions])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ period })
      if (memberUserId) q.set('userId', memberUserId)
      const res = await api.getCrmTeamDashboard(q.toString())
      setData(res)
    } catch (e) {
      setError(e.message || 'Could not load team metrics')
    } finally {
      setLoading(false)
    }
  }, [period, memberUserId])

  useEffect(() => {
    if (!isActive) return undefined
    setData(null)
    load()
  }, [load, isActive])

  const preserveAssignee = () => {}

  const drillTo = (nav, options = {}) => {
    if (options.status) {
      onNavigate?.(nav, { status: options.status })
      return
    }
    if (nav === 'crm-calendar') {
      onNavigate?.(nav, { upcomingOnly: true, ...options })
      return
    }
    if (nav === 'crm-log') {
      if (memberUserId) setPipelineAssigneeFilter?.(memberUserId)
      onNavigate?.(nav, {
        activityType: options.activityType || null,
        assigneeUserId: memberUserId || null,
      })
      return
    }
    if (memberUserId && nav === 'pipeline') {
      setPipelineAssigneeFilter?.(memberUserId)
    }
    onNavigate?.(nav, options)
  }

  const onMemberRow = (m) => {
    setIntelMemberId(String(m.userId))
    setExpandedMember((prev) => (prev === m.userId ? null : m.userId))
  }

  const onMemberDrill = (m) => {
    onNavigate?.('pipeline', { assigneeUserId: m.userId })
  }

  const onMemberSelect = (e) => {
    const v = e.target.value
    setIntelMemberId(v || '')
    setExpandedMember(null)
    setPipelineAssigneeFilter?.(v || null)
  }

  const onInsightClick = (insight) => {
    if (insight.userId) {
      onNavigate?.('pipeline', { assigneeUserId: insight.userId })
      return
    }
    if (insight.userIds?.length === 1) {
      onNavigate?.('pipeline', { assigneeUserId: insight.userIds[0] })
    }
  }

  const summary = data?.summary || {}
  const comparison = intel?.comparison || {}
  const statusBreakdown = (data?.statusBreakdown || []).filter((r) => r.count > 0)

  const activityTotals = useMemo(() => {
    const days = data?.activityByDay || []
    return days.reduce(
      (acc, d) => ({
        calls: acc.calls + (d.call || 0),
        emails: acc.emails + (d.email || 0),
        tasksCreated: acc.tasksCreated + (d.task || 0),
        meetings: acc.meetings + (d.meeting || 0),
        whatsapp: acc.whatsapp + (d.whatsapp || 0),
        contactsOpened: acc.contactsOpened + (d.count > 0 ? 1 : 0),
      }),
      { calls: 0, emails: 0, tasksCreated: 0, meetings: 0, whatsapp: 0, contactsOpened: 0 }
    )
  }, [data?.activityByDay])

  const activityHighlights = useMemo(
    () => [
      {
        label: 'Tracked reps',
        value: (intel?.members?.length || memberOptions.length || 0).toLocaleString(),
      },
      {
        label: 'Active stages',
        value: statusBreakdown.length.toLocaleString(),
      },
      {
        label: 'Period',
        value: intel?.periodLabel || (period === 'week' ? 'This week' : 'This month'),
      },
    ],
    [intel?.members?.length, memberOptions.length, statusBreakdown.length, intel?.periodLabel, period]
  )

  if (!isActive) return null

  return (
    <div className="team-intelligence-embedded">
      <div className="team-intelligence-embedded__head">
        <div>
          <h2 className="team-intelligence-embedded__title">Team intelligence</h2>
          <p className="team-intelligence-embedded__subtitle">
            Activity, calls, and pipeline — filter by rep for weekly reviews
          </p>
        </div>
        <div className="team-intelligence-embedded__controls">
          <DashboardSegmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'week', label: 'This week' },
              { value: 'month', label: 'This month' },
            ]}
          />
        </div>
      </div>

      <div className="team-intelligence-hero-strip">
        {activityHighlights.map((item) => (
          <div key={item.label} className="team-intelligence-hero-stat">
            <span className="team-intelligence-hero-stat__label">{item.label}</span>
            <span className="team-intelligence-hero-stat__value">{item.value}</span>
          </div>
        ))}
      </div>

      {isManagerView && memberOptions.length > 0 ? (
        <div className="team-member-filter-bar">
          <label className="team-member-filter-bar__label">
            <span className="team-member-filter-bar__text">Team member</span>
            <select
              value={memberUserId}
              onChange={onMemberSelect}
              className="team-member-filter-bar__select dashboard-select"
              aria-label="Filter dashboard by team member"
            >
              <option value="">All team members</option>
              {memberOptions.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          {memberUserId && memberName ? (
            <button
              type="button"
              className="dashboard-team-filter-banner__clear"
              onClick={() => {
                setIntelMemberId('')
                setExpandedMember(null)
                setPipelineAssigneeFilter?.(null)
              }}
            >
              Clear filter
            </button>
          ) : null}
        </div>
      ) : null}

      {memberUserId && memberName ? (
        <div className="dashboard-team-filter-banner" role="status">
          <span>
            Showing metrics for <strong>{memberName}</strong>
          </span>
        </div>
      ) : null}

      {isManagerView ? (
        <div className="intel-transparency-banner" role="note">
          <strong>Manager view.</strong> Team members see their own stats. Admins can filter by rep for 1:1s and
          weekly team calls.
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
          className="rounded-2xl border border-[#dde3ea] min-h-[200px] bg-white"
        />
      ) : (
        <>
          <div className="team-intelligence-kpi-grid">
            {TEAM_KPIS.map((item) => {
              const intelVal = item.intelKey ? rollup[item.intelKey] : null
              const chartVal = item.intelKey ? activityTotals[item.intelKey] : null
              const summaryVal = item.summaryKey ? summary[item.summaryKey] : null
              const raw = intelVal ?? chartVal ?? summaryVal ?? 0
              let value = raw.toLocaleString()
              if (item.format === 'currency') value = formatDealValue(raw)
              if (item.format === 'hours') value = formatHours(raw)
              const delta = item.intelKey && comparison[item.intelKey]?.delta
              const clickable = Boolean(item.nav)
              return (
                <DashboardKpiCard
                  key={item.key}
                  className={`team-intelligence-kpi team-intelligence-kpi--${item.key}`}
                  icon={item.icon}
                  label={item.label}
                  value={value}
                  badge={delta != null ? formatDelta(delta) : null}
                  hint={delta != null ? 'vs previous period' : null}
                  onClick={
                    clickable
                      ? () => drillTo(item.nav, item.navOptions || {})
                      : undefined
                  }
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
              title={isManagerView && !memberUserId ? 'Team hours vs CRM actions' : 'Activity profile'}
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
                onClick={(status) => drillTo('pipeline', { status })}
              />
            </DashboardSection>
          </div>

          {intel?.members?.length ? (
            <DashboardSection
              title={memberUserId ? `${memberName || 'Member'} detail` : 'Team performance table'}
              subtitle="Click a row to expand or drill into pipeline"
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
                                      setIntelMemberId(String(m.userId))
                                      drillTo('crm-log')
                                    }}
                                  >
                                    Activity log
                                  </button>
                                  <button
                                    type="button"
                                    className="crm-btn crm-btn-sm crm-btn-secondary"
                                    onClick={() => {
                                      setIntelMemberId(String(m.userId))
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

          {intel?.trackingNote ? <p className="intel-tracking-note">{intel.trackingNote}</p> : null}

          {!intel?.members?.length && !loading ? (
            <DashboardEmpty>No team activity for this period yet. Log calls, emails, and tasks on leads.</DashboardEmpty>
          ) : null}
        </>
      )}
    </div>
  )
}
