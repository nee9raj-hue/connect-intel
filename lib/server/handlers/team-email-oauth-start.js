import { requireUser } from '../auth.js'
import { buildGmailOAuthStartUrl, isGmailOAuthConfigured } from '../gmailOAuth.js'
import { canManageInviteEmail, resolveOAuthOrganizationId } from '../inviteEmailAccess.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  if (!canManageInviteEmail(user)) {
    return sendJson(res, 403, { error: 'Only company admin can connect invite email' })
  }

  const store = await readStore()
  const organizationId = resolveOAuthOrganizationId(user, store)
  if (!organizationId) {
    return sendJson(res, 400, {
      error: 'No organization found for this account',
      hint: 'Sign in as invite@connectintel.net (platform admin) or a company admin.',
    })
  }

  if (!isGmailOAuthConfigured()) {
    return sendJson(res, 503, {
      error: 'Google OAuth secret missing on server',
      hint:
        'In Google Cloud Console create a Web OAuth client, add redirect URI https://connectintel.net/api/team/email-oauth/callback, then set GOOGLE_CLIENT_SECRET and APP_URL=https://connectintel.net on Vercel and redeploy.',
    })
  }

  try {
    const url = buildGmailOAuthStartUrl({
      organizationId,
      userId: user.id,
    })
    return sendJson(res, 200, { url })
  } catch (error) {
    return sendJson(res, 500, { error: error.message })
  }
}
