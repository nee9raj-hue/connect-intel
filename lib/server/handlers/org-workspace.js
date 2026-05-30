import { requireUser, refreshSessionCookie } from '../auth.js'
import { buildOrgUserResponse } from '../organizations.js'
import { readStore, updateStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import {
  buildWorkspaceSettingsPayload,
  updateOrganizationWorkspace,
} from '../workspaceFeatures.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const user = await requireUser(req, res)
  if (!user) return

  if (!user.organizationId || user.accountType !== 'company') {
    return sendJson(res, 403, { error: 'Company workspace required' })
  }

  if (req.method === 'GET') {
    const store = await readStore({ only: ['organizations', 'activeTradingImports'] })
    const org = store.organizations.find((o) => o.id === user.organizationId)
    if (!org) return sendJson(res, 404, { error: 'Organization not found' })
    org.activeTradingImports = (store.activeTradingImports || []).filter(
      (r) => r.organizationId === user.organizationId
    )
    return sendJson(res, 200, buildWorkspaceSettingsPayload(store, org))
  }

  if (req.method !== 'PATCH') return methodNotAllowed(res, ['GET', 'PATCH'])

  if (!user.isOrgAdmin) {
    return sendJson(res, 403, { error: 'Only company admins can change workspace modules' })
  }

  const body = getBody(req)

  try {
    await updateStore((draft) => {
      updateOrganizationWorkspace(draft, user.organizationId, {
        workspacePreset: body.workspacePreset,
        workspaceFeatures: body.workspaceFeatures,
      })
      return draft
    })

    const store = await readStore()
    const refreshedUser = buildOrgUserResponse(
      store.users.find((u) => u.id === user.id),
      store
    )
    await refreshSessionCookie(res, refreshedUser)

    const org = store.organizations.find((o) => o.id === user.organizationId)
    return sendJson(res, 200, {
      user: refreshedUser,
      settings: buildWorkspaceSettingsPayload(store, org),
    })
  } catch (error) {
    return sendJson(res, 400, { error: error.message || 'Update failed' })
  }
}
