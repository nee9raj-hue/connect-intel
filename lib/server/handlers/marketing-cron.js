import { applyCors, getBody, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { processDueSequenceEnrollments } from '../crmSequences.js'
import { processDueEnrollments } from '../marketingCampaigns.js'
import { readStore, updateStore } from '../store.js'

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

  const marketing = await processDueEnrollments({ limit: 60 })

  let crmSequences = { processed: 0 }
  await updateStore((draft) => {
    crmSequences = processDueSequenceEnrollments(draft, null)
    return draft
  })

  return sendJson(res, 200, { ok: true, marketing, crmSequences })
}
