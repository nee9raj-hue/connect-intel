import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildOrgUserResponse } from '../organizations.js'
import { getUserCrmGmail } from '../crmUserGmail.js'
import { getInfraStatus } from '../infra/config.js'
import { isCrmInboundEmailEnabled } from '../crmInboundEmail.js'

const EXTENSION_VERSION = '2026-07-07d'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const metaStore = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  const user = buildOrgUserResponse(
    metaStore.users.find((u) => u.id === sessionUser.id) || sessionUser,
    metaStore
  )
  const gmail = getUserCrmGmail(user)

  return sendJson(res, 200, {
    ok: true,
    extensionVersion: EXTENSION_VERSION,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      organizationId: user.organizationId || null,
      organizationName: user.organizationName || null,
    },
    integrations: {
      workGmailConnected: Boolean(gmail),
      workGmailEmail: gmail?.email || null,
      inboundReplySync: isCrmInboundEmailEnabled(),
      trailSyncAvailable: Boolean(gmail),
    },
    capabilities: {
      leadMatch: true,
      trailSync: true,
      logActivity: true,
      openInApp: true,
      captureLead: true,
      composeEmail: true,
    },
    apiBase: 'https://connectintel.net',
    infra: {
      auditEvents: getInfraStatus().auditEvents,
      emailSends: getInfraStatus().emailSends,
    },
    policy: {
      trailOnly: true,
      noBulkInboxImport: true,
    },
  })
}
