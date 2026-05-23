import { requireUser } from '../auth.js'
import { buildOrgUserResponse } from '../organizations.js'
import { readStore, updateStore } from '../store.js'
import { validateMobileInput } from '../phoneUtils.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { refreshSessionCookie } from '../auth.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (req.method === 'PATCH') {
    const { mobile } = getBody(req)
    const check = validateMobileInput(mobile)
    if (!check.ok) {
      return sendJson(res, 400, { error: check.error })
    }

    await updateStore((draft) => {
      const u = draft.users.find((x) => x.id === user.id)
      if (!u) throw new Error('User not found')
      u.mobileE164 = check.mobileE164
      u.mobile = check.display
      return draft
    })

    const store = await readStore()
    const refreshed = buildOrgUserResponse(store.users.find((u) => u.id === user.id), store)
    const token = await refreshSessionCookie(res, refreshed)
    return sendJson(res, 200, { user: refreshed, token })
  }

  return methodNotAllowed(res, ['PATCH'])
}
