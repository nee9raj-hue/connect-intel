import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  createTeamNoteRow,
  filterOrgRows,
  parseLeadMentions,
  requireTeamWorkspace,
  userCanViewNote,
  validateLeadMentions,
  validateRecipient,
} from '../teamCollaboration.js'
import { notifyTeamNoteRecipient } from '../teamCollaborationNotify.js'

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
    const notes = filterOrgRows(store.teamNotes, user.organizationId)
      .filter((n) => userCanViewNote(n, user))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return sendJson(res, 200, { notes })
  }

  if (req.method === 'POST') {
    const { recipientUserId, body } = getBody(req)
    if (!recipientUserId) return sendJson(res, 400, { error: 'Choose a team member' })
    if (!String(body || '').trim()) return sendJson(res, 400, { error: 'Write a note' })

    try {
      const recipient = validateRecipient(store, user.organizationId, recipientUserId)
      const leadMentions = parseLeadMentions(body)
      validateLeadMentions(store, user, leadMentions)
      const note = createTeamNoteRow({ user, recipientUserId: recipient.id, body, leadMentions })

      await updateStore((draft) => {
        draft.teamNotes = draft.teamNotes || []
        draft.teamNotes.push(note)
        return draft
      })

      const emailResult = await notifyTeamNoteRecipient({
        store: await readStore(),
        note,
        actor: user,
      })

      return sendJson(res, 201, { note, emailSent: Boolean(emailResult.sent) })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Could not save note' })
    }
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
