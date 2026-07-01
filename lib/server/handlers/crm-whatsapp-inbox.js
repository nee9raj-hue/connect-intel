import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { isWhatsAppCloudConfigured } from '../whatsappCloud.js'
import {
  getWhatsAppInboxStats,
  getWhatsAppThreadDetail,
  listWhatsAppThreads,
  replyWhatsAppThread,
  setWhatsAppThreadTag,
  syncWhatsAppThreadsFromPipeline,
} from '../whatsappInbox.js'
import { loadMetaUserAndAssertEditLeads, permissionDeniedResponse } from '../permissionEnforce.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const store = await readStore()
  let user
  try {
    ;({ user } = await loadMetaUserAndAssertEditLeads(sessionUser, store))
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    return sendJson(res, denied.status, denied.body)
  }

  const url = new URL(req.url || '', 'http://local')
  const threadId = String(url.searchParams.get('threadId') || '').trim()
  const statsOnly = url.searchParams.get('stats') === '1'

  if (req.method === 'GET') {
    if (!isWhatsAppCloudConfigured(user, store)) {
      return sendJson(res, 200, {
        configured: false,
        threads: [],
        thread: null,
        stats: { unread: 0, total: 0 },
        message:
          'Connect WhatsApp Business API under Integrations to use the inbox. Manual wa.me chats from Pipeline are logged on each lead.',
      })
    }

    await updateStore((draft) => {
      syncWhatsAppThreadsFromPipeline(draft, user)
      return draft
    })
    const fresh = await readStore()

    if (statsOnly) {
      return sendJson(res, 200, {
        configured: true,
        stats: getWhatsAppInboxStats(fresh, user),
      })
    }

    if (threadId) {
      let thread = null
      await updateStore((draft) => {
        thread = getWhatsAppThreadDetail(draft, user, threadId)
        return draft
      })
      if (!thread) return sendJson(res, 404, { error: 'Conversation not found' })
      return sendJson(res, 200, { configured: true, thread })
    }

    const filters = {
      phone: url.searchParams.get('phone') || '',
      tag: url.searchParams.get('tag') || '',
      campaignId: url.searchParams.get('campaignId') || '',
    }
    const threads = listWhatsAppThreads(fresh, user, filters)
    const campaigns = (fresh.marketingCampaigns || [])
      .filter((c) => c.channel === 'whatsapp')
      .map((c) => ({ id: c.id, name: c.name }))

    return sendJson(res, 200, {
      configured: true,
      threads,
      campaigns,
      stats: getWhatsAppInboxStats(fresh, user),
    })
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    const action = body.action || 'reply'

    if (action === 'sync') {
      let sync = { added: 0 }
      await updateStore((draft) => {
        sync = syncWhatsAppThreadsFromPipeline(draft, user)
        return draft
      })
      return sendJson(res, 200, { ok: true, ...sync })
    }

    if (action === 'reply') {
      if (!threadId && !body.threadId) {
        return sendJson(res, 400, { error: 'threadId is required' })
      }
      const id = threadId || body.threadId
      try {
        let reply = null
        await updateStore(async (draft) => {
          reply = await replyWhatsAppThread(draft, user, id, body.message)
          return draft
        })
        return sendJson(res, 200, { ok: true, ...reply })
      } catch (e) {
        return sendJson(res, 400, { error: e.message || 'Could not send' })
      }
    }

    return sendJson(res, 400, { error: 'Unknown action' })
  }

  if (req.method === 'PATCH' || req.method === 'PUT') {
    const body = getBody(req)
    const id = threadId || body.threadId
    if (!id) return sendJson(res, 400, { error: 'threadId is required' })
    if (body.action !== 'tag') return sendJson(res, 400, { error: 'Use action: tag' })

    try {
      await updateStore((draft) => {
        setWhatsAppThreadTag(draft, user, id, body.tag)
        return draft
      })
      const fresh = await readStore()
      const thread = getWhatsAppThreadDetail(fresh, user, id)
      return sendJson(res, 200, { ok: true, thread })
    } catch (e) {
      return sendJson(res, 400, { error: e.message || 'Could not update tag' })
    }
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH', 'PUT'])
}
