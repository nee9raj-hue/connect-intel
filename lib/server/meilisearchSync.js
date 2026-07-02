import { syncLeadEntriesToMeilisearch, syncOrgCrmToMeilisearch } from './meilisearch/sync.js'
import { meiliEnabled } from './meilisearch/client.js'

/** Index pipeline row(s) in Meilisearch after save (no Redis required). */
export function syncMeilisearchAfterSave({ organizationId, entry, entries = null }) {
  if (!meiliEnabled() || !organizationId) return

  const list = entries || (entry ? [entry] : [])
  if (!list.length) return

  void syncLeadEntriesToMeilisearch({ organizationId, entries: list }).catch((err) => {
    console.warn('meilisearch sync:', err?.message || err)
  })
}

export async function syncMeilisearchOrgNow(organizationId) {
  if (!meiliEnabled() || !organizationId) return { indexed: 0, skipped: true }
  return syncOrgCrmToMeilisearch(organizationId)
}
