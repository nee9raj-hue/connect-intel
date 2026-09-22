import { requireUser } from '../auth.js'
import { resolveOrgRole } from '../organizations.js'
import {
  createOrgLeadTag,
  createOrgLeadTagsBatch,
  deleteOrgLeadTag,
  listOrgLeadTagDefinitions,
  parseTagNamesInput,
  stabilizeOrgLeadTagIds,
  updateOrgLeadTag,
} from '../orgLeadTags.js'
import { readStore, updateStore, updateStorePartial } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getPlatform } from '../../platform/index.js'
import { removeLeadTagMaster, writeLeadTagMaster } from '../leadTagMaster.js'
import { isPersonalLeadTag, memberCanUseLeadTag } from '../../pipelineMemberVisibility.js'

function isCompanyAdmin(user) {
  return Boolean(user?.isPlatformAdmin || (user?.isOrgAdmin && user?.accountType === 'company'))
}

function viewerActorIds(user) {
  return [...new Set([user?.id, ...(user?.pipelineActorIds || [])].map(String).filter(Boolean))]
}

function canEditLeadTag(tag, user) {
  if (!tag) return false
  if (isCompanyAdmin(user)) return true
  if (!isPersonalLeadTag(tag)) return false
  const owner = String(tag.createdByUserId || '')
  return viewerActorIds(user).includes(owner)
}

function withTagPermissions(tags, user, memberTeamIds = []) {
  const admin = isCompanyAdmin(user)
  const actorIds = viewerActorIds(user)
  return (tags || [])
    .filter((tag) => memberCanUseLeadTag(tag, memberTeamIds, { isOrgAdmin: admin, actorIds }))
    .map((tag) => ({
      ...tag,
      canEdit: canEditLeadTag(tag, user),
    }))
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  let store = await readStore()
  const { accountType } = resolveOrgRole(user, store)
  const organizationId =
    accountType === 'company' && user.organizationId ? user.organizationId : null

  if (!organizationId) {
    return sendJson(res, 400, { error: 'Lead tags require a company workspace' })
  }

  const admin = isCompanyAdmin(user)
  const personalByDefault = !admin

  async function listedTags(draft = null) {
    const nextStore = draft || (await readStore())
    return withTagPermissions(listOrgLeadTagDefinitions(nextStore, organizationId), user)
  }

  if (req.method === 'GET') {
    if (stabilizeOrgLeadTagIds(store, organizationId)) {
      await updateStorePartial(['organizations'], (draft) => {
        stabilizeOrgLeadTagIds(draft, organizationId)
        return draft
      })
      store = await readStore({ only: ['organizations'] })
    }
    const tags = await getPlatform().repositories.leadTags.syncFromStore(store, organizationId)
    return sendJson(res, 200, {
      tags: withTagPermissions(tags, user),
      canManage: true,
      canManageCompanyTags: admin,
    })
  }

  if (req.method === 'POST') {
    const body = getBody(req) || {}
    try {
      const names = Array.isArray(body.names)
        ? body.names.map((n) => String(n).trim()).filter(Boolean)
        : parseTagNamesInput(body.name)

      if (!names.length) {
        return sendJson(res, 400, { error: 'Enter at least one tag name' })
      }

      const personal = personalByDefault || body.personal === true || body.visibility === 'personal'

      if (names.length === 1) {
        let tag
        await updateStore((draft) => {
          tag = createOrgLeadTag(
            draft,
            organizationId,
            { name: names[0], color: body.color, personal },
            user.id
          )
          return draft
        })
        await writeLeadTagMaster(organizationId, tag)
        return sendJson(res, 200, {
          tag,
          created: [tag],
          skipped: [],
          tags: await listedTags(),
        })
      }

      let batch
      await updateStore((draft) => {
        batch = createOrgLeadTagsBatch(draft, organizationId, names, user.id, { personal })
        return draft
      })
      if (batch.created.length) {
        await getPlatform().repositories.leadTags.upsertMany(organizationId, batch.created)
      }
      return sendJson(res, 200, {
        tag: batch.created[0] || null,
        created: batch.created,
        skipped: batch.skipped,
        tags: await listedTags(),
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
        const current = listOrgLeadTagDefinitions(draft, organizationId).find((t) => t.id === tagId)
        if (!canEditLeadTag(current, user)) throw new Error('You can only edit your own tags')
        tag = updateOrgLeadTag(draft, organizationId, tagId, body)
        return draft
      })
      await writeLeadTagMaster(organizationId, tag)
      return sendJson(res, 200, { tag, tags: await listedTags() })
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
        const current = listOrgLeadTagDefinitions(draft, organizationId).find((t) => t.id === tagId)
        if (!canEditLeadTag(current, user)) throw new Error('You can only delete your own tags')
        deleteOrgLeadTag(draft, organizationId, tagId)
        return draft
      })
      await removeLeadTagMaster(organizationId, tagId)
      return sendJson(res, 200, {
        ok: true,
        tags: await listedTags(),
      })
    } catch (error) {
      return sendJson(res, 400, { error: error.message })
    }
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
