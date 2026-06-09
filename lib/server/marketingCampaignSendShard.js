import { readStore, writeStoreCollections } from './store.js'

export function isMarketingCampaignSendShardCollection(name) {
  return typeof name === 'string' && name.startsWith('mcamp_')
}

export function campaignSendShardName(campaignId) {
  return `mcamp_${campaignId}`
}

function slimStep(step) {
  if (!step || typeof step !== 'object') return step
  return {
    subject: step.subject,
    body: step.body ? String(step.body).slice(0, 12000) : step.body,
    blocks: step.blocks || null,
    design: step.design || null,
    previewText: step.previewText || null,
    delayDays: step.delayDays ?? 0,
  }
}

/** Persist one campaign's send config so process_sends never loads the full marketingCampaigns blob. */
export async function writeCampaignSendShard(store, user, campaign) {
  if (!campaign?.id) return
  const { getMarketingTemplate, resolveCampaignContent } = await import('./marketingCampaigns.js')
  const template = getMarketingTemplate(store, user, campaign.templateId)
  const resolved = resolveCampaignContent(campaign, template)
  const shard = {
    id: campaign.id,
    organizationId: campaign.organizationId || null,
    createdByUserId: campaign.createdByUserId || null,
    name: campaign.name,
    channel: campaign.channel || 'email',
    listId: campaign.listId,
    templateId: campaign.templateId || null,
    type: campaign.type || 'one_shot',
    status: campaign.status,
    subject: resolved.subject,
    body: resolved.body ? String(resolved.body).slice(0, 12000) : resolved.body,
    blocks: resolved.blocks || null,
    design: resolved.design || null,
    previewText: resolved.previewText || null,
    steps: (resolved.steps || []).map(slimStep),
    source: campaign.source || null,
    pipelineBulkOptions: campaign.pipelineBulkOptions || null,
    emailProvider: campaign.emailProvider || null,
    updatedAt: new Date().toISOString(),
  }
  const name = campaignSendShardName(campaign.id)
  await writeStoreCollections({ [name]: shard }, [name])
}

export async function readCampaignSendShard(campaignId) {
  if (!campaignId) return null
  const name = campaignSendShardName(campaignId)
  const store = await readStore({ only: [name] })
  const row = store[name]
  return row && typeof row === 'object' && !Array.isArray(row) ? row : null
}
