import { listPipelineEntries } from './organizations.js'

export function findPipelineEntry(store, user, leadId) {
  const visible = new Set(listPipelineEntries(store, user).map((l) => l.id))
  if (!visible.has(leadId)) return null
  return store.savedLeads.find((e) => e.lead?.id === leadId) || null
}
