/** Company CRM delete (leads and deals) is Org Admin only. Solo users keep access. */
export function userCanDeleteCrmRecords(user) {
  if (!user) return false
  if (!user.organizationId || user.accountType !== 'company') return true
  if (user.isPlatformAdmin || user.isOrgAdmin) return true
  return Boolean(user.orgPermissions?.delete_leads)
}
