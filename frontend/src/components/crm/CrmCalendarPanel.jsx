import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'
import useIsMobile from '../../hooks/useIsMobile'
import {
  CALENDAR_FILTER_OPTIONS,
  GCAL_HOUR_HEIGHT,
  GCAL_HOURS,
  KIND_COLORS,
  addDays,
  calendarRangeForView,
  formatDayKey,
  formatEventTime,
  formatEventTimeRange,
  getMiniMonthGrid,
  personInitials,
  getMonthGrid,
  getWeekDays,
  groupEventsByDay,
  indexEventsByDay,
  layoutTimedEvents,
  sameDay,
  sortEventsByTime,
  startOfDay,
} from '../../lib/calendarUtils'
import { clearCalendarCache, getCalendarCache, setCalendarCache } from '../../lib/calendarCache'
import MyDayReturnBar from '../overview/MyDayReturnBar'

const VIEW_OPTIONS = [
  { id: 'schedule', label: 'Schedule', mobileIcon: 'schedule' },
  { id: 'day', label: 'Day', mobileIcon: 'day' },
  { id: 'week', label: 'Week', mobileIcon: 'week' },
  { id: 'month', label: 'Month', mobileIcon: 'month' },
]

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MINI_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function parseFocusDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : startOfDay(d)
}

function kindColor(kind) {
  return KIND_COLORS[kind] || KIND_COLORS.task
}

