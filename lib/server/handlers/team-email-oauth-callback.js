import { getAppBaseUrl } from '../appUrl.js'
import { getGmailOAuthRedirectUri } from '../gmailOAuth.js'
import {
  applyPlatformInviteOAuth,
  completeCrmUserGmailOAuth,
  completeGmailOAuth,
  recordPlatformOAuthError,
  resolveInviteGmailOAuthForOrg,
  verifyState,
} from '../gmailOAuth.js'
import { saveUserCrmGmailOAuth } from '../crmUserGmail.js'
import { PLATFORM_OAUTH_ORG_ID } from '../inviteEmailAccess.js'
import { getOrganization } from '../organizations.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const code = req.query?.code
  const stateRaw = req.query?.state
  const oauthError = req.query?.error

  const appUrl = getAppBaseUrl(req)
  const fail = (message) => {
    res.writeHead(302, {
      Location: `${appUrl}/?email_oauth=error&message=${encodeURIComponent(message)}`,
    })
    res.end()
  }

  if (oauthError) {
    res.writeHead(302, { Location: `${appUrl}/?email_oauth=cancelled` })
    return res.end()
  }

  if (!code || !stateRaw) {
    return fail('Missing Google authorization code')
  }

  const state = verifyState(stateRaw)
  if (!state?.organizationId || !state?.userId) {
    return fail('Invalid OAuth state')
  }

  try {
    const before = await readStore()

    if (state.kind === 'user_crm') {
      const storeUser = before.users.find((u) => u.id === state.userId)
      const existing = storeUser?.crmGmailOAuth
      const oauth = await completeCrmUserGmailOAuth(code, {
        existingRefreshToken: existing?.refreshToken || null,
      })
      await saveUserCrmGmailOAuth(state.userId, oauth)

      const after = await readStore()
      const saved = after.users.find((u) => u.id === state.userId)?.crmGmailOAuth
      if (!saved?.refreshToken) {
        return fail('Gmail connected but the token did not save. Check Supabase keys on Vercel.')
      }

      res.writeHead(302, {
        Location: `${appUrl}/?crm_gmail=connected&mailbox=${encodeURIComponent(oauth.email)}`,
      })
      return res.end()
    }

    const existing = resolveInviteGmailOAuthForOrg(before, state.organizationId)
    const oauth = await completeGmailOAuth(code, {
      existingRefreshToken: existing?.refreshToken || null,
    })

    await updateStore((draft) => {
      applyPlatformInviteOAuth(draft, oauth)
      if (state.organizationId && state.organizationId !== PLATFORM_OAUTH_ORG_ID) {
        const org = getOrganization(draft, state.organizationId)
        if (org) org.inviteGmailOAuth = oauth
      }
      return draft
    })

    const after = await readStore()
    const saved = resolveInviteGmailOAuthForOrg(after, state.organizationId)
    if (!saved?.refreshToken) {
      return fail(
        'Google connected but the token did not save. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel, then redeploy.'
      )
    }

    res.writeHead(302, { Location: `${appUrl}/?email_oauth=connected&mailbox=${encodeURIComponent(oauth.email)}` })
    res.end()
  } catch (error) {
    try {
      await updateStore((draft) => {
        recordPlatformOAuthError(draft, error.message)
        return draft
      })
    } catch {
      // ignore secondary save errors
    }
    return fail(error.message)
  }
}
