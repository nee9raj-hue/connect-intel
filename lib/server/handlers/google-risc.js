import { handleGoogleRiscRequest } from '../googleRisc.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  try {
    const auth = req.headers?.authorization || req.headers?.Authorization
    const result = await handleGoogleRiscRequest(auth)
    return sendJson(res, 200, result)
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: error.message || 'Invalid security event' })
  }
}
