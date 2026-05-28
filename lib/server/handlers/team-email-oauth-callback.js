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
import { oauthHasCalendarScope } from '../googleCalendar.js'
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
  const oauthErrorDescription = req.query?.error_description

  const appUrl = getAppBaseUrl(req)

  const fail = (message, kind = 'invite') => {
    const param = kind === 'user_crm' ? 'crm_gmail' : 'email_oauth'
    res.writeHead(302, {
      Location: `${appUrl}/?${param}=error&message=${encodeURIComponent(message)}`,
    })
    res.end()
  }

  if (oauthError) {
    const msg =
      oauthError === 'access_denied'
        ? 'Email connection was cancelled or blocked. Try again, or contact your administrator if sign-in keeps failing.'
        : oauthErrorDescription || oauthError
    const kindGuess = String(stateRaw || '').includes('user_crm') ? 'user_crm' : 'invite'
    const state = verifyState(stateRaw)
    const kind = state?.kind === 'user_crm' ? 'user_crm' : kindGuess
    res.writeHead(302, {
      Location: `${appUrl}/?${kind === 'user_crm' ? 'crm_gmail' : 'email_oauth'}=error&message=${encodeURIComponent(msg)}`,
    })
    return res.end()
  }

  if (!code || !stateRaw) {
    return fail('Missing authorization code')
  }

  const state = verifyState(stateRaw)
  if (!state?.userId) {
    return fail('Invalid connection state — sign in again and retry Connect work email.')
  }

  const isCrm = state.kind === 'user_crm'
  if (!isCrm && !state.organizationId) {
    return fail('Invalid OAuth state — organization missing.')
  }

  try {
    if (isCrm) {
      const before = await readStore({ only: ['users'] })
      const storeUser = before.users.find((u) => u.id === state.userId)
      if (!storeUser) {
        return fail('Your Connect Intel session expired. Sign in again, then connect work email.', 'user_crm')
      }
      const existing = storeUser?.crmGmailOAuth
      const oauth = await completeCrmUserGmailOAuth(code, {
        existingRefreshToken: existing?.refreshToken || null,
      })
      await saveUserCrmGmailOAuth(state.userId, oauth)
      if (oauthHasCalendarScope(oauth)) {
        await updateStore((draft) => {
          const row = draft.users.find((u) => u.id === state.userId)
          if (row) {
            row.calendarSyncEnabled = true
          }
          return draft
        })
      }

      const calendarParam = oauthHasCalendarScope(oauth) ? '&crm_calendar=connected' : ''
      res.writeHead(302, {
        Location: `${appUrl}/?crm_gmail=connected&mailbox=${encodeURIComponent(oauth.email)}${calendarParam}`,
      })
      return res.end()
    }

    const before = await readStore()
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
        'Invite email connected but the session did not save. Sign out, sign in again, and retry.'
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
    const hint =
      error.message?.includes('redirect_uri')
        ? ` Redirect URI must be exactly: ${getGmailOAuthRedirectUri()}`
        : ''
    return fail(`${error.message || 'Google connection failed'}${hint}`, isCrm ? 'user_crm' : 'invite')
  }
}
