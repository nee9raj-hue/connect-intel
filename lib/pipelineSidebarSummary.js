/** Org-wide pipeline summary shape + optimistic sidebar count shifts (shared client/server tests). */

export function normalizePipelineSummary(summary = {}) {
  return {
    total: summary.total ?? 0,
    byStatus: summary.byStatus || [],
    cities: summary.cities || [],
    states: summary.states || [],
    openDealCounts: summary.openDealCounts || null,
    dealCounts: summary.dealCounts || null,
  }
}

/** Optimistic sidebar count shift when a lead moves between CRM statuses (SPA, no reload). */
export function bumpPipelineSummaryStatus(summary, fromStatus, toStatus) {
  const from = String(fromStatus || '').trim()
  const to = String(toStatus || '').trim()
  if (!from || !to || from === to) return normalizePipelineSummary(summary)
  const base = normalizePipelineSummary(summary)
  const byStatus = (base.byStatus || []).map((row) => ({ ...row }))
  const find = (st) => byStatus.find((r) => r.status === st)
  const fromRow = find(from)
  const toRow = find(to)
  if (fromRow && fromRow.count > 0) fromRow.count -= 1
  if (toRow) toRow.count += 1
  else if (to) byStatus.push({ status: to, count: 1 })
  return { ...base, byStatus }
}
