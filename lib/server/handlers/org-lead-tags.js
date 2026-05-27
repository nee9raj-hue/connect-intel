import { requireUser } from '../auth.js'
import { resolveOrgRole } from '../organizations.js'
import {
  createOrgLeadTag,
  deleteOrgLeadTag,
  listOrgLeadTagDefinitions,
  updateOrgLeadTag,
} from '../orgLeadTags.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  const { accountType } = resolveOrgRole(user, store)
  const organizationId =
    accountType === 'company' && user.organizationId ? user.organizationId : null

  if (!organizationId) {
    return sendJson(res, 400, { error: 'Lead tags require a company workspace' })
  }

  if (req.method === 'GET') {
    const tags = listOrgLeadTagDefinitions(store, organizationId)
    return sendJson(res, 200, { tags, canManage: Boolean(user.isOrgAdmin) })
  }

  if (!user.isOrgAdmin) {
    return sendJson(res, 403, { error: 'Only company admins can manage lead tags' })
  }

  if (req.method === 'POST') {
    const body = getBody(req) || {}
    try {
      let tag
      await updateStore((draft) => {
        tag = createOrgLeadTag(draft, organizationId, body, user.id)
        return draft
      })
      return sendJson(res, 200, { tag, tags: listOrgLeadTagDefinitions(await readStore(), organizationId) })
    } catch (error) {
      return sendJson(res, 400, { error: error.message })
    }
  }

  if (req.method === 'PATCH') {
    const body = getBody(req) || {}
    const tagId = String(body.id || '').trim()
    if (!tagId) return sendJson(res, 400, { error: 'Tag id is required' })
    try {
      let tag
      await updateStore((draft) => {
        tag = updateOrgLeadTag(draft, organizationId, tagId, body)
        return draft
      })
      return sendJson(res, 200, { tag, tags: listOrgLeadTagDefinitions(await readStore(), organizationId) })
    } catch (error) {
      return sendJson(res, 400, { error: error.message })
    }
  }

  if (req.method === 'DELETE') {
    const body = getBody(req) || {}
    const tagId = String(body.id || '').trim()
    if (!tagId) return sendJson(res, 400, { error: 'Tag id is required' })
    try {
      await updateStore((draft) => {
        deleteOrgLeadTag(draft, organizationId, tagId)
        return draft
      })
      return sendJson(res, 200, {
        ok: true,
        tags: listOrgLeadTagDefinitions(await readStore(), organizationId),
      })
    } catch (error) {
      return sendJson(res, 400, { error: error.message })
    }
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
