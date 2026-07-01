import { syncPipelineDealsForEntry } from './pipelineDealsTable.js'

/** Mirror CRM deals[] to pipeline_deals after pipeline save. */
export function syncPipelineDealsAfterSave({ organizationId, entry }) {
  if (!organizationId || !entry) return
  void syncPipelineDealsForEntry({ organizationId, entry }).catch((err) => {
    console.warn('pipeline_deals sync:', err?.message || err)
  })
}
