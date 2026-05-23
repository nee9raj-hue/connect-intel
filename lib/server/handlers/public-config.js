import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export function getPublicGoogleClientId() {
  return String(process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim()
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const googleClientId = getPublicGoogleClientId()

  return sendJson(res, 200, {
    googleClientId,
    googleAuthConfigured: Boolean(googleClientId),
  })
}
