import {
  createSession,
  destroySession,
  getSessionUser,
  refreshSessionFromDatabase,
  upsertUser,
} from '../auth.js'
import { verifyDemoProfile, verifyGoogleCredential } from '../google.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method === 'GET') {
    try {
      const refreshed = await refreshSessionFromDatabase(req, res)
      const user = refreshed?.user || (await getSessionUser(req))
      const token = refreshed?.token || null
      return sendJson(res, 200, { user: user || null, token })
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

      const view = await upsertUser(profile)
      const { token } = await createSession(res, view)
      return sendJson(res, 200, { user: view, token })
    } catch (error) {
      const message = error.message || 'Sign-in failed'
      const isDb =
        /supabase|database|521|522|503|504|timed out|unavailable|redploy|circuit open/i.test(message)
      return sendJson(res, isDb ? 503 : 401, {
        error: message,
        hint: isDb
          ? 'Fix database first: Supabase dashboard → Resume project. Vercel → env vars → Redeploy. Then open /api/health until supabase.connected is true.'
          : null,
      })
    }
  }

  if (req.method === 'DELETE') {
    await destroySession(req, res)
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'DELETE'])
}

