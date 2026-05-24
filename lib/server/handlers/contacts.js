import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  listContactsForUser,
  shapeContactRecord,
  updateMasterContactById,
  userCanAccessContact,
} from '../pipelineContact.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  const contactId = String(req.query?.contactId || req.query?.id || '').trim()

  if (req.method === 'GET') {
    const search = String(req.query?.search || req.query?.q || '').trim()
    const limit = Math.min(Math.max(Number(req.query?.limit) || 100, 1), 200)
    const offset = Math.max(Number(req.query?.offset) || 0, 0)

    if (contactId) {
      const contact = store.contacts.find((row) => row.id === contactId)
      if (!contact || !userCanAccessContact(store, user, contactId)) {
        return sendJson(res, 404, { error: 'Contact not found' })
      }
      const company = store.companies.find((row) => row.id === contact.companyId) || null
      return sendJson(res, 200, { contact: shapeContactRecord(contact, company) })
    }

    const result = listContactsForUser(store, user, { search, limit, offset })
    return sendJson(res, 200, result)
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    const id = String(body.contactId || contactId || '').trim()
    if (!id) return sendJson(res, 400, { error: 'contactId is required' })

    try {
      let saved = null
      await updateStore((draft) => {
        saved = updateMasterContactById(draft, user, id, body.contact || body)
        return draft
      })
      return sendJson(res, 200, { contact: saved })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Update failed' })
    }
  }

  return methodNotAllowed(res, ['GET', 'PATCH'])
}
