/** ERP owner claim + stage classify must never block Pipeline HTTP. */

function runInBackground(task) {
  const work = Promise.resolve()
    .then(task)
    .catch((err) => console.warn('erp pipeline maintenance:', err?.message || err))
  void import('@vercel/functions')
    .then(({ waitUntil }) => waitUntil(work))
    .catch(() => {
      void work
    })
}

export function scheduleErpPipelineMaintenance(user, query = {}) {
  if (!user?.organizationId || user.accountType !== 'company') return
  runInBackground(async () => {
    const { claimErpLeadsForMemberOnce, claimErpLeadsForFilteredMember } = await import(
      './erpOwnerLeadClaim.js'
    )
    await claimErpLeadsForMemberOnce(user)
    const assignee = String(query.assigneeUserId || '').trim()
    if (assignee && assignee !== '__unassigned__' && assignee !== String(user.id)) {
      await claimErpLeadsForFilteredMember(user, assignee)
    }
    const { classifyErpPipelineStagesOnce } = await import('./erpAccountStageApply.js')
    await classifyErpPipelineStagesOnce(user.organizationId)
  })
}
