import { getOrganization } from './organizations.js'
import { normalizeExtendedCrm } from './crmWorkflow.js'
import { mergeLeadForClient, mergeLeadForClientLight } from './crm.js'

/** User ids that belong to the same tenant as the viewer. */
export function tenantUserIds(store, user) {
  const ids = new Set()
  if (!user?.id) return ids
  ids.add(user.id)

  const orgId = user.organizationId
  if (!orgId) return ids

  for (const row of store.users || []) {
    if (row.organizationId === orgId) ids.add(row.id)
  }
  return ids
}

function emailBelongsToTenant(store, user, emailLike) {
  const raw = String(emailLike || '').trim().toLowerCase()
  if (!raw.includes('@')) return true

  const orgId = user.organizationId
  if (!orgId) {
    return raw === String(user.email || '').toLowerCase()
  }

  for (const row of store.users || []) {
    if (row.organizationId === orgId && String(row.email || '').toLowerCase() === raw) {
      return true
    }
  }

  const org = getOrganization(store, orgId)
  const orgDomain = String(org?.domain || '').toLowerCase()
  const domain = raw.split('@')[1]
  if (orgDomain && domain === orgDomain) return true

  return false
}

function actorAllowed(store, user, { createdByUserId, createdByName, userId, assignedToUserId } = {}) {
  const allowed = tenantUserIds(store, user)
  const uid = createdByUserId || userId || assignedToUserId
  if (uid) return allowed.has(uid)
  if (createdByName?.includes('@')) return emailBelongsToTenant(store, user, createdByName)
  return !user.organizationId
}

/** Remove CRM rows created by users outside the viewer's company. */
export function sanitizeCrmForTenant(store, user, crm) {
  const normalized = normalizeExtendedCrm(crm)

  normalized.activities = normalized.activities.filter((act) =>
    actorAllowed(store, user, {
      createdByUserId: act.createdByUserId,
      createdByName: act.createdByName,
    })
  )

  normalized.tasks = normalized.tasks.filter((task) =>
    actorAllowed(store, user, {
      createdByUserId: task.createdByUserId,
      assignedToUserId: task.assignedToUserId,
    })
  )

  normalized.meetings = normalized.meetings.filter((meeting) =>
    actorAllowed(store, user, {
      createdByUserId: meeting.createdByUserId,
      assignedToUserId: meeting.assignedToUserId,
    })
  )

  normalized.emails = (normalized.emails || []).filter((email) => {
    if (email.direction === 'inbound') return true
    const mailbox = email.fromMailbox || email.mailbox
    return emailBelongsToTenant(store, user, mailbox)
  })

  return normalized
}

export function mergeLeadForTenant(store, user, entry) {
  if (!entry) return null
  const merged = mergeLeadForClient(entry)
  return {
    ...merged,
    crm: sanitizeCrmForTenant(store, user, merged.crm),
  }
}

export function mergeLeadForTenantLight(store, user, entry) {
  if (!entry) return null
  const merged = mergeLeadForClientLight(entry)
  return {
    ...merged,
    crm: sanitizeCrmForTenant(store, user, merged.crm),
  }
}

/** Persistently strip cross-tenant CRM data from a pipeline row. Returns true if data changed. */
export function repairPipelineEntryCrm(store, user, entry) {
  if (!entry) return false
  const before = JSON.stringify(entry.crm || {})
  entry.crm = sanitizeCrmForTenant(store, user, entry.crm)
  return JSON.stringify(entry.crm || {}) !== before
}
