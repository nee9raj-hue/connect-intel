import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { loadMarketingGateContext, requireMarketingHubAccess, requireMarketingSendAccess, MARKETING_SEND_ACTIONS, requireMarketingUser } from '../marketingAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import {
  getOrgEmailDomainStatusForUser,
  setupOrgEmailDomain,
  verifyOrgEmailDomain,
} from '../orgEmailDomain.js'
import { getUserCrmGmail } from '../crmUserGmail.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const { user: gateUser, store: gateStore } = await loadMarketingGateContext(sessionUser)
  const hubCheck = await requireMarketingHubAccess(gateUser, gateStore)
  if (!hubCheck.ok) return sendJson(res, hubCheck.status || 403, { error: hubCheck.error, code: hubCheck.code })

  const store = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  const user = buildOrgUserResponse(store.users.find((u) => u.id === sessionUser.id) || sessionUser, store)

  if (req.method === 'GET') {
    const domain = await getOrgEmailDomainStatusForUser(user)
    const gmail = getUserCrmGmail(user)
    return sendJson(res, 200, {
      workEmail: {
        connected: Boolean(gmail),
        mailbox: gmail?.mailbox || null,
        verificationPending: Boolean(domain?.verificationPending),
      },
      companyDns: domain,
      dkim: domain?.records?.find((r) => /dkim/i.test(r.purpose || '')) || null,
      spf: domain?.records?.find((r) => /spf|mx/i.test(r.purpose || r.type || '')) || null,
      verification_status: domain?.verified ? 'verified' : domain?.configured ? 'pending' : 'not_configured',
    })
  }

  if (req.method === 'POST') {
    const body = getBody(req)
    const action = body.action || 'verify'
    if (!user.isOrgAdmin) return sendJson(res, 403, { error: 'Org admin required' })

    const orgId = user.organizationId
    if (!orgId) return sendJson(res, 400, { error: 'Organization required' })

    if (action === 'auto_setup' || action === 'setup') {
      const result = await setupOrgEmailDomain(orgId, body.domain)
      return sendJson(res, 200, result)
    }

    const verified = await verifyOrgEmailDomain(orgId)
    const domain = await getOrgEmailDomainStatusForUser(user)
    return sendJson(res, 200, { verified, ...domain })
  }

  return methodNotAllowed(res, ['GET', 'POST'])
}
