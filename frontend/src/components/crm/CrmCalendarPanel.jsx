import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { formatDateTime } from '../../lib/crmUiConstants'
import LoadingExperience from '../ui/LoadingExperience'
import { LOADING_MESSAGES } from '../../lib/loadingQuotes'
import {
  KIND_STYLES,
  addDays,
  calendarRangeForView,
  eventsForDay,
  getMonthGrid,
  getWeekDays,
  groupEventsByDay,
  sameDay,
  startOfDay,
} from '../../lib/calendarUtils'

function parseFocusDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : startOfDay(d)
}

const VIEWS = [
  { id: 'list', label: 'List' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
]

export default function CrmCalendarPanel({ onNavigate, panelOptions }) {
  const { openPipelineLead, calendarFocus, clearCalendarFocus } = useApp()
  const upcomingOnly = Boolean(panelOptions?.upcomingOnly)
  const [view, setView] = useState('list')
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [events, setEvents] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [googleCal, setGoogleCal] = useState(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [googleNotice, setGoogleNotice] = useState(null)

  useEffect(() => {
    if (panelOptions?.upcomingOnly) {
      setView('list')
      setAnchor(startOfDay(new Date()))
    }
  }, [panelOptions?.upcomingOnly])

  useEffect(() => {
    if (!calendarFocus?.scheduledAt) return
    const day = parseFocusDate(calendarFocus.scheduledAt)
    if (day) setAnchor(day)
  }, [calendarFocus?.scheduledAt, calendarFocus?.eventId])

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
      setView('list')
      setSelected(match)
      clearCalendarFocus()
    }
  }, [calendarFocus, events, loading, clearCalendarFocus])

  const memberName = useMemo(() => {
    const map = Object.fromEntries(members.map((m) => [m.userId, m.name]))
    return (id) => map[id] || 'Team member'
  }, [members])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let q
      if (upcomingOnly) {
        const from = startOfDay(new Date())
        const to = addDays(from, 90)
        q = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() }).toString()
      } else {
        const range = calendarRangeForView(view, anchor)
        q = new URLSearchParams({ from: range.from, to: range.to }).toString()
      }
      const data = await api.getCrmCalendar(q)
      setEvents(data.events || [])
      setMembers(data.members || [])
      setGoogleCal(data.googleCalendar || null)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [view, anchor, upcomingOnly])

  const visibleEvents = useMemo(() => {
    if (!upcomingOnly) return events
    const now = Date.now()
    return events.filter((e) => new Date(e.scheduledAt).getTime() >= now)
  }, [events, upcomingOnly])

  useEffect(() => {
    load()
  }, [load])

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
      load()
    } catch (e) {
      setGoogleNotice(e.message || 'Sync failed')
    } finally {
      setGoogleBusy(false)
    }
  }

  const shiftAnchor = (delta) => {
    if (view === 'month') {
      setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1))
    } else if (view === 'week') {
      setAnchor(addDays(anchor, delta * 7))
    } else {
      setAnchor(addDays(anchor, delta))
    }
  }

  const headerLabel = useMemo(() => {
    if (view === 'month') {
      return anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    }
    if (view === 'week') {
      const days = getWeekDays(anchor)
      const a = days[0]
      const b = days[6]
      return `${a.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${b.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    }
    if (upcomingOnly) return 'Upcoming only'
    return 'All tasks & meetings'
  }, [view, anchor, upcomingOnly])

  return (
    <div className="panel-shell relative">
      <header className="shrink-0 bg-white border-b border-gray-200 px-4 md:px-5 py-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {upcomingOnly ? 'Upcoming meetings' : 'Calendar'}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {upcomingOnly
                ? 'Tasks and meetings from now — next 90 days'
                : 'Tasks, meetings, and follow-ups · past items kept for history'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setAnchor(startOfDay(new Date()))
              load()
            }}
            className="text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Today
          </button>
        </div>

        {!upcomingOnly && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-xs text-emerald-950 space-y-2">
            <p className="font-semibold">Google Calendar sync</p>
            <p className="text-emerald-900/90 leading-relaxed">
              {googleCal?.calendarScope
                ? 'CRM meetings can be added to Google Calendar. Import your Google events here (read-only, green).'
                : 'Connect the same work Google account to show Gmail Calendar events and push new CRM meetings.'}
            </p>
            <div className="flex flex-wrap gap-2">
              {!googleCal?.calendarScope && (
                <button
                  type="button"
                  disabled={googleBusy}
                  onClick={connectGoogleCalendar}
                  className="font-semibold px-3 py-1.5 rounded-lg bg-emerald-700 text-white disabled:opacity-50"
                >
                  {googleBusy ? 'Connecting…' : 'Connect Google Calendar'}
                </button>
              )}
              {googleCal?.calendarScope && (
                <>
                  <button
                    type="button"
                    disabled={googleBusy}
                    onClick={syncGoogleCalendar}
                    className="font-semibold px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 disabled:opacity-50"
                  >
                    {googleBusy ? 'Syncing…' : 'Sync from Google'}
                  </button>
                  {googleCal.lastSyncAt && (
                    <span className="self-center text-xs text-emerald-800">
                      Last sync {formatDateTime(googleCal.lastSyncAt)}
                    </span>
                  )}
                </>
              )}
            </div>
            {googleNotice && <p className="text-xs font-medium">{googleNotice}</p>}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!upcomingOnly && (
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  className={`px-3 py-1.5 ${view === v.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
          {!upcomingOnly && view !== 'list' && (
            <div className="flex items-center gap-1 ml-auto">
              <button type="button" onClick={() => shiftAnchor(-1)} className="px-2 py-1 text-sm border rounded-lg">
                ‹
              </button>
              <span className="text-sm font-medium text-gray-800 min-w-[140px] text-center">{headerLabel}</span>
              <button type="button" onClick={() => shiftAnchor(1)} className="px-2 py-1 text-sm border rounded-lg">
                ›
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="panel-body-scroll p-4 md:p-5">
        {loading ? (
          <LoadingExperience message={LOADING_MESSAGES.calendar} fill={false} className="rounded-xl border border-gray-200 min-h-[200px]" />
        ) : null}
        {!loading && visibleEvents.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center max-w-md mx-auto">
            <p className="text-sm text-gray-600">No tasks or meetings in this range.</p>
            <p className="text-xs text-gray-400 mt-2">
              Create them from Pipeline → open a lead → Tasks & meetings.
            </p>
            <button
              type="button"
              onClick={() => onNavigate?.('pipeline')}
              className="mt-4 text-xs font-semibold underline text-gray-800"
            >
              Open pipeline
            </button>
          </div>
        )}

        {!loading && view === 'list' && visibleEvents.length > 0 && (
          <ListView events={visibleEvents} onSelect={setSelected} />
        )}

        {!loading && view === 'week' && (
          <WeekView days={getWeekDays(anchor)} events={events} onSelect={setSelected} />
        )}

        {!loading && view === 'month' && (
          <MonthView anchor={anchor} events={events} onSelect={setSelected} />
        )}
      </div>

      {selected && (
        <EventDetailDrawer
          event={selected}
          memberName={memberName}
          onClose={() => setSelected(null)}
          onOpenLead={() => {
            openPipelineLead(selected.leadId)
            onNavigate?.('pipeline')
          }}
        />
      )}
    </div>
  )
}

function ListView({ events, onSelect }) {
  const grouped = groupEventsByDay(events)
  const keys = [...grouped.keys()].sort()

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {keys.map((key) => (
        <section key={key}>
          <h2 className="text-xs font-bold uppercase text-gray-400 mb-2 sticky top-0 bg-[var(--color-hs-canvas)] py-1">
            {new Date(key).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </h2>
          <ul className="space-y-2">
            {grouped.get(key).map((ev) => (
              <EventChip key={ev.id} event={ev} onClick={() => onSelect(ev)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function WeekView({ days, events, onSelect }) {
  return (
    <div className="grid grid-cols-7 gap-1 min-h-[320px]">
      {days.map((day) => {
        const dayEvents = eventsForDay(events, day)
        const isToday = sameDay(day, new Date())
        return (
          <div
            key={day.toISOString()}
            className={`bg-white border rounded-lg min-h-[120px] flex flex-col ${
              isToday ? 'border-[#FF773D] ring-1 ring-[#FF773D]/40' : 'border-gray-200'
            }`}
          >
            <p className={`text-xs font-bold px-2 py-1.5 border-b ${isToday ? 'bg-[#fff4ee]' : 'bg-gray-50'}`}>
              {day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
            </p>
            <div className="flex-1 overflow-y-auto p-1 space-y-1">
              {dayEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onSelect(ev)}
                  className={`w-full text-left text-xs px-1.5 py-1 rounded border truncate ${KIND_STYLES[ev.kind]?.bg} ${KIND_STYLES[ev.kind]?.border}`}
                >
                  {new Date(ev.scheduledAt).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  {ev.title}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MonthView({ anchor, events, onSelect }) {
  const grid = getMonthGrid(anchor)
  const month = anchor.getMonth()

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500 uppercase">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="px-2 py-2 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {grid.map((day) => {
          const dayEvents = eventsForDay(events, day)
          const inMonth = day.getMonth() === month
          const isToday = sameDay(day, new Date())
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => dayEvents[0] && onSelect(dayEvents[0])}
              className={`min-h-[72px] border-t border-r border-gray-100 p-1 text-left hover:bg-gray-50 ${
                !inMonth ? 'bg-gray-50/80 text-gray-400' : ''
              } ${isToday ? 'bg-[#fff4ee]/60' : ''}`}
            >
              <span className={`text-xs font-semibold ${isToday ? 'text-[#8a6600]' : ''}`}>
                {day.getDate()}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <span
                    key={ev.id}
                    className={`block text-xs truncate px-1 rounded ${KIND_STYLES[ev.kind]?.bg}`}
                  >
                    {ev.title}
                  </span>
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-xs text-gray-500">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EventChip({ event, onClick }) {
  const style = KIND_STYLES[event.kind] || KIND_STYLES.task
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 hover:shadow-sm transition-shadow ${style.bg} ${style.border}`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold uppercase ${style.text}`}>{style.label}</span>
        <StatusPill status={event.timeStatus} />
      </div>
      <p className="text-sm font-semibold text-gray-900 mt-1">{event.title}</p>
      <p className="text-xs text-gray-600">
        {event.kind === 'google'
          ? 'From Google Calendar'
          : `${event.leadName || ''}${event.company ? ` · ${event.company}` : ''}`}
      </p>
      <p className="text-xs text-gray-500 mt-1">{formatDateTime(event.scheduledAt)}</p>
    </button>
  )
}

function StatusPill({ status }) {
  const map = {
    upcoming: 'bg-emerald-100 text-emerald-800',
    past: 'bg-gray-200 text-gray-600',
    completed: 'bg-blue-100 text-blue-800',
  }
  return (
    <span className={`text-xs font-bold uppercase px-1.5 py-0.5 rounded-full ${map[status] || map.past}`}>
      {status || 'past'}
    </span>
  )
}

function EventDetailDrawer({ event, memberName, onClose, onOpenLead }) {
  const style = KIND_STYLES[event.kind] || KIND_STYLES.task
  const participants = (event.participantUserIds || []).filter((id) => id !== event.assignedToUserId)

  return (
    <>
      <button type="button" aria-label="Close" className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white shadow-xl border-l border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <span className={`text-xs font-bold uppercase ${style.text}`}>{style.label}</span>
            <h2 className="text-lg font-semibold text-gray-900 mt-1">{event.title}</h2>
            <StatusPill status={event.timeStatus} />
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
          <DetailRow label="When" value={formatDateTime(event.scheduledAt)} />
          {event.endAt && <DetailRow label="Ends" value={formatDateTime(event.endAt)} />}
          {event.kind !== 'google' && (
            <DetailRow label="Lead" value={`${event.leadName}${event.company ? ` (${event.company})` : ''}`} />
          )}
          {event.kind === 'google' && (
            <DetailRow label="Source" value="Google Calendar (imported)" />
          )}
          {event.type && <DetailRow label="Type" value={String(event.type).replace('_', ' ')} />}
          {event.location && <DetailRow label="Location" value={event.location} />}
          {event.notes && <DetailRow label="Notes" value={event.notes} />}
          {event.assignedToUserId && (
            <DetailRow label="Owner" value={memberName(event.assignedToUserId)} />
          )}
          {participants.length > 0 && (
            <DetailRow label="With" value={participants.map((id) => memberName(id)).join(', ')} />
          )}
          {event.createdByName && <DetailRow label="Created by" value={event.createdByName} />}
          {event.completedAt && <DetailRow label="Completed" value={formatDateTime(event.completedAt)} />}
          {event.visitRecordedAt && (
            <DetailRow label="Visit logged" value={formatDateTime(event.visitRecordedAt)} />
          )}
        </div>
        <div className="shrink-0 p-4 border-t border-gray-100 space-y-2">
          {event.kind === 'google' && event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-2.5 text-center bg-emerald-700 text-white text-sm font-semibold rounded-lg"
            >
              Open in Google Calendar
            </a>
          )}
          {event.leadId && (
            <button
              type="button"
              onClick={onOpenLead}
              className="w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg"
            >
              Open lead in pipeline
            </button>
          )}
        </div>
      </aside>
    </>
  )
}

function DetailRow({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase text-gray-400">{label}</p>
      <p className="text-gray-800 mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  )
}
