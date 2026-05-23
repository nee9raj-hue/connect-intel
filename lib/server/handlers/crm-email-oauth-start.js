import { requireUser } from '../auth.js'
import { isGoogleOAuthVerifiedForCustomers } from '../config.js'
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

  const verifiedForCustomers = isGoogleOAuthVerifiedForCustomers()
  if (!verifiedForCustomers && !user.isPlatformAdmin && user.role !== 'admin') {
    return sendJson(res, 403, {
      error: 'Work Gmail connect is not available yet.',
      googleVerificationPending: true,
      hint:
        'Your company admin can set up outbound email under Team → Company domain (DNS). No Google permission screen is required.',
    })
  }

  const store = await readStore()
  const freshUser = store.users.find((u) => u.id === user.id) || user
  const organizationId = freshUser.organizationId || user.organizationId
  if (!organizationId) {
    return sendJson(res, 400, { error: 'Complete company onboarding before connecting Gmail' })
  }

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
