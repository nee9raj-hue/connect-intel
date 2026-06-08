const MS_DAY = 86400000

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata'

export function isValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone })
    return true
  } catch {
    return false
  }
}

/** Resolve IANA timezone from request param, user profile, or India default. */
export function resolveTimeZone(user, requestTz) {
  const candidates = [requestTz, user?.timezone, DEFAULT_TIME_ZONE]
  for (const tz of candidates) {
    const trimmed = String(tz || '').trim()
    if (trimmed && isValidTimeZone(trimmed)) return trimmed
  }
  return DEFAULT_TIME_ZONE
}

export function localDateKey(date, timeZone) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function localWeekday(date, timeZone) {
  const d = date instanceof Date ? date : new Date(date)
  const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(d)
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[short] ?? 0
}

/** UTC ms for local midnight on the given instant's calendar day. */
export function startOfLocalDayMs(timeZone, date = new Date()) {
  const key = localDateKey(date, timeZone)
  if (!key) return Date.now()
  return startOfLocalDayMsForKey(timeZone, key)
}

export function startOfLocalDayMsForKey(timeZone, dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  let lo = Date.UTC(y, m - 1, d - 1, 0, 0, 0)
  let hi = Date.UTC(y, m - 1, d + 2, 0, 0, 0)
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    const midKey = localDateKey(new Date(mid), timeZone)
    if (midKey < dateKey) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function nextLocalDayMs(timeZone, dayStartMs) {
  return startOfLocalDayMs(timeZone, new Date(dayStartMs + 36 * 3600 * 1000))
}

/** Monday 00:00 in the user's timezone. */
export function startOfLocalWeekMs(timeZone, date = new Date()) {
  let cursor = startOfLocalDayMs(timeZone, date)
  for (let i = 0; i < 8; i += 1) {
    const dow = localWeekday(new Date(cursor), timeZone)
    if (dow === 1) return cursor
    cursor = startOfLocalDayMs(timeZone, new Date(cursor - 12 * 3600 * 1000))
  }
  return cursor
}

/** First day of the local calendar month at 00:00. */
export function startOfLocalMonthMs(timeZone, date = new Date()) {
  const key = localDateKey(date, timeZone)
  if (!key) return Date.now()
  const [y, m] = key.split('-')
  return startOfLocalDayMsForKey(timeZone, `${y}-${m}-01`)
}

export function formatLocalDateLabel(date, timeZone, { weekday = true } = {}) {
  const d = date instanceof Date ? date : new Date(date)
  const opts = { timeZone, day: 'numeric' }
  if (weekday) opts.weekday = 'short'
  return new Intl.DateTimeFormat(undefined, opts).format(d)
}
