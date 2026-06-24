import {
  DEFAULT_TIME_ZONE,
  nextLocalDayMs,
  resolveTimeZone,
  startOfLocalDayMs,
  startOfLocalMonthMs,
  startOfLocalWeekMs,
} from '../calendarLocale.js'

const MS_DAY = 86400000

export const DASHBOARD_PERIODS = ['day', 'week', 'month', '7d', '30d']

export function normalizeDashboardPeriod(raw) {
  if (raw === '7d' || raw === '30d') return raw
  return DASHBOARD_PERIODS.includes(raw) ? raw : 'week'
}

export function periodWindowDays(period, timeZone = DEFAULT_TIME_ZONE) {
  if (period === 'day') return 1
  if (period === '7d') return 7
  if (period === '30d') return 30
  const tz = resolveTimeZone({}, timeZone)
  const start = periodStart(period, tz)
  const todayStart = startOfLocalDayMs(tz)
  return Math.max(1, Math.floor((todayStart - start) / MS_DAY) + 1)
}

/** Inclusive start timestamp for the current calendar window in the user's timezone. */
export function periodStart(period, timeZone = DEFAULT_TIME_ZONE) {
  const tz = resolveTimeZone({}, timeZone)
  const normalized = normalizeDashboardPeriod(period)
  if (normalized === 'day') return startOfLocalDayMs(tz)
  if (normalized === '7d') return Date.now() - 7 * MS_DAY
  if (normalized === '30d') return Date.now() - 30 * MS_DAY
  if (normalized === 'month') return startOfLocalMonthMs(tz)
  return startOfLocalWeekMs(tz)
}

export function previousPeriodStart(period, timeZone = DEFAULT_TIME_ZONE) {
  const tz = resolveTimeZone({}, timeZone)
  const normalized = normalizeDashboardPeriod(period)
  if (normalized === '7d') return Date.now() - 14 * MS_DAY
  if (normalized === '30d') return Date.now() - 60 * MS_DAY
  const current = periodStart(normalized, tz)
  if (normalized === 'day') {
    return startOfLocalDayMs(tz, new Date(current - 12 * 3600 * 1000))
  }
  if (normalized === 'month') {
    const anchor = new Date(current - 12 * 3600 * 1000)
    return startOfLocalMonthMs(tz, anchor)
  }
  return startOfLocalWeekMs(tz, new Date(current - 12 * 3600 * 1000))
}

export function periodLabel(period) {
  if (period === 'day') return 'Today'
  if (period === '7d') return 'Last 7 days'
  if (period === '30d') return 'Last 30 days'
  if (period === 'month') return 'This month'
  return 'This week'
}

export function comparisonPeriodLabel(period) {
  if (period === 'day') return 'yesterday'
  if (period === 'month') return 'previous month'
  return 'previous week'
}

export { nextLocalDayMs, MS_DAY }
