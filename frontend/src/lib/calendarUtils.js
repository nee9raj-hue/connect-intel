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
  return d.toISOString().slice(0, 10)
}

export function getWeekDays(anchor) {
  const start = startOfDay(anchor)
  const day = start.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = addDays(start, mondayOffset)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function getMonthGrid(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = startOfDay(first)
  const day = start.getDay()
  const gridStart = addDays(start, day === 0 ? -6 : 1 - day)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
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

export function calendarRangeForView(view, anchor) {
  const now = Date.now()
  if (view === 'week') {
    const days = getWeekDays(anchor)
    return {
      from: days[0].toISOString(),
      to: addDays(days[6], 1).toISOString(),
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

export const KIND_STYLES = {
  task: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', label: 'Task' },
  meeting: { bg: 'bg-[#fffbeb]', border: 'border-[#fde68a]', text: 'text-[#5b4a00]', label: 'Meeting' },
  follow_up: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', label: 'Follow-up' },
}
