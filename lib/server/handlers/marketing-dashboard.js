import { requireUser } from '../auth.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  filterMarketingCampaignsVisible,
  filterMarketingRows,
  requireMarketingUser,
} from '../marketingAccess.js'
import { buildOrgUserResponse } from '../organizations.js'
import { buildMarketingDashboard } from '../marketingDashboard.js'
import { buildMarketingHub } from '../marketingHub.js'
import { resolveMarketingPermissions } from '../marketingRoles.js'
import { isMarketingSqlQueueEnabled } from '../infra/config.js'
import {
  dashboardFromAnalyticsSnapshot,
  readOrgMarketingAnalyticsSnapshot,
} from '../marketingAnalyticsSnapshots.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const check = requireMarketingUser(sessionUser)
  if (!check.ok) return sendJson(res, 401, { error: check.error })

  if (req.method === 'PATCH') {
    const store = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
    const user = buildOrgUserResponse(store.users.find((u) => u.id === sessionUser.id) || sessionUser, store)
    if (!user.isOrgAdmin) return sendJson(res, 403, { error: 'Org admin required' })

    const { emailProvider } = getBody(req)
    const allowed = ['auto', 'resend', 'gmail', 'ses', 'sendgrid']
    if (emailProvider !== undefined && !allowed.includes(emailProvider)) {
      return sendJson(res, 400, { error: 'Invalid email provider' })
    }

    await updateStore((draft) => {
      const org = (draft.organizations || []).find((o) => o.id === user.organizationId)
      if (!org) return draft
      org.marketingSettings = org.marketingSettings || {}
      if (emailProvider !== undefined) org.marketingSettings.emailProvider = emailProvider
      org.updatedAt = new Date().toISOString()
      return draft
    })

    return sendJson(res, 200, { ok: true, emailProvider })
  }

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'PATCH'])

  const hubMode = req.query?.hub === '1' || req.query?.hub === 'true'
  const SLICES = [
    'marketingCampaigns',
    'marketingLists',
    'marketingSegments',
    'marketingSuppressions',
    'marketingEvents',
    'marketingAutomations',
    'marketingAutomationRuns',
    'users',
    'organizations',
    'organizationMemberships',
  ]

  const store = await readStore({ only: SLICES })
  const dbUser = store.users.find((u) => u.id === sessionUser.id)
  const user = buildOrgUserResponse(dbUser || sessionUser, store)
  const perms = resolveMarketingPermissions(user, store)

  if (perms.isReadOnly === false && !perms.canView) {
    return sendJson(res, 403, { error: 'You do not have permission to view marketing' })
  }

  const period = String(req.query?.period || '30d').trim()
  const org = (store.organizations || []).find((o) => o.id === user.organizationId)

  if (hubMode) {
    const hub = await buildMarketingHub(store, user, { period })
    return sendJson(res, 200, {
      hub,
      permissions: perms,
      orgSettings: org?.marketingSettings || {},
    })
  }

  if (isMarketingSqlQueueEnabled() && user.organizationId) {
    const snapshot = await readOrgMarketingAnalyticsSnapshot(user.organizationId, 'rolling')
    if (snapshot) {
      const lists = filterMarketingRows(store.marketingLists || [], user)
      const segments = filterMarketingRows(store.marketingSegments || [], user)
      const suppressions = filterMarketingRows(store.marketingSuppressions || [], user)
      const campaigns = filterMarketingCampaignsVisible(store.marketingCampaigns || [], user)
      const fast = dashboardFromAnalyticsSnapshot(snapshot, {
        listCount: lists.length,
        segmentCount: segments.length,
        suppressionCount: suppressions.length,
        campaignsSent: campaigns.filter((c) => c.startedAt).length,
        scheduledCount: campaigns.filter((c) => c.status === 'scheduled').length,
      })
      if (fast) {
        return sendJson(res, 200, {
          ...fast,
          permissions: perms,
          orgSettings: org?.marketingSettings || {},
        })
      }
    }
  }

  const dashboard = await buildMarketingDashboard(store, user, { period })

  return sendJson(res, 200, {
    ...dashboard,
    permissions: perms,
    orgSettings: org?.marketingSettings || {},
  })
}
