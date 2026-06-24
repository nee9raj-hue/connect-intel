/** Rolling calendar dates for activity APIs (immune to period=week vs 7d mismatches). */
export function rollingActivityRange(days = 7) {
  const to = new Date()
  const from = new Date(to.getTime() - days * 86400000)
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

/** Team review / dashboard lead-activity — always live CRM, explicit date window. */
export function teamReviewActivityQuery({ days = 7, userId = '', limit = 100 } = {}) {
  const { from, to } = rollingActivityRange(days)
  const q = new URLSearchParams({
    from,
    to,
    limit: String(limit),
    offset: '0',
    fresh: '1',
    source: 'crm',
    _v: '2',
  })
  if (userId) q.set('userId', String(userId))
  return q.toString()
}

export function teamReviewMetricsQuery(days = 7) {
  const { from, to } = rollingActivityRange(days)
  return `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&fresh=1&_v=2`
}
