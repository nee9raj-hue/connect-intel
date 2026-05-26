import { findPipelineEntry } from './pipelineAccess.js'
import { isEmailSuppressed } from './marketingUnsubscribe.js'
import { marketingScopeKey } from './marketingAccess.js'

export function emailForPipelineLead(store, user, leadId) {
  const entry = findPipelineEntry(store, user, leadId)
  if (!entry) return ''
  const lead = entry.lead || entry
  return String(lead.email || '').trim().toLowerCase()
}

function listInScope(list, scope) {
  if (scope.organizationId) return list.organizationId === scope.organizationId
  return list.createdByUserId === scope.createdByUserId && !list.organizationId
}

function leadIdsMatchingEmail(store, scope, email) {
  const normalized = String(email || '').trim().toLowerCase()
  const ids = new Set()
  for (const entry of store.savedLeads || []) {
    if (scope.organizationId) {
      if (entry.organizationId !== scope.organizationId) continue
    } else if (entry.userId !== scope.createdByUserId) {
      continue
    }
    const lead = entry.lead || entry
    if (String(lead.email || '').trim().toLowerCase() === normalized) {
      ids.add(entry.id)
    }
  }
  return ids
}

/** Remove unsubscribed contacts from all marketing lists in this workspace. */
export function removeEmailFromMarketingLists(store, scope, email) {
  const removeIds = leadIdsMatchingEmail(store, scope, email)
  if (!removeIds.size) return { listsUpdated: 0, leadsRemoved: 0 }

  let listsUpdated = 0
  let leadsRemoved = 0

  for (const list of store.marketingLists || []) {
    if (!listInScope(list, scope)) continue
    const before = (list.leadIds || []).length
    list.leadIds = (list.leadIds || []).filter((id) => !removeIds.has(id))
    const removed = before - list.leadIds.length
    if (removed > 0) {
      listsUpdated += 1
      leadsRemoved += removed
      list.updatedAt = new Date().toISOString()
    }
  }

  return { listsUpdated, leadsRemoved }
}

export function partitionLeadsBySuppression(store, user, leadIds) {
  const scope = marketingScopeKey(user)
  const allowed = []
  const blocked = []

  for (const leadId of leadIds || []) {
    const email = emailForPipelineLead(store, user, leadId)
    if (
      email &&
      isEmailSuppressed(store, {
        organizationId: scope.organizationId,
        createdByUserId: scope.createdByUserId,
        email,
      })
    ) {
      blocked.push({ leadId, email })
    } else {
      allowed.push(leadId)
    }
  }

  return { allowed, blocked, scope }
}
