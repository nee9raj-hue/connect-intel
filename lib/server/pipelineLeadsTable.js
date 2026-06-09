import { isPipelineLeadsTableEnabled } from './infra/config.js'
import { isSupabaseEnabled, supabaseRest } from './supabaseClient.js'
import { pipelineShardNameForUser } from './pipelineShard.js'

const TABLE = 'pipeline_leads'

export function pipelineLeadsTableActive() {
  return isPipelineLeadsTableEnabled() && isSupabaseEnabled()
}

/** Batch-patch CRM fields without reading the full org shard (when table is enabled). */
export async function patchPipelineLeadsTable(user, patches) {
  if (!pipelineLeadsTableActive()) return { patched: 0, mode: 'disabled' }
  const shardName = pipelineShardNameForUser(user)
  const list = Array.isArray(patches) ? patches.filter((p) => p?.leadId) : []
  if (!list.length) return { patched: 0 }

  let patched = 0
  for (const { leadId, updateCrm } of list) {
    const rows = await supabaseRest(
      `${TABLE}?shard_name=eq.${encodeURIComponent(shardName)}&lead_id=eq.${encodeURIComponent(leadId)}&select=entry`,
      {},
      { timeoutMs: 15_000 }
    )
    const existing = Array.isArray(rows) && rows[0]?.entry ? rows[0].entry : null
    if (!existing) continue
    const nextEntry = {
      ...existing,
      crm: updateCrm(existing.crm || {}),
      updatedAt: new Date().toISOString(),
    }
    await supabaseRest(
      `${TABLE}?shard_name=eq.${encodeURIComponent(shardName)}&lead_id=eq.${encodeURIComponent(leadId)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          entry: nextEntry,
          updated_at: new Date().toISOString(),
        }),
      },
      { timeoutMs: 15_000 }
    )
    patched += 1
  }
  return { patched, mode: 'table' }
}

export async function upsertPipelineLeadRow(shardName, entry) {
  if (!pipelineLeadsTableActive() || !entry) return null
  const lead = entry.lead || entry
  const leadId = lead?.id || entry.leadId
  if (!leadId) return null

  const row = {
    lead_id: leadId,
    shard_name: shardName,
    organization_id: entry.organizationId || null,
    user_id: entry.userId || entry.savedByUserId || null,
    entry,
    updated_at: new Date().toISOString(),
  }

  await supabaseRest(
    TABLE,
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([row]),
    },
    { timeoutMs: 20_000 }
  )
  return row
}

export async function readPipelineLeadsPage(shardName, { offset = 0, limit = 100 } = {}) {
  if (!pipelineLeadsTableActive()) return null
  const rows = await supabaseRest(
    `${TABLE}?shard_name=eq.${encodeURIComponent(shardName)}&select=entry&order=updated_at.desc&offset=${offset}&limit=${limit}`,
    {},
    { timeoutMs: 30_000 }
  )
  if (!Array.isArray(rows)) return []
  return rows.map((r) => r.entry).filter(Boolean)
}
