import { listPipelineSavedEntries } from './organizations.js'
import { findPipelineEntryWithScope } from './pipelineVisibility.js'

export { findPipelineEntryWithScope }

/**
 * Resolve a pipeline row for this user. Contact ids (lead.id) are shared across the
 * master database, but each company has its own savedLeads row — never match globally.
 *
 * For manager team scope on writes, prefer findPipelineEntryAsync from pipelineVisibility.js.
 */
export function findPipelineEntry(store, user, leadId) {
  if (!leadId) return null
  return listPipelineSavedEntries(store, user).find((e) => e.lead?.id === leadId) || null
}

/** System/webhook lookup — full shard rows, no assignee filter. */
export function findPipelineEntryRaw(store, leadId) {
  if (!leadId) return null
  const target = String(leadId)
  return (Array.isArray(store?.savedLeads) ? store.savedLeads : []).find(
    (e) => String(e.lead?.id || '') === target || String(e.id || '') === target
  ) || null
}
