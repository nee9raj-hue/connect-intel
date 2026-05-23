import { requireUser } from '../auth.js'
import {
  autoSetupOrgEmailDomainIfNeeded,
  getOrgEmailDomainStatusForUser,
  setupOrgEmailDomain,
  verifyOrgEmailDomain,
} from '../orgEmailDomain.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (user.accountType !== 'company' || !user.organizationId) {
    return sendJson(res, 400, { error: 'Company workspace required' })
  }

  if (req.method === 'GET') {
    const status = await getOrgEmailDomainStatusForUser(user)
    return sendJson(res, 200, status)
  }

  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST'])

  const isAdmin = user.isOrgAdmin || user.orgRole === 'org_admin'
  const { action, domain } = getBody(req)

  try {
    if (action === 'auto_setup') {
      if (!isAdmin) {
        return sendJson(res, 403, { error: 'Only company admin can set up outbound email' })
      }
      const result = await autoSetupOrgEmailDomainIfNeeded(user)
      if (result?.error && !result.configured) {
        return sendJson(res, 400, result)
      }
      return sendJson(res, 200, result)
    }

    if (action === 'setup') {
      if (!isAdmin) {
        return sendJson(res, 403, { error: 'Only company admin can set up outbound email' })
      }
      const targetDomain = domain || null
      if (!targetDomain) {
        const auto = await autoSetupOrgEmailDomainIfNeeded(user)
        return sendJson(res, 200, auto)
      }
      const result = await setupOrgEmailDomain(user.organizationId, targetDomain)
      return sendJson(res, 200, result)
    }

    if (action === 'verify') {
      if (!isAdmin) {
        return sendJson(res, 403, { error: 'Only company admin can verify DNS' })
      }
      const result = await verifyOrgEmailDomain(user.organizationId)
      return sendJson(res, 200, result)
    }

    return sendJson(res, 400, { error: 'Unknown action. Use auto_setup, setup, or verify.' })
  } catch (error) {
    return sendJson(res, 400, { error: error.message })
  }
}
