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
  DashboardEmpty,
} from '../dashboard/dashboardUi'
import { buildActivityLogQuery, pipelineOptsFromActivityFilters } from '../../lib/activityDashboardNav'
import ActivityDashboardFilters from './ActivityDashboardFilters'
import { formatDelta, formatHours, formatShortDate } from '../../lib/teamIntelligenceConstants'
import { ACTIVITY_LABELS, formatDateTime } from '../../lib/crmUiConstants'
import {
  ActivityMixPie,
  ActivityTrendChart,
  PipelineFunnelChart,
  TeamHoursBarChart,
} from './TeamIntelligenceCharts'
import { mergeMemberOptions } from '../../lib/memberOptions'
import { isFreightDealOrg } from '../../lib/freightDeal'

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
    nav: 'crm-log',
    navOptions: { activityType: 'task' },
  },
  {
    key: 'meetings',
    label: 'Meetings set',
    intelKey: 'meetings',
    icon: 'calendar',
    nav: 'crm-log',
    navOptions: { activityType: 'meeting' },
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
  const { user, teamMembers, openPipelineLead, setPipelineAssigneeFilter, orgLeadTags, refreshTeam } = useApp()
  const [period, setPeriod] = useState('week')
  const [intelMemberId, setIntelMemberId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('')
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedMember, setExpandedMember] = useState(null)

  const memberUserId = intelMemberId
  const activeMemberId = data?.memberUserId ?? memberUserId
  const intel = data?.teamIntelligence
  const rollup = intel?.rollup || {}
  const isFilteredMember = Boolean(activeMemberId)

  const isManagerView = Boolean(
    user?.isOrgAdmin || user?.orgRole === 'org_admin' || user?.orgRole === 'manager' || data?.isAdmin || data?.isManager
  )

  const memberOptions = useMemo(
    () => mergeMemberOptions(teamMembers, data?.memberOptions),
    [teamMembers, data?.memberOptions]
  )

  useEffect(() => {
    if (!isActive) return undefined
    void refreshTeam()
  }, [isActive, refreshTeam])

  const memberName = useMemo(() => {
    if (!activeMemberId) return null
    const fromOptions = memberOptions.find((m) => String(m.userId) === String(activeMemberId))
    if (fromOptions?.name) return fromOptions.name
    const fromIntel = intel?.members?.find((m) => String(m.userId) === String(activeMemberId))
    return fromIntel?.name || 'Team member'
  }, [activeMemberId, memberOptions, intel?.members])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query = buildActivityLogQuery({
        period: useCustomRange ? undefined : period,
        memberUserId: memberUserId,
        status: statusFilter,
        tagId: tagFilter,
        from: useCustomRange ? fromDate : '',
        to: useCustomRange ? toDate : '',
      })
      const res = await api.getCrmTeamMetrics(query)
      setData(res)
    } catch (e) {
      setError(e.message || 'Could not load team metrics')
    } finally {
      setLoading(false)
    }
  }, [period, memberUserId, statusFilter, tagFilter, useCustomRange, fromDate, toDate])

  useEffect(() => {
    if (!isActive) return undefined
    load()
  }, [load, isActive])

  useEffect(() => {
    if (data?.memberUserId == null && intelMemberId) return
    if (data?.memberUserId && String(data.memberUserId) !== String(intelMemberId)) {
      setIntelMemberId(String(data.memberUserId))
    }
  }, [data?.memberUserId, intelMemberId])

  const scopedUserId = memberUserId || activeMemberId || null

  const freightOrg = isFreightDealOrg(user)

  const openLeadInPipeline = useCallback(
    (leadId) => {
      if (scopedUserId) setPipelineAssigneeFilter?.(scopedUserId)
      openPipelineLead(leadId)
      onNavigate?.(
        'pipeline',
        scopedUserId ? { userId: scopedUserId, assigneeUserId: scopedUserId } : {}
      )
    },
    [scopedUserId, setPipelineAssigneeFilter, openPipelineLead, onNavigate]
  )

  const drillTo = (nav, options = {}) => {
    const filterOpts = pipelineOptsFromActivityFilters({
      period: useCustomRange ? 'custom' : period,
      memberUserId: scopedUserId,
      status: statusFilter,
      tagId: tagFilter,
    })
    const sharedOpts = scopedUserId ? { userId: scopedUserId, assigneeUserId: scopedUserId } : {}

    if (options.status) {
      if (scopedUserId && nav === 'pipeline') setPipelineAssigneeFilter?.(scopedUserId)
      if (nav === 'pipeline' && options.status === 'won' && freightOrg) {
        onNavigate?.('pipeline', { view: 'deals', dealStage: 'won', ...filterOpts, ...sharedOpts })
        return
      }
      onNavigate?.(nav, { status: options.status, ...filterOpts, ...sharedOpts })
      return
    }
    if (nav === 'crm-calendar') {
      onNavigate?.(nav, { upcomingOnly: true, ...options, ...sharedOpts })
      return
    }
    if (nav === 'crm-log') {
      if (scopedUserId) setPipelineAssigneeFilter?.(scopedUserId)
      onNavigate?.(nav, {
        activityType: options.activityType || null,
        period: useCustomRange ? undefined : period,
        from: useCustomRange ? fromDate : undefined,
        to: useCustomRange ? toDate : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        tagId: tagFilter || undefined,
        ...sharedOpts,
      })
      return
    }
    if (scopedUserId && nav === 'pipeline') {
      setPipelineAssigneeFilter?.(scopedUserId)
    }
    onNavigate?.(nav, { ...filterOpts, ...options, ...sharedOpts })
  }

  const onMemberRow = (m) => {
    const uid = String(m.userId)
    setIntelMemberId(uid)
    setPipelineAssigneeFilter?.(uid)
    setExpandedMember((prev) => (prev === m.userId ? null : m.userId))
  }

  const onMemberDrill = (m) => {
    setPipelineAssigneeFilter?.(m.userId)
    onNavigate?.('pipeline', { status: 'all', userId: m.userId })
  }

  const onMemberSelect = (e) => {
    const v = e.target.value
    setIntelMemberId(v || '')
    setExpandedMember(null)
    setPipelineAssigneeFilter?.(v || null)
  }

  const onInsightClick = (insight) => {
    const uid = insight.userId || (insight.userIds?.length === 1 ? insight.userIds[0] : null)
    if (!uid) return
    setPipelineAssigneeFilter?.(uid)
    onNavigate?.('pipeline', { status: 'all', userId: uid })
  }

  const summary = data?.summary || {}
  const comparison = intel?.comparison || {}
  const statusBreakdown = (data?.statusBreakdown || []).filter((r) => r.count > 0)
  const recentActivities = data?.recentActivities || []
  const recentCalls = useMemo(
    () => recentActivities.filter((a) => a.type === 'call').slice(0, 6),
    [recentActivities]
  )
  const recentContacts = useMemo(() => {
    const seen = new Set()
    const rows = []
    for (const act of recentActivities) {
      if (!act.leadId || seen.has(act.leadId)) continue
      seen.add(act.leadId)
      rows.push(act)
      if (rows.length >= 6) break
    }
    return rows
  }, [recentActivities])

  const periodLabelText = data?.periodLabel || intel?.periodLabel ||
    (period === 'day' ? 'Today' : period === 'month' ? 'This month' : 'This week')
  const activityHighlights = useMemo(
    () => [
      {
        label: 'Tracked reps',
        value: (isFilteredMember ? 1 : intel?.members?.length || memberOptions.length || 0).toLocaleString(),
      },
      {
        label: 'Active stages',
        value: statusBreakdown.length.toLocaleString(),
      },
      {
        label: 'Period',
        value: periodLabelText,
      },
    ],
    [isFilteredMember, intel?.members?.length, memberOptions.length, statusBreakdown.length, periodLabelText]
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
          <ActivityDashboardFilters
            period={period}
            onPeriodChange={setPeriod}
            memberUserId={intelMemberId}
            onMemberChange={(id) => {
              setIntelMemberId(id || '')
              setExpandedMember(null)
              setPipelineAssigneeFilter?.(id || null)
            }}
            memberOptions={memberOptions}
            showMemberFilter={isManagerView}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            tagId={tagFilter}
            onTagChange={setTagFilter}
            orgLeadTags={orgLeadTags || []}
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={setFromDate}
            onToDateChange={setToDate}
            useCustomRange={useCustomRange}
            onUseCustomRangeChange={setUseCustomRange}
          />
          {isManagerView ? (
            <button
              type="button"
              className="crm-btn crm-btn-secondary crm-btn-sm"
              onClick={() =>
                onNavigate?.('crm-dashboard', {
                  period,
                  userId: intelMemberId || undefined,
                })
              }
            >
              Full review
            </button>
          ) : null}
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

      {activeMemberId && memberName ? (
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
          {loading ? (
            <p className="text-xs text-[#647185] mb-2" role="status">
              Updating metrics…
            </p>
          ) : null}
          <div className="team-intelligence-kpi-grid" key={`${period}-${activeMemberId || 'all'}`}>
            {TEAM_KPIS.map((item) => {
              let raw = 0
              if (item.intelKey) {
                raw = rollup[item.intelKey] ?? 0
              } else if (item.summaryKey) {
                raw = summary[item.summaryKey] ?? 0
              }
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

          {recentContacts.length > 0 || recentCalls.length > 0 ? (
            <div className="team-intelligence-recent-grid">
              {recentContacts.length > 0 ? (
                <DashboardSection
                  title="Contacts worked"
                  subtitle="Leads touched this period — open for full timeline"
                  actionLabel="View all"
                  onAction={() => drillTo('crm-log')}
                >
                  <ul className="team-intelligence-recent-list">
                    {recentContacts.map((act) => (
                      <li key={`${act.leadId}-${act.id}`}>
                        <button
                          type="button"
                          className="team-intelligence-recent-row"
                          onClick={() => openLeadInPipeline(act.leadId)}
                        >
                          <span className="team-intelligence-recent-row__title">
                            {act.leadName}
                            {act.company && act.company !== act.leadName ? ` · ${act.company}` : ''}
                          </span>
                          <span className="team-intelligence-recent-row__meta">
                            {ACTIVITY_LABELS[act.type] || act.type} · {formatDateTime(act.createdAt)}
                          </span>
                          {act.summary ? (
                            <span className="team-intelligence-recent-row__summary">{act.summary}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </DashboardSection>
              ) : null}
              {recentCalls.length > 0 ? (
                <DashboardSection
                  title="Calls logged"
                  subtitle="Outbound and incoming calls with remarks"
                  actionLabel="Call log"
                  onAction={() => drillTo('crm-log', { activityType: 'call' })}
                >
                  <ul className="team-intelligence-recent-list">
                    {recentCalls.map((act) => (
                      <li key={act.id}>
                        <button
                          type="button"
                          className="team-intelligence-recent-row"
                          onClick={() => openLeadInPipeline(act.leadId)}
                        >
                          <span className="team-intelligence-recent-row__title">
                            {act.leadName}
                            {act.company && act.company !== act.leadName ? ` · ${act.company}` : ''}
                          </span>
                          <span className="team-intelligence-recent-row__meta">
                            {act.createdByName || 'Rep'} · {formatDateTime(act.createdAt)}
                          </span>
                          {act.summary ? (
                            <span className="team-intelligence-recent-row__summary">{act.summary}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </DashboardSection>
              ) : null}
            </div>
          ) : null}

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
              title={isFilteredMember ? `${memberName || 'Member'} detail` : 'Team performance table'}
              subtitle={
                isFilteredMember
                  ? 'Individual metrics for the selected rep'
                  : 'Click a row to filter the dashboard to that rep'
              }
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
                          <td className="tabular font-semibold text-[#FF773D]">{m.activitiesTotal}</td>
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
