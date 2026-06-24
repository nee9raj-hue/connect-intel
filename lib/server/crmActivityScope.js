/**
 * Canonical CRM activity period — one vocabulary for filters across rep review,
 * team metrics, activity log, and dashboards.
 *
 * Rolling windows: day | 7d | 30d (never calendar week vs rolling 7d mismatch).
 */
export function canonicalActivityPeriod(raw) {
  const p = String(raw || '').trim().toLowerCase()
  if (p === 'today') return 'day'
  if (p === 'day') return 'day'
  if (p === 'week' || p === '7d') return '7d'
  if (p === 'month' || p === '30d') return '30d'
  return '7d'
}

export function activityPeriodQuery(period) {
  return canonicalActivityPeriod(period)
}
