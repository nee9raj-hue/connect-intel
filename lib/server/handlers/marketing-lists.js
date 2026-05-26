import { requireUser } from '../auth.js'
import { readStore, updateStore, createId } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  canAccessMarketingAsset,
  enrichMarketingRows,
  filterMarketingAssets,
  marketingScopeKey,
  requireMarketingUser,
} from '../marketingAccess.js'
import { MAX_LIST_LEADS } from '../marketingCampaigns.js'
import { ensureLeadsInPipeline } from '../marketingPipeline.js'
import { buildOrgUserResponse, getPipelineLeadIds } from '../organizations.js'
import {
  assertCanCreateListBatches,
  createMarketingListBatches,
} from '../marketingListBatchCreate.js'
import {
  filterLeadIdsForMarketingChannel,
  normalizeMarketingChannel,
} from '../marketingLeadEligibility.js'
import { partitionLeadsBySuppression } from '../marketingListMembers.js'

function leadIdsVisibleToUser(store, user, leadIds) {
  const visible = getPipelineLeadIds(store, user)
  return [...new Set((leadIds || []).filter((id) => visible.has(id)))]
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireMarketingUser(sessionUser)
  if (!check.ok) return sendJson(res, 401, { error: check.error })

  const store = await readStore()
  const dbUser = store.users.find((u) => u.id === sessionUser.id)
  const user = buildOrgUserResponse(dbUser || sessionUser, store)

  if (req.method === 'GET') {
    const lists = enrichMarketingRows(
      store,
      user,
      filterMarketingAssets(store, user, store.marketingLists, { filterLeadIds: true }).sort(
        (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
      )
    )
    return sendJson(res, 200, { lists })
  }

  if (req.method === 'POST') {
    const body = getBody(req)

    if (body.action === 'create_batches') {
      try {
        assertCanCreateListBatches(store, user, body.assigneeUserId)
        let result = null
        await updateStore((draft) => {
          result = createMarketingListBatches(draft, user, {
            namePrefix: body.namePrefix,
            leadIds: body.leadIds,
            assigneeUserId: body.assigneeUserId,
            pipelineStatus: body.pipelineStatus,
            batchSize: body.batchSize,
            channel: body.channel,
          })
          return draft
        })
        return sendJson(res, 201, result)
      } catch (error) {
        return sendJson(res, 400, { error: error.message || 'Could not create batch lists' })
      }
    }

    const { name, description, leadIds, searchLeads, channel, assigneeUserId } = body
    const listChannel = normalizeMarketingChannel(channel)
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

    ids = leadIdsVisibleToUser(store, user, ids)
    ids = filterLeadIdsForMarketingChannel(store, user, ids, listChannel).slice(0, MAX_LIST_LEADS)
    const { allowed, blocked } = partitionLeadsBySuppression(store, user, ids)
    if (blocked.length && !allowed.length) {
      const sample = blocked[0]?.email || 'this address'
      return sendJson(res, 400, {
        error: `Cannot add leads — ${sample} unsubscribed from your email list and cannot be re-added.`,
        blocked,
      })
    }
    ids = allowed
    if (!ids.length) {
      return sendJson(res, 400, {
        error:
          listChannel === 'whatsapp'
            ? 'No leads with a valid mobile number in this selection'
            : 'No leads with a valid email address in this selection',
      })
    }
    const now = new Date().toISOString()
    const assignee =
      assigneeUserId && assigneeUserId !== '__unassigned__' ? String(assigneeUserId) : null
    const list = {
      id: createId('mlist'),
      ...marketingScopeKey(user),
      name: String(name).trim().slice(0, 120),
      description: String(description || '').trim().slice(0, 400),
      leadIds: ids,
      channel: listChannel,
      assigneeUserId: assignee,
      createdByUserId: user.id,
      createdAt: now,
      updatedAt: now,
    }
    await updateStore((draft) => {
      draft.marketingLists = draft.marketingLists || []
      draft.marketingLists.push(list)
      return draft
    })
    return sendJson(res, 201, {
      list,
      skippedUnsubscribed: blocked.length ? blocked : undefined,
    })
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    const { id, name, description, leadIds, action } = body

    if (action === 'add_leads' || action === 'remove_leads') {
      const existing = (store.marketingLists || []).find((l) => l.id === id)
      if (!existing || !canAccessMarketingAsset(existing, user)) {
        return sendJson(res, 404, { error: 'List not found' })
      }
      const incoming = [...new Set(Array.isArray(body.leadIds) ? body.leadIds : [])]
      const visible = leadIdsVisibleToUser(store, user, incoming)
      const channel = existing.channel || 'email'
      const eligible = filterLeadIdsForMarketingChannel(store, user, visible, channel)

      if (action === 'remove_leads') {
        const removeSet = new Set(eligible)
        await updateStore((draft) => {
          const row = draft.marketingLists.find((l) => l.id === id)
          if (!row) return draft
          row.leadIds = (row.leadIds || []).filter((lid) => !removeSet.has(lid))
          row.updatedAt = new Date().toISOString()
          return draft
        })
        const updated = (await readStore()).marketingLists.find((l) => l.id === id)
        return sendJson(res, 200, { list: updated, removed: eligible.length })
      }

      const { allowed, blocked } = partitionLeadsBySuppression(store, user, eligible)
      if (blocked.length && !allowed.length) {
        const sample = blocked.map((b) => b.email).slice(0, 3).join(', ')
        return sendJson(res, 400, {
          error: `These contacts unsubscribed from your email list and cannot be re-added: ${sample}`,
          blocked,
        })
      }

      await updateStore((draft) => {
        const row = draft.marketingLists.find((l) => l.id === id)
        if (!row) return draft
        const merged = [...new Set([...(row.leadIds || []), ...allowed])].slice(0, MAX_LIST_LEADS)
        row.leadIds = merged
        row.updatedAt = new Date().toISOString()
        return draft
      })
      const updated = (await readStore()).marketingLists.find((l) => l.id === id)
      return sendJson(res, 200, {
        list: updated,
        added: allowed.length,
        skippedUnsubscribed: blocked.length ? blocked : undefined,
      })
    }

    const { id: patchId, name: patchName, description: patchDesc, leadIds: patchLeadIds } = body
    const listId = patchId || id
    const existing = (store.marketingLists || []).find((l) => l.id === listId)
    if (!existing || !canAccessMarketingAsset(existing, user)) {
      return sendJson(res, 404, { error: 'List not found' })
    }
    const now = new Date().toISOString()
    let skippedUnsubscribed
    if (patchLeadIds !== undefined) {
      const visible = leadIdsVisibleToUser(store, user, patchLeadIds)
      const channel = existing.channel || 'email'
      const eligible = filterLeadIdsForMarketingChannel(store, user, visible, channel)
      const { allowed, blocked } = partitionLeadsBySuppression(store, user, eligible)
      if (blocked.length && !allowed.length) {
        return sendJson(res, 400, {
          error: 'One or more contacts unsubscribed from your email list and cannot be on this list.',
          blocked,
        })
      }
      skippedUnsubscribed = blocked.length ? blocked : undefined
      await updateStore((draft) => {
        const row = draft.marketingLists.find((l) => l.id === listId)
        if (!row) return draft
        if (patchName !== undefined) row.name = String(patchName).trim().slice(0, 120)
        if (patchDesc !== undefined) row.description = String(patchDesc || '').trim().slice(0, 400)
        row.leadIds = allowed.slice(0, MAX_LIST_LEADS)
        row.updatedAt = now
        return draft
      })
    } else {
      await updateStore((draft) => {
        const row = draft.marketingLists.find((l) => l.id === listId)
        if (!row) return draft
        if (patchName !== undefined) row.name = String(patchName).trim().slice(0, 120)
        if (patchDesc !== undefined) row.description = String(patchDesc || '').trim().slice(0, 400)
        row.updatedAt = now
        return draft
      })
    }
    const updated = (await readStore()).marketingLists.find((l) => l.id === listId)
    return sendJson(res, 200, { list: updated, skippedUnsubscribed })
  }

  if (req.method === 'DELETE') {
    const id = getBody(req).id || req.query?.id
    const existing = (store.marketingLists || []).find((l) => l.id === id)
    if (!existing || !canAccessMarketingAsset(existing, user)) {
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
