import { CRM_STATUSES } from '../../frontend/src/lib/crmConstants.js'

export const TEAM_PIPELINE_ROLES = [
  { id: 'member', label: 'Team member', description: 'Full pipeline: all lead stages' },
  { id: 'manager', label: 'Manager', description: 'Full pipeline with team visibility' },
]

/** All company members see every configured pipeline stage (legacy sales role no longer restricts). */
export function getVisiblePipelineColumns(orgRole, pipelineRole = 'member') {
  void pipelineRole
  if (orgRole === 'individual') return CRM_STATUSES
  return CRM_STATUSES
}

export function canMoveLeadToStatus(orgRole, pipelineRole, statusId) {
  void orgRole
  void pipelineRole
  return CRM_STATUSES.some((col) => col.id === statusId)
}