export default function CrmCalendarPanel({ onNavigate, panelOptions }) {
  const { openPipelineLead, calendarFocus, clearCalendarFocus, user } = useApp()
  const isMobile = useIsMobile()
  const upcomingOnly = Boolean(panelOptions?.upcomingOnly)

  const [view, setView] = useState(() => (upcomingOnly || isMobile ? 'schedule' : 'month'))
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [events, setEvents] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedDayEvents, setSelectedDayEvents] = useState([])
  const [googleCal, setGoogleCal] = useState(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [googleNotice, setGoogleNotice] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)
  const [kindFilters, setKindFilters] = useState(() =>
    Object.fromEntries(CALENDAR_FILTER_OPTIONS.map((o) => [o.id, true]))
  )

  const createRef = useRef(null)
  const viewMenuRef = useRef(null)
  const monthPickerRef = useRef(null)
  const syncRef = useRef(null)
  const fabRef = useRef(null)

  const userInitial = useMemo(
    () => personInitials(user?.name || user?.email?.split('@')[0]),
    [user?.name, user?.email]
  )

  useEffect(() => {
    if (panelOptions?.upcomingOnly || panelOptions?.focusToday) {
      setView('schedule')
      setAnchor(startOfDay(new Date()))
    }
  }, [panelOptions?.upcomingOnly, panelOptions?.focusToday])

  useEffect(() => {
    if (!calendarFocus?.scheduledAt) return
    const day = parseFocusDate(calendarFocus.scheduledAt)
    if (day) {
      setAnchor(day)
      if (!upcomingOnly) setView(isMobile ? 'schedule' : 'day')
    }
  }, [calendarFocus?.scheduledAt, calendarFocus?.eventId, isMobile, upcomingOnly])

  useEffect(() => {
    if (!calendarFocus || loading) return
    let match = null
    if (calendarFocus.eventId) {
      match = events.find((e) => e.id === calendarFocus.eventId)
    }
    if (!match && calendarFocus.leadId) {
      match = events.find(
        (e) =>
          e.leadId === calendarFocus.leadId &&
          (calendarFocus.eventId
            ? e.id === calendarFocus.eventId
            : e.meetingId === calendarFocus.meetingId || e.taskId === calendarFocus.taskId)
      )
    }
    if (match) {
      setSelectedDay(null)
      setSelectedDayEvents([])
      setSelected(match)
      clearCalendarFocus()
    }
  }, [calendarFocus, events, loading, clearCalendarFocus])

  useEffect(() => {
    const onDocClick = (e) => {
      if (createRef.current && !createRef.current.contains(e.target)) setCreateOpen(false)
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target)) setViewMenuOpen(false)
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target)) setMonthPickerOpen(false)
      if (syncRef.current && !syncRef.current.contains(e.target)) setSyncOpen(false)
      if (fabRef.current && !fabRef.current.contains(e.target) && createRef.current && !createRef.current.contains(e.target)) {
        setCreateOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const memberName = useMemo(() => {
    const map = Object.fromEntries(members.map((m) => [m.userId, m.name]))
    return (id) => map[id] || 'Team member'
  }, [members])

  const effectiveView = upcomingOnly ? 'schedule' : view

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams({ includeReminders: '0' })
    if (upcomingOnly) {
      const from = startOfDay(new Date())
      const to = addDays(from, 60)
      params.set('from', from.toISOString())
      params.set('to', to.toISOString())
    } else {
      const range = calendarRangeForView(effectiveView, anchor)
      params.set('from', range.from)
      params.set('to', range.to)
    }
    return params.toString()
  }, [effectiveView, anchor, upcomingOnly])

  const applyCalendarPayload = useCallback((data) => {
    setEvents(data.events || [])
    setMembers(data.members || [])
    setGoogleCal(data.googleCalendar || null)
  }, [])

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const q = buildQuery()
      const cached = getCalendarCache(q)
      if (cached) {
        applyCalendarPayload(cached)
        setLoading(false)
      } else if (!silent) {
        setLoading(true)
      }

      try {
        const data = await api.getCrmCalendar(q, { silent: true })
        setCalendarCache(q, data)
        applyCalendarPayload(data)
      } catch {
        if (!cached && !silent) setEvents([])
      } finally {
        setLoading(false)
      }
    },
    [applyCalendarPayload, buildQuery]
  )

  useEffect(() => {
    load()
    const tick = () => {
      if (document.visibilityState === 'visible') load({ silent: true })
    }
    const timer = setInterval(tick, 90_000)
    return () => clearInterval(timer)
  }, [load])

  const filteredEvents = useMemo(() => {
    let list = events.filter((e) => kindFilters[e.kind] !== false)
    if (upcomingOnly) {
      const now = Date.now()
      list = list.filter((e) => new Date(e.scheduledAt).getTime() >= now)
    }
    return list
  }, [events, kindFilters, upcomingOnly])

  const eventsByDay = useMemo(() => indexEventsByDay(filteredEvents), [filteredEvents])
  const showLoading = loading && events.length === 0

  const openDay = useCallback((day, dayEvents) => {
    if (!dayEvents?.length) return
    setSelected(null)
    setSelectedDay(day)
    setSelectedDayEvents(dayEvents)
  }, [])

  const openEvent = useCallback((ev) => {
    setSelectedDay(null)
    setSelectedDayEvents([])
    setSelected(ev)
  }, [])

  const goToDay = useCallback(
    (day) => {
      setAnchor(startOfDay(day))
      if (!upcomingOnly) setView(isMobile ? 'schedule' : 'day')
      setSidebarOpen(false)
    },
    [isMobile, upcomingOnly]
  )

  const connectGoogleCalendar = async () => {
    setGoogleBusy(true)
    setGoogleNotice(null)
    try {
      const data = await api.connectCrmGoogleCalendar()
      if (data.url) window.location.href = data.url
    } catch (e) {
      setGoogleNotice(e.message || 'Could not start Google connect')
    } finally {
      setGoogleBusy(false)
    }
  }

  const syncGoogleCalendar = async () => {
    setGoogleBusy(true)
    setGoogleNotice(null)
    try {
      await api.setCrmGoogleCalendarSync(true)
      const data = await api.syncCrmGoogleCalendar()
      setGoogleNotice(`Synced ${data.imported || 0} Google events`)
      clearCalendarCache()
      load()
    } catch (e) {
      setGoogleNotice(e.message || 'Sync failed')
    } finally {
      setGoogleBusy(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('crm_calendar') !== 'connected') return
    params.delete('crm_calendar')
    const qs = params.toString()
    window.history.replaceState({}, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
    void syncGoogleCalendar()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once after OAuth redirect
  }, [])

  const shiftAnchor = (delta) => {
    if (effectiveView === 'month' || effectiveView === 'schedule') {
      setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1))
    } else if (effectiveView === 'week') {
      setAnchor(addDays(anchor, delta * 7))
    } else {
      setAnchor(addDays(anchor, delta))
    }
  }

  const goToday = () => {
    setAnchor(startOfDay(new Date()))
    load()
  }

  const headerLabel = useMemo(() => {
    if (effectiveView === 'month') {
      return anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    }
    if (effectiveView === 'week') {
      const days = getWeekDays(anchor)
      const a = days[0]
      const b = days[6]
      if (a.getMonth() === b.getMonth()) {
        return `${a.toLocaleDateString(undefined, { month: 'long' })} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`
      }
      return `${a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${b.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    if (effectiveView === 'day') {
      return anchor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    }
    if (upcomingOnly) return 'Upcoming'
    return anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }, [effectiveView, anchor, upcomingOnly])

  const viewLabel = VIEW_OPTIONS.find((v) => v.id === effectiveView)?.label || 'Schedule'

  const toggleKind = (id) => {
    setKindFilters((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const handleCreatePipeline = () => {
    setCreateOpen(false)
    onNavigate?.('pipeline')
  }

  const monthPickerOptions = useMemo(() => {
    const base = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() + i - 4, 1)
      return d
    })
  }, [anchor])

  return (
    <div className={`panel-shell crm-calendar-panel gcal-root relative${isMobile ? ' gcal-root--mobile' : ''}`}>
      <MyDayReturnBar panelOptions={panelOptions} onNavigate={onNavigate} />

      <header className={`gcal-toolbar${isMobile ? ' gcal-toolbar--mobile' : ''}`}>
        {isMobile ? (
          <>
            <button
              type="button"
              className="gcal-toolbar__menu-btn"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div className="gcal-mobile-month-picker" ref={monthPickerRef}>
              <button
                type="button"
                className="gcal-mobile-month-btn"
                onClick={() => setMonthPickerOpen((o) => !o)}
                aria-expanded={monthPickerOpen}
              >
                {anchor.toLocaleDateString(undefined, { month: 'long' })} ▾
              </button>
              {monthPickerOpen && (
                <div className="gcal-mobile-month-menu" role="menu">
                  {monthPickerOptions.map((d) => (
                    <button
                      key={d.toISOString()}
                      type="button"
                      role="menuitem"
                      className={`gcal-mobile-month-menu__item${
                        d.getMonth() === anchor.getMonth() && d.getFullYear() === anchor.getFullYear()
                          ? ' gcal-mobile-month-menu__item--active'
                          : ''
                      }`}
                      onClick={() => {
                        setAnchor(d)
                        setMonthPickerOpen(false)
                      }}
                    >
                      {d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="gcal-toolbar__spacer" />
            <button type="button" className="gcal-mobile-today-btn" onClick={goToday} aria-label="Go to today">
              <span className="gcal-mobile-today-btn__icon">{new Date().getDate()}</span>
            </button>
            <span className="gcal-mobile-avatar" aria-hidden>
              {userInitial}
            </span>
          </>
        ) : (
          <>
            <div className="gcal-toolbar__brand">
              <div className="gcal-logo">
                <span className="gcal-logo__icon" aria-hidden>
                  {anchor.getDate()}
                </span>
                <span className="gcal-logo__text">Calendar</span>
              </div>
            </div>

            <button type="button" className="gcal-btn-today" onClick={goToday}>
              Today
            </button>

            <div className="gcal-nav">
              <button type="button" className="gcal-nav__btn" aria-label="Previous" onClick={() => shiftAnchor(-1)}>
                ‹
              </button>
              <button type="button" className="gcal-nav__btn" aria-label="Next" onClick={() => shiftAnchor(1)}>
                ›
              </button>
            </div>

            <h1 className="gcal-toolbar__title">{headerLabel}</h1>

            <div className="gcal-toolbar__spacer" />

            {!upcomingOnly && (
              <div className="gcal-view-select" ref={viewMenuRef}>
                <button
                  type="button"
                  className="gcal-view-select__btn"
                  onClick={() => setViewMenuOpen((o) => !o)}
                  aria-expanded={viewMenuOpen}
                >
                  {viewLabel} ▾
                </button>
                {viewMenuOpen && (
                  <div className="gcal-view-select__menu" role="menu">
                    {VIEW_OPTIONS.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        role="menuitem"
                        className={`gcal-view-select__item${effectiveView === v.id ? ' gcal-view-select__item--active' : ''}`}
                        onClick={() => {
                          setView(v.id)
                          setViewMenuOpen(false)
                        }}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </header>

      {isMobile && effectiveView === 'month' && !upcomingOnly && (
        <MobileMonthStrip anchor={anchor} onSelect={setAnchor} />
      )}

      <div className="gcal-layout">
        <button
          type="button"
          className={`gcal-sidebar-backdrop${sidebarOpen ? ' gcal-sidebar-backdrop--visible' : ''}`}
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />

        <aside className={`gcal-sidebar${sidebarOpen ? ' gcal-sidebar--open' : ''}${isMobile ? ' gcal-sidebar--drawer' : ''}`}>
          {isMobile && (
            <div className="gcal-drawer-head">
              <span className="gcal-drawer-head__logo">Calendar</span>
            </div>
          )}

          {isMobile && !upcomingOnly && (
            <div className="gcal-drawer-views">
              {VIEW_OPTIONS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`gcal-drawer-view${effectiveView === v.id ? ' gcal-drawer-view--active' : ''}`}
                  onClick={() => {
                    setView(v.id)
                    setSidebarOpen(false)
                  }}
                >
                  <ViewIcon type={v.mobileIcon} />
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
          )}

          {!isMobile && (
            <div className="gcal-create-wrap" ref={createRef}>
              <button type="button" className="gcal-create-btn" onClick={() => setCreateOpen((o) => !o)}>
                <span className="gcal-create-btn__plus">+</span>
                Create
              </button>
              {createOpen && (
                <div className="gcal-create-menu">
                  <button type="button" className="gcal-create-menu__item" onClick={handleCreatePipeline}>
                    Task or meeting in pipeline
                  </button>
                </div>
              )}
            </div>
          )}

          {!isMobile && <MiniCalendar anchor={anchor} onPickDay={goToDay} onMonthChange={setAnchor} />}

          <div className="gcal-sidebar__section">
            <p className="gcal-sidebar__heading">{isMobile ? user?.email || 'My calendars' : 'My calendars'}</p>
            {CALENDAR_FILTER_OPTIONS.map((opt) => {
              const colors = kindColor(opt.id)
              return (
                <label key={opt.id} className="gcal-cal-toggle">
                  <input
                    type="checkbox"
                    checked={kindFilters[opt.id] !== false}
                    onChange={() => toggleKind(opt.id)}
                  />
                  <span className="gcal-cal-toggle__dot" style={{ background: colors.dot }} />
                  {opt.label}
                </label>
              )
            })}
          </div>
        </aside>

        <main className="gcal-main">
          {showLoading ? (
            <LoadingExperience
              message={LOADING_MESSAGES.calendar}
              fill={false}
              className="gcal-loading rounded-none border-0 min-h-[240px]"
            />
          ) : filteredEvents.length === 0 ? (
            <div className="gcal-empty">
              <p>No tasks or meetings in this range.</p>
              <p style={{ fontSize: 12 }}>Create them from Pipeline → open a lead → Tasks &amp; meetings.</p>
              <button type="button" className="link" onClick={() => onNavigate?.('pipeline')}>
                Open pipeline
              </button>
            </div>
          ) : (
            <>
              {effectiveView === 'schedule' && (
                <ScheduleView
                  events={filteredEvents}
                  onSelect={openEvent}
                  upcomingOnly={upcomingOnly}
                  mobile={isMobile}
                  memberName={memberName}
                />
              )}
              {effectiveView === 'month' && (
                <MonthView
                  anchor={anchor}
                  eventsByDay={eventsByDay}
                  onSelect={openEvent}
                  onSelectDay={openDay}
                  onGoToDay={goToDay}
                  mobile={isMobile}
                />
              )}
              {effectiveView === 'week' && (
                <TimeGridView
                  mode="week"
                  anchor={anchor}
                  eventsByDay={eventsByDay}
                  onSelect={openEvent}
                  onGoToDay={goToDay}
                />
              )}
              {effectiveView === 'day' && (
                <TimeGridView
                  mode="day"
                  anchor={anchor}
                  eventsByDay={eventsByDay}
                  onSelect={openEvent}
                  onGoToDay={goToDay}
                />
              )}
            </>
          )}
        </main>
      </div>

      {!upcomingOnly && (
        <GoogleSyncFloater
          ref={syncRef}
          open={syncOpen}
          onToggle={() => setSyncOpen((o) => !o)}
          googleCal={googleCal}
          googleBusy={googleBusy}
          googleNotice={googleNotice}
          onConnect={connectGoogleCalendar}
          onSync={syncGoogleCalendar}
        />
      )}

      <div className="gcal-fab-wrap" ref={fabRef}>
        {createOpen && isMobile && (
          <div className="gcal-create-menu gcal-create-menu--fab">
            <button type="button" className="gcal-create-menu__item" onClick={handleCreatePipeline}>
              Task or meeting
            </button>
            {!googleCal?.calendarScope && (
              <button type="button" className="gcal-create-menu__item" onClick={connectGoogleCalendar}>
                Connect Google
              </button>
            )}
          </div>
        )}
        <button
          type="button"
          className="gcal-fab"
          aria-label="Create"
          onClick={() => setCreateOpen((o) => !o)}
        >
          +
        </button>
      </div>

      {selectedDay && selectedDayEvents.length > 0 && (
        <DayEventsDrawer
          day={selectedDay}
          events={selectedDayEvents}
          onClose={() => {
            setSelectedDay(null)
            setSelectedDayEvents([])
          }}
          onSelectEvent={openEvent}
        />
      )}

      {selected && (
        <EventDetailDrawer
          event={selected}
          memberName={memberName}
          onClose={() => setSelected(null)}
          onOpenLead={() => {
            openPipelineLead(selected.leadId, 'schedule')
            onNavigate?.('pipeline')
          }}
        />
      )}
    </div>
  )
}

function ViewIcon({ type }) {
  return (
    <span className={`gcal-view-icon gcal-view-icon--${type}`} aria-hidden>
      {type === 'schedule' && (
        <>
          <i />
          <i />
        </>
      )}
      {type === 'day' && <i />}
      {type === 'week' && (
        <>
          <i />
          <i />
          <i />
        </>
      )}
      {type === 'month' && (
        <>
          <i />
          <i />
          <i />
          <i />
        </>
      )}
    </span>
  )
}

function MobileMonthStrip({ anchor, onSelect }) {
  const months = useMemo(() => {
    const base = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    return Array.from({ length: 7 }, (_, i) => new Date(base.getFullYear(), base.getMonth() + i - 3, 1))
  }, [anchor])

  return (
    <div className="gcal-month-strip">
      {months.map((d) => {
        const active = d.getMonth() === anchor.getMonth() && d.getFullYear() === anchor.getFullYear()
        return (
          <button
            key={d.toISOString()}
            type="button"
            className={`gcal-month-strip__chip${active ? ' gcal-month-strip__chip--active' : ''}`}
            onClick={() => onSelect(d)}
          >
            {d.toLocaleDateString(undefined, { month: 'short' })}
          </button>
        )
      })}
    </div>
  )
}

const GoogleSyncFloater = forwardRef(function GoogleSyncFloater(
  { open, onToggle, googleCal, googleBusy, googleNotice, onConnect, onSync },
  ref
) {
  const connected = Boolean(googleCal?.calendarScope)
  return (
    <div className="gcal-sync-float" ref={ref}>
      <button
        type="button"
        className={`gcal-sync-float__btn${connected ? ' gcal-sync-float__btn--on' : ''}`}
        onClick={onToggle}
        aria-label={connected ? 'Google Calendar connected' : 'Connect Google Calendar'}
        title={connected ? 'Google Calendar' : 'Connect Google'}
      >
        <span className="gcal-sync-float__g">G</span>
        {connected && <span className="gcal-sync-float__dot" />}
      </button>
      {open && (
        <div className="gcal-sync-float__pop">
          {connected ? (
            <>
              <p className="gcal-sync-float__title">Google connected</p>
              <button type="button" disabled={googleBusy} onClick={onSync}>
                {googleBusy ? 'Syncing…' : 'Sync now'}
              </button>
              {googleCal?.lastSyncAt && (
                <p className="gcal-sync-float__meta">Last {formatDateTime(googleCal.lastSyncAt)}</p>
              )}
            </>
          ) : (
            <>
              <p className="gcal-sync-float__title">Google Calendar</p>
              <button type="button" disabled={googleBusy} onClick={onConnect}>
                {googleBusy ? '…' : 'Connect'}
              </button>
            </>
          )}
          {googleNotice && <p className="gcal-sync-float__notice">{googleNotice}</p>}
        </div>
      )}
    </div>
  )
})

function MiniCalendar({ anchor, onPickDay, onMonthChange }) {
  const grid = getMiniMonthGrid(anchor)
  const month = anchor.getMonth()

  return (
    <div className="gcal-mini-cal">
      <div className="gcal-mini-cal__head">
        <span className="gcal-mini-cal__title">
          {anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <div className="gcal-mini-cal__nav">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onMonthChange(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onMonthChange(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
          >
            ›
          </button>
        </div>
      </div>
      <div className="gcal-mini-cal__weekdays">
        {MINI_WEEKDAYS.map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="gcal-mini-cal__grid">
        {grid.map((day) => {
          const isToday = sameDay(day, new Date())
          const isSelected = sameDay(day, anchor)
          const off = day.getMonth() !== month
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={[
                'gcal-mini-cal__day',
                off ? 'gcal-mini-cal__day--off' : '',
                isToday ? 'gcal-mini-cal__day--today' : '',
                isSelected && !isToday ? 'gcal-mini-cal__day--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onPickDay(day)}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MonthView({ anchor, eventsByDay, onSelect, onSelectDay, onGoToDay, mobile = false }) {
  const grid = getMonthGrid(anchor)
  const month = anchor.getMonth()
  const maxVisible = mobile ? 2 : 3

  return (
    <div className={`gcal-month${mobile ? ' gcal-month--mobile' : ''}`}>
      <div className="gcal-month__head">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="gcal-month__head-cell">
            {d}
          </div>
        ))}
      </div>
      <div className="gcal-month__grid">
        {grid.map((day) => {
          const dayEvents = eventsByDay.get(formatDayKey(day)) || []
          const inMonth = day.getMonth() === month
          const isToday = sameDay(day, new Date())
          const pendingTasks = dayEvents.filter((e) => e.kind === 'task' && e.timeStatus !== 'completed')

          return (
            <div
              key={day.toISOString()}
              className={`gcal-month__cell${!inMonth ? ' gcal-month__cell--off' : ''}`}
            >
              <div className="gcal-month__date">
                <button
                  type="button"
                  className={`gcal-month__date-btn${isToday ? ' gcal-month__date-btn--today' : ''}`}
                  onClick={() => onGoToDay(day)}
                >
                  {day.getDate()}
                </button>
              </div>
              <div className="gcal-month__events">
                {dayEvents.slice(0, maxVisible).map((ev) => (
                  <MonthEventChip key={ev.id} event={ev} onSelect={onSelect} mobile={mobile} />
                ))}
                {dayEvents.length > maxVisible && (
                  <button
                    type="button"
                    className="gcal-month__more"
                    onClick={() => onSelectDay(day, dayEvents)}
                  >
                    {dayEvents.length - maxVisible} more
                  </button>
                )}
                {pendingTasks.length > 0 && dayEvents.length <= maxVisible && (
                  <button
                    type="button"
                    className="gcal-month__tasks-bar"
                    onClick={() => onSelectDay(day, dayEvents)}
                  >
                    ✓ {pendingTasks.length} pending task{pendingTasks.length === 1 ? '' : 's'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MonthEventChip({ event, onSelect, mobile = false }) {
  const colors = kindColor(event.kind)
  if (mobile) {
    const filled = event.kind === 'meeting' || event.kind === 'google'
    return (
      <button
        type="button"
        className={`gcal-mobile-month-pill${filled ? ' gcal-mobile-month-pill--fill' : ''}`}
        style={{
          borderColor: colors.border,
          color: filled ? '#fff' : colors.border,
          background: filled ? colors.dot : '#fff',
        }}
        onClick={() => onSelect(event)}
      >
        {event.title}
      </button>
    )
  }
  return (
    <button type="button" className="gcal-month__event" onClick={() => onSelect(event)}>
      <span className="gcal-month__event-dot" style={{ background: colors.dot }} />
      <span className="gcal-month__event-text">
        {formatEventTime(event.scheduledAt)} {event.title}
      </span>
    </button>
  )
}

function TimeGridView({ mode, anchor, eventsByDay, onSelect, onGoToDay }) {
  const scrollRef = useRef(null)
  const days = useMemo(
    () => (mode === 'day' ? [startOfDay(anchor)] : getWeekDays(anchor)),
    [mode, anchor]
  )
  const today = new Date()

  const layoutsByDay = useMemo(() => {
    const map = new Map()
    for (const day of days) {
      const dayEvents = eventsByDay.get(formatDayKey(day)) || []
      map.set(formatDayKey(day), layoutTimedEvents(dayEvents))
    }
    return map
  }, [days, eventsByDay])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const now = new Date()
    const scrollTop = Math.max(0, now.getHours() * GCAL_HOUR_HEIGHT - 120)
    el.scrollTop = scrollTop
  }, [mode, anchor])

  const nowMinutes = today.getHours() * 60 + today.getMinutes()
  const nowTop = (nowMinutes / 60) * GCAL_HOUR_HEIGHT
  const showNow = days.some((d) => sameDay(d, today))

  return (
    <div className="gcal-timegrid-wrap" ref={scrollRef}>
      <div className="gcal-timegrid__header">
        <div className="gcal-timegrid__gutter" />
        <div className="gcal-timegrid__cols" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
          {days.map((day) => {
            const isToday = sameDay(day, today)
            return (
              <div key={day.toISOString()} className="gcal-timegrid__day-head">
                <div className="gcal-timegrid__day-name">
                  {day.toLocaleDateString(undefined, { weekday: 'short' })}
                </div>
                <button
                  type="button"
                  className={`gcal-timegrid__day-num${isToday ? ' gcal-timegrid__day-num--today' : ''}`}
                  onClick={() => onGoToDay(day)}
                >
                  {day.getDate()}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="gcal-timegrid__body">
        <div className="gcal-timegrid__hours">
          {GCAL_HOURS.map((h) => (
            <div key={h} className="gcal-timegrid__hour-label">
              {h === 0
                ? ''
                : new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric' })}
            </div>
          ))}
        </div>
        <div className="gcal-timegrid__cols" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
          {days.map((day) => {
            const layouts = layoutsByDay.get(formatDayKey(day)) || []
            const isToday = sameDay(day, today)
            return (
              <div key={day.toISOString()} className="gcal-timegrid__col">
                {GCAL_HOURS.map((h) => (
                  <div
                    key={h}
                    className="gcal-timegrid__hour-line"
                    style={{ top: h * GCAL_HOUR_HEIGHT }}
                  />
                ))}
                {isToday && showNow && (
                  <div className="gcal-timegrid__now-line" style={{ top: nowTop }} />
                )}
                {layouts.map(({ event, top, height }) => {
                  const colors = kindColor(event.kind)
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className="gcal-timegrid__event"
                      style={{
                        top,
                        height,
                        background: colors.bg,
                        borderLeftColor: colors.border,
                        color: '#3c4043',
                      }}
                      onClick={() => onSelect(event)}
                    >
                      <div className="gcal-timegrid__event-title">{event.title}</div>
                      <div className="gcal-timegrid__event-time">{formatEventTime(event.scheduledAt)}</div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function weekHeaderLabel(day) {
  const week = getWeekDays(day)
  const a = week[0]
  const b = week[6]
  const fmt = (d, opts) => d.toLocaleDateString(undefined, opts).toUpperCase()
  if (a.getMonth() === b.getMonth()) {
    return `${fmt(a, { month: 'long' })} ${a.getDate()} – ${b.getDate()}`
  }
  return `${fmt(a, { month: 'short', day: 'numeric' })} – ${fmt(b, { month: 'short', day: 'numeric' })}`
}

function ScheduleView({ events, onSelect, upcomingOnly, mobile = false, memberName }) {
  const grouped = groupEventsByDay(events)
  const keys = [...grouped.keys()].sort()
  const todayKey = new Intl.DateTimeFormat('en-CA').format(new Date())
  let lastWeekKey = ''

  if (!keys.length) return null

  return (
    <div className={`gcal-schedule${mobile ? ' gcal-schedule--mobile' : ''}`}>
      {keys.map((key) => {
        const day = new Date(`${key}T12:00:00`)
        const isToday = key === todayKey
        const dayEvents = sortEventsByTime(grouped.get(key))
        const weekKey = formatDayKey(getWeekDays(day)[0])
        const showWeekHeader = mobile && weekKey !== lastWeekKey
        if (showWeekHeader) lastWeekKey = weekKey

        const pendingTasks = dayEvents.filter((e) => e.kind === 'task' && e.timeStatus !== 'completed')

        return (
          <div key={key}>
            {showWeekHeader && <p className="gcal-schedule__week-head">{weekHeaderLabel(day)}</p>}
            <section className="gcal-schedule__day">
              <div className="gcal-schedule__day-label">
                <span className={`gcal-schedule__weekday${isToday ? ' gcal-schedule__weekday--today' : ''}`}>
                  {day.toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
                <span className={`gcal-schedule__dom${isToday ? ' gcal-schedule__dom--today' : ''}`}>
                  {isToday ? <span className="gcal-schedule__dom-circle">{day.getDate()}</span> : day.getDate()}
                </span>
              </div>
              <div className="gcal-schedule__events">
                {isToday && mobile && <div className="gcal-schedule__now-line" aria-hidden />}
                {mobile && pendingTasks.length > 0 && (
                  <button type="button" className="gcal-schedule__tasks-pill" onClick={() => onSelect(pendingTasks[0])}>
                    ✓ {pendingTasks.length} pending task{pendingTasks.length === 1 ? '' : 's'}
                  </button>
                )}
                {dayEvents.map((ev) => {
                  const colors = kindColor(ev.kind)
                  const avatarName =
                    ev.kind === 'google'
                      ? 'G'
                      : memberName?.(ev.assignedToUserId) || ev.leadName || colors.label

                  if (mobile) {
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        className="gcal-schedule__card"
                        style={{ borderColor: colors.border }}
                        onClick={() => onSelect(ev)}
                      >
                        <div className="gcal-schedule__card-body">
                          <span className="gcal-schedule__card-title" style={{ color: colors.border }}>
                            {ev.title}
                          </span>
                          <span className="gcal-schedule__card-time">
                            {formatEventTimeRange(ev)}
                            {ev.location ? ` · ${ev.location}` : ''}
                          </span>
                        </div>
                        <span className="gcal-schedule__card-avatar" style={{ background: colors.dot }}>
                          {personInitials(avatarName)}
                        </span>
                      </button>
                    )
                  }

                  return (
                    <button
                      key={ev.id}
                      type="button"
                      className="gcal-schedule__event"
                      onClick={() => onSelect(ev)}
                    >
                      <span className="gcal-schedule__event-bar" style={{ background: colors.dot }} />
                      <span className="gcal-schedule__event-time">
                        {upcomingOnly && isToday && new Date(ev.scheduledAt).getTime() < Date.now()
                          ? 'Now'
                          : formatEventTime(ev.scheduledAt)}
                      </span>
                      <span className="gcal-schedule__event-body">
                        <span className="gcal-schedule__event-title">{ev.title}</span>
                        <span className="gcal-schedule__event-meta">
                          {ev.kind === 'google'
                            ? 'Google Calendar'
                            : [ev.leadName, ev.company].filter(Boolean).join(' · ') || colors.label}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        )
      })}
    </div>
  )
}

function DayEventsDrawer({ day, events, onClose, onSelectEvent }) {
  const sorted = sortEventsByTime(events)
  const label = day.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <>
      <button type="button" aria-label="Close" className="gcal-drawer-backdrop" onClick={onClose} />
      <aside className="gcal-drawer">
        <div className="gcal-drawer__head">
          <div style={{ flex: 1 }}>
            <p className="gcal-drawer__row-label">Day schedule</p>
            <h2 className="gcal-drawer__title">{label}</h2>
            <p style={{ fontSize: 12, color: '#70757a', margin: '4px 0 0' }}>
              {sorted.length} event{sorted.length === 1 ? '' : 's'}
            </p>
          </div>
          <button type="button" className="gcal-drawer__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="gcal-drawer__body">
          {sorted.map((ev) => (
            <ScheduleEventRow key={ev.id} event={ev} onClick={() => onSelectEvent(ev)} />
          ))}
        </div>
      </aside>
    </>
  )
}

function ScheduleEventRow({ event, onClick }) {
  const colors = kindColor(event.kind)
  return (
    <button type="button" className="gcal-schedule__event" onClick={onClick} style={{ width: '100%' }}>
      <span className="gcal-schedule__event-bar" style={{ background: colors.dot }} />
      <span className="gcal-schedule__event-time">{formatEventTime(event.scheduledAt)}</span>
      <span className="gcal-schedule__event-body">
        <span className="gcal-schedule__event-title">{event.title}</span>
        <span className="gcal-schedule__event-meta">
          {event.kind === 'google' ? 'Google Calendar' : event.leadName || colors.label}
        </span>
      </span>
    </button>
  )
}

function EventDetailDrawer({ event, memberName, onClose, onOpenLead }) {
  const colors = kindColor(event.kind)
  const participants = (event.participantUserIds || []).filter((id) => id !== event.assignedToUserId)

  return (
    <>
      <button type="button" aria-label="Close" className="gcal-drawer-backdrop" onClick={onClose} />
      <aside className="gcal-drawer">
        <div className="gcal-drawer__head">
          <span className="gcal-drawer__color" style={{ background: colors.dot }} />
          <div style={{ flex: 1 }}>
            <h2 className="gcal-drawer__title">{event.title}</h2>
            <StatusPill status={event.timeStatus} />
          </div>
          <button type="button" className="gcal-drawer__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="gcal-drawer__body">
          <DrawerRow icon="🕐" label="When" value={formatDateTime(event.scheduledAt)} />
          {event.endAt && <DrawerRow icon="🕐" label="Ends" value={formatDateTime(event.endAt)} />}
          {event.kind !== 'google' && (
            <DrawerRow
              icon="👤"
              label="Lead"
              value={`${event.leadName || '—'}${event.company ? ` · ${event.company}` : ''}`}
            />
          )}
          {event.kind === 'google' && <DrawerRow icon="📅" label="Source" value="Google Calendar" />}
          {event.type && (
            <DrawerRow icon="📋" label="Type" value={String(event.type).replace(/_/g, ' ')} />
          )}
          {event.location && <DrawerRow icon="📍" label="Location" value={event.location} />}
          {event.notes && <DrawerRow icon="📝" label="Notes" value={event.notes} />}
          {event.assignedToUserId && (
            <DrawerRow icon="👤" label="Owner" value={memberName(event.assignedToUserId)} />
          )}
          {participants.length > 0 && (
            <DrawerRow icon="👥" label="With" value={participants.map((id) => memberName(id)).join(', ')} />
          )}
          {event.createdByName && <DrawerRow icon="✏️" label="Created by" value={event.createdByName} />}
          {event.completedAt && <DrawerRow icon="✓" label="Completed" value={formatDateTime(event.completedAt)} />}
          {event.visitRecordedAt && (
            <DrawerRow icon="📍" label="Visit logged" value={formatDateTime(event.visitRecordedAt)} />
          )}
        </div>
        <div className="gcal-drawer__foot">
          {event.kind === 'google' && event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="gcal-drawer__btn gcal-drawer__btn--primary"
            >
              Open in Google Calendar
            </a>
          )}
          {event.leadId && (
            <button type="button" onClick={onOpenLead} className="gcal-drawer__btn gcal-drawer__btn--primary">
              Open lead in pipeline
            </button>
          )}
          <button type="button" onClick={onClose} className="gcal-drawer__btn gcal-drawer__btn--secondary">
            Close
          </button>
        </div>
      </aside>
    </>
  )
}

function DrawerRow({ icon, label, value }) {
  return (
    <div className="gcal-drawer__row">
      <span className="gcal-drawer__row-icon" aria-hidden>
        {icon}
      </span>
      <div>
        <div className="gcal-drawer__row-label">{label}</div>
        <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{value}</div>
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    upcoming: 'gcal-status gcal-status--upcoming',
    past: 'gcal-status gcal-status--past',
    completed: 'gcal-status gcal-status--completed',
  }
  return <span className={map[status] || map.past}>{status || 'past'}</span>
}
