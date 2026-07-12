import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getPlatform } from '../../platform/index.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const url = new URL(req.url || '', 'http://local')
  const provider = String(url.searchParams.get('provider') || '').trim()

  try {
    const auth = getPlatform().auth
    const result = await auth.startSso(res, provider || undefined)
    if (result?.redirect) return
    return sendJson(res, 200, result)
  } catch (error) {
    const message = error?.message || String(error)
    const status = /not configured|unknown/i.test(message) ? 503 : 400
    return sendJson(res, status, { error: message })
  }
}
