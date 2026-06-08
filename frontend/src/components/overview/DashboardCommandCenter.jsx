import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { withTimeout } from '../../lib/fetchWithTimeout'
import { hasWorkspaceFeature } from '../../lib/workspaceFeatures'
import { QUICK_NAV_TILES, navTargetToOptions } from '../../lib/navConfig'
import { formatDateTime } from '../../lib/crmUiConstants'
import { DashboardSegmented, DashboardQuickTile } from '../dashboard/dashboardUi'
import {
  CommandBarMetric,
  InsightsCarousel,
  PerformanceMatrix,
  PipelineHealthFunnel,
  RevenueLeakGrid,
  CapacityChart,
  AdoptionPanel,
  EffectivenessGrid,
  ActionCenterPanel,
  ActivityFeed,
  SkeletonBlock,
} from '../crm/TeamIntelligenceV3Charts'
function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  )
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [breakpoint])
  return mobile
}

function CreditsMetric({ user, onNavigate }) {
  const credits = ((user?.creditsPaise ?? 0) / 100).toFixed(0)
  const searches = user?.searchesLeft ?? 0
  return (
    <article className="ti3-cmd-metric ti3-cmd-metric--good ti3-cmd-metric--credits">
      <div className="ti3-cmd-metric__head">
        <span className="ti3-cmd-metric__label">Credits</span>
        <span className="ti3-cmd-metric__status" style={{ background: '#FF773D' }} aria-hidden />
      </div>
      <div className="ti3-cmd-metric__body">
        <span className="ti3-cmd-metric__value">₹{credits}</span>
      </div>
      <div className="ti3-cmd-metric__foot">
        <button type="button" className="ti3-dash-credits-hint" onClick={() => onNavigate?.('search')}>
          {searches} AI searches left →
        </button>
      </div>
    </article>
  )
}

