/** ERP stage classify must never block Pipeline or sign-in HTTP. */

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

export function scheduleErpPipelineMaintenance(user) {
  if (!user?.organizationId || user.accountType !== 'company') return
  runInBackground(async () => {
    const { classifyErpPipelineStagesOnce } = await import('./erpAccountStageApply.js')
    await classifyErpPipelineStagesOnce(user.organizationId)
  })
}
