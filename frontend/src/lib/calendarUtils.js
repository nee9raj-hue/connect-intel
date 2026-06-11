import { getUserTimeZone } from './dateLocale.js'

const MS_DAY = 86400000

export function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function formatDayKey(d) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: getUserTimeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** Week starting Sunday (Google Calendar default). */
export function getWeekDays(anchor) {
  const start = startOfDay(anchor)
  const sunday = addDays(start, -start.getDay())
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i))
}

/** 6-week month grid, Sunday-first. */
export function getMonthGrid(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = startOfDay(first)
  const gridStart = addDays(start, -start.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

export const GCAL_HOUR_HEIGHT = 48
export const GCAL_HOURS = Array.from({ length: 24 }, (_, i) => i)

export function formatEventTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function eventDurationMs(event) {
  if (event?.endAt) {
    const ms = new Date(event.endAt).getTime() - new Date(event.scheduledAt).getTime()
    if (ms > 0) return ms
  }
  if (event?.durationMinutes) return Number(event.durationMinutes) * 60 * 1000
  return 30 * 60 * 1000
}

export function sortEventsByTime(events) {
  return [...(events || [])].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  )
}

/** Position timed events on a day column (top/height in px). */
export function layoutTimedEvents(events, day) {
  return sortEventsByTime(eventsForDay(events, day)).map((ev) => {
    const start = new Date(ev.scheduledAt)
    const startMinutes = start.getHours() * 60 + start.getMinutes()
    const durationMin = eventDurationMs(ev) / 60000
    return {
      event: ev,
      top: (startMinutes / 60) * GCAL_HOUR_HEIGHT,
      height: Math.max((durationMin / 60) * GCAL_HOUR_HEIGHT, 22),
    }
  })
}

export function calendarRangeForView(view, anchor) {
  const now = Date.now()
  if (view === 'week' || view === 'day') {
    const days = view === 'day' ? [startOfDay(anchor)] : getWeekDays(anchor)
    return {
      from: days[0].toISOString(),
      to: addDays(days[days.length - 1], 1).toISOString(),
    }
  }
  if (view === 'month') {
    const grid = getMonthGrid(anchor)
    return {
      from: grid[0].toISOString(),
      to: addDays(grid[grid.length - 1], 1).toISOString(),
    }
  }
  return {
    from: new Date(now - 90 * MS_DAY).toISOString(),
    to: new Date(now + 365 * MS_DAY).toISOString(),
  }
}

export function eventsForDay(events, day) {
  return events.filter((e) => {
    if (!e.scheduledAt) return false
    return sameDay(new Date(e.scheduledAt), day)
  })
}

export function groupEventsByDay(events) {
  const map = new Map()
  for (const e of events) {
    const key = formatDayKey(new Date(e.scheduledAt))
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(e)
  }
  return map
}

export const KIND_COLORS = {
  task: { dot: '#7986cb', bg: '#e8eaf6', border: '#7986cb', label: 'Task' },
  meeting: { dot: '#039be5', bg: '#e1f5fe', border: '#039be5', label: 'Meeting' },
  follow_up: { dot: '#f4511e', bg: '#fbe9e7', border: '#f4511e', label: 'Follow-up' },
  google: { dot: '#33b679', bg: '#e6f4ea', border: '#33b679', label: 'Google' },
}

/** @deprecated use KIND_COLORS — kept for any legacy imports */
export const KIND_STYLES = {
  task: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', label: 'Task' },
  meeting: { bg: 'bg-[#fff4ee]', border: 'border-[#ffd4b8]', text: 'text-[#475569]', label: 'Meeting' },
  follow_up: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', label: 'Follow-up' },
  google: { bg: 'bg-slate-100', border: 'border-slate-200', text: 'text-[#64748B]', label: 'Google' },
}

export const CALENDAR_FILTER_OPTIONS = [
  { id: 'task', label: 'Tasks' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'follow_up', label: 'Follow-ups' },
  { id: 'google', label: 'Google Calendar' },
]

export function getMiniMonthGrid(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = startOfDay(first)
  const gridStart = addDays(start, -start.getDay())
  const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const weeks = Math.ceil((start.getDay() + lastDay.getDate()) / 7)
  const cells = weeks * 7
  return Array.from({ length: cells }, (_, i) => addDays(gridStart, i))
}
