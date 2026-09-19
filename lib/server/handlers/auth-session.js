import { createSession, destroySession, loadSessionForRequest, upsertUser } from '../auth.js'
import { verifyDemoProfile, verifyGoogleCredential } from '../google.js'
import { loginWithEmailPassword, registerWithEmailPassword } from '../emailPasswordAuth.js'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { customerSafeErrorMessage, customerSignInBusyMessage } from '../customerError.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method === 'GET') {
    try {
      const loaded = await loadSessionForRequest(req, res)
      return sendJson(res, 200, { user: loaded.user || null, token: loaded.token })
    } catch (error) {
      return sendJson(res, 503, {
        error: customerSafeErrorMessage(error),
        user: null,
      })
    }
  }

  if (req.method === 'POST') {
    const body = getBody(req)

    try {
      let view
      if (body.credential) {
        const profile = await verifyGoogleCredential(body.credential)
        view = await upsertUser(profile)
      } else if (body.email && body.password) {
        const mode = String(body.mode || 'login').toLowerCase()
        view =
          mode === 'signup'
            ? await registerWithEmailPassword({
                email: body.email,
                password: body.password,
                name: body.name,
              })
            : await loginWithEmailPassword({ email: body.email, password: body.password })
      } else {
        const profile = verifyDemoProfile(body.demoProfile)
        view = await upsertUser(profile)
      }

      const { token } = await createSession(res, view)
      return sendJson(res, 200, { user: view, token })
    } catch (error) {
      const message = error.message || 'Sign-in failed'
      const isDb =
        /supabase|database|521|522|503|504|timed out|unavailable|redploy|circuit open|workspace is taking longer/i.test(
          message
        )
      return sendJson(res, isDb ? 503 : 401, {
        error: isDb ? customerSafeErrorMessage(error, customerSignInBusyMessage()) : message,
      })
    }
  }

  if (req.method === 'DELETE') {
    await destroySession(req, res)
    return sendJson(res, 200, { ok: true })
  }

  return methodNotAllowed(res, ['GET', 'POST', 'DELETE'])
}
