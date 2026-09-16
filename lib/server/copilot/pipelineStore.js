import {
  attachPipelineEntriesToStore,
  loadPipelineStoreContext,
} from '../pipelineShard.js'

/**
 * Copilot must read live pipeline rows (pipeline_leads / shard), not the JSON
 * savedLeads blob that is often empty on production orgs.
 */
export async function attachCopilotPipelineStore(store, user) {
  if (!user) return store
  try {
    const loaded = await loadPipelineStoreContext(user, {
      dashboard: true,
      shardOnly: true,
    })
    const visible = loaded?.visible
    if (Array.isArray(visible) && visible.length) {
      return attachPipelineEntriesToStore(store, visible)
    }
  } catch (err) {
    console.warn('copilot pipeline load failed:', err?.message || err)
  }
  return store
}

export function copilotTurnFailureReply(err) {
  const raw = String(err?.message || err || '').trim()
  const looksInternal = /unexpected identifier|syntax error|pipeline_leads|supabase/i.test(raw)
  return {
    reply: looksInternal
      ? '**Answer:** I could not read your pipeline just now. Open **Pipeline** and retry, or ask “who needs follow-up today?”'
      : `**Answer:** ${raw.slice(0, 180) || 'Something went wrong.'}`,
    source: 'crm',
    sources: [{ type: 'crm', label: 'CRM' }],
    confidence: 'low',
    suggestions: ['Who needs follow-up today?', 'How many leads by stage?', 'Brief me'],
    actions: [{ type: 'navigate', panel: 'pipeline', label: 'Open Pipeline' }],
  }
}
