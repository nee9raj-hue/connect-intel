import { waitUntil } from '@vercel/functions'
import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { resolveXindusErpSyncMode, runXindusErpCustomerSync } from '../xindusErpCustomerSync.js'

function isCronAuthorized(req, body) {
  if (req.headers['x-vercel-cron'] === '1') return true
  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  if (!secret) return false
  const authHeader = req.headers?.authorization || ''
  const provided = authHeader.replace(/^Bearer\s+/i, '') || req.query?.secret || body?.secret
  return provided === secret
}

function originFromReq(req) {
  const app = String(process.env.APP_URL || '').replace(/\/$/, '')
  if (app) return app
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const proto = req.headers['x-forwarded-proto'] || 'https'
  return host ? `${proto}://${host}` : ''
}

function continueSync(req, { mode, offset, updatedSince, dryRun }) {
  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  const origin = originFromReq(req)
  if (!origin || !secret) return
  const url = new URL('/api/crm/xindus-erp-sync', `${origin}/`)
  waitUntil(
    fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        mode,
        offset,
        updatedSince,
        dryRun,
        continue: true,
      }),
    }).catch((err) => {
      console.warn('xindus erp sync continue failed:', err?.message || err)
    })
  )
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return methodNotAllowed(res, ['GET', 'POST'])
  }

  const body = req.method === 'POST' ? getBody(req) : {}
  if (!isCronAuthorized(req, body)) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  const mode = resolveXindusErpSyncMode(req.query?.mode || body.mode)
  const offset = Math.max(0, Number(req.query?.offset || body.offset) || 0)
  const dryRun = Boolean(body.dryRun || req.query?.dryRun === '1')
  const updatedSince = String(req.query?.updated_since || body.updatedSince || '').trim() || null
  const nameQuery = String(req.query?.nameQuery || body.nameQuery || 'Xindus').trim() || 'Xindus'

  try {
    const result = await runXindusErpCustomerSync({
      mode,
      updatedSince,
      offset,
      dryRun,
      nameQuery,
    })
    if (result.skipped) {
      return sendJson(res, 200, result)
    }
    if (!result.done && !dryRun) {
      continueSync(req, {
        mode,
        offset: result.nextOffset,
        updatedSince: result.updatedSince,
        dryRun,
      })
    }
    return sendJson(res, 200, result)
  } catch (err) {
    console.error('xindus erp sync failed:', err?.message || err)
    return sendJson(res, 500, { error: err.message || 'ERP customer sync failed' })
  }
}
