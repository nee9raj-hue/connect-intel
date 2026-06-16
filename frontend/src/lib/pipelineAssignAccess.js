/** Company admin or team manager — may assign any org lead. */
export function isPipelineAssignManager(user) {
  return Boolean(
    user?.accountType === 'company' &&
      (user?.isOrgAdmin ||
        user?.orgRole === 'org_admin' ||
        user?.pipelineRole === 'manager')
  )
}

/** Whether this user may bulk/single assign the given pipeline rows. */
export function canAssignPipelineLeads(user, leads = []) {
  if (!user || user.accountType !== 'company') return false
  if (isPipelineAssignManager(user)) return true
  if (!leads.length) return false
  const uid = String(user.id)
  return leads.every((lead) => {
    const ownerId = lead?.assignedToUserId
    return ownerId && String(ownerId) === uid
  })
}
