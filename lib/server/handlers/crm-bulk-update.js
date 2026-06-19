import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { CRM_STATUSES, mergeLeadForClientListMinimal } from '../crm.js'
import { appendActivity, normalizeExtendedCrm } from '../crmWorkflow.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import {
  buildOrgUserResponse,
  canAssignLead,
  getMembership,
  resolveOrgRole,
} from '../organizations.js'
import { canMoveLeadToStatus } from '../pipelineRoles.js'
import { notifyLeadAssigned } from '../assignmentNotify.js'
import { normalizeLeadTagIds } from '../orgLeadTags.js'
import { bulkMutatePipelineEntries } from '../pipelineLeadMutations.js'
import { bulkAssignGuard, policiesForUser } from '../resourceProtectionEnforce.js'
import { roleLimitsFor } from '../../resourceProtection.js'
import { applyCommercialEmailConsent } from '../../emailConsent.js'
import { findPipelineEntryAsync } from '../pipelineVisibility.js'

function maxBulkForUser(user, store) {
  const policies = policiesForUser(store, user)
  return Math.max(100, roleLimitsFor(user, policies).bulkAssignMax)
}

function toBulkLeadRow(entry) {
  return {
    ...mergeLeadForClientListMinimal(entry),
    assignedToUserId: entry.assignedToUserId || null,
    savedByUserId: entry.savedByUserId || entry.userId || null,
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const body = getBody(req)
  const updates = body.updates && typeof body.updates === 'object' ? body.updates : {}
  const leadIds = Array.isArray(body.leadIds)
    ? [...new Set(body.leadIds)]
    : Array.isArray(body.lead_ids)
      ? [...new Set(body.lead_ids)]
      : []
  const status =
    body.status != null
      ? String(body.status)
      : updates.lead_status != null
        ? String(updates.lead_status)
        : null
  const assignToUserId =
    body.assignToUserId !== undefined
      ? body.assignToUserId || null
      : updates.owner_id !== undefined
        ? updates.owner_id || null
        : undefined
  const markReplied = Boolean(body.markReplied)
  const clearAssignee = Boolean(body.clearAssignee)
  const approveEmailConsent = Boolean(body.approveEmailConsent)

  const storeBefore = await readStore({
    only: ['users', 'organizations', 'organizationMemberships'],
  })
  const rawUser = storeBefore.users.find((u) => u.id === sessionUser.id) || sessionUser
  const user = buildOrgUserResponse(rawUser, storeBefore)
  const organizationId = user.organizationId

  const addTagIds = organizationId
    ? normalizeLeadTagIds(Array.isArray(body.addTagIds) ? body.addTagIds : [], storeBefore, organizationId)
    : []
  const removeTagIds = organizationId
    ? normalizeLeadTagIds(Array.isArray(body.removeTagIds) ? body.removeTagIds : [], storeBefore, organizationId)
    : []

  if (!leadIds.length) {
    return sendJson(res, 400, { error: 'leadIds array is required' })
  }
  const maxBulk = maxBulkForUser(user, storeBefore)
  if (leadIds.length > maxBulk) {
    return sendJson(res, 400, {
      code: 'NARROW_SELECTION',
      message: 'This update is larger than recommended. Narrow your selection or ask a manager to help.',
    })
  }
  if (assignToUserId !== undefined) {
    const assignGuard = bulkAssignGuard(leadIds.length, user, storeBefore)
    if (assignGuard) return sendJson(res, assignGuard.status, assignGuard.body)
  }
  if (status && !CRM_STATUSES.includes(status)) {
    return sendJson(res, 400, { error: 'Invalid pipeline status' })
  }
  if (
    !status &&
    assignToUserId === undefined &&
    !markReplied &&
    !clearAssignee &&
    !approveEmailConsent &&
    !addTagIds.length &&
    !removeTagIds.length
  ) {
    return sendJson(res, 400, { error: 'No bulk action specified' })
  }

  if (assignToUserId !== undefined || clearAssignee) {
    const targetAssignee = clearAssignee ? null : assignToUserId
    if (targetAssignee && organizationId) {
      const member = getMembership(storeBefore, targetAssignee, organizationId)
      if (!member) {
        return sendJson(res, 400, { error: 'Assignee is not on your team' })
      }
    }
    for (const leadId of leadIds) {
      const entry = await findPipelineEntryAsync(storeBefore, user, leadId, storeBefore)
      if (!entry) continue
      if (!canAssignLead(user, entry, targetAssignee)) {
        return sendJson(res, 403, {
          error:
            targetAssignee === null
              ? 'You cannot unassign this lead'
              : entry.assignedToUserId
                ? 'Only admins, managers, or the current lead owner can reassign this lead'
                : 'You can only claim unassigned leads by assigning them to yourself',
        })
      }
    }
  }

  if (status && organizationId) {
    const membership = getMembership(storeBefore, user.id, organizationId)
    const { orgRole } = resolveOrgRole(user, storeBefore)
    const pipelineRole = membership?.pipelineRole || (orgRole === 'org_admin' ? 'org_admin' : 'member')
    if (!canMoveLeadToStatus(orgRole, pipelineRole, status)) {
      return sendJson(res, 403, { error: 'Your role cannot move leads to this stage' })
    }
  }

  const assignmentNotifies = []

  const { store, updated, skipped, updatedEntries } = await bulkMutatePipelineEntries(
    user,
    leadIds,
    (entry, draft) => {
      let crm = normalizeExtendedCrm(entry.crm)

      if (status) {
        const prev = crm.status
        crm.status = status
        if (prev !== status) {
          crm = appendActivity(crm, {
            type: 'status',
            summary: `Status changed to ${status}`,
            userId: user.id,
            userName: user.name,
            meta: { from: prev, to: status },
          })
        }
      }

      if (markReplied) {
        crm.responseReceived = true
        crm.lastResponseAt = crm.lastResponseAt || new Date().toISOString()
        if (['new', 'contacted', 'follow_up'].includes(crm.status)) {
          crm.status = 'replied'
        }
        crm = appendActivity(crm, {
          type: 'note',
          summary: 'Marked as replied (bulk)',
          userId: user.id,
          userName: user.name,
        })
      }

      if (assignToUserId !== undefined) {
        const prev = entry.assignedToUserId
        entry.assignedToUserId = assignToUserId
        entry.assignedAt = new Date().toISOString()
        entry.assignedByUserId = user.id
        crm = appendActivity(crm, {
          type: assignToUserId ? 'assignment' : 'transfer',
          summary: assignToUserId ? 'Lead assigned (bulk)' : 'Lead unassigned (bulk)',
          userId: user.id,
          userName: user.name,
          meta: { assignToUserId, previousAssignee: prev },
        })
        if (assignToUserId && assignToUserId !== prev && organizationId) {
          assignmentNotifies.push({ leadId: entry.lead?.id, assigneeUserId: assignToUserId })
        }
      } else if (clearAssignee) {
        entry.assignedToUserId = null
        entry.assignedAt = new Date().toISOString()
        entry.assignedByUserId = user.id
        crm = appendActivity(crm, {
          type: 'transfer',
          summary: 'Lead unassigned (bulk)',
          userId: user.id,
          userName: user.name,
        })
      }

      if (addTagIds.length || removeTagIds.length) {
        const prevIds = [...(crm.tagIds || [])]
        const removeSet = new Set(removeTagIds)
        const nextIds = [...new Set([...prevIds, ...addTagIds])].filter((id) => !removeSet.has(id))
        const changed =
          nextIds.length !== prevIds.length ||
          nextIds.some((id, i) => id !== prevIds[i]) ||
          prevIds.some((id) => !nextIds.includes(id))
        if (changed) {
          crm.tagIds = nextIds
          const parts = []
          if (addTagIds.length) parts.push(`added ${addTagIds.length}`)
          if (removeTagIds.length) parts.push(`removed ${removeTagIds.length}`)
          crm = appendActivity(crm, {
            type: 'note',
            summary: `Tags updated (bulk${parts.length ? `: ${parts.join(', ')}` : ''})`,
            userId: user.id,
            userName: user.name,
            meta: { addTagIds, removeTagIds },
          })
        }
      }

      if (approveEmailConsent) {
        entry.lead = applyCommercialEmailConsent(entry.lead || entry, {
          granted: true,
          source: 'manual_bulk',
        })
        crm = appendActivity(crm, {
          type: 'note',
          summary: 'Commercial email consent recorded (bulk)',
          userId: user.id,
          userName: user.name,
        })
      }

      entry.crm = crm
      return true
    }
  )

  const updatedLeads = updatedEntries.map((entry) => toBulkLeadRow(entry))

  if (organizationId && assignmentNotifies.length) {
    void Promise.allSettled(
      assignmentNotifies.map(async ({ leadId, assigneeUserId }) => {
        const entry = findPipelineEntry(store, user, leadId)
        if (!entry) return null
        return notifyLeadAssigned({
          store,
          entry,
          assigneeUserId,
          actorUser: user,
          organizationId,
        })
      })
    )
  }

  return sendJson(res, 200, {
    updated,
    skipped,
    leads: updatedLeads,
  })
}
