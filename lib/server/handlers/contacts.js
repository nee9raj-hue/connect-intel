import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { META_STORE_COLLECTIONS, loadPipelineStoreContext } from '../pipelineShard.js'
import { assertOrgPermission, permissionDeniedResponse } from '../permissionEnforce.js'
import {
  listContactsForUser,
  shapeContactRecord,
  userCanAccessContact,
} from '../pipelineContact.js'
import { persistMasterContactUpdate, persistMasterContactMerge } from '../pipelineLeadMutations.js'
import { syncMeilisearchContactsAfterSave } from '../meilisearchSync.js'
import { findDuplicateContactGroups } from '../contactDedup.js'

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

    if (req.query?.duplicates === '1') {
      const gateStore = await readStore({ only: META_STORE_COLLECTIONS })
      try {
        await assertOrgPermission(user, 'edit_leads', gateStore)
      } catch (permError) {
        const denied = permissionDeniedResponse(permError)
        return sendJson(res, denied.status, denied.body)
      }
      const groups = findDuplicateContactGroups(store, user)
      return sendJson(res, 200, { groups, total: groups.length })
    }

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

  if (req.method === 'POST') {
    const body = getBody(req)
    if (body.action === 'merge') {
      const gateStore = await readStore({ only: META_STORE_COLLECTIONS })
      try {
        await assertOrgPermission(user, 'edit_leads', gateStore)
      } catch (permError) {
        const denied = permissionDeniedResponse(permError)
        return sendJson(res, denied.status, denied.body)
      }

      const primaryContactId = String(body.primaryContactId || '').trim()
      const mergeContactIds = Array.isArray(body.mergeContactIds)
        ? body.mergeContactIds.map(String).filter(Boolean)
        : []
      if (!primaryContactId || !mergeContactIds.length) {
        return sendJson(res, 400, { error: 'primaryContactId and mergeContactIds are required' })
      }

      try {
        const result = await persistMasterContactMerge(user, primaryContactId, mergeContactIds)
        if (result.contact && user.organizationId) {
          syncMeilisearchContactsAfterSave({
            organizationId: user.organizationId,
            contact: result.contact,
          })
        }
        return sendJson(res, 200, {
          contact: result.contact,
          mergedCount: result.mergedCount,
          removedContactIds: result.removedContactIds,
          message:
            result.mergedCount === 1
              ? 'Merged 1 duplicate contact'
              : `Merged ${result.mergedCount} duplicate contacts`,
        })
      } catch (error) {
        return sendJson(res, 400, { error: error.message || 'Merge failed' })
      }
    }

    return sendJson(res, 400, { error: 'Unknown action' })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    const id = String(body.contactId || contactId || '').trim()
    if (!id) return sendJson(res, 400, { error: 'contactId is required' })

    const gateStore = await readStore({ only: META_STORE_COLLECTIONS })
    try {
      await assertOrgPermission(user, 'edit_leads', gateStore)
    } catch (permError) {
      const denied = permissionDeniedResponse(permError)
      return sendJson(res, denied.status, denied.body)
    }

    try {
      const { contact: saved } = await persistMasterContactUpdate(user, id, body.contact || body)
      if (saved && user.organizationId) {
        syncMeilisearchContactsAfterSave({
          organizationId: user.organizationId,
          contact: saved,
        })
      }
      return sendJson(res, 200, { contact: saved })
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'Update failed' })
    }
  }

  return methodNotAllowed(res, ['GET', 'PATCH', 'POST'])
}
