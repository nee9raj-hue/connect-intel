export function buildActivityLogQuery({
  period = 'week',
  memberUserId = '',
  activityType = null,
  status = 'all',
  tagId = '',
  from = '',
  to = '',
} = {}) {
  const q = new URLSearchParams()
  if (from && to) {
    q.set('from', from)
    q.set('to', to)
  } else if (period) {
    q.set('period', period)
  }
  if (memberUserId) q.set('userId', memberUserId)
  if (activityType) q.set('type', activityType)
  if (status && status !== 'all') q.set('status', status)
  if (tagId) q.set('tagId', tagId)
  return q.toString()
}

export function lastActivityForPeriod(period) {
  if (period === 'day') return 'today'
  if (period === 'month') return 'month'
  return 'week'
}

export function pipelineOptsFromActivityFilters(filters = {}) {
  const opts = {
    status: filters.status && filters.status !== 'all' ? filters.status : 'all',
    assigneeUserId: filters.memberUserId || undefined,
    userId: filters.memberUserId || undefined,
    lastActivity: lastActivityForPeriod(filters.period),
  }
  if (filters.tagId) opts.smartTags = [filters.tagId]
  return opts
}

const METRIC_ACTIVITY_TYPE = {
  calls: 'call',
  emails: 'email',
  meetings: 'meeting',
  tasks: 'task',
}

export function navigationForActivityMetric(metricId, filters = {}) {
  const activityType = METRIC_ACTIVITY_TYPE[metricId]
  if (activityType) {
    return {
      panel: 'crm-log',
      opts: {
        period: filters.period,
        userId: filters.memberUserId || undefined,
        activityType,
        from: filters.from || undefined,
        to: filters.to || undefined,
      },
    }
  }
  return {
    panel: 'pipeline',
    opts: pipelineOptsFromActivityFilters(filters),
  }
}
