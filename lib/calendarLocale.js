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

/** Shift a local midnight by whole calendar days (DST-safe). */
export function shiftLocalDaysMs(timeZone, dayStartMs, deltaDays) {
  const n = Number(deltaDays) || 0
  if (!n) return dayStartMs
  const sign = n > 0 ? 1 : -1
  let cursor = dayStartMs
  for (let i = 0; i < Math.abs(n); i += 1) {
    cursor =
      sign > 0
        ? nextLocalDayMs(timeZone, cursor)
        : startOfLocalDayMs(timeZone, new Date(cursor - 12 * 3600 * 1000))
  }
  return cursor
}

/**
 * ISO-8601 week (Monday start). Week 1 is the week containing the year's first Thursday.
 * `endMs` is exclusive (next Monday 00:00).
 */
export function isoWeekParts(date, timeZone = DEFAULT_TIME_ZONE) {
  const tz = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE
  const dayStart = startOfLocalDayMs(tz, date)
  const dow = localWeekday(new Date(dayStart), tz)
  const isoDow = dow === 0 ? 7 : dow
  const mondayMs = shiftLocalDaysMs(tz, dayStart, 1 - isoDow)
  const thursdayMs = shiftLocalDaysMs(tz, mondayMs, 3)
  const thuKey = localDateKey(new Date(thursdayMs), tz)
  const isoYear = Number(thuKey?.slice(0, 4) || 0)
  const jan4 = startOfLocalDayMsForKey(tz, `${isoYear}-01-04`)
  const jan4Dow = localWeekday(new Date(jan4), tz)
  const jan4Iso = jan4Dow === 0 ? 7 : jan4Dow
  const week1Monday = shiftLocalDaysMs(tz, jan4, 1 - jan4Iso)
  const startKey = localDateKey(new Date(week1Monday), tz)
  const mondayKey = localDateKey(new Date(mondayMs), tz)
  const [sy, sm, sd] = (startKey || '').split('-').map(Number)
  const [my, mm, md] = (mondayKey || '').split('-').map(Number)
  const dayDiff = Math.round(
    (Date.UTC(my, mm - 1, md) - Date.UTC(sy, sm - 1, sd)) / 86400000
  )
  const week = 1 + Math.round(dayDiff / 7)
  return {
    year: isoYear,
    week,
    mondayMs,
    endMs: shiftLocalDaysMs(tz, mondayMs, 7),
  }
}

/** Distinct ISO weeks that overlap a calendar month, in calendar order. */
export function isoWeeksOverlappingMonth(year, month, timeZone = DEFAULT_TIME_ZONE) {
  const tz = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE
  const y = Number(year)
  const m = Number(month)
  if (!y || m < 1 || m > 12) return []
  const pad = (n) => String(n).padStart(2, '0')
  const start = startOfLocalDayMsForKey(tz, `${y}-${pad(m)}-01`)
  const nextKey = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`
  const monthEnd = startOfLocalDayMsForKey(tz, nextKey)
  const out = []
  const seen = new Set()
  let cursor = start
  let guard = 0
  while (cursor < monthEnd && guard < 8) {
    const parts = isoWeekParts(new Date(cursor), tz)
    const id = String(parts.week)
    if (!seen.has(id)) {
      seen.add(id)
      out.push({
        value: id,
        week: parts.week,
        isoYear: parts.year,
        label: `week${parts.week}`,
        startMs: parts.mondayMs,
        endMs: parts.endMs,
      })
    }
    cursor = parts.endMs
    guard += 1
  }
  return out
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

/** Hour 0–23 in the given IANA timezone (not necessarily the device offset). */
export function getLocalHour(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const d = date instanceof Date ? date : new Date(date)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(d)
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
}

/** Dashboard greeting fragment: morning | afternoon | evening | night */
export function getGreetingDayPart(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const h = getLocalHour(date, timeZone)
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 22) return 'evening'
  return 'night'
}
