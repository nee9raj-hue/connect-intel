import { syncPipelineCompaniesForOrg } from './pipelineCompaniesTable.js'

/** Rebuild pipeline_companies for an org after pipeline save. */
export function syncPipelineCompaniesAfterSave({ user, metaStore = null }) {
  if (!user?.organizationId) return
  void syncPipelineCompaniesForOrg(user, metaStore)
    .then(async (result) => {
      const { syncMeilisearchCompaniesAfterSave } = await import('./meilisearchSync.js')
      syncMeilisearchCompaniesAfterSave({
        organizationId: user.organizationId,
        companies: result?.companies || null,
      })
    })
    .catch((err) => {
      console.warn('pipeline_companies sync:', err?.message || err)
    })
}
