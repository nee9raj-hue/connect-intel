import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { captureException } from '../infra/sentry.js'

/** Browser error reports — optional Sentry forward. */
export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const body = getBody(req)

  const message = String(body?.message || 'Client error').slice(0, 500)
  const stack = String(body?.stack || '').slice(0, 4000)
  const url = String(body?.url || '').slice(0, 500)

  console.error('[client-error]', url, message)
  const err = new Error(message)
  if (stack) err.stack = stack
  await captureException(err, {
    route: 'client',
    tags: { surface: 'browser', url },
  })

  return sendJson(res, 200, { ok: true })
}
