import { isOrgMarketingAdmin } from './marketingAccess.js'

export const MARKETING_ROLES = {
  MANAGER: 'marketing_manager',
  EXECUTIVE: 'marketing_executive',
  READONLY: 'marketing_readonly',
}

export function getMembershipMarketingRole(user, store) {
  if (!user?.organizationId) return null
  if (isOrgMarketingAdmin(user)) return MARKETING_ROLES.MANAGER
  const membership = (store?.organizationMemberships || []).find(
    (m) => m.organizationId === user.organizationId && m.userId === user.id
  )
  return membership?.marketingRole || null
}

export function resolveMarketingPermissions(user, store) {
  const role = getMembershipMarketingRole(user, store)
  const isAdmin = isOrgMarketingAdmin(user)

  if (isAdmin) {
    return {
      role: MARKETING_ROLES.MANAGER,
      canView: true,
      canCreate: true,
      canEdit: true,
      canSend: true,
      canApprove: true,
      canManageSegments: true,
      canManageSuppressions: true,
      canManageDomains: true,
      canManageAutomations: true,
      requiresApprovalToSend: false,
      isReadOnly: false,
    }
  }

  if (role === MARKETING_ROLES.READONLY) {
    return {
      role,
      canView: true,
      canCreate: false,
      canEdit: false,
      canSend: false,
      canApprove: false,
      canManageSegments: false,
      canManageSuppressions: false,
      canManageDomains: false,
      canManageAutomations: false,
      requiresApprovalToSend: true,
      isReadOnly: true,
    }
  }

  if (role === MARKETING_ROLES.EXECUTIVE) {
    return {
      role,
      canView: true,
      canCreate: true,
      canEdit: true,
      canSend: false,
      canApprove: false,
      canManageSegments: true,
      canManageSuppressions: false,
      canManageDomains: false,
      canManageAutomations: false,
      requiresApprovalToSend: true,
      isReadOnly: false,
    }
  }

  if (role === MARKETING_ROLES.MANAGER) {
    return {
      role,
      canView: true,
      canCreate: true,
      canEdit: true,
      canSend: true,
      canApprove: true,
      canManageSegments: true,
      canManageSuppressions: true,
      canManageDomains: false,
      canManageAutomations: true,
      requiresApprovalToSend: false,
      isReadOnly: false,
    }
  }

  // Default rep — creator-scoped assets, can send own campaigns
  return {
    role: null,
    canView: true,
    canCreate: true,
    canEdit: true,
    canSend: true,
    canApprove: false,
    canManageSegments: true,
    canManageSuppressions: false,
    canManageDomains: false,
    canManageAutomations: false,
    requiresApprovalToSend: false,
    isReadOnly: false,
  }
}

export function canSendMarketingCampaign(user, store, campaign) {
  const perms = resolveMarketingPermissions(user, store)
  if (!perms.canSend) return false
  if (perms.requiresApprovalToSend) {
    return campaign?.approvalStatus === 'approved'
  }
  return true
}

export function canApproveMarketingCampaign(user, store) {
  return resolveMarketingPermissions(user, store).canApprove
}
