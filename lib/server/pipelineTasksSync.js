import { syncPipelineTasksForEntry } from './pipelineTasksTable.js'

/** Mirror CRM tasks[] to pipeline_tasks after pipeline save. */
export function syncPipelineTasksAfterSave({ organizationId, entry }) {
  if (!organizationId || !entry) return
  void syncPipelineTasksForEntry({ organizationId, entry }).catch((err) => {
    console.warn('pipeline_tasks sync:', err?.message || err)
  })
}
