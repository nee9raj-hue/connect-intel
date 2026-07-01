import { requireUser, refreshSessionCookie } from '../auth.js'
import { buildOrgUserResponse, completeOnboarding } from '../organizations.js'
import { AUTH_STORE_COLLECTIONS, readStore } from '../store.js'
import { enrichUserWithOrgPermissions } from '../permissionEnforce.js'
import { seedEmptyPipelineIndexForOrg } from '../pipelineIndex.js'
import { validateMobileInput } from '../phoneUtils.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

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

  const mobileCheck = validateMobileInput(body.mobile)
  if (!mobileCheck.ok) {
    return sendJson(res, 400, { error: mobileCheck.error })
  }

  try {
    await completeOnboarding(user.id, {
      accountType,
      companyName: body.companyName,
      logoUrl: body.logoUrl || null,
      mobileE164: mobileCheck.mobileE164,
      mobile: mobileCheck.display,
      adminMobileE164: mobileCheck.mobileE164,
    })
    const store = await readStore({ only: AUTH_STORE_COLLECTIONS })
    const refreshed = store.users.find((u) => u.id === user.id)
    if (refreshed?.organizationId) {
      await seedEmptyPipelineIndexForOrg(refreshed.organizationId)
    }
    const response = await enrichUserWithOrgPermissions(buildOrgUserResponse(refreshed, store), store)
    const token = await refreshSessionCookie(res, response)
    return sendJson(res, 200, { user: response, token })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Onboarding failed' })
  }
}
