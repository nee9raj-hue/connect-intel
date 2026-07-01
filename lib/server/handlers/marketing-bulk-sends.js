import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadMarketingGateContext, requireMarketingHubAccess, requireMarketingSendAccess, MARKETING_SEND_ACTIONS, requireMarketingUser } from '../marketingAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import {
  attachBulkRecipients,
  createMarketingBulkSend,
  getBulkRecipients,
  getMarketingBulkSend,
  listMarketingBulkSends,
  processMarketingBulkSend,
} from '../marketingBulkSends.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const { user: gateUser, store: gateStore } = await loadMarketingGateContext(sessionUser)
  const hubCheck = await requireMarketingHubAccess(gateUser, gateStore)
  if (!hubCheck.ok) return sendJson(res, hubCheck.status || 403, { error: hubCheck.error, code: hubCheck.code })

  const store = await readStore({
    only: [
      'marketingBulkSends',
      'marketingBulkRecipients',
      'marketingLists',
      'marketingSegments',
      'users',
      'organizations',
      'organizationMemberships',
      'savedLeads',
    ],
  })
  const user = buildOrgUserResponse(store.users.find((u) => u.id === sessionUser.id) || sessionUser, store)
  const sendId = String(req.query?.id || getBody(req)?.id || '').trim()
  const action = String(req.query?.action || getBody(req)?.action || '').trim()

  if (req.method === 'GET') {
    if (sendId) {
      const send = getMarketingBulkSend(store, user, sendId)
      if (!send) return sendJson(res, 404, { error: 'Not found' })
      const recipients = getBulkRecipients(store, sendId)
      return sendJson(res, 200, { send, recipients, stats: { opens: send.opens, clicks: send.clicks, leadsCreated: send.leadsCreated } })
    }
    const sends = listMarketingBulkSends(store, user)
    return sendJson(res, 200, { sends })
  }

  if (req.method === 'POST') {
    const body = getBody(req)

    if (sendId && action === 'recipients') {
      try {
        const result = await attachBulkRecipients(user, sendId, body)
        return sendJson(res, 200, result)
      } catch (e) {
        return sendJson(res, 400, { error: e.message })
      }
    }

    if (sendId && (action === 'send' || body.sendNow)) {
      const sendCheck = await requireMarketingSendAccess(gateUser, gateStore)
      if (!sendCheck.ok) {
        return sendJson(res, sendCheck.status || 403, { error: sendCheck.error, code: sendCheck.code })
      }
      try {
        const result = await processMarketingBulkSend(user, sendId)
        return sendJson(res, 200, { ok: true, ...result })
      } catch (e) {
        return sendJson(res, 400, { error: e.message })
      }
    }

    try {
      const send = await createMarketingBulkSend(user, body)
      if (body.recipients) {
        await attachBulkRecipients(user, send.id, body.recipients)
      }
      return sendJson(res, 201, { send })
    } catch (e) {
      return sendJson(res, 400, { error: e.message })
    }
  }

  if (req.method === 'PATCH') {
    const body = getBody(req)
    const id = sendId || body.id
    const send = getMarketingBulkSend(store, user, id)
    if (!send) return sendJson(res, 404, { error: 'Not found' })
    const now = new Date().toISOString()
    await updateStore((draft) => {
      const row = draft.marketingBulkSends.find((s) => s.id === id)
      if (!row) return draft
      for (const key of ['name', 'subject', 'fromName', 'fromEmail', 'replyTo', 'body', 'bodyHtml', 'previewText', 'captureAsLead', 'captureStage']) {
        if (body[key] !== undefined) row[key] = body[key]
      }
      row.updatedAt = now
      return draft
    })
    const updated = getMarketingBulkSend(await readStore(), user, id)
    return sendJson(res, 200, { send: updated })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'PATCH'])
}
