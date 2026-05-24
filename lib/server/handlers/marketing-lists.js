import { requireUser } from '../auth.js'
import { readStore, updateStore, createId } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  filterMarketingRows,
  marketingScopeKey,
  requireMarketingUser,
  rowInMarketingScope,
} from '../marketingAccess.js'
import { MAX_LIST_LEADS } from '../marketingCampaigns.js'
import { ensureLeadsInPipeline } from '../marketingPipeline.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireMarketingUser(sessionUser)
  if (!check.ok) return sendJson(res, 401, { error: check.error })

  const store = await readStore()
  const user = store.users.find((u) => u.id === sessionUser.id) || sessionUser

  if (req.method === 'GET') {
    const lists = filterMarketingRows(store.marketingLists, user).sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
    )
    return sendJson(res, 200, { lists })
  }

  if (req.method === 'POST') {
    const { name, description, leadIds, searchLeads } = getBody(req)
    if (!String(name || '').trim()) {
      return sendJson(res, 400, { error: 'List name is required' })
    }

    let ids = [...new Set(Array.isArray(leadIds) ? leadIds : [])]

    if (Array.isArray(searchLeads) && searchLeads.length) {
      await updateStore((draft) => {
        const fromSearch = ensureLeadsInPipeline(draft, user, searchLeads.slice(0, MAX_LIST_LEADS))
        ids = [...new Set([...ids, ...fromSearch])]
        return draft
      })
    }

    ids = ids.slice(0, MAX_LIST_LEADS)
    const now = new Date().toISOString()
    const list = {
      id: createId('mlist'),
      ...marketingScopeKey(user),
      name: String(name).trim().slice(0, 120),
      description: String(description || '').trim().slice(0, 400),
      leadIds: ids,
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
    }
    await updateStore((draft) => {
      draft.marketingLists = draft.marketingLists || []
      draft.marketingLists.push(list)
      return draft
    })
    return sendJson(res, 201, { list })
  }

  if (req.method === 'PATCH') {
    const { id, name, description, leadIds } = getBody(req)
    const existing = (store.marketingLists || []).find((l) => l.id === id)
    if (!existing || !rowInMarketingScope(existing, user)) {
      return sendJson(res, 404, { error: 'List not found' })
    }
    const now = new Date().toISOString()
    await updateStore((draft) => {
      const row = draft.marketingLists.find((l) => l.id === id)
      if (!row) return draft
      if (name !== undefined) row.name = String(name).trim().slice(0, 120)
      if (description !== undefined) row.description = String(description || '').trim().slice(0, 400)
      if (leadIds !== undefined) {
        row.leadIds = [...new Set(Array.isArray(leadIds) ? leadIds : [])].slice(0, MAX_LIST_LEADS)
      }
      row.updatedAt = now
      return draft
    })
    const updated = (await readStore()).marketingLists.find((l) => l.id === id)
    return sendJson(res, 200, { list: updated })
  }

  if (req.method === 'DELETE') {
    const id = getBody(req).id || req.query?.id
    const existing = (store.marketingLists || []).find((l) => l.id === id)
    if (!existing || !rowInMarketingScope(existing, user)) {
      return sendJson(res, 404, { error: 'List not found' })
    }
    await updateStore((draft) => {
      draft.marketingLists = (draft.marketingLists || []).filter((l) => l.id !== id)
      return draft
    })
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
