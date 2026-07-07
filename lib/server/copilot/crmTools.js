import { readStore } from '../store.js'
import { addTask, addMeeting, resolveEntryCrm } from '../crmWorkflow.js'
import { generateAiEmail } from '../crm.js'
import { buildCrmDraftOptions, requireAgenda } from '../crmEmailPrompt.js'
import { assertEditLeadsForPipelinePatch } from '../permissionEnforce.js'
import { mergeLeadForTenant } from '../tenantIsolation.js'
import {
  attachPipelineEntriesToStore,
  loadPipelineStoreContext,
  loadPipelineLeadForMutation,
  persistPipelineEntryUpdates,
  pipelineShardNameForUser,
} from '../pipelineShard.js'
import { findPipelineEntryAsync } from '../pipelineVisibility.js'
import {
  buildEmailAgenda,
  parseDueFromMessage,
  parseMeetingFromMessage,
  parseTaskTitle,
} from './scheduleIntent.js'

const META_COLLECTIONS = ['users', 'organizations', 'organizationMemberships']

async function loadLeadEntry(user, leadId) {
  const tableLoad = await loadPipelineLeadForMutation(user, leadId)
  if (tableLoad) {
    return {
      entry: tableLoad.entry,
      metaStore: tableLoad.metaStore,
      shardName: tableLoad.shardName,
    }
  }

  const { pipelineStore } = await loadPipelineStoreContext(user, { shardOnly: true })
  const metaStore = await readStore({ only: META_COLLECTIONS })
  const entry = await findPipelineEntryAsync(pipelineStore, user, leadId, metaStore)
  if (!entry) return null
  return {
    entry,
    metaStore,
    shardName: pipelineShardNameForUser(user),
  }
}

export async function executeCopilotSchedulePatch(user, leadId, { task, meeting }) {
  const loaded = await loadLeadEntry(user, leadId)
  if (!loaded?.entry) return { error: 'Lead not in pipeline' }

  const { entry, metaStore, shardName } = loaded

  try {
    await assertEditLeadsForPipelinePatch(user, metaStore, entry, { scheduleOnly: true })
  } catch (err) {
    return { error: err.message || 'Permission denied', code: err.code || 'permission_denied' }
  }

  let crm = resolveEntryCrm(entry)
  let createdTask = null
  let createdMeeting = null

  if (task?.title) {
    const result = addTask(crm, {
      title: task.title,
      dueAt: task.dueAt || null,
      assignedToUserId: user.id,
      createdByUserId: user.id,
      createdByName: user.name || user.email,
    })
    crm = result.crm
    createdTask = result.task
  }

  if (meeting?.scheduledAt) {
    const result = addMeeting(
      crm,
      {
        title: meeting.title || 'Meeting',
        scheduledAt: meeting.scheduledAt,
        durationMinutes: meeting.durationMinutes || 30,
        type: meeting.type || 'call',
        notes: meeting.notes || '',
      },
      { userId: user.id, name: user.name || user.email }
    )
    crm = result.crm
    createdMeeting = result.meeting
  }

  const updated = { ...entry, crm, lead: { ...(entry.lead || {}), crm } }
  await persistPipelineEntryUpdates(shardName, [updated])

  return { ok: true, leadId, task: createdTask, meeting: createdMeeting }
}

export async function executeCopilotEmailDraft(user, leadId, { agenda, purpose = 'follow_up' }) {
  const agendaText = String(agenda || '').trim()
  const agendaError = requireAgenda({ agenda: agendaText })
  if (agendaError) return { error: agendaError }

  const loaded = await loadLeadEntry(user, leadId)
  if (!loaded?.entry) return { error: 'Lead not in pipeline' }

  const store = attachPipelineEntriesToStore(loaded.metaStore, [loaded.entry])
  const pipelineLead = mergeLeadForTenant(store, user, loaded.entry)

  const options = buildCrmDraftOptions(user, {
    agenda: agendaText,
    purpose,
    tone: 'professional',
    senderName: user.name,
    senderCompany: user.company || user.organizationName,
  })

  try {
    const draft = await generateAiEmail(pipelineLead, options)
    return {
      ok: true,
      leadId,
      draft: {
        subject: draft.subject || '',
        body: draft.body || '',
        aiGenerated: Boolean(draft.aiGenerated),
      },
    }
  } catch (err) {
    return { error: err.message || 'Could not generate email draft' }
  }
}

function formatWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export async function tryCopilotCrmTools({ user, message, plan, leadContext, uiContext }) {
  const leadId = uiContext.leadId || leadContext?.id
  if (!leadId) return null

  const intents = plan.intents || {}
  const followUpTask =
    intents.createTask ||
    (/\b(remind me|follow.?up)\b/i.test(message) && !intents.draftEmail && !plan.runWeb)

  if (intents.draftEmail || /\bfollow.?up email\b/i.test(message)) {
    const agenda = buildEmailAgenda(message, leadContext)
    const out = await executeCopilotEmailDraft(user, leadId, {
      agenda,
      purpose: /\bintro/i.test(message) ? 'introduction' : 'follow_up',
    })
    if (out.error) {
      return {
        reply: `**Answer:** Could not draft email — ${out.error}`,
        source: 'crm',
        sources: [{ type: 'crm', label: 'CRM action' }],
        confidence: 'low',
        actions: [
          { type: 'navigate', panel: 'pipeline', leadId, leadTab: 'email', label: 'Open email tab' },
        ],
        suggestions: ['Try a longer agenda (8+ characters)'],
      }
    }

    const { subject, body } = out.draft
    return {
      reply: `**Answer:** Email draft ready for **${leadContext?.name || 'this lead'}**.\n\n**Subject:** ${subject}\n\n**Preview:**\n${body.slice(0, 600)}${body.length > 600 ? '…' : ''}`,
      source: 'crm',
      sources: [{ type: 'crm', label: 'Email draft' }],
      confidence: 'high',
      emailDraft: out.draft,
      actions: [
        {
          type: 'open_email_draft',
          leadId,
          label: 'Open in composer',
          payload: { subject, body, agenda },
        },
        { type: 'navigate', panel: 'pipeline', leadId, leadTab: 'email', label: 'Review & send' },
      ],
      suggestions: ['Schedule a follow-up meeting', 'Research this company'],
    }
  }

  if (intents.scheduleMeeting) {
    const parsed = parseMeetingFromMessage(message)
    const title = parseTaskTitle(message).replace(/^follow up$/i, 'Discovery call') || 'Meeting'
    const out = await executeCopilotSchedulePatch(user, leadId, {
      meeting: { title, ...parsed },
    })
    if (out.error) {
      return {
        reply: `**Answer:** Could not schedule meeting — ${out.error}`,
        source: 'crm',
        sources: [{ type: 'crm', label: 'CRM action' }],
        confidence: 'low',
        actions: [],
      }
    }
    const m = out.meeting
    return {
      reply: `**Answer:** Meeting scheduled — **${m.title}** on ${formatWhen(m.scheduledAt)} (${m.durationMinutes} min).`,
      source: 'crm',
      sources: [{ type: 'crm', label: 'CRM action' }],
      confidence: 'high',
      executedAction: 'meeting',
      actions: [
        { type: 'navigate', panel: 'pipeline', leadId, leadTab: 'schedule', label: 'View in schedule' },
      ],
      suggestions: ['Draft follow-up email', 'Add another task'],
    }
  }

  if (followUpTask) {
    const title = parseTaskTitle(message)
    const dueAt = parseDueFromMessage(message)
    const out = await executeCopilotSchedulePatch(user, leadId, {
      task: { title, dueAt },
    })
    if (out.error) {
      return {
        reply: `**Answer:** Could not create task — ${out.error}`,
        source: 'crm',
        sources: [{ type: 'crm', label: 'CRM action' }],
        confidence: 'low',
        actions: [
          { type: 'navigate', panel: 'pipeline', leadId, leadTab: 'schedule', label: 'Add manually' },
        ],
      }
    }
    const t = out.task
    return {
      reply: `**Answer:** Task created — **${t.title}** due ${formatWhen(t.dueAt)}.`,
      source: 'crm',
      sources: [{ type: 'crm', label: 'CRM action' }],
      confidence: 'high',
      executedAction: 'task',
      actions: [
        { type: 'navigate', panel: 'pipeline', leadId, leadTab: 'schedule', label: 'View task' },
        { type: 'navigate', panel: 'pipeline', leadId, leadTab: 'email', label: 'Draft email' },
      ],
      suggestions: ['Draft follow-up email', 'Schedule a meeting'],
    }
  }

  return null
}
