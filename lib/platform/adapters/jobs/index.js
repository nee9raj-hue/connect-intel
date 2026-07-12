import { triggerQueueDrainNow } from '../../../server/queue/triggerDrain.js'

/** Inline jobs — browser-initiated + fire-and-forget HTTP (MVP zero-cost mode). */
export function createInlineJobsAdapter() {
  return {
    provider: 'inline',
    async enqueue(name, payload = {}) {
      if (name === 'queue-drain' || name === 'workers/cron') {
        void triggerQueueDrainNow().catch(() => {})
      }
      return { jobId: null, mode: 'inline', name, payload }
    },
    async runNow(name, payload = {}) {
      if (name === 'meili-sync') {
        const { warmAllMeilisearch } = await import('../../../server/meiliWarm.js')
        return warmAllMeilisearch(payload)
      }
      if (name === 'data-sync') {
        const { verifyPipelineLeadsBackfill } = await import('../../../server/pipelineLeadsBackfill.js')
        const { verifyPipelineCompaniesBackfill } = await import('../../../server/pipelineCompaniesBackfill.js')
        const orgId = payload.orgId || null
        return {
          pipeline: await verifyPipelineLeadsBackfill({ orgId }),
          companies: await verifyPipelineCompaniesBackfill({ orgId }),
        }
      }
      return { ok: true, name, skipped: true }
    },
  }
}

export function createBullmqJobsAdapter() {
  const inline = createInlineJobsAdapter()
  return {
    provider: 'bullmq',
    async enqueue(name, payload = {}) {
      const result = await inline.enqueue(name, payload)
      return { ...result, mode: 'bullmq-enqueue' }
    },
    runNow: inline.runNow,
  }
}

export function createJobsAdapter(provider) {
  switch (provider) {
    case 'bullmq':
      return createBullmqJobsAdapter()
    case 'inline':
    case 'manual':
    default:
      return createInlineJobsAdapter()
  }
}
