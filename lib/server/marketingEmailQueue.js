import crypto from 'node:crypto'
import { isMarketingSqlQueueEnabled } from './infra/config.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { readPipelineLeadsByIds, pipelineLeadsTableActive } from './pipelineLeadsTable.js'
import { pipelineShardNameForUser } from './pipelineShard.js'
import { isEmailSuppressed } from './marketingUnsubscribe.js'
import { leadCanReceiveCommercialEmail, leadHasSendableEmail } from '../leadEmailSendable.js'

const BATCH_TABLE = 'marketing_campaign_batches'
const QUEUE_TABLE = 'marketing_email_queue'
const INSERT_CHUNK = 100

function leadFromEntry(entry) {
  const lead = entry?.lead || entry
  return {
    leadId: String(lead?.id || entry?.leadId || '').trim(),
    email: String(lead?.email || lead?.work_email || '')
      .trim()
      .toLowerCase(),
    firstName: String(lead?.firstName || lead?.first_name || lead?.name || '')
      .trim()
      .split(/\s+/)[0] || '',
  }
}

export function marketingSqlQueueActive() {
  return isMarketingSqlQueueEnabled() && isSupabaseEnabled() && pipelineLeadsTableActive()
}

export async function probeMarketingSqlQueueTables() {
  try {
    await supabaseRest(`${QUEUE_TABLE}?select=id&limit=1`, {}, { timeoutMs: 10_000, attempts: 1 })
    await supabaseRest(`${BATCH_TABLE}?select=id&limit=1`, {}, { timeoutMs: 10_000, attempts: 1 })
    return { ok: true }
  } catch (error) {
    const msg = String(error?.message || '')
    if (/relation.*does not exist|42P01|schema cache/i.test(msg)) {
      return { ok: false, error: msg, missingMigration: '20260618120000_marketing_sql_queue.sql' }
    }
    throw error
  }
}

/**
 * Enqueue one row per eligible lead. Reads only pipeline_leads rows for leadIds (no shard download).
 */
export async function enqueueMarketingCampaignBatch({
  user,
  campaign,
  leadIds,
  enrollmentsByLeadId = {},
  suppressions = [],
}) {
  if (!marketingSqlQueueActive()) {
    return { enqueued: 0, mode: 'disabled' }
  }

  const ids = [...new Set((leadIds || []).filter(Boolean))]
  if (!ids.length) return { enqueued: 0, batchId: null }

  const shardName = pipelineShardNameForUser(user)
  const entries = (await readPipelineLeadsByIds(shardName, ids)) || []
  const entryByLead = new Map(
    entries.map((entry) => {
      const { leadId } = leadFromEntry(entry)
      return [leadId, entry]
    })
  )

  const scope = user.organizationId
    ? { organizationId: user.organizationId, createdByUserId: null }
    : { organizationId: null, createdByUserId: user.id }

  const jobs = []
  for (const leadId of ids) {
    const entry = entryByLead.get(leadId)
    if (!entry) continue
    const { email, firstName } = leadFromEntry(entry)
    const lead = entry.lead || entry
    if (!leadHasSendableEmail(lead)) continue
    if (!leadCanReceiveCommercialEmail(lead)) continue
    if (isEmailSuppressed({ marketingSuppressions: suppressions }, { ...scope, email })) continue

    const enrollment = enrollmentsByLeadId[leadId]
    jobs.push({
      campaign_id: campaign.id,
      lead_id: leadId,
      enrollment_id: enrollment?.id || null,
      organization_id: user.organizationId || null,
      user_id: user.id,
      shard_name: shardName,
      to_email: email,
      first_name: firstName || null,
      status: 'pending',
    })
  }

  if (!jobs.length) return { enqueued: 0, batchId: null }

  const batchRow = {
    campaign_id: campaign.id,
    organization_id: user.organizationId || null,
    user_id: user.id,
    shard_name: shardName,
    total_jobs: jobs.length,
    status: 'pending',
  }

  const batchInsert = await supabaseRest(
    `${BATCH_TABLE}`,
    {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(batchRow),
    },
    { timeoutMs: 20_000 }
  )
  const batch = Array.isArray(batchInsert) ? batchInsert[0] : batchInsert
  const batchId = batch?.id
  if (!batchId) throw new Error('Failed to create marketing campaign batch')

  let enqueued = 0
  for (let i = 0; i < jobs.length; i += INSERT_CHUNK) {
    const chunk = jobs.slice(i, i + INSERT_CHUNK).map((row) => ({ ...row, batch_id: batchId }))
    await supabaseRest(
      `${QUEUE_TABLE}`,
      {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(chunk),
      },
      { timeoutMs: 60_000 }
    )
    enqueued += chunk.length
  }

  await supabaseRest(
    `${BATCH_TABLE}?id=eq.${batchId}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'processing', started_at: new Date().toISOString() }),
    },
    { timeoutMs: 15_000 }
  )

  return { enqueued, batchId, mode: 'sql_queue' }
}

export async function claimMarketingEmailQueueRows({ limit = 50, workerId } = {}) {
  if (!marketingSqlQueueActive()) return []
  const worker = workerId || `ci_${crypto.randomUUID().slice(0, 8)}`
  const rows = await supabaseRest(
    'rpc/ci_claim_marketing_email_queue',
    {
      method: 'POST',
      body: JSON.stringify({ p_limit: limit, p_worker: worker }),
    },
    { timeoutMs: 25_000 }
  )
  return Array.isArray(rows) ? rows : []
}

export async function patchMarketingQueueRow(id, patch) {
  await supabaseRest(
    `${QUEUE_TABLE}?id=eq.${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    },
    { timeoutMs: 15_000 }
  )
}

export async function countPendingMarketingQueue(campaignId) {
  if (!marketingSqlQueueActive()) return 0
  const rows = await supabaseRest(
    `${QUEUE_TABLE}?campaign_id=eq.${encodeURIComponent(campaignId)}&status=in.(pending,processing)&select=id`,
    { headers: { Prefer: 'count=exact' } },
    { timeoutMs: 12_000 }
  )
  if (Array.isArray(rows)) return rows.length
  return 0
}

export async function cancelPendingMarketingQueue(campaignId) {
  if (!marketingSqlQueueActive()) return 0
  await supabaseRest(
    `${QUEUE_TABLE}?campaign_id=eq.${encodeURIComponent(campaignId)}&status=eq.pending`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'cancelled' }),
    },
    { timeoutMs: 20_000 }
  )
}
