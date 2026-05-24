import { listPipelineSavedEntries } from './organizations.js'

/**
 * Resolve a pipeline row for this user. Contact ids (lead.id) are shared across the
 * master database, but each company has its own savedLeads row — never match globally.
 */
export function findPipelineEntry(store, user, leadId) {
  if (!leadId) return null
  return listPipelineSavedEntries(store, user).find((e) => e.lead?.id === leadId) || null
}
