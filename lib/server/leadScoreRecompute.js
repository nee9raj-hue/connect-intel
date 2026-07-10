import { readStore } from './store.js'
import { computeCrmLeadScore } from './crmLeadScore.js'
import { normalizeExtendedCrm } from './crmWorkflow.js'
import {
  findPipelineEntry,
  listPipelineSavedEntries,
  touchPipelineEntry,
  updatePipelineStore,
} from './pipelineShard.js'
import { getOrganization } from './organizations.js'

function scoringContextFromMeta(metaStore, organizationId) {
  return {
    store: { organizations: metaStore.organizations || [] },
    organizationId,
    marketingEvents: metaStore.marketingEvents || [],
  }
}

export function resolveScoringActor(metaStore, { organizationId, actorUserId }) {
  if (actorUserId) {
    const user = (metaStore.users || []).find((u) => u.id === actorUserId)
    if (user) return user
  }
  return (metaStore.users || []).find(
    (u) => u.organizationId === organizationId && u.isOrgAdmin
  )
}

/** Recompute one lead score and persist to pipeline store (+ SQL when enabled). */
export async function refreshLeadScoreForLead(
  user,
  { organizationId, leadId, marketingEvents, organizations }
) {
  if (!user?.id || !organizationId || !leadId) return null

  let metaStore = null
  if (!marketingEvents || !organizations) {
    metaStore = await readStore({
      only: ['marketingEvents', 'organizations', 'users', 'organizationMemberships'],
    })
  }

  const ctx = {
    store: { organizations: organizations || metaStore?.organizations || [] },
    organizationId,
    marketingEvents: marketingEvents || metaStore?.marketingEvents || [],
  }

  let newScore = null
  await updatePipelineStore(user, async (draft) => {
    const entry = findPipelineEntry(draft, user, leadId)
    if (!entry) return draft
    newScore = computeCrmLeadScore(entry, ctx)
    entry.crm = { ...normalizeExtendedCrm(entry.crm), leadScore: newScore }
    touchPipelineEntry(entry)
    return draft
  })

  return newScore
}

/** After marketing open/click/unsubscribe — update lead score without waiting for manual save. */
export async function refreshLeadScoreAfterMarketingEvent({
  organizationId,
  leadId,
  actorUserId,
}) {
  if (!organizationId || !leadId) return null

  const metaStore = await readStore({
    only: ['marketingEvents', 'organizations', 'users', 'organizationMemberships'],
  })
  const user = resolveScoringActor(metaStore, { organizationId, actorUserId })
  if (!user) return null

  return refreshLeadScoreForLead(user, {
    organizationId,
    leadId,
    marketingEvents: metaStore.marketingEvents,
    organizations: metaStore.organizations,
  })
}

/** Admin bulk recompute for an org (cap limits work per request). */
export async function recomputeOrgLeadScores(user, organizationId, { limit = 500 } = {}) {
  if (!user?.id || !organizationId) return { updated: 0, scanned: 0 }

  const metaStore = await readStore({
    only: ['marketingEvents', 'organizations', 'users', 'organizationMemberships'],
  })
  const org = getOrganization(metaStore, organizationId)
  if (!org) return { updated: 0, scanned: 0 }

  const ctx = scoringContextFromMeta(metaStore, organizationId)
  let updated = 0
  let scanned = 0

  await updatePipelineStore(user, async (draft) => {
    const entries = listPipelineSavedEntries(draft, user)
    for (const entry of entries) {
      if (scanned >= limit) break
      scanned += 1
      const next = computeCrmLeadScore(entry, ctx)
      const prev = entry.crm?.leadScore
      if (prev === next) continue
      entry.crm = { ...normalizeExtendedCrm(entry.crm), leadScore: next }
      touchPipelineEntry(entry)
      updated += 1
    }
    return draft
  })

  return { updated, scanned }
}
