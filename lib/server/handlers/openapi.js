import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildOpenApiSpec } from '../openapiSpec.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const host = req.headers?.['x-forwarded-host'] || req.headers?.host
  const proto = req.headers?.['x-forwarded-proto'] || 'https'
  const baseUrl = host ? `${proto}://${host}` : 'https://connectintel.net'

  return sendJson(res, 200, buildOpenApiSpec({ baseUrl }))
}
