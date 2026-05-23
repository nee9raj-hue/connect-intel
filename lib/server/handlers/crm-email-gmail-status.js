import { requireUser } from '../auth.js'
import { isGoogleOAuthVerifiedForCustomers } from '../config.js'
import { getUserCrmGmail } from '../crmUserGmail.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getGmailOAuthDiagnostics, isGmailOAuthConfigured } from '../gmailOAuth.js'
import { crmGmailHasReadScope, ensureCrmGmailReadScopeRecorded, probeGmailReadAccess } from '../crmEmailThread.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore()
  const freshUser = store.users.find((u) => u.id === user.id) || user
  let oauth = getUserCrmGmail(freshUser)
  let replySyncEnabled = Boolean(oauth && crmGmailHasReadScope(oauth))

  if (oauth && !replySyncEnabled) {
    const probe = await probeGmailReadAccess(oauth)
    if (probe.ok) {
      oauth = await ensureCrmGmailReadScopeRecorded(user.id, oauth)
      replySyncEnabled = true
    }
  }

  const oauthDiag = getGmailOAuthDiagnostics()
  const verifiedForCustomers = isGoogleOAuthVerifiedForCustomers()
  const canOfferGmailConnect =
    verifiedForCustomers || Boolean(user.isPlatformAdmin || user.role === 'admin')

  return sendJson(res, 200, {
    configured: isGmailOAuthConfigured(),
    connected: Boolean(oauth),
    mailbox: oauth?.email || null,
    connectedAt: oauth?.connectedAt || null,
    replySyncEnabled: canOfferGmailConnect ? replySyncEnabled : false,
    needsReplySyncReconnect: canOfferGmailConnect && Boolean(oauth && !replySyncEnabled),
    gmailConnectAvailable: canOfferGmailConnect,
    googleVerificationPending: !verifiedForCustomers,
    diagnostics: oauthDiag,
    hint: !oauthDiag.configured
      ? oauthDiag.missingEnv.includes('GOOGLE_CLIENT_SECRET')
        ? 'Add GOOGLE_CLIENT_SECRET on Vercel (same OAuth Web client as login), set redirect URI, redeploy.'
        : 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on Vercel, then redeploy.'
      : null,
  })
}
