import { requireUser } from '../auth.js'
import {
  canOfferCustomerGmailConnect,
  getCrmEmailStrategy,
  getGoogleOAuthVerificationEnv,
  isGoogleOAuthVerifiedForCustomers,
} from '../config.js'
import { getUserCrmGmail } from '../crmUserGmail.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getGmailOAuthDiagnostics, getGmailOAuthRedirectUri, isGmailOAuthConfigured } from '../gmailOAuth.js'
import { isCrmInboundEmailEnabled, getCrmInboundEmailDomain } from '../crmInboundEmail.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore({ only: ['users'] })
  const freshUser = store.users.find((u) => u.id === user.id) || user
  const oauth = getUserCrmGmail(freshUser)
  const inboundEnabled = isCrmInboundEmailEnabled()

  const oauthDiag = getGmailOAuthDiagnostics()
  const verification = getGoogleOAuthVerificationEnv()
  const verifiedForCustomers = isGoogleOAuthVerifiedForCustomers()
  const canOfferGmailConnect = isGmailOAuthConfigured() && canOfferCustomerGmailConnect()

  return sendJson(res, 200, {
    configured: isGmailOAuthConfigured(),
    connected: Boolean(oauth),
    mailbox: oauth?.email || null,
    connectedAt: oauth?.connectedAt || null,
    emailStrategy: getCrmEmailStrategy(),
    inboundReplySync: inboundEnabled,
    replySyncEnabled: inboundEnabled ? Boolean(oauth) : false,
    replySyncMode: inboundEnabled ? 'inbound_forward' : 'gmail_read_legacy',
    needsReplySyncReconnect: false,
    inboundDomain: inboundEnabled ? getCrmInboundEmailDomain() : null,
    gmailConnectAvailable: canOfferGmailConnect,
    googleVerificationPending: !verifiedForCustomers,
    googleAppVerified: verifiedForCustomers,
    googleVerificationPhase: verification.phase,
    diagnostics: oauthDiag,
    googleSetup: {
      redirectUri: getGmailOAuthRedirectUri(),
      privacyPolicyUrl: 'https://connectintel.net/privacy.html',
      scopesOnConnect: ['gmail.send', 'userinfo.email'],
      scopesOptional: [],
      inboundReplyNote:
        'Lead replies are captured via Connect Intel inbound routing — no Gmail read access required.',
      whyUnverifiedWarning:
        'Email connection may show a security notice until Connect Intel completes provider verification. This is normal.',
      immediateFixForTesting:
        'Platform owner: Google Cloud Console → Connect Intel project → Audience → Test users → add each rep work email (e.g. sales@yourcompany.com). Reps must use Advanced → Go to Connect Intel (unsafe).',
      verificationSteps:
        'Submit app at Google Cloud Verification center with privacy policy, scope justification, and demo video. See GOOGLE-OAUTH-VERIFICATION-SUBMIT.md in repo.',
      afterVerificationEnv: 'Set GOOGLE_OAUTH_VERIFIED=true on Vercel and redeploy.',
      duringTestingEnv: 'Set GOOGLE_OAUTH_ALLOW_CONNECT=true while app is in Testing + test users added.',
    },
    hint: !oauthDiag.configured
      ? oauthDiag.missingEnv.includes('GOOGLE_CLIENT_SECRET')
        ? 'Add GOOGLE_CLIENT_SECRET on Vercel (same OAuth Web client as login), set redirect URI, redeploy.'
        : 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on Vercel, then redeploy.'
      : !canOfferGmailConnect
        ? 'Gmail connect opens after Google approves the app (GOOGLE_OAUTH_VERIFIED=true) or during beta (GOOGLE_OAUTH_ALLOW_CONNECT=true + test users).'
        : null,
  })
}
