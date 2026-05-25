import { requireUser } from '../auth.js'
import { canOfferCustomerGmailConnect } from '../config.js'
import { buildGmailOAuthStartUrl, isGmailOAuthConfigured } from '../gmailOAuth.js'
import { getUserCrmGmail } from '../crmUserGmail.js'
import { crmGmailHasReadScope, probeGmailReadAccess } from '../crmEmailThread.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

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
