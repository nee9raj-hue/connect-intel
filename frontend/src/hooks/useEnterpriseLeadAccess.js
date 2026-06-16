import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { isPipelineAssignManager } from '../lib/pipelineAssignAccess'

/**
 * Role-aware lead visibility (mirrors Supabase leads RLS on the server).
 * Admins/managers: org-wide metrics and pipeline (optional assignee filter).
 * Sales reps: scoped to their own assigned leads.
 */
export function useEnterpriseLeadAccess() {
  const { user, pipelineAssigneeFilter } = useApp()

  return useMemo(() => {
    const isCompany = user?.accountType === 'company' && user?.organizationId
    const isManager = isPipelineAssignManager(user)
    const isRep = isCompany && !isManager

    return {
      organizationId: user?.organizationId || null,
      orgRole: user?.orgRole || null,
      pipelineRole: user?.pipelineRole || null,
      isManager,
      isRep,
      /** When set, managers filter pipeline/dashboard to this rep's leads. */
      assigneeUserId: isManager ? pipelineAssigneeFilter || null : null,
      /** Reps see assigned leads plus the org unassigned pool (null = combined view). */
      effectiveAssigneeUserId: isRep ? pipelineAssigneeFilter || null : pipelineAssigneeFilter || null,
      canViewOrgWide: isManager,
      canAssignLeads: isManager,
      canClaimUnassigned: isCompany && !isManager,
    }
  }, [user, pipelineAssigneeFilter])
}
