import {
  syncLeadEntriesToMeilisearch,
  syncMetaDocsToMeilisearch,
  syncOrgCrmToMeilisearch,
  contactToSearchDoc,
  companyToSearchDoc,
} from './meilisearch/sync.js'
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

/** Index master contact(s) after CRM contact save. */
export function syncMeilisearchContactsAfterSave({ organizationId, contact, contacts = null, store = null }) {
  if (!meiliEnabled() || !organizationId) return
  const list = contacts || (contact ? [contact] : [])
  if (!list.length) return

  void (async () => {
    const meta =
      store ||
      (await import('./store.js').then(({ readStore }) =>
        readStore({ only: ['contacts', 'companies'] })
      ))
    const docs = list.map((row) => contactToSearchDoc(row, meta, organizationId))
    await syncMetaDocsToMeilisearch({ organizationId, docs })
  })().catch((err) => {
    console.warn('meilisearch contact sync:', err?.message || err)
  })
}

/** Index account/company rows after pipeline_companies sync. */
export function syncMeilisearchCompaniesAfterSave({ organizationId, companies = null }) {
  if (!meiliEnabled() || !organizationId) return

  void (async () => {
    let list = companies
    if (!list?.length) {
      const { listPipelineCompaniesPage } = await import('./pipelineCompaniesTable.js')
      const page = await listPipelineCompaniesPage(organizationId, { limit: 500, offset: 0 })
      list = page?.companies || []
    }
    if (!list.length) return
    const docs = list.map((row) => companyToSearchDoc(row, organizationId))
    await syncMetaDocsToMeilisearch({ organizationId, docs })
  })().catch((err) => {
    console.warn('meilisearch company sync:', err?.message || err)
  })
}

export async function syncMeilisearchOrgNow(organizationId) {
  if (!meiliEnabled() || !organizationId) return { indexed: 0, skipped: true }
  return syncOrgCrmToMeilisearch(organizationId)
}
