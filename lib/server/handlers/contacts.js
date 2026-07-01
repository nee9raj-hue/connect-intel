import { requireUser } from '../auth.js'
import { readStore, updateStorePartial } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { META_STORE_COLLECTIONS, loadPipelineStoreContext } from '../pipelineShard.js'
import {
  listContactsForUser,
  shapeContactRecord,
  updateMasterContactById,
  userCanAccessContact,
} from '../pipelineContact.js'

const CONTACT_STORE_COLLECTIONS = [
  ...META_STORE_COLLECTIONS,
  'contacts',
  'companies',
]

async function loadContactsStore(user) {
  const metaStore = await readStore({ only: CONTACT_STORE_COLLECTIONS })
  const ctx = await loadPipelineStoreContext(user, { shardOnly: true, dashboard: true })
  return {
    ...metaStore,
    savedLeads: ctx.pipelineStore?.savedLeads || [],
  }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  const contactId = String(req.query?.contactId || req.query?.id || '').trim()

  if (req.method === 'GET') {
    const store = await loadContactsStore(user)
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
      await updateStorePartial(CONTACT_STORE_COLLECTIONS, async (draft) => {
        const ctx = await loadPipelineStoreContext(user, { shardOnly: true, dashboard: true })
        draft.savedLeads = ctx.pipelineStore?.savedLeads || []
        saved = updateMasterContactById(draft, user, id, body.contact || body)
        delete draft.savedLeads
        return draft
      })
      return sendJson(res, 200, { contact: saved })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Update failed' })
    }
  }

  return methodNotAllowed(res, ['GET', 'PATCH'])
}
