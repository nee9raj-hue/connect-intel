import { supabaseRest, isSupabaseEnabled } from '../supabaseClient.js'

function bucketCollection(name) {
  if (name.startsWith('pipeline_org_')) return 'pipeline_org_shard'
  if (name.startsWith('pipeline_user_')) return 'pipeline_user_shard'
  if (name.startsWith('menroll_')) return 'enrollment_shard'
  if (name.startsWith('mcstat_')) return 'campaign_stats'
  if (name.startsWith('mcamp_')) return 'campaign_send'
  if (name.startsWith('pipeline_index_')) return 'pipeline_index'
  return name
}

/** Measure store_collections sizes via PostgREST (admin diagnostics). */
export async function buildCapacityReport() {
  if (!isSupabaseEnabled()) {
    return { ok: false, error: 'Supabase not configured' }
  }

  const started = Date.now()
  const names = await supabaseRest(
    'store_collections?select=collection,updated_at&order=updated_at.desc',
    {},
    { timeoutMs: 60_000 }
  )

  const buckets = new Map()
  const topShards = []
  let totalBytes = 0
  let pipelineLeadRows = 0

  for (const row of names || []) {
    const collection = row.collection
    const t0 = Date.now()
    const payload = await supabaseRest(
      `store_collections?select=json&collection=eq.${encodeURIComponent(collection)}`,
      {},
      { timeoutMs: 180_000 }
    )
    const json = payload?.[0]?.json
    const bytes = JSON.stringify(json ?? []).length
    totalBytes += bytes

    const bucket = bucketCollection(collection)
    const prev = buckets.get(bucket) || { count: 0, bytes: 0 }
    prev.count += 1
    prev.bytes += bytes
    buckets.set(bucket, prev)

    if (collection.startsWith('pipeline_org_') && Array.isArray(json)) {
      pipelineLeadRows += json.length
      topShards.push({
        collection,
        leadCount: json.length,
        bytes,
        mb: +(bytes / 1024 / 1024).toFixed(2),
        fetchMs: Date.now() - t0,
        updated_at: row.updated_at,
      })
    }
  }

  topShards.sort((a, b) => b.bytes - a.bytes)

  const bucketSummary = [...buckets.entries()]
    .map(([bucket, row]) => ({
      bucket,
      collections: row.count,
      mb: +(row.bytes / 1024 / 1024).toFixed(2),
    }))
    .sort((a, b) => b.mb - a.mb)

  return {
    ok: true,
    collectionCount: (names || []).length,
    totalJsonMb: +(totalBytes / 1024 / 1024).toFixed(2),
    pipelineLeadRows,
    topPipelineOrgShards: topShards.slice(0, 10),
    buckets: bucketSummary.slice(0, 25),
    durationMs: Date.now() - started,
  }
}
