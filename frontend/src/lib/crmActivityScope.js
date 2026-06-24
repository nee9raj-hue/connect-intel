/** Client mirror of lib/server/crmActivityScope.js — keep period filters aligned with APIs. */
export function canonicalActivityPeriod(raw) {
  const p = String(raw || '').trim().toLowerCase()
  if (p === 'today') return 'day'
  if (p === 'day') return 'day'
  if (p === 'week' || p === '7d') return '7d'
  if (p === 'month' || p === '30d') return '30d'
  return '7d'
}

export const REP_REVIEW_PERIODS = [
  { value: 'day', label: 'Today' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
]
