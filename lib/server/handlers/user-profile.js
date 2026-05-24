import { requireUser } from '../auth.js'
import { buildOrgUserResponse } from '../organizations.js'
import { readStore, updateStore } from '../store.js'
import { validateMobileInput } from '../phoneUtils.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { refreshSessionCookie } from '../auth.js'
import { MAX_SIGNATURE_LENGTH } from '../crmEmailCompose.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'PATCH') {
    const { mobile, emailSignature, includeEmailSignature } = getBody(req)

    if (mobile === undefined && emailSignature === undefined && includeEmailSignature === undefined) {
      return sendJson(res, 400, { error: 'Nothing to update' })
    }

    let mobileCheck = null
    if (mobile !== undefined) {
      mobileCheck = validateMobileInput(mobile)
      if (!mobileCheck.ok) {
        return sendJson(res, 400, { error: mobileCheck.error })
      }
    }

    await updateStore((draft) => {
      const u = draft.users.find((x) => x.id === user.id)
      if (!u) throw new Error('User not found')
      if (mobileCheck) {
        u.mobileE164 = mobileCheck.mobileE164
        u.mobile = mobileCheck.display
      }
      if (emailSignature !== undefined) {
        u.emailSignature = String(emailSignature).slice(0, MAX_SIGNATURE_LENGTH)
      }
      if (includeEmailSignature !== undefined) {
        u.includeEmailSignature = Boolean(includeEmailSignature)
      }
      return draft
    })

    const store = await readStore()
    const refreshed = buildOrgUserResponse(store.users.find((u) => u.id === user.id), store)
    const token = await refreshSessionCookie(res, refreshed)
    return sendJson(res, 200, { user: refreshed, token })
  }

  return methodNotAllowed(res, ['PATCH'])
}
