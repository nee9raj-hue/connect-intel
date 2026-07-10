import { requireUser } from '../auth.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  notifyOrgAdminsOfAccessRequest,
  submitOrgAccessRequest,
} from '../orgWorkspaceAccess.js'
import { readStore, ONBOARDING_STORE_COLLECTIONS } from '../store.js'
import { validateMobileInput } from '../phoneUtils.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  const body = getBody(req)
  let mobile = null
  if (body.mobile) {
    const mobileCheck = validateMobileInput(body.mobile)
    if (!mobileCheck.ok) {
      return sendJson(res, 400, { error: mobileCheck.error })
    }
    mobile = mobileCheck.display
  }

  try {
    const meta = await submitOrgAccessRequest(user.id, {
      mobile,
      message: String(body.message || '').trim() || null,
    })

    let notification = { notified: 0, skipped: true }
    if (meta?.notifyAdmins) {
      const store = await readStore({ only: ONBOARDING_STORE_COLLECTIONS })
      notification = await notifyOrgAdminsOfAccessRequest(store, meta)
    }

    return sendJson(res, 200, {
      ok: true,
      organizationName: meta?.org?.name || null,
      pendingAccessRequest: true,
      notifiedAdmins: notification.notified || 0,
      notificationSkipped: Boolean(notification.skipped),
      noOrgAdmin: notification.error === 'NO_ORG_ADMIN',
    })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Access request failed' })
  }
}
