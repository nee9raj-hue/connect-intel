import { useCallback, useEffect, useMemo, useState } from 'react'
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
import {
  formatDelta,
  formatHours,
  formatShortDate,
  timelineTypeLabel,
} from '../../lib/teamIntelligenceConstants'
import { ACTIVITY_LABELS, formatDateTime } from '../../lib/crmUiConstants'
import {
  ActivityMixPie,
  ActivityTrendChart,
  PipelineFunnelChart,
  TeamHoursBarChart,
} from './TeamIntelligenceCharts'

const TEAM_KPIS = [
  { key: 'hoursInApp', label: 'Hours in CRM', intelKey: 'hoursInApp', format: 'hours', icon: 'team' },
  { key: 'contactsOpened', label: 'Contacts worked', intelKey: 'contactsOpened', icon: 'people' },
  { key: 'emails', label: 'Emails sent', intelKey: 'emails', icon: 'mail' },
  { key: 'calls', label: 'Calls logged', intelKey: 'calls', icon: 'log' },
  { key: 'tasksCreated', label: 'Tasks created', intelKey: 'tasksCreated', icon: 'task' },
  { key: 'meetings', label: 'Meetings set', intelKey: 'meetings', icon: 'calendar' },
]

const TIMELINE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'call', label: 'Calls' },
  { id: 'email', label: 'Emails' },
  { id: 'deal', label: 'Deals' },
  { id: 'task', label: 'Tasks' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'note', label: 'Notes' },
]

function matchesTimelineFilter(item, filter) {
  if (!filter || filter === 'all') return true
  if (filter === 'deal') return item.kind === 'deal' || String(item.type || '').startsWith('deal_')
  if (filter === 'task') return item.kind === 'task' || String(item.type || '').startsWith('task')
  if (filter === 'meeting') return item.kind === 'meeting' || item.type === 'field_visit'
  return String(item.type || '').toLowerCase() === filter
}

