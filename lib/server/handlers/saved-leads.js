import { requireUser } from '../auth.js'
import { createId, readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { defaultCrm, mergeLeadForClient, normalizeCrm } from '../crm.js'
import {
  addMeeting,
  addTask,
  appendActivity,
  completeTask,
  normalizeExtendedCrm,
  recordFieldVisit,
} from '../crmWorkflow.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import {
  getMembership,
  listPipelineEntries,
  resolveOrgRole,
} from '../organizations.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  const { accountType } = resolveOrgRole(user, store)
  const organizationId =
    accountType === 'company' && user.organizationId ? user.organizationId : null

  if (req.method === 'GET') {
    return sendJson(res, 200, { leads: listPipelineEntries(store, user) })
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    const lead = body.lead

    if (!lead?.id) {
      return sendJson(res, 400, { error: 'Lead payload is required' })
    }

    const updated = await updateStore((draft) => {
      const exists = draft.savedLeads.find(
        (e) =>
          e.lead.id === lead.id &&
          (organizationId ? e.organizationId === organizationId : e.userId === user.id)
      )

      if (!exists) {
        draft.savedLeads.push({
          id: createId('saved'),
          userId: user.id,
          organizationId,
          savedByUserId: user.id,
          assignedToUserId: user.isOrgAdmin ? null : user.id,
          savedAt: new Date().toISOString(),
          crm: defaultCrm(),
          lead: {
            ...lead,
            savedAt: new Date().toISOString(),
            inPipeline: true,
          },
        })
      }
      return draft
    })

    return sendJson(res, 200, { leads: listPipelineEntries(updated, user) })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    const leadId = body.leadId
    const crmPatch = body.crm
    const assignToUserId = body.assignToUserId
    const activity = body.activity
    const taskAction = body.task
    const meetingAction = body.meeting
    const fieldVisit = body.fieldVisit

    if (!leadId) {
      return sendJson(res, 400, { error: 'leadId is required' })
    }

    if (assignToUserId && user.isOrgAdmin && organizationId) {
      const member = getMembership(store, assignToUserId, organizationId)
      if (!member) {
        return sendJson(res, 400, { error: 'Assignee is not in your team' })
      }
    }

    const creator = { userId: user.id, name: user.name || user.email }

    let updated
    try {
      updated = await updateStore((draft) => {
      const entry = findPipelineEntry(draft, user, leadId)
      if (!entry) return draft

      let crm = normalizeExtendedCrm(entry.crm)

      if (assignToUserId !== undefined && user.isOrgAdmin && organizationId) {
        const prev = entry.assignedToUserId
        entry.assignedToUserId = assignToUserId || null
        entry.assignedAt = new Date().toISOString()
        entry.assignedByUserId = user.id
        crm = appendActivity(crm, {
          type: prev && assignToUserId && prev !== assignToUserId ? 'transfer' : 'assignment',
          summary: assignToUserId
            ? `Lead assigned to team member`
            : 'Lead unassigned',
          userId: user.id,
          userName: user.name,
          meta: { assignToUserId, previousAssignee: prev },
        })
      }

      if (crmPatch) {
        const notesChanged =
          crmPatch.notes !== undefined && String(crmPatch.notes) !== String(crm.notes || '')
        crm = normalizeExtendedCrm({
          ...crm,
          ...crmPatch,
          emails: crmPatch?.emails ?? crm.emails,
          activities: crm.activities,
          tasks: crm.tasks,
          meetings: crm.meetings,
        })
        if (notesChanged && crmPatch.notes?.trim()) {
          crm = appendActivity(crm, {
            type: 'note',
            summary: crmPatch.notes.trim().slice(0, 280),
            userId: user.id,
            userName: user.name,
          })
        }
        if (crmPatch?.responseReceived === true && !crm.lastResponseAt) {
          crm.lastResponseAt = new Date().toISOString()
          if (['new', 'contacted', 'follow_up'].includes(crm.status)) {
            crm.status = 'replied'
          }
        }
      }

      if (activity?.summary) {
        crm = appendActivity(crm, {
          type: activity.type || 'note',
          summary: activity.summary,
          userId: user.id,
          userName: user.name,
          meta: activity.meta || null,
        })
      }

      if (taskAction?.action === 'add' && taskAction.title) {
        const assignee = taskAction.assignedToUserId || user.id
        if (assignee !== user.id && !user.isOrgAdmin) {
          throw new Error('Only managers can assign tasks to others')
        }
        if (assignee !== user.id && organizationId) {
          const member = getMembership(draft, assignee, organizationId)
          if (!member) throw new Error('Assignee is not in your team')
        }
        const result = addTask(crm, {
          title: taskAction.title,
          dueAt: taskAction.dueAt || null,
          assignedToUserId: assignee,
          createdByUserId: user.id,
          createdByName: user.name,
        })
        crm = result.crm
      }

      if (taskAction?.action === 'complete' && taskAction.taskId) {
        crm = completeTask(crm, taskAction.taskId, user.id, user.name)
      }

      if (meetingAction?.action === 'add' && meetingAction.scheduledAt) {
        const assignee = meetingAction.assignedToUserId || user.id
        if (assignee !== user.id && !user.isOrgAdmin) {
          throw new Error('Only managers can schedule meetings for others')
        }
        if (assignee !== user.id && organizationId) {
          const member = getMembership(draft, assignee, organizationId)
          if (!member) throw new Error('Assignee is not in your team')
        }
        const result = addMeeting(
          crm,
          {
            title: meetingAction.title,
            scheduledAt: meetingAction.scheduledAt,
            durationMinutes: meetingAction.durationMinutes,
            type: meetingAction.type,
            location: meetingAction.location,
            notes: meetingAction.notes,
            assignedToUserId: assignee,
          },
          creator
        )
        crm = result.crm
      }

      if (fieldVisit?.meetingId) {
        crm = recordFieldVisit(
          crm,
          fieldVisit.meetingId,
          { outcome: fieldVisit.outcome, notes: fieldVisit.notes, location: fieldVisit.location },
          creator
        )
      }

      entry.crm = crm
      return draft
    })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Update failed' })
    }

    const entry = findPipelineEntry(updated, user, leadId)
    if (!entry) {
      return sendJson(res, 404, { error: 'Lead not in pipeline' })
    }

    return sendJson(res, 200, {
      leads: listPipelineEntries(updated, user),
      lead: mergeLeadForClient(entry),
    })
  }

  if (req.method === 'DELETE') {
    const body = getBody(req)
    const leadId = body.leadId

    if (!leadId) {
      return sendJson(res, 400, { error: 'leadId is required' })
    }

    const updated = await updateStore((draft) => {
      draft.savedLeads = draft.savedLeads.filter(
        (e) =>
          !(
            e.lead.id === leadId &&
            (organizationId ? e.organizationId === organizationId : e.userId === user.id)
          )
      )
      return draft
    })

    return sendJson(res, 200, { leads: listPipelineEntries(updated, user) })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
