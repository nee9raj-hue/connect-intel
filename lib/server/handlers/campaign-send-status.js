import { requireUser } from '../auth.js'
import { applyCors, handleOptions, methodNotAllowed, sendJson } from '../http.js'
import { getCampaignSendProgress } from '../email/campaignProgress.js'
import { findPipelineBulkCampaign } from '../pipelineBulkCampaign.js'
import { getMarketingCampaign } from '../marketingCampaigns.js'
import { readStore } from '../store.js'
import { isBackgroundEmailEnabled } from '../infra/config.js'

export default async function handler(req, res) {
  if (handleOptions(req, res)) return
  applyCors(req, res)

  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])

  const user = await requireUser(req, res)
  if (!user) return

  const params = new URL(req.url || '', 'http://localhost').searchParams
  const campaignId = String(params.get('campaignId') || '').trim()
  if (!campaignId) {
    return sendJson(res, 400, { error: 'campaignId is required' })
  }

  const meta = await readStore({
    only: ['marketingCampaigns', 'users', 'marketingEvents', 'organizations', 'organizationMemberships'],
  })
  const storeUser = (meta.users || []).find((u) => u.id === user.id) || user
  const pipeline = findPipelineBulkCampaign(meta, storeUser, campaignId)
  const marketing = getMarketingCampaign(meta, storeUser, campaignId)
  if (!pipeline && !marketing) {
    return sendJson(res, 404, { error: 'Campaign not found' })
  }

  const progress = await getCampaignSendProgress(campaignId, storeUser, meta)

  return sendJson(res, 200, {
    ...progress,
    backgroundEmailEnabled: isBackgroundEmailEnabled(),
  })
}
