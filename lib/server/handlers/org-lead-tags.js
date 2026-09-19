import { requireUser, requireOrgAdmin } from '../auth.js'
import { resolveOrgRole } from '../organizations.js'
import {
  createOrgLeadTag,
  createOrgLeadTagsBatch,
  deleteOrgLeadTag,
  listOrgLeadTagDefinitions,
  parseTagNamesInput,
  updateOrgLeadTag,
} from '../orgLeadTags.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getPlatform } from '../../platform/index.js'
import { listLeadTagMaster, removeLeadTagMaster, writeLeadTagMaster } from '../leadTagMaster.js'
import { findOrganizationByLegacyId } from '../storeUserLookup.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  const organizationId =
    user.accountType === 'company' && user.organizationId ? user.organizationId : null

  if (!organizationId) {
    return sendJson(res, 400, { error: 'Lead tags require a company workspace' })
  }

  if (req.method === 'GET') {
    try {
      const fromSql = await listLeadTagMaster(organizationId)
      if (fromSql.length) {
        return sendJson(res, 200, { tags: fromSql, canManage: Boolean(user.isOrgAdmin) })
      }
    } catch (error) {
      console.warn('org/lead-tags sql:', error?.message || error)
    }
    try {
      const org = await findOrganizationByLegacyId(organizationId)
      const tags = listOrgLeadTagDefinitions({ organizations: org ? [org] : [] }, organizationId)
      return sendJson(res, 200, { tags, canManage: Boolean(user.isOrgAdmin) })
    } catch (error) {
      console.warn('org/lead-tags json:', error?.message || error)
      return sendJson(res, 200, { tags: [], canManage: Boolean(user.isOrgAdmin) })
    }
  }

  let store = await readStore({ only: ['organizations'], timeoutMs: 12_000, attempts: 1 })
  const { accountType } = resolveOrgRole(user, store)
  if (accountType !== 'company') {
    return sendJson(res, 400, { error: 'Lead tags require a company workspace' })
  }

  const admin = await requireOrgAdmin(req, res)
  if (!admin) return

  if (req.method === 'POST') {
    const body = getBody(req) || {}
    try {
      const names = Array.isArray(body.names)
        ? body.names.map((n) => String(n).trim()).filter(Boolean)
        : parseTagNamesInput(body.name)

      if (!names.length) {
        return sendJson(res, 400, { error: 'Enter at least one tag name' })
      }

      if (names.length === 1) {
        let tag
        await updateStore((draft) => {
          tag = createOrgLeadTag(
            draft,
            organizationId,
            { name: names[0], color: body.color },
            user.id
          )
          return draft
        })
        await writeLeadTagMaster(organizationId, tag)
        return sendJson(res, 200, {
          tag,
          created: [tag],
          skipped: [],
          tags: listOrgLeadTagDefinitions(await readStore({ only: ['organizations'] }), organizationId),
        })
      }

      let batch
      await updateStore((draft) => {
        batch = createOrgLeadTagsBatch(draft, organizationId, names, user.id)
        return draft
      })
      if (batch.created.length) {
        await getPlatform().repositories.leadTags.upsertMany(organizationId, batch.created)
      }
      return sendJson(res, 200, {
        tag: batch.created[0] || null,
        created: batch.created,
        skipped: batch.skipped,
          tags: listOrgLeadTagDefinitions(await readStore({ only: ['organizations'] }), organizationId),
      })
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
      await writeLeadTagMaster(organizationId, tag)
      return sendJson(res, 200, { tag, tags: listOrgLeadTagDefinitions(await readStore({ only: ['organizations'] }), organizationId) })
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
      await removeLeadTagMaster(organizationId, tagId)
      return sendJson(res, 200, {
        ok: true,
          tags: listOrgLeadTagDefinitions(await readStore({ only: ['organizations'] }), organizationId),
      })
    } catch (error) {
      return sendJson(res, 400, { error: error.message })
    }
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
