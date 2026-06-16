import {
  createSession,
  destroySession,
  getSessionUser,
  refreshSessionFromDatabase,
  upsertUser,
} from '../auth.js'
import { shouldRefreshSessionFromDatabase } from '../authSessionCache.js'
import { verifySessionToken } from '../sessionJwt.js'
import { parseCookies } from '../cookies.js'
import { SESSION_COOKIE } from '../config.js'
import { verifyDemoProfile, verifyGoogleCredential } from '../google.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'

function readSessionToken(req) {
  const cookies = parseCookies(req)
  const header = String(req.headers?.authorization || '')
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : null
  return cookies[SESSION_COOKIE] || bearer || null
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method === 'GET') {
    try {
      const token = readSessionToken(req)
      const payload = verifySessionToken(token)
      const cachedUser = await getSessionUser(req)
      if (cachedUser && payload?.userId && !shouldRefreshSessionFromDatabase(payload.userId)) {
        return sendJson(res, 200, { user: cachedUser, token })
      }

      const refreshed = await refreshSessionFromDatabase(req, res)
      const user = refreshed?.user || cachedUser || (await getSessionUser(req))
      const sessionToken = refreshed?.token || token
      return sendJson(res, 200, { user: user || null, token: sessionToken })
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

