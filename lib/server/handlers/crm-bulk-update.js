import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { CRM_STATUSES, mergeLeadForClientListMinimal } from '../crm.js'
import { appendActivity, normalizeExtendedCrm } from '../crmWorkflow.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { getMembership, isCompanyPipelineManager, resolveOrgRole } from '../organizations.js'
import { canMoveLeadToStatus } from '../pipelineRoles.js'
import { notifyLeadAssigned } from '../assignmentNotify.js'
import { normalizeLeadTagIds } from '../orgLeadTags.js'
import { updatePipelineStore, touchPipelineEntry } from '../pipelineShard.js'

const MAX_BULK = 100

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
  const leadIds = Array.isArray(body.leadIds) ? [...new Set(body.leadIds)] : []
  const status = body.status != null ? String(body.status) : null
  const assignToUserId =
    body.assignToUserId !== undefined ? body.assignToUserId || null : undefined
  const markReplied = Boolean(body.markReplied)
  const clearAssignee = Boolean(body.clearAssignee)

  const storeBefore = await readStore({
    only: ['users', 'organizations', 'organizationMemberships'],
  })
  const user = storeBefore.users.find((u) => u.id === sessionUser.id) || sessionUser
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
  if (leadIds.length > MAX_BULK) {
    return sendJson(res, 400, { error: `Maximum ${MAX_BULK} leads per batch` })
  }
  if (status && !CRM_STATUSES.includes(status)) {
    return sendJson(res, 400, { error: 'Invalid pipeline status' })
  }
  if (
    !status &&
    assignToUserId === undefined &&
    !markReplied &&
    !clearAssignee &&
    !addTagIds.length &&
    !removeTagIds.length
  ) {
    return sendJson(res, 400, { error: 'No bulk action specified' })
  }

  if (assignToUserId !== undefined && assignToUserId && organizationId) {
    const member = getMembership(storeBefore, assignToUserId, organizationId)
    if (!member) {
      return sendJson(res, 400, { error: 'Assignee is not on your team' })
    }
    if (!isCompanyPipelineManager(user)) {
      return sendJson(res, 403, { error: 'Only company admins can reassign leads in bulk' })
    }
  }

  if (assignToUserId !== undefined && !isCompanyPipelineManager(user)) {
    return sendJson(res, 403, { error: 'Only company admins can reassign leads in bulk' })
  }

  if (clearAssignee && !isCompanyPipelineManager(user)) {
    return sendJson(res, 403, { error: 'Only company admins can unassign leads in bulk' })
  }

  if (status && organizationId) {
    const membership = getMembership(storeBefore, user.id, organizationId)
    const { orgRole } = resolveOrgRole(user, storeBefore)
    const pipelineRole = membership?.pipelineRole || (orgRole === 'org_admin' ? 'org_admin' : 'member')
    if (!canMoveLeadToStatus(orgRole, pipelineRole, status)) {
      return sendJson(res, 403, { error: 'Your role cannot move leads to this stage' })
    }
  }

  let updated = 0
  let skipped = 0
  const assignmentNotifies = []
  const updatedLeads = []

  const store = await updatePipelineStore(user, async (draft) => {
    for (const leadId of leadIds) {
      const entry = findPipelineEntry(draft, user, leadId)
      if (!entry) {
        skipped += 1
        continue
      }

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
          assignmentNotifies.push({ leadId, assigneeUserId: assignToUserId })
        }
      } else if (clearAssignee) {
        entry.assignedToUserId = null
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

      entry.crm = crm
      touchPipelineEntry(entry)
      updatedLeads.push(toBulkLeadRow(entry))
      updated += 1
    }
    return draft
  })

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
