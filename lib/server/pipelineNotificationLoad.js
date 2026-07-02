import { listPipelineSavedEntries } from './organizations.js'
import { getScopedLeadsQuery, scopedLeadsListUrl } from './pipelineScopedQuery.js'
import { attachPipelineEntriesToStore, loadPipelineStoreContext, META_STORE_COLLECTIONS } from './pipelineShard.js'
import { readStore } from './store.js'
import { supabaseRest } from './supabaseClient.js'

function parseSinceMs(since) {
  if (!since) return Date.now() - 120_000
  const t = new Date(since).getTime()
  return Number.isNaN(t) ? Date.now() - 120_000 : t
}

function scopedUrl(scoped, extraParts, limit) {
  const parts = [...scoped.postgrestParts, ...extraParts]
  const next = {
    ...scoped,
    postgrestParts: parts,
    queryString: parts.join('&'),
    pagination: { ...scoped.pagination, limit },
  }
  return scopedLeadsListUrl(next, { select: 'entry,lead_id,updated_at' })
}

/**
 * Notification poll — load only recently changed + soon-due follow-ups (not full org shard).
 * Falls back to dashboard-cached shard read when SQL path is unavailable.
 */
export async function loadPipelineStoreForNotifications(user, { since } = {}) {
  const sinceMs = parseSinceMs(since)
  const sinceIso = new Date(sinceMs - 90_000).toISOString()
  const horizonDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { pipelineLeadsTableActive } = await import('./pipelineLeadsTable.js')
  if (!pipelineLeadsTableActive()) {
    return loadPipelineStoreContext(user, { shardOnly: true, dashboard: true })
  }

  const metaStore = await readStore({ only: META_STORE_COLLECTIONS })
  const scoped = await getScopedLeadsQuery(user, { limit: 300, offset: 0 }, metaStore)

  const recentUrl = scopedUrl(scoped, [`updated_at=gte.${encodeURIComponent(sinceIso)}`], 300)
  const followUpUrl = scopedUrl(
    scoped,
    [
      `next_followup_date=lte.${horizonDate}`,
      'lead_status=eq.follow_up',
    ],
    150
  )

  let recentRows = []
  let followUpRows = []
  try {
    ;[recentRows, followUpRows] = await Promise.all([
      supabaseRest(recentUrl, {}, { timeoutMs: 8_000, attempts: 2 }),
      supabaseRest(followUpUrl, {}, { timeoutMs: 8_000, attempts: 2 }).catch(() => []),
    ])
  } catch (err) {
    console.warn('pipeline notification slice failed:', err?.message || err)
    return {
      pipelineStore: attachPipelineEntriesToStore(metaStore, []),
      visible: [],
      shardName: scoped.shardName,
      pipelineSource: 'pipeline_leads_notification_error',
    }
  }

  const byLeadId = new Map()
  for (const row of [...(recentRows || []), ...(followUpRows || [])]) {
    const entry = row?.entry
    const leadId = entry?.lead?.id || row?.lead_id
    if (entry && leadId) byLeadId.set(String(leadId), entry)
  }

  if (!byLeadId.size) {
    return {
      pipelineStore: attachPipelineEntriesToStore(metaStore, []),
      visible: [],
      shardName: scoped.shardName,
      pipelineSource: 'pipeline_leads_notification_empty',
    }
  }

  const entries = [...byLeadId.values()]
  const pipelineStore = attachPipelineEntriesToStore(metaStore, entries)
  const visible = listPipelineSavedEntries(pipelineStore, user)
  return {
    pipelineStore: attachPipelineEntriesToStore(metaStore, visible),
    visible,
    shardName: scoped.shardName,
    pipelineSource: 'pipeline_leads_notification_slice',
  }
}
