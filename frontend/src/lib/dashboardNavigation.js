import { navTargetToOptions } from './navConfig'

/** Map dashboard drill-down actions to panelOptions (preserves all filter fields). */
export function dashboardNavOptions(action = {}, user = null) {
  const opts = { ...navTargetToOptions(action) }
  if (action.returnTo) opts.returnTo = action.returnTo

  if (action.scopeOwner === 'me' && user?.id) {
    opts.scopeOwner = 'me'
    opts.userId = user.id
    opts.assigneeUserId = user.id
  } else if (action.userId || action.assigneeUserId) {
    const id = action.userId || action.assigneeUserId
    opts.userId = id
    opts.assigneeUserId = id
  }

  if (action.hierarchyTeam) {
    opts.hierarchyTeam = action.hierarchyTeam
    if (action.hierarchyTeam === 'mine') {
      delete opts.userId
      delete opts.assigneeUserId
    }
  }

  if (action.scope === 'all') {
    opts.scope = 'all'
    if (!action.userId && !action.assigneeUserId && action.scopeOwner !== 'me') {
      delete opts.userId
      delete opts.assigneeUserId
    }
  }

  if (action.stuck) opts.stuck = true
  if (action.scoreMin != null && action.scoreMin !== '') opts.scoreMin = Number(action.scoreMin)
  if (action.closing) opts.closing = action.closing
  if (action.due) opts.due = action.due
  if (action.assignedAfter) opts.assignedAfter = action.assignedAfter
  if (action.lastActivity) opts.lastActivity = action.lastActivity
  if (action.activityFilter) opts.activityFilter = action.activityFilter
  if (action.teamId) opts.teamId = action.teamId
  if (action.wonThisMonth) opts.wonThisMonth = true
  if (action.tasksDueToday) opts.tasksDueToday = true
  if (action.unreadOnly) opts.unreadOnly = true
  if (Array.isArray(action.leadIds) && action.leadIds.length) opts.leadIds = [...action.leadIds]

  return opts
}

export function describeDashboardFilter(panelOptions = {}) {
  const parts = []
  const po = panelOptions || {}

  if (po.unreadOnly || po.activityFilter === 'unread') parts.push('Unread updates')
  if (po.tasksDueToday || (po.view === 'tasks' && po.due === 'today')) parts.push("Today's tasks")
  if (po.status && po.status !== 'all') {
    parts.push(po.status.replace(/_/g, ' '))
  }
  if (po.followUpDue) parts.push('Follow-up due')
  if (po.overdueFollowUp) parts.push('Overdue follow-up')
  if (po.stuck) parts.push('Stuck 7+ days')
  if (po.scoreMin != null && po.scoreMin !== '') parts.push(`Score ≥ ${po.scoreMin}`)
  if (po.closing === 'this-month' || po.closingThisWeek) parts.push('Closing soon')
  if (po.assignedAfter === 'yesterday') parts.push('New since yesterday')
  if (po.lastActivity === 'never') parts.push('Uncontacted')
  if (po.wonThisMonth) parts.push('Won this month')
  if (po.teamId) parts.push('Team filter')
  if (po.hierarchyTeam === 'mine') parts.push('Your team')
  if (po.scopeOwner === 'me') parts.push('Your leads')
  if (po.leadIds?.length) parts.push(`${po.leadIds.length} selected leads`)

  return parts.length ? parts.join(' · ') : null
}
