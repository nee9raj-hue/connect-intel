import { syncPipelineMeetingsForEntry } from './pipelineMeetingsTable.js'

/** Mirror CRM meetings[] to pipeline_meetings after pipeline save. */
export function syncPipelineMeetingsAfterSave({ organizationId, entry }) {
  if (!organizationId || !entry) return
  void syncPipelineMeetingsForEntry({ organizationId, entry }).catch((err) => {
    console.warn('pipeline_meetings sync:', err?.message || err)
  })
}
