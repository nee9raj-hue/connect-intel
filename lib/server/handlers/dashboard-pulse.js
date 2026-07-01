import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { buildDashboardPulse } from '../dashboardPulse.js'

const STREAM_MS = 25_000
const STREAM_MAX_MS = 55_000

function wantsEventStream(req) {
  const accept = String(req.headers?.accept || '')
  const stream = String(req.query?.stream || '').trim()
  return stream === '1' || accept.includes('text/event-stream')
}

async function writePulseEvent(res, pulse) {
  res.write(`data: ${JSON.stringify(pulse)}\n\n`)
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  if (!wantsEventStream(req)) {
    const pulse = await buildDashboardPulse(user)
    return sendJson(res, 200, pulse)
  }

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const started = Date.now()
  let closed = false

  const onClose = () => {
    closed = true
  }
  req.on('close', onClose)

  const tick = async () => {
    if (closed) return
    try {
      const pulse = await buildDashboardPulse(user)
      await writePulseEvent(res, pulse)
    } catch (err) {
      console.error('dashboard pulse stream error:', err?.message || err)
      if (!closed) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'pulse_failed' })}\n\n`)
      }
    }
  }

  await tick()

  while (!closed && Date.now() - started < STREAM_MAX_MS) {
    await new Promise((r) => setTimeout(r, STREAM_MS))
    if (closed) break
    await tick()
  }

  if (!closed) res.end()
}
