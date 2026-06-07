import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { lookupPostalCode } from '../pincodeLookup.js'
import { isFreightDealOrg } from '../../freightDeal.js'
import { readStore } from '../store.js'
import { getOrganization } from '../organizations.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const store = await readStore({ only: ['organizations'] })
  const org = user.organizationId ? getOrganization(store, user.organizationId) : null
  if (!isFreightDealOrg(org, user)) {
    return sendJson(res, 403, { error: 'Freight deal lookup is not enabled for this workspace' })
  }

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const pin = params.get('pin') || params.get('zip') || ''
  const side = params.get('side') === 'pickup' ? 'pickup' : 'delivery'

  if (!String(pin).trim()) {
    return sendJson(res, 400, { error: 'pin or zip is required' })
  }

  try {
    const location = await lookupPostalCode(pin, { side })
    if (!location) {
      return sendJson(res, 404, { error: 'Could not resolve this postal code. Enter city and country manually.' })
    }
    return sendJson(res, 200, { location })
  } catch (error) {
    return sendJson(res, 502, { error: error.message || 'Lookup failed' })
  }
}
