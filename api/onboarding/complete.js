import { requireUser, refreshSessionCookie } from '../../lib/server/auth.js'
import { buildOrgUserResponse, completeOnboarding } from '../../lib/server/organizations.js'
import { readStore } from '../../lib/server/store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../../lib/server/http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const user = await requireUser(req, res)
  if (!user) return

  if (user.onboardingComplete) {
    return sendJson(res, 200, { user })
  }

  const body = getBody(req)
  const accountType = body.accountType === 'company' ? 'company' : 'individual'

  if (accountType === 'company' && !String(body.companyName || '').trim()) {
    return sendJson(res, 400, { error: 'Company name is required' })
  }

  try {
    await completeOnboarding(user.id, {
      accountType,
      companyName: body.companyName,
      logoUrl: body.logoUrl || null,
    })
    const store = await readStore()
    const refreshed = store.users.find((u) => u.id === user.id)
    const response = buildOrgUserResponse(refreshed, store)
    await refreshSessionCookie(res, response)
    return sendJson(res, 200, { user: response })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Onboarding failed' })
  }
}
