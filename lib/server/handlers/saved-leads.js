import { requireUser } from '../auth.js'
import { createId, readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { defaultCrm, normalizeCrm } from '../crm.js'
import { mergeLeadForTenant } from '../tenantIsolation.js'
import {
  addMeeting,
  addTask,
  appendActivity,
  completeTask,
  normalizeExtendedCrm,
  normalizeParticipantIds,
  recordFieldVisit,
} from '../crmWorkflow.js'
import { findPipelineEntry } from '../pipelineAccess.js'
import { repairPipelineEntryCrm } from '../tenantIsolation.js'
import { addManualPipelineLead } from '../manualPipelineLead.js'
import {
  getMembership,
  listPipelinePage,
  listPipelineSavedEntries,
  resolveOrgRole,
} from '../organizations.js'
import { notifyLeadAssigned } from '../assignmentNotify.js'
import { upsertMasterRecordFromLeadFields, updatePipelineContactDetails } from '../pipelineContact.js'
import { applyWorkflowRules, maybeAutoAssignLead } from '../crmWorkflowRules.js'
import { computeCrmLeadScore } from '../crmLeadScore.js'
import { maybeMaintainPipelineStore, resetPipelineMaintainThrottle } from '../pipelineMaintain.js'
import { recordWhatsAppOutbound } from '../whatsappInbox.js'
import { normalizeLeadTagIds } from '../orgLeadTags.js'
import {
  DEFAULT_PIPELINE_PAGE_SIZE,
  MAX_PIPELINE_PAGE_SIZE,
} from '../pipelineStore.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import {
  boardPipelineSlice,
  collectPipelineLocationFacets,
  filterPipelineEntries,
  summarizePipelineEntries,
} from '../pipelineQuery.js'
import { mergeLeadForClientListMinimal, CRM_STATUSES } from '../crm.js'

function parseBoardColumnLimits(url) {
  const columnLimits = {}
  for (const status of CRM_STATUSES) {
    const raw = url.searchParams.get(`col_${status}`)
    if (!raw) continue
    const n = Math.floor(Number(raw))
    if (Number.isFinite(n) && n > 0) columnLimits[status] = Math.min(n, 500)
  }
  return columnLimits
}

