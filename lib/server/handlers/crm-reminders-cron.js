import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { processAllCrmReminderEmails } from '../crmReminderEmails.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'POST' && req.method !== 'GET') {
    return methodNotAllowed(res, ['GET', 'POST'])
  }

  const secret = process.env.CRON_SECRET || process.env.MARKETING_CRON_SECRET
  const authHeader = req.headers?.authorization || ''
  const querySecret = req.query?.secret
  const bodySecret = getBody(req)?.secret
  const provided = authHeader.replace(/^Bearer\s+/i, '') || querySecret || bodySecret

  if (secret && provided !== secret) {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  try {
    const result = await processAllCrmReminderEmails()
    return sendJson(res, 200, { ok: true, ...result })
  } catch (err) {
    console.error('crm reminders cron failed:', err?.message || err)
    return sendJson(res, 500, { error: err.message || 'Reminder cron failed' })
  }
}
