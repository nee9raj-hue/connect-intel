import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { getVisiblePipelineColumns } from '../../lib/crmConstants'
import {
  QUICK_NAV_TILES,
  pipelineCountsFromSummary,
  countUpcomingFromLeads,
  navTargetToOptions,
} from '../../lib/navConfig'
import { formatDateTime } from '../../lib/crmUiConstants'
import { withTimeout } from '../../lib/fetchWithTimeout'
import {
  DashboardShell,
  DashboardKpiCard,
  DashboardSection,
  DashboardQuickTile,
  DashboardListRow,
  DashboardProgressRow,
  DashboardEmpty,
  DashboardFeatureCard,
} from '../dashboard/dashboardUi'
import DashboardTeamSnapshot from './DashboardTeamSnapshot'
import { hasWorkspaceFeature } from '../../lib/workspaceFeatures'

export default function OverviewPanel({ onNavigate, isActive = true }) {
  const {
    user,
    savedLeads,
    pipelineLoad,
    pipelineSummary,
    searchHistory,
    unreadNotificationCount,
    notifications,
    teamMembers,
    setPipelineAssigneeFilter,
    openPipelineLead,
  } = useApp()

  const [marketingSummary, setMarketingSummary] = useState(null)
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [teamDashboard, setTeamDashboard] = useState(null)
  const [teamPeriod, setTeamPeriod] = useState('week')
  const [loadingExtras, setLoadingExtras] = useState(true)
  const isCompany = user?.accountType === 'company'

  const pipelineCounts = useMemo(
    () => pipelineCountsFromSummary(pipelineSummary, savedLeads),
    [pipelineSummary, savedLeads]
  )
  const columns = useMemo(() => getVisiblePipelineColumns(user), [user])
  const upcomingLocal = useMemo(() => countUpcomingFromLeads(savedLeads), [savedLeads])

  const replied = savedLeads.filter((l) => l.crm?.responseReceived).length
  const followUpDue = savedLeads.filter((l) => {
    const at = l.crm?.nextFollowUpAt
    return at && new Date(at).getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000
  }).length

  const loadExtras = useCallback(async () => {
    setLoadingExtras(true)
    try {
      const from = new Date()
      const to = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      const q = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      }).toString()
      const [mkt, cal] = await Promise.allSettled([
        withTimeout(api.getMarketingOverview(), 20_000),
        withTimeout(api.getCrmCalendar(q, { silent: true }), 20_000),
      ])
      if (mkt.status === 'fulfilled') setMarketingSummary(mkt.value.summary || null)
      if (cal.status === 'fulfilled') {
        const now = Date.now()
        const events = (cal.value.events || [])
          .filter((e) => new Date(e.scheduledAt).getTime() >= now)
          .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
          .slice(0, 6)
        setUpcomingEvents(events)
      }
    } catch {
      // keep local fallbacks
    } finally {
      setLoadingExtras(false)
    }
  }, [])

  useEffect(() => {
    if (!isActive) return undefined
    const timer = setTimeout(() => loadExtras(), 80)
    return () => clearTimeout(timer)
  }, [loadExtras, isActive])

  const reloadTeamDashboard = useCallback(async () => {
    if (!hasWorkspaceFeature(user, 'dashboardTeamIntelligence')) {
      setTeamDashboard(null)
      return
    }
    try {
      const q = new URLSearchParams({ period: teamPeriod }).toString()
      const res = await api.getCrmTeamDashboard(q)
      setTeamDashboard(res)
    } catch {
      // keep previous snapshot
    }
  }, [teamPeriod, user])

  useEffect(() => {
    if (!isActive) return undefined
    reloadTeamDashboard()
  }, [isActive, teamPeriod, reloadTeamDashboard])

  const go = (target) => onNavigate?.(target.panel, navTargetToOptions(target))

  const showTeamIntelligence = hasWorkspaceFeature(user, 'dashboardTeamIntelligence')
  const showActiveCustomersPanel = hasWorkspaceFeature(user, 'panelActiveCustomers')
  const showCompanyWorkspace = hasWorkspaceFeature(user, 'companyWorkspacePage')

  const quickTiles = useMemo(() => {
    const isCompany = user?.accountType === 'company'
    const tiles = QUICK_NAV_TILES.filter((t) => {
      if (t.panel === 'chithi' || t.panel === 'team-hub' || t.panel === 'team-notes' || t.panel === 'team-tasks')
        return isCompany
      return true
    })
    if (isCompany && showCompanyWorkspace) {
      tiles.push({
        id: 'company-workspace',
        label: user?.workspacePageTitle?.replace(/ workspace$/i, '') || 'Workspace',
        panel: 'company-workspace',
        icon: 'chart',
        desc: 'Your data & reports',
      })
    }
    if (isCompany && hasWorkspaceFeature(user, 'homeTeamMetrics')) {
      tiles.push({
        id: 'team-metrics',
        label: 'Team metrics',
        panel: 'crm-dashboard',
        icon: 'chart',
        desc: 'Performance',
      })
    }
    return tiles
  }, [user?.accountType, user?.workspacePageTitle, showCompanyWorkspace])

  const recentNotifs = notifications.filter((n) => n.unread).slice(0, 5)
  const pipelineTotal = pipelineSummary.total || savedLeads.length

  const headerActions =
    user?.accountType === 'company' && hasWorkspaceFeature(user, 'homeTeamMetrics') ? (
      <button
        type="button"
        className="crm-btn crm-btn-secondary crm-btn-sm"
        onClick={() => go({ panel: 'crm-dashboard' })}
      >
        Team metrics
      </button>
    ) : null

  return (
    <DashboardShell
      title="Dashboard"
      subtitle={
        user?.name
          ? `Welcome back, ${user.name.split(' ')[0]} — pipeline, marketing, and calendar at a glance`
          : 'Your CRM at a glance — click any card to jump in'
      }
      actions={headerActions}
    >
      <div className="dashboard-kpi-grid">
        <DashboardKpiCard
          icon="pipeline"
          label="Pipeline leads"
          value={(pipelineTotal || 0).toLocaleString()}
          hint={
            pipelineLoad.hasMore
              ? `${savedLeads.length.toLocaleString()} loaded · ${replied} replied`
              : `${replied} replied`
          }
          onClick={() => go({ panel: 'pipeline', status: 'all' })}
        />
        <DashboardKpiCard
          icon="calendar"
          label="Follow-up due"
          value={followUpDue.toLocaleString()}
          hint="Next 7 days"
          onClick={() => go({ panel: 'pipeline', status: 'follow_up' })}
        />
        <DashboardKpiCard
          icon="task"
          label="Upcoming"
          value={(upcomingLocal || upcomingEvents.length).toLocaleString()}
          hint="Meetings & tasks"
          onClick={() => go({ panel: 'crm-calendar', upcomingOnly: true })}
        />
        <DashboardKpiCard
          icon="spark"
          label="Credits"
          value={`₹${((user?.creditsPaise ?? 0) / 100).toFixed(0)}`}
          hint={`${user?.searchesLeft ?? 0} AI searches left`}
          onClick={() => go({ panel: 'search' })}
        />
      </div>

      <div>
        <p className="dashboard-section-label">Jump to</p>
        <div className="dashboard-quick-grid">
          {quickTiles.map((tile) => (
            <DashboardQuickTile key={tile.id} tile={tile} onClick={() => go(tile)} />
          ))}
        </div>
      </div>

      <DashboardSection
        title="Pipeline by stage"
        subtitle={
          pipelineTotal > 0
            ? `${pipelineTotal.toLocaleString()} leads total — click a stage to filter`
            : 'Add leads from AI search or import'
        }
        actionLabel="Open pipeline"
        onAction={() => go({ panel: 'pipeline', status: 'all' })}
      >
        <div className="flex flex-col gap-0.5">
          {columns.map((col) => (
            <DashboardProgressRow
              key={col.id}
              label={col.label}
              count={pipelineCounts[col.id] || 0}
              total={pipelineCounts.all || 0}
              onClick={() => go({ panel: 'pipeline', status: col.id })}
            />
          ))}
        </div>
      </DashboardSection>

      {showTeamIntelligence && teamDashboard?.teamSnapshot && (
        <DashboardTeamSnapshot
          data={teamDashboard}
          loading={!teamDashboard}
          period={teamPeriod}
          onPeriodChange={setTeamPeriod}
          members={isCompany ? teamDashboard?.members || [] : []}
          onNavigate={(panel, options) => {
            if (panel === 'pipeline' && options?.leadId) {
              openPipelineLead?.(options.leadId)
              onNavigate?.('pipeline', { status: 'all' })
              return
            }
            onNavigate?.(panel, options)
          }}
          onMemberClick={(m) => {
            setPipelineAssigneeFilter?.(m.userId)
            go({ panel: 'pipeline' })
          }}
        />
      )}

      <div className="dashboard-layout-2-1">
        <DashboardSection
          title="Marketing"
          subtitle="Campaign performance"
          actionLabel="Reports"
          onAction={() => go({ panel: 'marketing', tab: 'reports' })}
        >
          {loadingExtras ? (
            <DashboardEmpty>Loading marketing stats…</DashboardEmpty>
          ) : marketingSummary ? (
            <ul className="dashboard-stat-list">
              <li>
                <span>Campaigns</span>
                <span>{marketingSummary.campaigns}</span>
              </li>
              <li>
                <span>Sent</span>
                <span>{marketingSummary.sent}</span>
              </li>
              <li>
                <span>Opens</span>
                <span>{marketingSummary.opens}</span>
              </li>
              <li>
                <span>Clicks</span>
                <span>{marketingSummary.clicks}</span>
              </li>
            </ul>
          ) : (
            <DashboardEmpty>No campaigns yet — create your first outreach.</DashboardEmpty>
          )}
          <button
            type="button"
            className="crm-btn crm-btn-secondary crm-btn-sm w-full mt-3"
            onClick={() => go({ panel: 'marketing', tab: 'campaigns' })}
          >
            Create campaign
          </button>
        </DashboardSection>

        {isCompany && showActiveCustomersPanel && (
          <DashboardFeatureCard
            icon="chart"
            title="Active customers"
            description={`${teamDashboard?.teamSnapshot?.activeCustomers?.total?.toLocaleString() ?? '—'} with trading activity · upload shipment files to refresh.`}
            actionLabel="Open dashboard"
            accent="teal"
            onAction={() => go({ panel: 'active-customers' })}
          />
        )}
      </div>

      <div className="dashboard-layout-2">
        <DashboardSection
          title="Upcoming meetings & tasks"
          subtitle="Next 90 days"
          actionLabel="View calendar"
          onAction={() => go({ panel: 'crm-calendar', upcomingOnly: true })}
        >
          {loadingExtras ? (
            <DashboardEmpty>Loading calendar…</DashboardEmpty>
          ) : upcomingEvents.length === 0 ? (
            <DashboardEmpty>Nothing scheduled — add meetings or tasks from Pipeline.</DashboardEmpty>
          ) : (
            <ul className="dashboard-list">
              {upcomingEvents.map((ev) => (
                <DashboardListRow
                  key={ev.id}
                  title={ev.title}
                  meta={`${ev.leadName || 'Lead'} · ${formatDateTime(ev.scheduledAt)}`}
                  onClick={() => go({ panel: 'crm-calendar', upcomingOnly: true })}
                />
              ))}
            </ul>
          )}
        </DashboardSection>

        <DashboardSection
          title={
            <>
              Notifications
              {unreadNotificationCount > 0 ? (
                <span className="dashboard-badge-pill">{unreadNotificationCount}</span>
              ) : null}
            </>
          }
          subtitle={unreadNotificationCount ? 'Unread updates' : 'All caught up'}
        >
          {recentNotifs.length === 0 ? (
            <DashboardEmpty>You are all caught up.</DashboardEmpty>
          ) : (
            <ul className="dashboard-list">
              {recentNotifs.map((n) => (
                <li key={n.id} className="dashboard-notif-item">
                  <p className="dashboard-notif-item__title">{n.title}</p>
                  <p className="dashboard-notif-item__body">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="dashboard-link-btn mt-2"
            onClick={() => go({ panel: 'pipeline', status: 'all' })}
          >
            Open pipeline
          </button>
        </DashboardSection>
      </div>

      <div className="dashboard-layout-2">
        <DashboardSection
          title="Recent AI searches"
          subtitle="Pick up where you left off"
          actionLabel="New search"
          onAction={() => go({ panel: 'search' })}
        >
          {searchHistory.length === 0 ? (
            <DashboardEmpty>No searches yet — find prospects with AI.</DashboardEmpty>
          ) : (
            <ul className="dashboard-list">
              {searchHistory.slice(0, 4).map((h, i) => (
                <DashboardListRow
                  key={i}
                  title={formatFilters(h.filters)}
                  meta={`${h.count} leads found`}
                  badge={h.count}
                  onClick={() => go({ panel: 'search' })}
                />
              ))}
            </ul>
          )}
        </DashboardSection>

        {isCompany && teamMembers.length > 0 && (
          <DashboardSection
            title="Team settings"
            subtitle={`${teamMembers.length} member${teamMembers.length === 1 ? '' : 's'}`}
            actionLabel="Manage team"
            onAction={() => go({ panel: 'team' })}
          >
            <ul className="dashboard-list">
              {teamMembers.slice(0, 4).map((m) => (
                <DashboardListRow
                  key={m.userId}
                  title={m.name}
                  meta={m.email}
                  badge={m.orgRole === 'org_admin' ? 'Admin' : 'Member'}
                  onClick={() => go({ panel: 'team' })}
                />
              ))}
            </ul>
          </DashboardSection>
        )}
      </div>

      {(user?.accountType === 'company' ||
        (user?.isOrgAdmin && user?.accountType === 'company')) && (
        <div className="dashboard-layout-2">
          {user?.accountType === 'company' && showActiveCustomersPanel && (
            <DashboardFeatureCard
              icon="chart"
              title="Active customers"
              description="Track first shipment and repeat loads. Import ERP or shipment files by mobile number."
              actionLabel="Open dashboard"
              accent="teal"
              onAction={() => go({ panel: 'active-customers' })}
            />
          )}
          {user?.isOrgAdmin && user?.accountType === 'company' && (
            <DashboardFeatureCard
              icon="whatsapp"
              title="WhatsApp Business API"
              description={
                user?.whatsappAutoSendReady
                  ? 'Bulk WhatsApp is connected for your company workspace.'
                  : 'Connect Meta API credentials to send marketing and pipeline WhatsApp automatically.'
              }
              actionLabel={user?.whatsappAutoSendReady ? 'API settings' : 'Set up WhatsApp API'}
              accent="whatsapp"
              onAction={() => go({ panel: 'whatsapp-settings' })}
            />
          )}
        </div>
      )}
    </DashboardShell>
  )
}

function formatFilters(f) {
  const parts = []
  if (f.keywords) parts.push(`"${f.keywords}"`)
  if (f.jobTitles?.length) parts.push(f.jobTitles.slice(0, 2).join(', '))
  if (f.industries?.length) parts.push(f.industries[0])
  return parts.join(' · ') || 'All prospects'
}
