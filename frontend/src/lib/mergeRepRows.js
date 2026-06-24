/** Merge bootstrap rep stats with live team roster so new members always appear in review tables. */
export function mergeRepPerformanceRows(repPerformance = [], teamMembers = [], intelByUser = new Map()) {
  const perfById = new Map((repPerformance || []).map((r) => [String(r.userId), r]))
  const seen = new Set()
  const rows = []

  const defaultActions = (userId) => ({
    action: { panel: 'pipeline', userId, assigneeUserId: userId, returnTo: 'overview' },
    cellActions: {
      open: { panel: 'pipeline', userId, assigneeUserId: userId, returnTo: 'overview' },
      followups: {
        panel: 'pipeline',
        status: 'follow_up',
        followUpDue: true,
        userId,
        assigneeUserId: userId,
        returnTo: 'overview',
      },
      won: {
        panel: 'pipeline',
        status: 'won',
        wonThisMonth: true,
        userId,
        assigneeUserId: userId,
        returnTo: 'overview',
      },
      activities: { panel: 'crm-log', userId, period: 'week', returnTo: 'overview' },
    },
  })

  const push = (userId, name, perf = {}) => {
    const id = String(userId || '')
    if (!id || seen.has(id)) return
    seen.add(id)
    const intel = intelByUser.get(id) || {}
    const actions = perf.action ? perf : defaultActions(id)
    rows.push({
      userId: id,
      name: name || 'Member',
      open: perf.open ?? 0,
      followups: perf.followups ?? 0,
      activities7d: perf.activities7d ?? 0,
      wonMonth: perf.wonMonth ?? 0,
      emails: intel.emails ?? 0,
      calls: intel.calls ?? 0,
      activitiesTotal: intel.activitiesTotal ?? 0,
      lastActiveAt: intel.lastActiveAt || perf.lastActiveAt || null,
      needsHelp: (intel.activitiesTotal ?? 0) === 0 && (intel.hoursInApp || 0) > 0,
      action: actions.action,
      cellActions: actions.cellActions || defaultActions(id).cellActions,
    })
  }

  for (const m of teamMembers || []) {
    if ((m.status || 'active') !== 'active') continue
    if (m.role === 'org_admin' && m.pipelineRole !== 'manager') continue
    push(m.userId, m.name, perfById.get(String(m.userId)) || {})
  }

  for (const perf of repPerformance || []) {
    push(perf.userId, perf.name, perf)
  }

  return rows.sort(
    (a, b) => (b.activitiesTotal ?? 0) - (a.activitiesTotal ?? 0)
  )
}