export default function DashboardCommandCenter({ onNavigate, isActive = true }) {
  const { user, savedLeads, notifications, unreadNotificationCount } = useApp()
  const [period, setPeriod] = useState('week')
  const [data, setData] = useState(null)
  const [marketingSummary, setMarketingSummary] = useState(null)
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedFeedId, setExpandedFeedId] = useState(null)
  const isMobile = useIsMobile()

  const isCompany = user?.accountType === 'company'
  const showIntel = isCompany && hasWorkspaceFeature(user, 'homeTeamMetrics')
  const dash = data?.dashboardV3
  const firstName = user?.name?.split(' ')[0] || 'there'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const from = new Date()
      const to = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      const calQ = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }).toString()
      const dashQ = new URLSearchParams({ period, detailed: '0' }).toString()

      const tasks = [
        withTimeout(api.getCrmTeamDashboard(dashQ), 25_000),
        withTimeout(api.getMarketingOverview(), 20_000).catch(() => null),
        withTimeout(api.getCrmCalendar(calQ, { silent: true }), 20_000).catch(() => null),
      ]

      const [dashRes, mktRes, calRes] = await Promise.all(tasks)
      setData(dashRes)
      if (mktRes?.summary) setMarketingSummary(mktRes.summary)
      if (calRes?.events) {
        const now = Date.now()
        setUpcomingEvents(
          (calRes.events || [])
            .filter((e) => new Date(e.scheduledAt).getTime() >= now)
            .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
            .slice(0, 12)
        )
      }
    } catch (e) {
      setError(e.message || 'Could not load dashboard')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    if (!isActive) return undefined
    load()
  }, [load, isActive])

  const go = useCallback(
    (panel, options = {}) => onNavigate?.(panel, options),
    [onNavigate]
  )

  const navigateAction = useCallback(
    (panel, opts = {}) => {
      if (panel === 'overview') return
      go(panel, opts)
    },
    [go]
  )

  const handleCenterAction = useCallback(
    (item, act) => {
      navigateAction(act.panel || 'pipeline', {
        status: act.status || item.filter,
        view: act.view || item.view,
        tab: act.tab,
      })
    },
    [navigateAction]
  )

  const handleLeak = useCallback(
    (leakId) => {
      const map = {
        not_contacted: { panel: 'pipeline', status: 'new' },
        inactive_deals: { panel: 'pipeline', view: 'deals' },
        missing_step: { panel: 'pipeline', status: 'follow_up' },
        overdue_tasks: { panel: 'crm-log' },
        inactive_reps: { panel: 'crm-dashboard' },
      }
      const target = map[leakId]
      if (target) navigateAction(target.panel, target)
    },
    [navigateAction]
  )

  const feedItems = useMemo(() => {
    const items = []
    for (const ev of upcomingEvents.slice(0, 6)) {
      items.push({
        id: `cal-${ev.id}`,
        kind: 'meeting',
        type: 'meeting',
        at: ev.scheduledAt,
        title: ev.title,
        company: ev.leadName,
        actorName: user?.name,
        body: 'Upcoming meeting',
        leadId: ev.leadId,
      })
    }
    for (const n of notifications.filter((x) => x.unread).slice(0, 4)) {
      items.push({
        id: `notif-${n.id}`,
        kind: 'note',
        type: 'notification',
        at: n.createdAt || new Date().toISOString(),
        title: n.title,
        body: n.body,
        actorName: 'System',
      })
    }
    for (const act of data?.recentActivities || []) {
      items.push({
        id: act.id || `act-${act.createdAt}`,
        kind: 'activity',
        type: act.type,
        at: act.createdAt,
        title: act.leadName || 'Lead',
        company: act.company,
        body: act.summary,
        actorName: act.createdByName,
        leadId: act.leadId,
      })
    }
    return items
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 14)
  }, [upcomingEvents, notifications, data?.recentActivities, user?.name])

  const quickTiles = useMemo(() => {
    return QUICK_NAV_TILES.filter((t) => {
      if (t.panel === 'chithi' || t.panel === 'team-hub') return isCompany
      return true
    }).slice(0, 6)
  }, [isCompany])

  const winning = dash?.pulse === 'on_target'

  const displayInsights = useMemo(() => {
    const base = [...(dash?.insights || [])]
    if (marketingSummary?.sent > 0) {
      const openRate = Math.round(((marketingSummary.opens || 0) / marketingSummary.sent) * 100)
      const text = `Marketing open rate is ${openRate}% across ${marketingSummary.campaigns || 0} campaigns.`
      if (!base.some((i) => i.text?.includes('Marketing'))) {
        base.unshift({
          kind: openRate >= 20 ? 'highlight' : 'risk',
          text,
          action: { panel: 'marketing', tab: 'reports' },
        })
      }
    }
    return base.slice(0, 8)
  }, [dash?.insights, marketingSummary])

  if (!isActive) return null

  return (
    <div className="ti3-dash">
      <div className="ti3-chrome ti3-chrome--dash">
        <div className="ti3-chrome__title">
          <h1>Dashboard</h1>
          <p className={`ti3-chrome__pulse${winning ? ' is-winning' : ' is-risk'}`}>
            {dash?.pulseLabel || 'Loading…'} · Welcome, {firstName}
          </p>
        </div>
        <div className="ti3-chrome__controls ti3-chrome__controls--desktop">
          <DashboardSegmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'day', label: 'Today' },
              { value: 'week', label: '7d' },
              { value: 'month', label: '30d' },
            ]}
          />
          {dash?.showFullIntelligence ? (
            <button type="button" className="ti3-dash-link-btn" onClick={() => go('crm-dashboard')}>
              Full team intelligence →
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="ti3-error">{error}</p> : null}

      {loading && !data ? (
        <div className="ti3-cockpit ti3-cockpit--loading">
          <div className="ti3-cmd-strip">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonBlock key={i} className="ti3-skeleton--cmd" />
            ))}
          </div>
          <SkeletonBlock className="ti3-skeleton--insights" />
        </div>
      ) : (
        <div className="ti3-cockpit ti3-cockpit--dash">
          <section className="ti3-cmd-strip" aria-label="Dashboard command bar">
            {(dash?.commandBar || []).map((metric) => (
              <CommandBarMetric key={metric.id} metric={metric} />
            ))}
            <CreditsMetric user={user} onNavigate={go} />
          </section>

          <section className="ti3-panel ti3-panel--insights" aria-label="Dashboard insights">
            <header className="ti3-panel__head">
              <h2>Today&apos;s insights</h2>
              <span className="ti3-panel__tag">Pipeline · team · marketing</span>
            </header>
            <InsightsCarousel
              insights={displayInsights}
              onSelect={(userId, action) => {
                if (userId) go('crm-dashboard', { userId })
                else if (action?.panel) navigateAction(action.panel, action)
              }}
            />
          </section>

          <div className="ti3-grid">
            {(dash?.performanceMatrix?.length ?? 0) > 0 ? (
              <section className="ti3-panel ti3-span-12" aria-label="Performance snapshot">
                <header className="ti3-panel__head ti3-panel__head--row">
                  <div>
                    <h2>{dash?.personal ? 'Your performance' : 'Team snapshot'}</h2>
                    <p>Health, activity, and revenue influence</p>
                  </div>
                  {dash?.showFullIntelligence ? (
                    <button type="button" className="ti3-dash-link-btn" onClick={() => go('crm-dashboard')}>
                      View all reps →
                    </button>
                  ) : null}
                </header>
                <PerformanceMatrix
                  rows={dash.performanceMatrix}
                  onSelectRep={(uid) => go('crm-dashboard', { userId: uid })}
                  mobile={isMobile}
                />
              </section>
            ) : null}

            <section className="ti3-panel ti3-span-7" aria-label="Pipeline health">
              <header className="ti3-panel__head">
                <h2>Pipeline health</h2>
                <p>{savedLeads.length.toLocaleString()} leads in workspace</p>
              </header>
              <PipelineHealthFunnel pipeline={dash?.pipelineHealth} />
            </section>

            <section className="ti3-panel ti3-span-5 ti3-panel--risk" aria-label="Revenue leaks">
              <header className="ti3-panel__head">
                <h2>Needs attention</h2>
                <p>Revenue at risk</p>
              </header>
              <RevenueLeakGrid leaks={dash?.revenueLeaks} onAction={handleLeak} />
            </section>

            {marketingSummary ? (
              <section className="ti3-panel ti3-span-6" aria-label="Marketing pulse">
                <header className="ti3-panel__head">
                  <h2>Marketing pulse</h2>
                  <p>{marketingSummary.campaigns || 0} campaigns</p>
                </header>
                <div className="ti3-dash-marketing">
                  <div className="ti3-dash-marketing__stat">
                    <span>Sent</span>
                    <strong>{(marketingSummary.sent || 0).toLocaleString()}</strong>
                  </div>
                  <div className="ti3-dash-marketing__stat">
                    <span>Open rate</span>
                    <strong>
                      {marketingSummary.sent
                        ? `${Math.round(((marketingSummary.opens || 0) / marketingSummary.sent) * 100)}%`
                        : '—'}
                    </strong>
                  </div>
                  <div className="ti3-dash-marketing__stat">
                    <span>Clicks</span>
                    <strong>{(marketingSummary.clicks || 0).toLocaleString()}</strong>
                  </div>
                  <button type="button" className="ti3-dash-link-btn" onClick={() => go('marketing', { tab: 'reports' })}>
                    Reports →
                  </button>
                </div>
              </section>
            ) : null}

            {(dash?.capacity?.length ?? 0) > 0 ? (
              <section className="ti3-panel ti3-span-6" aria-label="Team capacity">
                <header className="ti3-panel__head">
                  <h2>Team capacity</h2>
                  <p>Workload balance</p>
                </header>
                <CapacityChart rows={dash.capacity} onSelect={(uid) => go('crm-dashboard', { userId: uid })} />
              </section>
            ) : null}

            <section className={`ti3-panel ${marketingSummary ? 'ti3-span-6' : 'ti3-span-12'}`} aria-label="Activity effectiveness">
              <header className="ti3-panel__head">
                <h2>What&apos;s working</h2>
                <p>Activity → outcomes</p>
              </header>
              <EffectivenessGrid rows={dash?.activityEffectiveness} />
            </section>

            {showIntel && dash?.showFullIntelligence && dash?.adoption ? (
              <section className="ti3-panel ti3-span-6" aria-label="CRM adoption">
                <header className="ti3-panel__head">
                  <h2>CRM adoption</h2>
                </header>
                <AdoptionPanel adoption={dash.adoption} />
              </section>
            ) : null}

            <section className="ti3-panel ti3-span-12 ti3-action-desktop" aria-label="Dashboard actions">
              <header className="ti3-panel__head">
                <h2>Do this now</h2>
                <p>Priority actions for your pipeline</p>
              </header>
              <ActionCenterPanel items={dash?.actionCenter} onAction={handleCenterAction} />
            </section>
          </div>

          <section className="ti3-panel ti3-panel--feed" aria-label="Recent activity">
            <header className="ti3-panel__head">
              <h2>Recent activity</h2>
              <p>
                Meetings · notifications · CRM log
                {unreadNotificationCount > 0 ? ` · ${unreadNotificationCount} unread` : ''}
              </p>
            </header>
            <ActivityFeed
              items={feedItems}
              expandedId={expandedFeedId}
              onToggle={(id) => setExpandedFeedId((c) => (c === id ? null : id))}
              onOpen={(item) => item.leadId && go('pipeline')}
            />
          </section>

          <section className="ti3-panel ti3-panel--quick" aria-label="Quick navigation">
            <header className="ti3-panel__head">
              <h2>Jump to</h2>
            </header>
            <div className="ti3-dash-quick">
              {quickTiles.map((tile) => (
                <DashboardQuickTile key={tile.id} tile={tile} onClick={() => go(tile.panel, navTargetToOptions(tile))} />
              ))}
            </div>
          </section>
        </div>
      )}

      {!loading && (dash?.actionCenter?.length ?? 0) > 0 ? (
        <aside className="ti3-action-sheet" aria-label="Quick actions">
          <details className="ti3-action-sheet__details">
            <summary>
              <span className="ti3-action-sheet__count">{dash.actionCenter.length}</span>
              Actions today
            </summary>
            <ActionCenterPanel items={dash.actionCenter} onAction={handleCenterAction} compact />
          </details>
        </aside>
      ) : null}
    </div>
  )
}