function parsePipelineQueryParams(url) {
  const status = String(url.searchParams.get('status') || 'all').trim()
  const q = String(url.searchParams.get('q') || '').trim()
  const city = String(url.searchParams.get('city') || '').trim()
  const state = String(url.searchParams.get('state') || '').trim()
  const assigneeUserId = String(url.searchParams.get('assigneeUserId') || '').trim() || null
  const tagIds = url.searchParams.getAll('tagId').filter(Boolean)
  return { status, q, city, state, assigneeUserId, tagIds }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const url = new URL(req.url || '', 'http://local')
    const light = url.searchParams.get('light') !== '0'
    const leadId = String(url.searchParams.get('leadId') || '').trim()
    const isSummary = url.searchParams.get('summary') === '1'
    const isBoard = url.searchParams.get('view') === 'board'

    const { pipelineStore, visible } = await loadPipelineStoreContext(user)
    const { accountType } = resolveOrgRole(user, pipelineStore)
    const organizationId =
      accountType === 'company' && user.organizationId ? user.organizationId : null

    if (leadId) {
      const entry = findPipelineEntry(pipelineStore, user, leadId)
      if (!entry) return sendJson(res, 404, { error: 'Lead not in pipeline' })
      return sendJson(res, 200, { lead: mergeLeadForTenant(pipelineStore, user, entry) })
    }

    if (!light) {
      await maybeMaintainPipelineStore(user, organizationId)
    }

    const filters = parsePipelineQueryParams(url)
    const filtered = filterPipelineEntries(visible, filters)

    if (isSummary) {
      const summary = summarizePipelineEntries(visible)
      const locations = collectPipelineLocationFacets(visible)
      return sendJson(res, 200, { ...summary, ...locations, ready: true })
    }

    if (isBoard) {
      const columnLimits = parseBoardColumnLimits(url)
      const { columns, totals } = boardPipelineSlice(filtered, 50, columnLimits)
      const board = {}
      for (const [status, entries] of Object.entries(columns)) {
        board[status] = entries.map((entry) => ({
          ...mergeLeadForClientListMinimal(entry),
          assignedToUserId: entry.assignedToUserId || null,
          savedByUserId: entry.savedByUserId || entry.userId,
        }))
      }
      return sendJson(res, 200, {
        board,
        columnTotals: totals,
        total: filtered.length,
        visibleTotal: visible.length,
      })
    }

    let limit = url.searchParams.has('limit')
      ? Math.floor(Number(url.searchParams.get('limit')))
      : DEFAULT_PIPELINE_PAGE_SIZE
    if (!Number.isFinite(limit) || limit <= 0) limit = DEFAULT_PIPELINE_PAGE_SIZE
    limit = Math.min(limit, MAX_PIPELINE_PAGE_SIZE)
    const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset') || 0)) || 0)

    const { leads, total } = listPipelinePage(pipelineStore, user, {
      light,
      limit,
      offset,
      entries: filtered,
    })
    const hasMore = offset + leads.length < total
    return sendJson(res, 200, {
      leads,
      total,
      limit,
      offset,
      hasMore,
      pipelineTotal: visible.length,
    })
  }

  const store = await readStore()
  const { accountType } = resolveOrgRole(user, store)
  const organizationId =
    accountType === 'company' && user.organizationId ? user.organizationId : null

  if (req.method === 'POST') {
    const body = getBody(req)

    if (body.manual) {
      try {
        let createdLeadId = null
        const updated = await updateStore((draft) => {
          const created = addManualPipelineLead(draft, {
            user,
            organizationId,
            fields: body.manual,
          })
          createdLeadId = created?.id || null
          return draft
        })
        if (
          createdLeadId &&
          organizationId &&
          body.manual?.assignedToUserId &&
          String(body.manual.assignedToUserId) !== user.id
        ) {
          const entry = findPipelineEntry(updated, user, createdLeadId)
          if (entry) {
            void notifyLeadAssigned({
              store: updated,
              entry,
              assigneeUserId: body.manual.assignedToUserId,
              actorUser: user,
              organizationId,
            }).catch(() => {})
          }
        }
        const entry = createdLeadId
          ? findPipelineEntry(updated, user, createdLeadId)
          : null
        return sendJson(res, 200, {
          lead: entry ? mergeLeadForTenant(updated, user, entry) : null,
          message: 'Lead added to pipeline',
        })
      } catch (error) {
        return sendJson(res, 400, { error: error.message })
      }
    }

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
        let contactId = null
        let companyId = null
        let leadPayload = { ...lead }

        const existingContact = draft.contacts.find((row) => row.id === lead.id)
        if (existingContact) {
          contactId = existingContact.id
          companyId = existingContact.companyId
        } else {
          try {
            const linked = upsertMasterRecordFromLeadFields(
              draft,
              {
                firstName: lead.firstName,
                lastName: lead.lastName,
                title: lead.title,
                company: lead.company,
                email: lead.email,
                phone: lead.phone,
                city: lead.city,
                state: lead.state,
                industry: lead.industry,
                website: lead.companyDomain,
                linkedin: lead.linkedin,
                source: lead.source || 'search',
              },
              user
            )
            contactId = linked.contactId
            companyId = linked.companyId
            leadPayload = {
              ...linked.leadSnapshot,
              score: lead.score,
              source: lead.source || linked.leadSnapshot.source,
            }
          } catch {
            // Keep search snapshot if master upsert fails
          }
        }

        draft.savedLeads.push({
          id: createId('saved'),
          userId: user.id,
          organizationId,
          savedByUserId: user.id,
          assignedToUserId: user.isOrgAdmin ? null : user.id,
          savedAt: new Date().toISOString(),
          contactId,
          companyId,
          crm: defaultCrm(),
          lead: {
            ...leadPayload,
            id: contactId || leadPayload.id || lead.id,
            savedAt: new Date().toISOString(),
            inPipeline: true,
          },
        })
      }
      return draft
    })

    const entry = findPipelineEntry(updated, user, lead.id)
    return sendJson(res, 200, {
      lead: entry ? mergeLeadForTenant(updated, user, entry) : null,
    })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    const leadId = body.leadId
    const crmPatch = body.crm
    const contactPatch = body.contact
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

    function validateParticipantIds(draft, primaryId, extraIds) {
      const ids = normalizeParticipantIds(primaryId, extraIds)
      if (!organizationId) return ids
      for (const uid of ids) {
        if (uid === user.id) continue
        const member = getMembership(draft, uid, organizationId)
        if (!member) throw new Error('Each participant must be on your team')
      }
      return ids
    }

    const entryBefore =
      assignToUserId !== undefined && user.isOrgAdmin && organizationId
        ? findPipelineEntry(store, user, leadId)
        : null
    const previousAssignee = entryBefore?.assignedToUserId ?? null

    let updated
    try {
      updated = await updateStore((draft) => {
      const entry = findPipelineEntry(draft, user, leadId)
      if (!entry) return draft

      let crm = normalizeExtendedCrm(entry.crm)
      const previousStatus = crm.status

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

      if (contactPatch && typeof contactPatch === 'object') {
        updatePipelineContactDetails(draft, entry, contactPatch)
      }

      if (crmPatch) {
        const notesChanged =
          crmPatch.notes !== undefined && String(crmPatch.notes) !== String(crm.notes || '')
        const patch = { ...crmPatch }
        if (patch.tagIds !== undefined && organizationId) {
          patch.tagIds = normalizeLeadTagIds(patch.tagIds, draft, organizationId)
        } else if (patch.tagIds !== undefined) {
          delete patch.tagIds
        }
        crm = normalizeExtendedCrm({
          ...crm,
          ...patch,
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
        if (activity.type === 'whatsapp') {
          const lead = entry.lead || entry
          const waBody =
            String(activity.meta?.message || '').trim() ||
            String(activity.summary || '')
              .replace(/^WhatsApp:\s*/i, '')
              .trim()
          recordWhatsAppOutbound(draft, user, {
            phone: lead.phone,
            body: waBody,
            leadId: entry.id || lead.id,
            leadName: [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.company,
          })
        }
      }

      if (taskAction?.action === 'add' && taskAction.title) {
        const assignee = taskAction.assignedToUserId || user.id
        if (assignee !== user.id && !user.isOrgAdmin) {
          throw new Error('Only managers can set a different primary owner')
        }
        if (assignee !== user.id && organizationId) {
          const member = getMembership(draft, assignee, organizationId)
          if (!member) throw new Error('Assignee is not in your team')
        }
        const participantUserIds = validateParticipantIds(
          draft,
          assignee,
          taskAction.participantUserIds
        )
        const result = addTask(crm, {
          title: taskAction.title,
          dueAt: taskAction.dueAt || null,
          assignedToUserId: assignee,
          participantUserIds,
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
          throw new Error('Only managers can set a different primary owner')
        }
        if (assignee !== user.id && organizationId) {
          const member = getMembership(draft, assignee, organizationId)
          if (!member) throw new Error('Assignee is not in your team')
        }
        const participantUserIds = validateParticipantIds(
          draft,
          assignee,
          meetingAction.participantUserIds
        )
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
            participantUserIds,
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

      if (crmPatch?.status && crmPatch.status !== previousStatus && organizationId) {
        applyWorkflowRules(draft, entry, {
          trigger: 'status_change',
          previousStatus,
          newStatus: crm.status,
          actor: user,
          organizationId,
        })
        crm = normalizeExtendedCrm(entry.crm)
      }

      crm.leadScore = computeCrmLeadScore(entry)
      entry.crm = crm
      repairPipelineEntryCrm(draft, user, entry)
      return draft
    })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Update failed' })
    }

    const entry = findPipelineEntry(updated, user, leadId)
    if (!entry) {
      return sendJson(res, 404, { error: 'Lead not in pipeline' })
    }

    let assignmentEmail = null
    if (
      assignToUserId !== undefined &&
      assignToUserId &&
      organizationId &&
      assignToUserId !== previousAssignee
    ) {
      try {
        assignmentEmail = await notifyLeadAssigned({
          store: updated,
          entry,
          assigneeUserId: assignToUserId,
          actorUser: user,
          organizationId,
        })
      } catch (error) {
        assignmentEmail = { sent: false, error: error.message || 'Notification failed' }
      }
    }

    return sendJson(res, 200, {
      lead: mergeLeadForTenant(updated, user, entry),
      assignmentEmail,
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

    return sendJson(res, 200, { leadId })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
