import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getPlatform } from '../../platform/index.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const url = new URL(req.url || '', 'http://local')
  const query = Object.fromEntries(url.searchParams.entries())

  try {
    const auth = getPlatform().auth
    const result = await auth.completeSsoCallback(req, res, query)
    const appUrl = String(process.env.APP_URL || '').trim() || '/'
    const dest = `${appUrl.replace(/\/$/, '')}/?sso=1`
    res.status(302)
    res.setHeader('Location', dest)
    return res.end()
  } catch (error) {
    const message = error?.message || String(error)
    return sendJson(res, 401, { error: message })
  }
}
