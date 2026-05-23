import {
  createSession,
  destroySession,
  getSessionUser,
  refreshSessionFromDatabase,
  upsertUser,
} from '../auth.js'
import { verifyDemoProfile, verifyGoogleCredential } from '../google.js'
import { buildOrgUserResponse } from '../organizations.js'
import { readStore } from '../store.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method === 'GET') {
    try {
      const user = (await refreshSessionFromDatabase(req, res)) || (await getSessionUser(req))
      return sendJson(res, 200, { user: user || null })
    } catch (error) {
      return sendJson(res, 503, {
        error: error.message || 'Could not load your account data',
        user: null,
      })
    }
  }

  if (req.method === 'POST') {
    const body = getBody(req)

    try {
      const profile = body.credential
        ? await verifyGoogleCredential(body.credential)
        : verifyDemoProfile(body.demoProfile)

      const user = await upsertUser(profile)
      const store = await readStore()
      const dbUser = store.users.find(
        (u) => String(u.email || '').toLowerCase() === String(user.email || '').toLowerCase()
      )
      const view = dbUser ? buildOrgUserResponse(dbUser, store) : user
      const { token } = await createSession(res, view)
      return sendJson(res, 200, { user: view, token })
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

