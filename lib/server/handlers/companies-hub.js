import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildOrgUserResponse } from '../organizations.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import {
  assertOrgPermission,
  assertPipelineHubAccess,
  permissionDeniedResponse,
} from '../permissionEnforce.js'
import { recordAuditEvent } from '../auditEvents.js'
import { getPlatform } from '../../platform/index.js'

async function loadHubUser(req, res) {
  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return null

  const metaStore = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
  const user = buildOrgUserResponse(metaStore.users.find((u) => u.id === sessionUser.id) || sessionUser, metaStore)

  try {
    await assertPipelineHubAccess(user, metaStore)
  } catch (permError) {
    const denied = permissionDeniedResponse(permError)
    sendJson(res, denied.status, denied.body)
    return null
  }

  const { pipelineStore } = await loadPipelineStoreContext(sessionUser)
  const store = { ...metaStore, savedLeads: pipelineStore.savedLeads }
  return { user, metaStore, store }
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  const companies = getPlatform().repositories.companies

  if (req.method === 'PATCH') {
    const sessionUser = await requireUser(req, res)
    if (!sessionUser) return

    const metaStore = await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })
    const user = buildOrgUserResponse(metaStore.users.find((u) => u.id === sessionUser.id) || sessionUser, metaStore)

    try {
      await assertOrgPermission(user, 'edit_leads', metaStore)
    } catch (permError) {
      const denied = permissionDeniedResponse(permError)
      return sendJson(res, denied.status, denied.body)
    }

    if (!user.organizationId) {
      return sendJson(res, 400, { error: 'Account hierarchy requires a company workspace' })
    }

    const body = getBody(req)
    const companyId = String(body.companyId || '').trim()
    const parentCompanyId = body.parentCompanyId == null || body.parentCompanyId === ''
      ? null
      : String(body.parentCompanyId).trim()

    if (!companyId) {
      return sendJson(res, 400, { error: 'companyId is required' })
    }

    const result = await companies.updateParent(user.organizationId, companyId, parentCompanyId)
    if (!result.ok) {
      return sendJson(res, 400, { error: result.error })
    }

    void recordAuditEvent({
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'crm.company_parent_updated',
      resourceType: 'company',
      resourceId: companyId,
      metadata: { parentCompanyId },
      store: metaStore,
    }).catch(() => {})

    return sendJson(res, 200, result)
  }

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET', 'PATCH'])

  const ctx = await loadHubUser(req, res)
  if (!ctx) return
  const { user, store } = ctx

  const companyId = String(req.query?.companyId || '').trim()
  if (companyId) {
    const detail = await companies.getDetail(user, store, companyId)
    if (!detail) return sendJson(res, 404, { error: 'Company not found' })
    return sendJson(res, 200, detail)
  }

  const search = String(req.query?.q || '').trim()
  const rootsOnly = req.query?.rootsOnly === '1' || req.query?.rootsOnly === 'true'
  const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50))
  const offset = Math.max(0, Number(req.query?.offset) || 0)

  const payload = await companies.listHub(user, store, { search, limit, offset, rootsOnly })
  return sendJson(res, 200, payload)
}
