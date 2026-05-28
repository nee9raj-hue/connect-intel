import { requireUser } from '../auth.js'
import { canOfferCustomerGmailConnect } from '../config.js'
import { buildGmailOAuthStartUrl, isGmailOAuthConfigured } from '../gmailOAuth.js'
import { getUserCrmGmail } from '../crmUserGmail.js'
import { crmGmailHasReadScope, probeGmailReadAccess } from '../crmEmailThread.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, ['GET', 'POST'])

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'POST') {
    const body = getBody(req)
    if (body.action !== 'disconnect') {
      return sendJson(res, 400, { error: 'Unknown action. Use action=disconnect.' })
    }
    await updateStore((draft) => {
      const row = draft.users.find((u) => u.id === user.id)
      if (!row) return draft
      row.crmGmailOAuth = null
      return draft
    })
    return sendJson(res, 200, { ok: true, disconnected: true })
  }

  if (!isGmailOAuthConfigured()) {
    return sendJson(res, 503, {
      error: 'Google OAuth is not configured on the server',
      hint: 'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and APP_URL on Vercel.',
    })
  }

  if (!canOfferCustomerGmailConnect()) {
    return sendJson(res, 403, {
      error: 'Work Gmail connect is not available yet — Connect Intel is completing Google app verification.',
      googleVerificationPending: true,
      hint: 'You will be able to connect your work Gmail from the app after verification is approved.',
    })
  }

  const store = await readStore()
  const freshUser = store.users.find((u) => u.id === user.id) || user
  const organizationId = freshUser.organizationId || user.organizationId || null

  try {
    const connected = getUserCrmGmail(freshUser)
    let upgradeScopes = false
    if (connected && !crmGmailHasReadScope(connected)) {
      const probe = await probeGmailReadAccess(connected)
      upgradeScopes = !probe.ok
    }

    const url = buildGmailOAuthStartUrl({
      organizationId,
      userId: user.id,
      kind: 'user_crm',
      loginHint: freshUser.email || user.email,
      upgradeScopes,
      includeReadScope: upgradeScopes,
    })
    return sendJson(res, 200, {
      url,
      connected: Boolean(connected),
      mailbox: connected?.email || null,
      upgradeScopes,
      replySyncEnabled: connected ? crmGmailHasReadScope(connected) : false,
    })
  } catch (error) {
    return sendJson(res, 500, { error: error.message })
  }
}
