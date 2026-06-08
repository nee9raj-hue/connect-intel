/** CRM bulk email batch sizes — keep AI chunks small (each lead = AI + Gmail send). */
export const BULK_EMAIL_MAX = 100
export const BULK_EMAIL_CHUNK = 10
/** Max leads per API call when AI writes each email at send time. */
export const BULK_EMAIL_AI_CHUNK = 3
export const BULK_EMAIL_AI_MAX_PER_REQUEST = 5

export function bulkEmailChunkSize({ useAiPerLead = false } = {}) {
  return useAiPerLead ? BULK_EMAIL_AI_CHUNK : BULK_EMAIL_CHUNK
}
