import { readStore } from './store.js'
import { updatePipelineStore } from './pipelineShard.js'
import { applyLeadScoresToEntries } from './crmLeadScore.js'
import { processDueSequenceEnrollments } from './crmSequences.js'
import { listPipelineSavedEntries } from './organizations.js'
import { repairPipelineEntryCrm } from './tenantIsolation.js'

/** Throttle expensive pipeline repair / sequences between reads (cron handles due work). */
const MAINTAIN_INTERVAL_MS = 30 * 60 * 1000
const lastMaintainAt = new Map()

function maintainKey(user, organizationId) {
  return organizationId || `user:${user.id}`
}

/**
 * Run repair, due sequence steps, and lead scores at most once per interval per org.
 * @returns {Promise<boolean>} whether store was updated
 */
export async function maybeMaintainPipelineStore(user, organizationId) {
  const key = maintainKey(user, organizationId)
  const now = Date.now()
  if (now - (lastMaintainAt.get(key) || 0) < MAINTAIN_INTERVAL_MS) {
    return false
  }

  const metaStore = await readStore({
    only: ['marketingEvents', 'organizations'],
  })

  await updatePipelineStore(user, async (draft) => {
    const entries = listPipelineSavedEntries(draft, user)
    let repaired = 0
    for (const entry of entries) {
      if (repairPipelineEntryCrm(draft, user, entry)) repaired += 1
      if (repaired >= 80) break
    }
    if (organizationId) {
      processDueSequenceEnrollments(draft, organizationId)
    }
    applyLeadScoresToEntries(entries, {
      store: { organizations: metaStore.organizations || [] },
      organizationId,
      marketingEvents: metaStore.marketingEvents || [],
    })
    return draft
  })

  lastMaintainAt.set(key, now)
  return true
}

/** After a lead mutation, allow maintenance on the next full read sooner. */
export function resetPipelineMaintainThrottle(user, organizationId) {
  lastMaintainAt.delete(maintainKey(user, organizationId))
}
