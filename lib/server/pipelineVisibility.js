import {
  isCompanyPipelineManager,
  listPipelineSavedEntries,
  resolveOrgRole,
} from './organizations.js'
import { resolveManagerVisibleOwnerIds, isPipelineTeamManager } from './pipelineManagerScope.js'

/**
 * Resolve pipeline rows visible to this user (manager team scope included).
 */
export function listVisiblePipelineEntries(store, user, visibleOwnerIds) {
  const options =
    visibleOwnerIds === undefined ? {} : { visibleOwnerIds }
  return listPipelineSavedEntries(store, user, options)
}

/** Scoped lookup — use for writes/search when manager team visibility matters. */
export function findPipelineEntryWithScope(store, user, leadId, { visibleOwnerIds } = {}) {
  if (!leadId) return null
  const options =
    visibleOwnerIds === undefined ? {} : { visibleOwnerIds }
  const target = String(leadId)
  return (
    listPipelineSavedEntries(store, user, options).find(
      (e) => String(e.lead?.id || '') === target
    ) || null
  )
}

export async function resolvePipelineVisibleOwnerIds(user, metaStore) {
  return resolveManagerVisibleOwnerIds(user, metaStore)
}

export async function findPipelineEntryAsync(store, user, leadId, metaStore) {
  const visibleOwnerIds = await resolvePipelineVisibleOwnerIds(user, metaStore)
  return findPipelineEntryWithScope(store, user, leadId, { visibleOwnerIds })
}

/** True when user may read/write this entry (assignee, manager team, admin, unassigned pool). */
export async function isPipelineEntryVisibleAsync(user, entry, metaStore) {
  if (!entry || !user) return false
  const leadId = entry.lead?.id || entry.id
  if (!leadId) return false
  const store = { savedLeads: [entry] }
  const visibleOwnerIds = await resolvePipelineVisibleOwnerIds(user, metaStore)
  return findPipelineEntryWithScope(store, user, leadId, { visibleOwnerIds }) !== null
}

/** Filter a batch of raw entries to those visible to the user. */
export async function filterPipelineEntriesVisibleAsync(user, entries, metaStore) {
  if (!entries?.length) return []
  const visibleOwnerIds = await resolvePipelineVisibleOwnerIds(user, metaStore)
  const store = { ...metaStore, savedLeads: entries }
  const visible = listVisiblePipelineEntries(store, user, visibleOwnerIds)
  const seen = new Set(visible.map((e) => e.lead?.id))
  return entries.filter((e) => e.lead?.id && seen.has(e.lead.id))
}

/**
 * Org-only check for trusted system paths (webhooks, queue workers).
 * Prevents cross-tenant patches; does not enforce assignee RBAC.
 */
export function isPipelineEntryInUserOrg(user, entry) {
  if (!entry || !user) return false
  if (user.accountType === 'individual' || !user.organizationId) {
    const uid = user.id
    return entry.userId === uid || entry.savedByUserId === uid || entry.assignedToUserId === uid
  }
  return entry.organizationId === user.organizationId
}

/** Delete: must be visible; admins/managers or assignee/creator. */
export function canUserDeletePipelineEntry(user, entry, metaStore) {
  if (!user || !entry) return false
  const { accountType } = resolveOrgRole(user, metaStore || {})
  if (accountType === 'individual' || !user.organizationId) {
    const uid = user.id
    return entry.userId === uid || entry.savedByUserId === uid || entry.assignedToUserId === uid
  }
  if (isCompanyPipelineManager(user)) return true
  if (isPipelineTeamManager(user, metaStore || {})) return true
  const uid = user.id
  return entry.assignedToUserId === uid || entry.savedByUserId === uid || entry.userId === uid
}
