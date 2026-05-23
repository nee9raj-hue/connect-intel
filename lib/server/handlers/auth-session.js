import { createSession, destroySession, getSessionUser, upsertUser } from '../auth.js'
import { verifyDemoProfile, verifyGoogleCredential } from '../google.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method === 'GET') {
    const user = await getSessionUser(req)
    return sendJson(res, 200, { user: user || null })
  }

  if (req.method === 'POST') {
    const body = getBody(req)

    try {
      const profile = body.credential
        ? await verifyGoogleCredential(body.credential)
        : verifyDemoProfile(body.demoProfile)

      const user = await upsertUser(profile)
      const { token } = await createSession(res, user)
      return sendJson(res, 200, { user, token })
    } catch (error) {
      return sendJson(res, 401, { error: error.message || 'Sign-in failed' })
    }
  }

  if (req.method === 'DELETE') {
    await destroySession(req, res)
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'DELETE'])
}

