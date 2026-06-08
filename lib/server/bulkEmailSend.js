import { readCampaignEnrollments } from './marketingEnrollmentShard.js'

/** Run async work with a fixed concurrency pool. */
export async function mapWithConcurrency(items, limit, fn) {
  if (!items.length) return []
  const results = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await fn(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

/** Skip leads already completed when resuming a bulk campaign chunk. */
export async function filterRowsPendingSend(campaignId, validRows) {
  if (!campaignId || !validRows.length) return validRows
  const existing = await readCampaignEnrollments(campaignId)
  const done = new Set(
    existing.filter((e) => e.status === 'completed' || e.status === 'failed').map((e) => e.leadId)
  )
  return validRows.filter((row) => !done.has(row.leadId))
}

export function bulkSendConcurrency({ useAiPerLead = false } = {}) {
  return useAiPerLead ? 3 : 6
}
