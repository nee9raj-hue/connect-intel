import { requireUser, refreshSessionCookie, requireOrgAdmin } from '../auth.js'
import { buildOrgUserResponse, getOrganization } from '../organizations.js'
import {
  confirmOrgPlanUpgrade,
  buildPlanUsage,
  buildUpgradeQuote,
  buildUpgradeQuotes,
  listUpgradePlans,
  getPlanById,
} from '../crmPlanLimits.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (!user.organizationId) {
    return sendJson(res, 403, { error: 'Organization workspace required' })
  }

  if (req.method === 'GET') {
    const store = await readStore()
    const org = getOrganization(store, user.organizationId)
    if (!org) return sendJson(res, 404, { error: 'Organization not found' })
    return sendJson(res, 200, {
      planUsage: buildPlanUsage(store, org, user),
      upgradeQuote: buildUpgradeQuote(org),
      upgradeQuotes: buildUpgradeQuotes(org),
      pendingPayment: org.pendingPayment || null,
    })
  }

  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST'])

  const admin = await requireOrgAdmin(req, res)
  if (!admin) return

  const body = getBody(req) || {}
  const requestedPlanId = body.planId || body.plan || null

  try {
    await updateStore((draft) => {
      const org = getOrganization(draft, user.organizationId)
      if (!org) throw new Error('Organization not found')
      const available = listUpgradePlans(org)
      if (!available.length) {
        throw new Error('Workspace is already on the highest plan')
      }
      if (requestedPlanId && !getPlanById(requestedPlanId)) {
        throw new Error('Unknown plan')
      }
      confirmOrgPlanUpgrade(org, {
        planId: requestedPlanId || available[0].id,
        confirmedByUserId: user.id,
      })
      return draft
    })

    const store = await readStore()
    const org = getOrganization(store, user.organizationId)
    const refreshedUser = buildOrgUserResponse(store.users.find((u) => u.id === user.id), store)
    await refreshSessionCookie(res, refreshedUser)

    return sendJson(res, 200, {
      user: refreshedUser,
      planUsage: buildPlanUsage(store, org, refreshedUser),
      upgradeQuote: buildUpgradeQuote(org),
      upgradeQuotes: buildUpgradeQuotes(org),
      pendingPayment: org?.pendingPayment || null,
    })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Upgrade failed' })
  }
}
