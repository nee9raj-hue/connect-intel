import { updateStore } from './store.js'
import { applyLeadScoresToEntries } from './crmLeadScore.js'
import { processDueSequenceEnrollments } from './crmSequences.js'
import { listPipelineSavedEntries } from './organizations.js'
import { repairPipelineEntryCrm } from './tenantIsolation.js'

/** Throttle expensive pipeline repair / sequences / scoring between reads. */
const MAINTAIN_INTERVAL_MS = 4 * 60 * 1000
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

  await updateStore((draft) => {
    const entries = listPipelineSavedEntries(draft, user)
    for (const entry of entries) {
      repairPipelineEntryCrm(draft, user, entry)
    }
    if (organizationId) {
      processDueSequenceEnrollments(draft, organizationId)
    }
    applyLeadScoresToEntries(entries)
    return draft
  })

  lastMaintainAt.set(key, now)
  return true
}

/** After a lead mutation, allow maintenance on the next full read sooner. */
export function resetPipelineMaintainThrottle(user, organizationId) {
  lastMaintainAt.delete(maintainKey(user, organizationId))
}
