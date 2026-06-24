import { pruneCrmEmailsToTrail } from '../emailTrail.js'
import { getOrganization } from './organizations.js'
import { normalizeExtendedCrm } from './crmWorkflow.js'
import { mergeLeadForClient, mergeLeadForClientLight } from './crm.js'
import { getUserCrmGmail } from './crmUserGmail.js'

import { orgMemberUserIdSet } from './orgMemberSet.js'

/** User ids that belong to the same tenant as the viewer (memberships, not global user rows). */
export function tenantUserIds(store, user) {
  const ids = new Set()
  if (!user?.id) return ids
  ids.add(user.id)

  const orgId = user.organizationId
  if (!orgId) return ids

  for (const memberId of orgMemberUserIdSet(store, orgId)) {
    ids.add(memberId)
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

  for (const memberId of orgMemberUserIdSet(store, orgId)) {
    const row = (store.users || []).find((u) => String(u.id) === String(memberId))
    if (row && String(row.email || '').toLowerCase() === raw) return true
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

function repMailboxForLead(store, entry, viewer) {
  const assigneeId =
    entry?.assignedToUserId || entry?.savedByUserId || entry?.userId || viewer?.id
  const assignee = (store.users || []).find((u) => u.id === assigneeId) || viewer
  const gmail = getUserCrmGmail(assignee)
  return String(gmail?.email || assignee?.email || viewer?.email || '')
    .trim()
    .toLowerCase()
}

/** Remove CRM rows created by users outside the viewer's company. */
export function sanitizeCrmForTenant(store, user, crm, entry = null) {
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

  let emails = (normalized.emails || []).filter((email) => {
    const mailbox = email.fromMailbox || email.mailbox
    if (email.direction === 'inbound') {
      if (email.resendInboundId || email.provider === 'inbound_sync' || email.provider === 'manual') {
        return true
      }
      if (email.provider === 'gmail_sync' || email.gmailMessageId) {
        return true
      }
      return emailBelongsToTenant(store, user, mailbox)
    }
    return emailBelongsToTenant(store, user, mailbox)
  })

  const leadEmail = String(entry?.lead?.email || entry?.email || '').trim()
  const repEmail = entry ? repMailboxForLead(store, entry, user) : ''
  if (leadEmail.includes('@') && repEmail) {
    emails = pruneCrmEmailsToTrail(emails, leadEmail, repEmail)
  }

  normalized.emails = emails

  return normalized
}

export function mergeLeadForTenant(store, user, entry) {
  if (!entry) return null
  const merged = mergeLeadForClient(entry)
  return {
    ...merged,
    crm: sanitizeCrmForTenant(store, user, merged.crm, entry),
  }
}

export function mergeLeadForTenantLight(store, user, entry) {
  if (!entry) return null
  const merged = mergeLeadForClientLight(entry)
  return {
    ...merged,
    crm: sanitizeCrmForTenant(store, user, merged.crm, entry),
  }
}

/** Persistently strip cross-tenant CRM data from a pipeline row. Returns true if data changed. */
export function repairPipelineEntryCrm(store, user, entry) {
  if (!entry) return false
  const before = JSON.stringify(entry.crm || {})
  entry.crm = sanitizeCrmForTenant(store, user, entry.crm, entry)
  return JSON.stringify(entry.crm || {}) !== before
}
