/** Matches CRM bulk-email cap (lib/server/handlers/crm-bulk-email.js). */
export const MARKETING_SEND_BATCH_SIZE = 100

export const MAX_BATCH_LISTS_PER_REQUEST = 40

export function chunkArray(items, size = MARKETING_SEND_BATCH_SIZE) {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export function formatBatchListName(prefix, batchIndex, totalBatches) {
  const digits = totalBatches >= 100 ? 3 : 2
  const num = String(batchIndex + 1).padStart(digits, '0')
  return `${String(prefix || 'List').trim()} — ${num}`.slice(0, 120)
}

export function previewBatchNames(prefix, leadCount, batchSize = MARKETING_SEND_BATCH_SIZE) {
  const batches = Math.ceil(leadCount / batchSize) || 0
  return Array.from({ length: batches }, (_, i) => ({
    name: formatBatchListName(prefix, i, batches),
    leadCount: Math.min(batchSize, Math.max(0, leadCount - i * batchSize)),
  }))
}
