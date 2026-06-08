export const DEFAULT_TIME_ZONE = 'Asia/Kolkata'

export function getUserTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz) return tz
  } catch {
    /* ignore */
  }
  return DEFAULT_TIME_ZONE
}

export function getUserLocale() {
  try {
    return navigator.language || undefined
  } catch {
    return undefined
  }
}

export function appendTimeZoneToQuery(query = '') {
  const q = new URLSearchParams(query)
  if (!q.has('tz')) q.set('tz', getUserTimeZone())
  return q.toString()
}

export function formatDateTime(iso, { dateStyle, timeStyle } = {}) {
  if (!iso) return '—'
  try {
    const opts = {
      timeZone: getUserTimeZone(),
    }
    if (dateStyle || timeStyle) {
      if (dateStyle) opts.dateStyle = dateStyle
      if (timeStyle) opts.timeStyle = timeStyle
    } else {
      opts.month = 'short'
      opts.day = 'numeric'
      opts.year = 'numeric'
      opts.hour = 'numeric'
      opts.minute = '2-digit'
    }
    return new Date(iso).toLocaleString(getUserLocale(), opts)
  } catch {
    return iso
  }
}

export function formatDate(iso, { weekday, month = 'short', day = 'numeric', year } = {}) {
  if (!iso) return '—'
  try {
    const opts = {
      timeZone: getUserTimeZone(),
      month,
      day,
    }
    if (weekday) opts.weekday = weekday
    if (year) opts.year = year
    return new Date(iso).toLocaleDateString(getUserLocale(), opts)
  } catch {
    return '—'
  }
}
