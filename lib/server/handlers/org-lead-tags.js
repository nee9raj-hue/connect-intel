import { requireUser } from '../auth.js'
import {
  createLeadTagRecord,
  listOrgLeadTagDefinitions,
  parseTagNamesInput,
  updateOrgLeadTag,
} from '../orgLeadTags.js'
import { getOrganization } from '../organizations.js'
import { readStore, updateStorePartial } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  listLeadTagMaster,
  removeLeadTagMaster,
  upsertLeadTagMasterRows,
  writeLeadTagMaster,
} from '../leadTagMaster.js'
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

function withTagPermissions(tags, user) {
  const admin = isCompanyAdmin(user)
  const actorIds = viewerActorIds(user)
  return (tags || [])
    .filter((tag) => memberCanUseLeadTag(tag, [], { isOrgAdmin: admin, actorIds }))
    .map((tag) => ({
      ...tag,
      canEdit: canEditLeadTag(tag, user),
    }))
}

async function loadTagCatalog(organizationId) {
  const fromSql = await listLeadTagMaster(organizationId)
  if (fromSql.length) return fromSql
  try {
    const store = await readStore({ only: ['organizations'] })
    return listOrgLeadTagDefinitions(store, organizationId)
  } catch (error) {
    console.warn('org lead-tags catalog fallback:', error?.message || error)
    return []
  }
}

async function mirrorOrgLeadTagsBlob(organizationId, mutator) {
  try {
    await updateStorePartial(['organizations'], (draft) => {
      const org = getOrganization(draft, organizationId)
      if (!org) return draft
      const current = listOrgLeadTagDefinitions(draft, organizationId)
      org.leadTags = mutator(current)
      return draft
    })
  } catch (error) {
    console.warn('org leadTags blob mirror:', error?.message || error)
  }
}

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

  const admin = isCompanyAdmin(user)
  const personalByDefault = !admin

  async function listedTags() {
    return withTagPermissions(await loadTagCatalog(organizationId), user)
  }

  if (req.method === 'GET') {
    return sendJson(res, 200, {
      tags: await listedTags(),
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
      const existing = await loadTagCatalog(organizationId)

      if (names.length === 1) {
        const tag = createLeadTagRecord(existing, { name: names[0], color: body.color, personal }, user.id)
        await writeLeadTagMaster(organizationId, tag)
        void mirrorOrgLeadTagsBlob(organizationId, (tags) => [...tags.filter((t) => t.id !== tag.id), tag])
        return sendJson(res, 200, {
          tag,
          created: [tag],
          skipped: [],
          tags: withTagPermissions([...existing, tag], user),
        })
      }

      const created = []
      const skipped = []
      let working = [...existing]
      for (const name of names) {
        try {
          const tag = createLeadTagRecord(working, { name, personal }, user.id)
          created.push(tag)
          working.push(tag)
        } catch {
          skipped.push({ name, reason: 'already_exists' })
        }
      }
      if (!created.length && skipped.length) {
        throw new Error('All tag names already exist')
      }
      if (created.length) {
        await upsertLeadTagMasterRows(organizationId, created)
        void mirrorOrgLeadTagsBlob(organizationId, (tags) => {
          const extra = created.filter((tag) => !tags.some((t) => t.id === tag.id))
          return [...tags, ...extra]
        })
      }
      return sendJson(res, 200, {
        tag: created[0] || null,
        created,
        skipped,
        tags: withTagPermissions(working, user),
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
      const existing = await loadTagCatalog(organizationId)
      const current = existing.find((t) => t.id === tagId)
      if (!canEditLeadTag(current, user)) throw new Error('You can only edit your own tags')
      const store = { organizations: [{ id: organizationId, leadTags: existing }] }
      const tag = updateOrgLeadTag(store, organizationId, tagId, body)
      await writeLeadTagMaster(organizationId, tag)
      void mirrorOrgLeadTagsBlob(organizationId, (tags) => tags.map((t) => (t.id === tag.id ? tag : t)))
      return sendJson(res, 200, {
        tag,
        tags: withTagPermissions(existing.map((t) => (t.id === tag.id ? tag : t)), user),
      })
    } catch (error) {
      return sendJson(res, 400, { error: error.message })
    }
  }

  if (req.method === 'DELETE') {
    const body = getBody(req) || {}
    const tagId = String(body.id || '').trim()
    if (!tagId) return sendJson(res, 400, { error: 'Tag id is required' })
    try {
      const existing = await loadTagCatalog(organizationId)
      const current = existing.find((t) => t.id === tagId)
      if (!canEditLeadTag(current, user)) throw new Error('You can only delete your own tags')
      await removeLeadTagMaster(organizationId, tagId)
      void mirrorOrgLeadTagsBlob(organizationId, (tags) => tags.filter((t) => t.id !== tagId))
      return sendJson(res, 200, {
        ok: true,
        tags: withTagPermissions(existing.filter((t) => t.id !== tagId), user),
      })
    } catch (error) {
      return sendJson(res, 400, { error: error.message })
    }
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'DELETE'])
}
