import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { recordOutboundEmail } from './crmEmailThread.js'
import { pipelineShardNameForUser } from './pipelineShard.js'
import { upsertPipelineLeadRows } from './pipelineLeadsTable.js'

const TABLE = 'email_activity_queue'
const BATCH_SIZE = 50

export function emailActivityQueueActive() {
  return isSupabaseEnabled()
}

function slimPayload(payload) {
  if (!payload || typeof payload !== 'object') return {}
  return JSON.parse(JSON.stringify(payload))
}

/** Queue CRM updates during send — one batched insert per burst. */
export async function appendEmailActivityEvents(events) {
  if (!emailActivityQueueActive()) return { queued: 0, mode: 'disabled' }
  const rows = (events || [])
    .filter((e) => e?.campaign_id && e?.lead_id && e?.shard_name)
    .map((e) => ({
      campaign_id: String(e.campaign_id),
      lead_id: String(e.lead_id),
      shard_name: String(e.shard_name),
      organization_id: e.organization_id || null,
      user_id: e.user_id || null,
      payload: slimPayload(e.payload),
      status: 'pending',
    }))
  if (!rows.length) return { queued: 0 }

  let queued = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    await supabaseRest(
      TABLE,
      {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(chunk),
      },
      { timeoutMs: 30_000 }
    )
    queued += chunk.length
  }
  return { queued, mode: 'table' }
}

export function buildPipelineBulkActivityEvent(user, campaign, enrollment, write) {
  const subj = String(write.sendSubject || campaign.subject || '').trim()
  const bodyText = String(write.sendBody || campaign.body || '').trim()
  if (!subj || !bodyText || !enrollment?.leadId) return null

  return {
    campaign_id: campaign.id,
    lead_id: enrollment.leadId,
    shard_name: pipelineShardNameForUser(user),
    organization_id: user.organizationId || null,
    user_id: user.id,
    payload: {
      subject: subj,
      body: bodyText,
      sentAt: write.result?.sentAt || new Date().toISOString(),
      cc: campaign.pipelineBulkOptions?.cc || undefined,
      aiGenerated: Boolean(
        campaign.pipelineBulkOptions?.useAiPerLead || campaign.pipelineBulkOptions?.aiGenerated
      ),
      fromMailbox: write.result?.mailbox || user.email,
      toEmail: enrollment.contactEmail,
      gmailMessageId: write.result?.logPayload?.gmailMessageId || null,
      provider: write.result?.provider || 'bulk',
      campaignId: campaign.id,
      actorUserId: user.id,
      actorUserName: user.name,
    },
  }
}

async function readPendingActivityRows(campaignId) {
  const rows = await supabaseRest(
    `${TABLE}?campaign_id=eq.${encodeURIComponent(campaignId)}&status=eq.pending&select=id,lead_id,shard_name,payload&order=created_at.asc&limit=500`,
    {},
    { timeoutMs: 60_000 }
  )
  return Array.isArray(rows) ? rows : []
}

async function markActivityRowsProcessed(ids) {
  if (!ids?.length) return
  const inList = ids.map((id) => encodeURIComponent(id)).join(',')
  const now = new Date().toISOString()
  await supabaseRest(
    `${TABLE}?id=in.(${inList})`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'processed', processed_at: now, error: null }),
    },
    { timeoutMs: 30_000 }
  )
}

/** After campaign completes — batch-apply queued CRM email + activity updates. */
export async function processEmailActivityQueueForCampaign(campaignId, user) {
  if (!emailActivityQueueActive() || !campaignId || !user) {
    return { processed: 0, mode: 'disabled' }
  }

  const pending = await readPendingActivityRows(campaignId)
  if (!pending.length) return { processed: 0, mode: 'table' }

  const shardName = pipelineShardNameForUser(user)
  const byLead = new Map()
  for (const row of pending) {
    if (!row?.lead_id) continue
    if (!byLead.has(row.lead_id)) byLead.set(row.lead_id, [])
    byLead.get(row.lead_id).push(row)
  }

  const leadIds = [...byLead.keys()]
  const { readPipelineLeadsByIds, pipelineLeadsTableActive } = await import('./pipelineLeadsTable.js')
  if (!pipelineLeadsTableActive()) {
    console.warn('email_activity_queue: pipeline_leads table disabled — skipping CRM sync')
    return { processed: 0, mode: 'pipeline_leads_disabled' }
  }

  const entries = (await readPipelineLeadsByIds(shardName, leadIds)) || []
  const entryByLead = new Map()
  for (const entry of entries) {
    const lid = entry?.lead?.id || entry?.leadId
    if (lid) entryByLead.set(lid, entry)
  }

  const updatedEntries = []
  const processedIds = []

  for (const [leadId, rows] of byLead.entries()) {
    let entry = entryByLead.get(leadId)
    if (!entry) continue
    for (const row of rows) {
      const p = row.payload || {}
      entry = {
        ...entry,
        crm: recordOutboundEmail(
          entry.crm || {},
          {
            subject: p.subject,
            body: p.body,
            sentAt: p.sentAt,
            cc: p.cc,
            aiGenerated: p.aiGenerated,
            fromMailbox: p.fromMailbox,
            toEmail: p.toEmail,
            gmailMessageId: p.gmailMessageId,
            provider: p.provider,
            campaignId: p.campaignId,
          },
          { userId: p.actorUserId, userName: p.actorUserName }
        ),
        updatedAt: new Date().toISOString(),
      }
      processedIds.push(row.id)
    }
    updatedEntries.push(entry)
  }

  if (updatedEntries.length) {
    await upsertPipelineLeadRows(shardName, updatedEntries, { batchSize: 25 })
  }
  if (processedIds.length) {
    await markActivityRowsProcessed(processedIds)
  }

  return {
    processed: processedIds.length,
    leadsUpdated: updatedEntries.length,
    mode: 'table',
  }
}
