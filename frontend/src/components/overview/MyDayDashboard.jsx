import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { navTargetToOptions } from '../../lib/navConfig'
import {
  PersonalCommandBar,
  PriorityList,
  PipelineMini,
  DayTimeline,
  ActivityCards,
  RevenueProgressBar,
  LeadFocusCards,
  QuickActionsFab,
  GoalsCard,
  InsightPills,
  MyDaySkeleton,
} from './MyDayCharts'
import MyDayDetailDrawer from './MyDayDetailDrawer'

function useIsMobile(bp = 768) {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < bp : false))
  useEffect(() => {
    const fn = () => setM(window.innerWidth < bp)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [bp])
  return m
}

export default function MyDayDashboard({ onNavigate, isActive = true }) {
  const { user, openPipelineLead, unreadNotificationCount, notifications, navigateToNotification } = useApp()
  const [myDay, setMyDay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fabOpen, setFabOpen] = useState(false)
  const [drawer, setDrawer] = useState(null)
  const isMobile = useIsMobile()

  const firstName = user?.name?.split(' ')[0] || 'there'

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await api.getCrmMyDay()
      setMyDay(data.myDay)
    } catch (e) {
      setError(e.message || 'Could not load your day')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isActive) return undefined
    setLoading(true)
    load()
  }, [load, isActive])

  const navigateWithReturn = useCallback(
    (action = {}) => {
      if (!action?.panel && !action?.leadId) return
      const panel = action.panel || 'pipeline'
      const options = { ...navTargetToOptions(action), returnTo: 'overview' }
      if (action.leadId) {
        openPipelineLead(action.leadId, action.leadTab || 'overview')
      }
      onNavigate?.(panel, options)
      setDrawer(null)
    },
    [onNavigate, openPipelineLead]
  )

  const runAction = useCallback(
    (action = {}) => {
      if (action.panel === 'notifications') {
        const first = (notifications || []).find((n) => n.unread)
        if (first) {
          navigateToNotification(first)
        } else {
          onNavigate?.('crm-log', { period: 'day', userId: user?.id, returnTo: 'overview' })
        }
        setDrawer(null)
        return
      }
      navigateWithReturn(action)
    },
    [notifications, navigateToNotification, user?.id, onNavigate, navigateWithReturn]
  )

  const go = useCallback(
    (panel, opts = {}) => {
      onNavigate?.(panel, { ...opts, returnTo: 'overview' })
      setDrawer(null)
    },
    [onNavigate]
  )

  const openPriority = useCallback(
    (item) => {
      const action = item.action || {}
      if (action.panel || action.leadId) {
        navigateWithReturn(action)
        return
      }
      go('pipeline', { status: item.kind === 'follow_up' ? 'follow_up' : 'all' })
    },
    [go, navigateWithReturn]
  )

  const commandBar = useMemo(
    () =>
      myDay?.commandBar?.map((item) =>
        item.id === 'unread' ? { ...item, count: unreadNotificationCount ?? item.count } : item
      ),
    [myDay?.commandBar, unreadNotificationCount]
  )

  const unreadDrawerItems = useMemo(() => {
    return (notifications || [])
      .filter((n) => n.unread)
      .slice(0, 20)
      .map((n) => ({
        id: n.id,
        title: n.title || n.type || 'Update',
        subtitle: n.body || n.summary || '',
        dueAt: n.createdAt,
        action: { panel: n.panel || 'notifications' },
        notification: n,
      }))
  }, [notifications])

  const openCommandDrawer = useCallback(
    (item) => {
      if (item.id === 'unread') {
        setDrawer({
          id: 'unread',
          title: 'Unread updates',
          subtitle: 'Notifications on your account',
          count: unreadNotificationCount || 0,
          items: unreadDrawerItems,
          emptyMessage: 'No unread notifications.',
          viewAllLabel: 'Open activity log',
          action: item.action,
        })
        return
      }
      setDrawer({
        id: item.id,
        title: item.label,
        subtitle: item.subtitle,
        count: item.count,
        items: item.details || [],
        emptyMessage: `No ${item.label?.toLowerCase()} on your assigned leads right now.`,
        viewAllLabel: item.viewAllLabel,
        action: item.action,
      })
    },
    [unreadDrawerItems, unreadNotificationCount]
  )

  const openLeadFocusDrawer = useCallback(
    (card) => {
      const match = commandBar?.find((c) =>
        card.id === 'followup' ? c.id === 'followups' : card.id === 'new' ? c.id === 'assignments' : false
      )
      if (match) {
        openCommandDrawer(match)
        return
      }
      setDrawer({
        id: `focus-${card.id}`,
        title: card.label,
        subtitle: 'Your assigned leads',
        count: card.count,
        items: [],
        emptyMessage: 'Open pipeline to see the full list.',
        viewAllLabel: `View ${card.label?.toLowerCase()} in pipeline`,
        action: {
          panel: 'pipeline',
          status: card.status,
          smartTags: card.smartTags,
          followUpDue: card.followUpDue,
        },
      })
    },
    [commandBar, openCommandDrawer]
  )

  const urgentCount = useMemo(() => {
    const pillSum = (commandBar || []).reduce((n, item) => n + (Number(item.count) || 0), 0)
    return pillSum
  }, [commandBar])

  if (!isActive) return null

  return (
    <div className="myday-page">
      <header className="myday-header">
        <div>
          <p className="myday-header__eyebrow">My Day</p>
          <h1 className="myday-header__title">Good {getDayPart()}, {firstName}</h1>
          <p className="myday-header__sub">
            {urgentCount > 0
              ? `${urgentCount} item${urgentCount === 1 ? '' : 's'} across your command bar`
              : myDay?.greeting || 'What should you do next?'}
          </p>
        </div>
        {myDay?.teamIntelLink ? (
          <button type="button" className="myday-header__intel" onClick={() => go('crm-dashboard')}>
            Team intelligence →
          </button>
        ) : null}
      </header>

      {error ? <p className="myday-error">{error}</p> : null}

      {loading && !myDay ? (
        <MyDaySkeleton />
      ) : (
        <div className="myday-grid">
          <section className="myday-section myday-span-12 myday-section--sticky" aria-label="Personal command bar">
            <PersonalCommandBar items={commandBar} onAction={openCommandDrawer} />
          </section>

          <section className="myday-section myday-span-8 myday-section--hero" aria-label="My priorities">
            <div className="myday-section__head">
              <h2>My priorities</h2>
              <p>Your assistant-ranked to-do list</p>
            </div>
            <PriorityList items={myDay?.priorities} onOpen={openPriority} />
          </section>

          <section className="myday-section myday-span-4" aria-label="Goals">
            <div className="myday-section__head">
              <h2>This week</h2>
              <p>Goals & momentum</p>
            </div>
            <GoalsCard goals={myDay?.goals} />
          </section>

          <section className="myday-section myday-span-6" aria-label="Pipeline snapshot">
            <div className="myday-section__head">
              <h2>My pipeline</h2>
              <p>Your deals & leads only</p>
            </div>
            <PipelineMini snapshot={myDay?.pipelineSnapshot} onOpen={(opts) => go('pipeline', opts)} />
          </section>

          <section className="myday-section myday-span-6" aria-label="Lead focus">
            <div className="myday-section__head">
              <h2>Lead focus</h2>
              <p>Where to spend time</p>
            </div>
            <LeadFocusCards focus={myDay?.leadFocus} onCardClick={openLeadFocusDrawer} />
          </section>

          {myDay?.revenueProgress ? (
            <section className="myday-section myday-span-6" aria-label="Revenue progress">
              <div className="myday-section__head">
                <h2>Revenue progress</h2>
                <p>Month to date</p>
              </div>
              <RevenueProgressBar revenue={myDay.revenueProgress} />
            </section>
          ) : null}

          <section className={`myday-section ${myDay?.revenueProgress ? 'myday-span-6' : 'myday-span-12'}`} aria-label="Smart insights">
            <div className="myday-section__head">
              <h2>Smart insights</h2>
              <p>Proactive recommendations</p>
            </div>
            <InsightPills insights={myDay?.smartInsights} onAction={(a) => navigateWithReturn(a)} />
          </section>

          <section className="myday-section myday-span-6" aria-label="Today's timeline">
            <div className="myday-section__head">
              <h2>Today&apos;s timeline</h2>
              <p>Calendar + CRM</p>
            </div>
            <DayTimeline
              items={myDay?.todayTimeline}
              onOpen={(item) => item.leadId && navigateWithReturn({ leadId: item.leadId, panel: 'pipeline' })}
            />
          </section>

          <section className="myday-section myday-span-6" aria-label="Recent activity">
            <div className="myday-section__head">
              <h2>Recent activity</h2>
              <p>On your leads</p>
            </div>
            <ActivityCards
              items={myDay?.recentActivity}
              onOpen={(item) => item.leadId && navigateWithReturn({ leadId: item.leadId, panel: 'pipeline' })}
            />
            <button type="button" className="myday-link-btn" onClick={() => go('crm-log')}>
              Full activity log →
            </button>
          </section>

          {!isMobile ? (
            <section className="myday-section myday-span-12" aria-label="Quick actions">
              <div className="myday-section__head">
                <h2>Quick actions</h2>
              </div>
              <QuickActionsFab actions={myDay?.quickActions} onAction={(a) => go(a.panel)} />
            </section>
          ) : null}
        </div>
      )}

      <MyDayDetailDrawer
        open={Boolean(drawer)}
        title={drawer?.title}
        subtitle={drawer?.subtitle}
        count={drawer?.count}
        items={drawer?.items}
        emptyMessage={drawer?.emptyMessage}
        viewAllLabel={drawer?.viewAllLabel}
        onClose={() => setDrawer(null)}
        onOpenItem={(item) => {
          if (item.notification) {
            navigateToNotification(item.notification)
            setDrawer(null)
            return
          }
          if (item.action) navigateWithReturn(item.action)
        }}
        onViewAll={() => drawer?.action && runAction(drawer.action)}
      />

      {isMobile && myDay?.quickActions?.length ? (
        <div className={`myday-fab${fabOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="myday-fab__toggle"
            aria-expanded={fabOpen}
            onClick={() => setFabOpen((o) => !o)}
          >
            {fabOpen ? '×' : '+'}
          </button>
          {fabOpen ? (
            <QuickActionsFab
              actions={myDay.quickActions}
              onAction={(a) => {
                setFabOpen(false)
                go(a.panel)
              }}
              floating
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function getDayPart() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
