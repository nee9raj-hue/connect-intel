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
import TeamIntelligenceSection from '../crm/TeamIntelligenceSection'
import FreightDealsDashboard from './FreightDealsDashboard'
import { hasWorkspaceFeature } from '../../lib/workspaceFeatures'
import { isFreightDealOrg } from '../../lib/freightDeal'

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
  } = useApp()

  const [marketingSummary, setMarketingSummary] = useState(null)
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [loadingExtras, setLoadingExtras] = useState(true)
  const isCompany = user?.accountType === 'company'
  const showTeamIntelligence = isCompany && hasWorkspaceFeature(user, 'homeTeamMetrics')

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

  const go = (target) => onNavigate?.(target.panel, navTargetToOptions(target))

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
    return tiles
  }, [user?.accountType, user?.workspacePageTitle, showCompanyWorkspace])

  const recentNotifs = notifications.filter((n) => n.unread).slice(0, 5)
  const pipelineTotal = pipelineSummary.total || savedLeads.length
  const marketingOpenRate = marketingSummary?.sent
    ? Math.round(((marketingSummary.opens || 0) / marketingSummary.sent) * 100)
    : 0
  const marketingClickRate = marketingSummary?.sent
    ? Math.round(((marketingSummary.clicks || 0) / marketingSummary.sent) * 100)
    : 0

  const headerActions = null

  return (
    <DashboardShell
      title={showTeamIntelligence ? 'Dashboard & team intelligence' : 'Dashboard'}
      subtitle={
        user?.name
          ? showTeamIntelligence
            ? `Welcome back, ${user.name.split(' ')[0]} — your pipeline and team metrics`
            : `Welcome back, ${user.name.split(' ')[0]}`
          : undefined
      }
      actions={headerActions}
    >
      <div className="dashboard-kpi-grid">
        <DashboardKpiCard
          icon="pipeline"
          className="dashboard-kpi-card--pipeline"
          label="Pipeline leads"
          value={(pipelineTotal || 0).toLocaleString()}
          badge={pipelineTotal ? `${Math.round((replied / Math.max(1, pipelineTotal)) * 100)}% replied` : null}
          hint={
            pipelineLoad.hasMore
              ? `${savedLeads.length.toLocaleString()} loaded · ${replied} replied`
              : `${replied} replied`
          }
          progress={pipelineTotal ? (replied / Math.max(1, pipelineTotal)) * 100 : 0}
          onClick={() => go({ panel: 'pipeline', status: 'all' })}
        />
        <DashboardKpiCard
          icon="calendar"
          className="dashboard-kpi-card--followup"
          label="Follow-up due"
          value={followUpDue.toLocaleString()}
          badge={followUpDue > 0 ? 'Needs action' : 'On track'}
          hint="Next 7 days"
          progress={pipelineTotal ? (followUpDue / Math.max(1, pipelineTotal)) * 100 : 0}
          onClick={() => go({ panel: 'pipeline', status: 'follow_up' })}
        />
        <DashboardKpiCard
          icon="task"
          className="dashboard-kpi-card--upcoming"
          label="Upcoming"
          value={(upcomingLocal || upcomingEvents.length).toLocaleString()}
          badge={upcomingEvents.length ? `${upcomingEvents.length} booked` : 'Calendar'}
          hint="Meetings & tasks"
          progress={Math.min(100, ((upcomingLocal || upcomingEvents.length) / 6) * 100)}
          onClick={() => go({ panel: 'crm-calendar', upcomingOnly: true })}
        />
        <DashboardKpiCard
          icon="spark"
          className="dashboard-kpi-card--credits"
          label="Credits"
          value={`₹${((user?.creditsPaise ?? 0) / 100).toFixed(0)}`}
          badge={`${user?.searchesLeft ?? 0} AI left`}
          hint={`${user?.searchesLeft ?? 0} AI searches left`}
          onClick={() => go({ panel: 'search' })}
        />
      </div>

      {isFreightDealOrg(user) && (
        <FreightDealsDashboard user={user} pipelineSummary={pipelineSummary} onNavigate={onNavigate} />
      )}

      {showTeamIntelligence ? (
        <TeamIntelligenceSection onNavigate={onNavigate} isActive={isActive} />
      ) : null}

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
        subtitle="Stage coverage across the visible pipeline"
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

      <div className="dashboard-layout-2-1">
        <DashboardSection
          title="Marketing"
          subtitle="Campaign output and engagement at a glance"
          actionLabel="Reports"
          onAction={() => go({ panel: 'marketing', tab: 'reports' })}
        >
          {loadingExtras ? (
            <DashboardEmpty>Loading marketing stats…</DashboardEmpty>
          ) : marketingSummary ? (
            <div className="dashboard-marketing-grid">
              <OverviewStatMini label="Campaigns" value={marketingSummary.campaigns} accent="default" />
              <OverviewStatMini label="Sent" value={marketingSummary.sent} accent="default" />
              <OverviewStatMini label="Open rate" value={`${marketingOpenRate}%`} accent="soft" />
              <OverviewStatMini label="Click rate" value={`${marketingClickRate}%`} accent="soft" />
            </div>
          ) : (
            <DashboardEmpty>No campaigns</DashboardEmpty>
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
            description="Shipment history & trading profiles"
            actionLabel="Open dashboard"
            accent="teal"
            onAction={() => go({ panel: 'active-customers' })}
          />
        )}
      </div>

      <div className="dashboard-layout-2">
        <DashboardSection
          title="Upcoming meetings & tasks"
          subtitle="Next items already scheduled in CRM"
          actionLabel="View calendar"
          onAction={() => go({ panel: 'crm-calendar', upcomingOnly: true })}
        >
          {loadingExtras ? (
            <DashboardEmpty>Loading calendar…</DashboardEmpty>
          ) : upcomingEvents.length === 0 ? (
            <DashboardEmpty>Nothing scheduled</DashboardEmpty>
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
        >
          {recentNotifs.length === 0 ? (
            <DashboardEmpty>No notifications</DashboardEmpty>
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
          subtitle="Your latest prospecting prompts and result counts"
          actionLabel="New search"
          onAction={() => go({ panel: 'search' })}
        >
          {searchHistory.length === 0 ? (
            <DashboardEmpty>No searches</DashboardEmpty>
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
            subtitle="Members currently active in this workspace"
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
              actionLabel="Open dashboard"
              accent="teal"
              onAction={() => go({ panel: 'active-customers' })}
            />
          )}
          {user?.isOrgAdmin && user?.accountType === 'company' && (
            <DashboardFeatureCard
              icon="whatsapp"
              title="WhatsApp Business API"
              actionLabel={user?.whatsappAutoSendReady ? 'API settings' : 'Set up'}
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

function OverviewStatMini({ label, value, accent = 'default' }) {
  return (
    <div className={`dashboard-mini-stat dashboard-mini-stat--${accent}`}>
      <span className="dashboard-mini-stat__label">{label}</span>
      <span className="dashboard-mini-stat__value">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  )
}
