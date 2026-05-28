import { requireUser } from '../auth.js'
import { canOfferCustomerGmailConnect } from '../config.js'
import { getUserCrmGmail } from '../crmUserGmail.js'
import { crmGmailHasReadScope, probeGmailReadAccess } from '../crmEmailThread.js'
import { buildGmailOAuthStartUrl, isGmailOAuthConfigured } from '../gmailOAuth.js'
import { oauthHasCalendarScope } from '../googleCalendar.js'
import { getGoogleCalendarSyncStatus, syncGoogleCalendarForUser } from '../googleCalendarSync.js'
import { readStore, updateStorePartial } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'GET') {
    const store = await readStore({ only: ['users'] })
    const fresh = store.users.find((u) => u.id === user.id) || user
    return sendJson(res, 200, getGoogleCalendarSyncStatus(fresh))
  }

  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST'])

  const body = getBody(req)
  const action = body.action || 'sync'

  if (action === 'enable') {
    await updateStorePartial(['users'], (draft) => {
      const row = draft.users.find((u) => u.id === user.id)
      if (!row) throw new Error('User not found')
      row.calendarSyncEnabled = true
      return draft
    })
    return sendJson(res, 200, { ok: true, calendarSyncEnabled: true })
  }

  if (action === 'disable') {
    await updateStorePartial(['users'], (draft) => {
      const row = draft.users.find((u) => u.id === user.id)
      if (!row) throw new Error('User not found')
      row.calendarSyncEnabled = false
      return draft
    })
    return sendJson(res, 200, { ok: true, calendarSyncEnabled: false })
  }

  if (action === 'connect') {
    if (!isGmailOAuthConfigured()) {
      return sendJson(res, 503, { error: 'Google OAuth is not configured on the server' })
    }
    if (!canOfferCustomerGmailConnect()) {
      return sendJson(res, 403, {
        error: 'Google connect is not available yet — app verification in progress.',
        googleVerificationPending: true,
      })
    }
    const store = await readStore({ only: ['users'] })
    const fresh = store.users.find((u) => u.id === user.id) || user
    const connected = getUserCrmGmail(fresh)
    let upgradeScopes = false
    if (connected && !crmGmailHasReadScope(connected)) {
      const probe = await probeGmailReadAccess(connected)
      upgradeScopes = !probe.ok
    }
    const url = buildGmailOAuthStartUrl({
      organizationId: fresh.organizationId || user.organizationId,
      userId: user.id,
      kind: 'user_crm',
      loginHint: fresh.email || user.email,
      upgradeScopes: false,
      scopeMode: connected ? 'calendar_only' : 'send_calendar_bootstrap',
    })
    return sendJson(res, 200, { url, calendarConnect: true })
  }

  if (action === 'sync') {
    const store = await readStore({ only: ['users'] })
    const fresh = store.users.find((u) => u.id === user.id) || user
    const result = await syncGoogleCalendarForUser(fresh)
    if (!result.ok) {
      return sendJson(res, result.needsCalendarConsent ? 403 : 400, result)
    }
    return sendJson(res, 200, result)
  }

  return sendJson(res, 400, { error: 'Unknown action. Use sync, connect, enable, or disable.' })
}
