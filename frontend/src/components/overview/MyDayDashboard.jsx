import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
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
  const { user, openPipelineLead, unreadNotificationCount } = useApp()
  const [myDay, setMyDay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fabOpen, setFabOpen] = useState(false)
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

  const go = useCallback(
    (panel, opts = {}) => {
      if (opts.leadId) {
        openPipelineLead(opts.leadId)
        onNavigate?.('pipeline')
        return
      }
      onNavigate?.(panel, opts)
    },
    [onNavigate, openPipelineLead]
  )

  const openPriority = useCallback(
    (item) => {
      const a = item.action || {}
      if (a.leadId) {
        openPipelineLead(a.leadId)
        onNavigate?.('pipeline')
      } else if (a.panel) go(a.panel, a)
      else go('pipeline', { status: item.kind === 'follow_up' ? 'follow_up' : 'all' })
    },
    [go, openPipelineLead, onNavigate]
  )

  const commandBar = myDay?.commandBar?.map((item) =>
    item.id === 'unread' ? { ...item, count: unreadNotificationCount || item.count } : item
  )

  const urgentCount = (myDay?.priorities?.length || 0) + (unreadNotificationCount || 0)

  if (!isActive) return null

  return (
    <div className="myday-page">
      <header className="myday-header">
        <div>
          <p className="myday-header__eyebrow">My Day</p>
          <h1 className="myday-header__title">Good {getDayPart()}, {firstName}</h1>
          <p className="myday-header__sub">
            {urgentCount > 0
              ? `${urgentCount} thing${urgentCount === 1 ? '' : 's'} need your attention`
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
            <PersonalCommandBar
              items={commandBar}
              onAction={(item) => go(item.action?.panel || 'pipeline', item.action || {})}
            />
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
            <LeadFocusCards focus={myDay?.leadFocus} onNavigate={go} />
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
            <InsightPills insights={myDay?.smartInsights} onAction={(a) => go(a.panel, a)} />
          </section>

          <section className="myday-section myday-span-6" aria-label="Today's timeline">
            <div className="myday-section__head">
              <h2>Today&apos;s timeline</h2>
              <p>Calendar + CRM</p>
            </div>
            <DayTimeline
              items={myDay?.todayTimeline}
              onOpen={(item) => item.leadId && openPriority({ action: { leadId: item.leadId } })}
            />
          </section>

          <section className="myday-section myday-span-6" aria-label="Recent activity">
            <div className="myday-section__head">
              <h2>Recent activity</h2>
              <p>On your leads</p>
            </div>
            <ActivityCards
              items={myDay?.recentActivity}
              onOpen={(item) => item.leadId && go('pipeline', { leadId: item.leadId })}
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
            <QuickActionsFab actions={myDay.quickActions} onAction={(a) => { setFabOpen(false); go(a.panel) }} floating />
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
