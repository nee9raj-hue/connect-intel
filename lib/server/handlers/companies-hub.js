import { requireUser } from '../auth.js'
import { readStore } from '../store.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildOrgUserResponse } from '../organizations.js'
import { loadPipelineStoreContext } from '../pipelineShard.js'
import { buildCompaniesHub, getCompanyDetail } from '../companiesHub.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const sessionUser = await requireUser(req, res)
  if (!sessionUser) return

  const { pipelineStore } = await loadPipelineStoreContext(sessionUser)
  const store = {
    ...(await readStore({ only: ['users', 'organizations', 'organizationMemberships'] })),
    savedLeads: pipelineStore.savedLeads,
  }
  const user = buildOrgUserResponse(store.users.find((u) => u.id === sessionUser.id) || sessionUser, store)

  const companyId = String(req.query?.companyId || '').trim()
  if (companyId) {
    const company = getCompanyDetail(store, user, companyId)
    if (!company) return sendJson(res, 404, { error: 'Company not found' })
    return sendJson(res, 200, { company })
  }

  const search = String(req.query?.q || '').trim()
  const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50))
  const offset = Math.max(0, Number(req.query?.offset) || 0)
  const payload = buildCompaniesHub(store, user, { search, limit, offset })

  return sendJson(res, 200, payload)
}
