import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getUsdInrRate } from '../../usdInr.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const quote = await getUsdInrRate()
  res.setHeader('Cache-Control', 'public, max-age=300')
  return sendJson(res, 200, quote)
}