export default function TeamIntelligencePanel({ onNavigate, panelOptions = {}, isActive = true }) {
  const { user, teamMembers, openPipelineLead, setPipelineAssigneeFilter } = useApp()
  const [period, setPeriod] = useState(panelOptions?.period || 'week')
  const [memberUserId, setMemberUserId] = useState(panelOptions?.userId || '')
  const [timelineFilter, setTimelineFilter] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const intel = data?.teamIntelligence
  const rollup = intel?.rollup || {}
  const isManagerView = Boolean(user?.isOrgAdmin || user?.orgRole === 'org_admin' || data?.isAdmin)

  const memberOptions = useMemo(() => {
    if (data?.memberOptions?.length) return data.memberOptions
    return (teamMembers || []).map((m) => ({ userId: m.userId, name: m.name }))
  }, [data?.memberOptions, teamMembers])

  const activeMemberId = data?.memberUserId ?? memberUserId

  const memberName = useMemo(() => {
    if (!activeMemberId) return null
    return (
      memberOptions.find((m) => String(m.userId) === String(activeMemberId))?.name ||
      intel?.members?.find((m) => String(m.userId) === String(activeMemberId))?.name ||
      'Team member'
    )
  }, [activeMemberId, memberOptions, intel?.members])

  const selectedMemberProfile = useMemo(() => {
    if (!activeMemberId || !intel?.members?.length) return null
    return intel.members.find((m) => String(m.userId) === String(activeMemberId)) || null
  }, [activeMemberId, intel?.members])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({ period, detailed: '1' })
      if (memberUserId) q.set('userId', memberUserId)
      const res = await api.getCrmTeamDashboard(q.toString())
      setData(res)
    } catch (e) {
      setError(e.message || 'Could not load team intelligence')
    } finally {
      setLoading(false)
    }
  }, [period, memberUserId])

  useEffect(() => {
    if (!isActive) return undefined
    load()
  }, [load, isActive])

  useEffect(() => {
    if (panelOptions?.userId) setMemberUserId(String(panelOptions.userId))
    if (panelOptions?.period) setPeriod(panelOptions.period)
  }, [panelOptions?.userId, panelOptions?.period])

  const selectMember = (uid) => {
    const id = uid ? String(uid) : ''
    setMemberUserId(id)
    setPipelineAssigneeFilter?.(id || null)
    setTimelineFilter('all')
  }

  const filteredTimeline = useMemo(() => {
    const rows = data?.activityTimeline || []
    return rows.filter((item) => matchesTimelineFilter(item, timelineFilter))
  }, [data?.activityTimeline, timelineFilter])

  const statusBreakdown = (data?.statusBreakdown || []).filter((r) => r.count > 0)
  const memberUsage = data?.memberUsage
  const periodLabel = intel?.periodLabel || period

  if (!isActive) return null

  return (
    <div className="panel-shell team-intel-page">
      <header className="team-intel-page__header shrink-0">
        <div className="team-intel-page__header-main">
          <h1 className="team-intel-page__title">Team intelligence</h1>
          <p className="team-intel-page__subtitle">
            Manager review — rep activity, calls with remarks, deals, and CRM time
          </p>
        </div>
        <div className="team-intel-page__header-actions">
          <DashboardSegmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'day', label: 'Today' },
              { value: 'week', label: 'This week' },
              { value: 'month', label: 'This month' },
            ]}
          />
          <button type="button" className="crm-btn crm-btn-secondary crm-btn-sm" onClick={() => onNavigate?.('overview')}>
            Dashboard
          </button>
        </div>
      </header>

      <div className="team-intel-page__body panel-body-scroll">
        {error ? (
          <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-3 py-2 font-medium mb-4">
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
          <div className="team-intel-page__layout">
            {isManagerView && memberOptions.length > 0 ? (
              <aside className="team-intel-roster" aria-label="Team roster">
                <p className="team-intel-roster__title">Team</p>
                <button
                  type="button"
                  className={`team-intel-roster__item${!activeMemberId ? ' is-active' : ''}`}
                  onClick={() => selectMember('')}
                >
                  <span className="team-intel-roster__name">All team</span>
                  <span className="team-intel-roster__meta">{intel?.members?.length || 0} reps</span>
                </button>
                {(intel?.members || []).map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    className={`team-intel-roster__item${String(activeMemberId) === String(m.userId) ? ' is-active' : ''}`}
                    onClick={() => selectMember(m.userId)}
                  >
                    <span className="team-intel-roster__name">{m.name}</span>
                    <span className="team-intel-roster__meta">
                      {m.activitiesTotal || 0} actions · {formatHours(m.hoursInApp)}
                    </span>
                  </button>
                ))}
              </aside>
            ) : null}

            <div className="team-intel-page__main">
              {loading ? (
                <p className="text-xs text-[#647185] mb-3" role="status">
                  Updating…
                </p>
              ) : null}

              {activeMemberId && memberName ? (
                <div className="team-intel-profile" role="status">
                  <div>
                    <h2 className="team-intel-profile__name">{memberName}</h2>
                    <p className="team-intel-profile__period">{periodLabel} performance review</p>
                  </div>
                  {selectedMemberProfile ? (
                    <div className="team-intel-profile__stats">
                      <span>{formatHours(selectedMemberProfile.hoursInApp)} in app</span>
                      <span>{selectedMemberProfile.contactsOpened} contacts</span>
                      <span>{selectedMemberProfile.calls} calls</span>
                      <span>Last active {formatShortDate(selectedMemberProfile.lastActiveAt)}</span>
                    </div>
                  ) : null}
                </div>
              ) : isManagerView ? (
                <p className="team-intel-hint">
                  Select a rep from the team list to review their detailed activity timeline.
                </p>
              ) : null}

              <div className="team-intelligence-kpi-grid team-intel-page__kpis">
                {TEAM_KPIS.map((item) => {
                  const raw = rollup[item.intelKey] ?? 0
                  let value = raw.toLocaleString()
                  if (item.format === 'hours') value = formatHours(raw)
                  const delta = intel?.comparison?.[item.intelKey]?.delta
                  return (
                    <DashboardKpiCard
                      key={item.key}
                      className={`team-intelligence-kpi team-intelligence-kpi--${item.key}`}
                      icon={item.icon}
                      label={item.label}
                      value={value}
                      badge={delta != null ? formatDelta(delta) : null}
                      hint={delta != null ? 'vs previous period' : null}
                    />
                  )
                })}
              </div>

              {memberUsage ? (
                <DashboardSection title="CRM time" subtitle="Active minutes tracked while using Connect Intel">
                  <div className="team-intel-usage-grid">
                    <div className="team-intel-usage-stat">
                      <span className="team-intel-usage-stat__label">Total time</span>
                      <span className="team-intel-usage-stat__value">{formatHours(memberUsage.hours)}</span>
                    </div>
                    <div className="team-intel-usage-stat">
                      <span className="team-intel-usage-stat__label">Active days</span>
                      <span className="team-intel-usage-stat__value">{memberUsage.activeDays}</span>
                    </div>
                    <div className="team-intel-usage-stat">
                      <span className="team-intel-usage-stat__label">Leads opened</span>
                      <span className="team-intel-usage-stat__value">{memberUsage.leadsOpened}</span>
                    </div>
                    <div className="team-intel-usage-stat">
                      <span className="team-intel-usage-stat__label">Last pulse</span>
                      <span className="team-intel-usage-stat__value">{formatDateTime(memberUsage.lastActiveAt)}</span>
                    </div>
                  </div>
                  {memberUsage.daily?.length ? (
                    <ul className="team-intel-usage-daily">
                      {memberUsage.daily.map((row) => (
                        <li key={row.date} className="team-intel-usage-daily__row">
                          <span>{formatShortDate(row.date)}</span>
                          <span className="team-intel-usage-daily__bar-wrap">
                            <span
                              className="team-intel-usage-daily__bar"
                              style={{ width: `${Math.min(100, (row.minutes / 120) * 100)}%` }}
                            />
                          </span>
                          <span>{formatHours(row.hours)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </DashboardSection>
              ) : null}

              <DashboardSection
                title="Detailed activity"
                subtitle={
                  activeMemberId
                    ? `Calls, emails, deals, tasks — ${memberName}`
                    : 'Select a rep for the fullest timeline'
                }
                actionLabel="Activity log"
                onAction={() =>
                  onNavigate?.('crm-log', {
                    period,
                    userId: activeMemberId || undefined,
                  })
                }
              >
                <div className="team-intel-timeline-filters">
                  {TIMELINE_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`team-intel-timeline-filters__btn${timelineFilter === f.id ? ' is-active' : ''}`}
                      onClick={() => setTimelineFilter(f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {!filteredTimeline.length ? (
                  <DashboardEmpty>
                    No {timelineFilter === 'all' ? '' : `${timelineFilter} `}activity for this period yet.
                  </DashboardEmpty>
                ) : (
                  <ul className="team-intel-timeline">
                    {filteredTimeline.map((item) => (
                      <li key={item.id} className={`team-intel-timeline__item team-intel-timeline__item--${item.kind}`}>
                        <button
                          type="button"
                          className="team-intel-timeline__card"
                          onClick={() => {
                            if (item.leadId) {
                              openPipelineLead(item.leadId)
                              onNavigate?.('pipeline')
                            }
                          }}
                        >
                          <div className="team-intel-timeline__head">
                            <span className="team-intel-timeline__type">
                              {timelineTypeLabel(item.type)}
                            </span>
                            <time className="team-intel-timeline__time">{formatDateTime(item.at)}</time>
                          </div>
                          <p className="team-intel-timeline__title">
                            {item.title}
                            {item.company && item.company !== item.title ? ` · ${item.company}` : ''}
                          </p>
                          {item.body ? (
                            <p className="team-intel-timeline__body">{item.body}</p>
                          ) : null}
                          {item.meta?.stageLabel || item.meta?.amount != null ? (
                            <p className="team-intel-timeline__meta">
                              {item.meta.stageLabel ? `Stage: ${item.meta.stageLabel}` : null}
                              {item.meta.amount != null
                                ? `${item.meta.stageLabel ? ' · ' : ''}${formatDealValue(item.meta.amount)}`
                                : null}
                            </p>
                          ) : null}
                          <p className="team-intel-timeline__actor">
                            {item.actorName || 'Rep'}
                            {item.leadId ? ' · Open lead' : ''}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </DashboardSection>

              <div className="intel-layout-main">
                <DashboardSection title="Activity trend" subtitle={periodLabel}>
                  <ActivityTrendChart data={data?.activityByDay || []} />
                </DashboardSection>
                <DashboardSection title="Activity mix">
                  <ActivityMixPie data={intel?.activityMix || []} />
                </DashboardSection>
              </div>

              {!activeMemberId && isManagerView ? (
                <DashboardSection title="Team hours vs CRM actions">
                  <TeamHoursBarChart members={intel?.members || []} />
                </DashboardSection>
              ) : null}

              <DashboardSection title="Pipeline funnel" actionLabel="Open pipeline" onAction={() => onNavigate?.('pipeline')}>
                <PipelineFunnelChart
                  rows={statusBreakdown.map((r) => ({
                    status: r.status,
                    label: getStatusMeta(r.status)?.label || r.status,
                    count: r.count,
                  }))}
                />
              </DashboardSection>

              {intel?.weeklyReview?.length ? (
                <DashboardSection title="Weekly review insights">
                  <ul className="intel-insights-grid">
                    {intel.weeklyReview.map((insight, i) => (
                      <li key={i}>
                        <div className="intel-insight">
                          <span className="intel-insight__title">{insight.title}</span>
                          <span className="intel-insight__body">{insight.body}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </DashboardSection>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
