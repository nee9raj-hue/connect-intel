import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  createTeamTaskRow,
  filterOrgRows,
  parseLeadMentions,
  requireTeamWorkspace,
  userCanViewTask,
  validateLeadMentions,
  validateRecipient,
} from '../teamCollaboration.js'
import { notifyTeamTaskAssignee } from '../teamCollaborationNotify.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireTeamWorkspace(sessionUser)
  if (!check.ok) return sendJson(res, 403, { error: check.error })

  const store = await readStore()
  const user = store.users.find((u) => u.id === sessionUser.id) || sessionUser

  if (req.method === 'GET') {
    const tasks = filterOrgRows(store.teamTasks, user.organizationId)
      .filter((t) => userCanViewTask(t, user))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return sendJson(res, 200, { tasks })
  }

  if (req.method === 'POST') {
    const { assigneeUserId, title, body, dueAt } = getBody(req)
    if (!assigneeUserId) return sendJson(res, 400, { error: 'Choose a team member' })
    if (!String(title || '').trim()) return sendJson(res, 400, { error: 'Task title is required' })

    try {
      const assignee = validateRecipient(store, user.organizationId, assigneeUserId)
      const leadMentions = parseLeadMentions(body)
      validateLeadMentions(store, user, leadMentions)
      const task = createTeamTaskRow({
        user,
        assigneeUserId: assignee.id,
        title,
        body,
        dueAt: dueAt || null,
        leadMentions,
      })

      await updateStore((draft) => {
        draft.teamTasks = draft.teamTasks || []
        draft.teamTasks.push(task)
        return draft
      })

      const emailResult = await notifyTeamTaskAssignee({
        store: await readStore(),
        task,
        actor: user,
      })

      return sendJson(res, 201, { task, emailSent: Boolean(emailResult.sent) })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Could not create task' })
    }
  }

  if (req.method === 'PATCH') {
    const { id, action } = getBody(req)
    const existing = (store.teamTasks || []).find((t) => t.id === id)
    if (!existing || !userCanViewTask(existing, user)) {
      return sendJson(res, 404, { error: 'Task not found' })
    }

    if (action === 'complete') {
      const now = new Date().toISOString()
      await updateStore((draft) => {
        const row = draft.teamTasks.find((t) => t.id === id)
        if (!row) return draft
        row.status = 'done'
        row.completedAt = now
        row.updatedAt = now
        return draft
      })
      const updated = (await readStore()).teamTasks.find((t) => t.id === id)
      return sendJson(res, 200, { task: updated })
    }

    return sendJson(res, 400, { error: 'Unknown action' })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH'])
}
