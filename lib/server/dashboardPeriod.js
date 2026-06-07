const MS_DAY = 86400000

export const DASHBOARD_PERIODS = ['day', 'week', 'month']

export function normalizeDashboardPeriod(raw) {
  return DASHBOARD_PERIODS.includes(raw) ? raw : 'week'
}

export function periodWindowDays(period) {
  if (period === 'day') return 1
  if (period === 'month') return 30
  return 7
}

/** Inclusive start timestamp for the current dashboard window. */
export function periodStart(period) {
  const now = new Date()
  if (period === 'day') {
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  }
  const days = periodWindowDays(period)
  return Date.now() - days * MS_DAY
}

export function previousPeriodStart(period) {
  const days = periodWindowDays(period)
  return periodStart(period) - days * MS_DAY
}

export function periodLabel(period) {
  if (period === 'day') return 'Today'
  if (period === 'month') return 'This month'
  return 'This week'
}

export function comparisonPeriodLabel(period) {
  if (period === 'day') return '24 hours'
  if (period === 'month') return '30 days'
  return '7 days'
}
