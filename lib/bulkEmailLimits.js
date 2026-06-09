/** CRM bulk email batch sizes — tuned for Vercel 120s function budget. */
export const BULK_EMAIL_MAX = 200
/** Dual-mode threshold: ≤ this count = inline send; > this = queue + worker. */
export const INLINE_EMAIL_MAX_RECIPIENTS = 10
/** Manual/template emails per API request (parallel Gmail sends on server). */
export const BULK_EMAIL_CHUNK = 50
/** AI-personalized emails per API request (each lead = AI draft + send). */
export const BULK_EMAIL_AI_CHUNK = 10
export const BULK_EMAIL_AI_MAX_PER_REQUEST = 10

export function bulkEmailChunkSize({ useAiPerLead = false } = {}) {
  return useAiPerLead ? BULK_EMAIL_AI_CHUNK : BULK_EMAIL_CHUNK
}
