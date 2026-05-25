import { CRM_STATUSES } from '../../frontend/src/lib/crmConstants.js'

/** Which Kanban columns each org role may see */
export const PIPELINE_ROLE_COLUMNS = {
  org_admin: ['new', 'contacted', 'follow_up', 'replied', 'won', 'active_trading', 'lost'],
  member: ['new', 'contacted', 'follow_up', 'replied', 'won', 'active_trading', 'lost'],
  sales: ['new', 'contacted', 'follow_up'],
}

export const TEAM_PIPELINE_ROLES = [
  { id: 'member', label: 'Full pipeline', description: 'New through Active trading and Lost' },
  { id: 'sales', label: 'Sales rep', description: 'Early funnel: New, Contacted, Follow up' },
]

export function getVisiblePipelineColumns(orgRole, pipelineRole = 'member') {
  if (orgRole === 'org_admin' || orgRole === 'individual') {
    return CRM_STATUSES
  }

  const allowed =
    PIPELINE_ROLE_COLUMNS[pipelineRole] || PIPELINE_ROLE_COLUMNS.member

  return CRM_STATUSES.filter((col) => allowed.includes(col.id))
}

export function canMoveLeadToStatus(orgRole, pipelineRole, statusId) {
  const visible = getVisiblePipelineColumns(orgRole, pipelineRole).map((c) => c.id)
  return visible.includes(statusId)
}
