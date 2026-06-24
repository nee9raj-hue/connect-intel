/** Rolling calendar dates for activity APIs (immune to period=week vs 7d mismatches). */
export function rollingActivityRange(days = 7) {
  const to = new Date()
  const from = new Date(to.getTime() - days * 86400000)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

/** Team review lead-activity — rolling window via period (server-cached, CRM fallback when index stale). */
export function teamReviewActivityQuery({ days = 7, userId = '', limit = 100 } = {}) {
  const period = days >= 30 ? '30d' : '7d'
  const q = new URLSearchParams({
    period,
    limit: String(limit),
    offset: '0',
  })
  if (userId) q.set('userId', String(userId))
  return q.toString()
}

/** Rolling team metrics — use period so responses hit the shared dashboard cache. */
export function teamReviewMetricsQuery(days = 7) {
  const period = days >= 30 ? '30d' : '7d'
  return `period=${period}`
}
