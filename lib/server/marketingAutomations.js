import { createId, readStore, updateStore } from './store.js'
import {
  canAccessMarketingAsset,
  filterMarketingRows,
  marketingScopeKey,
} from './marketingAccess.js'
import { resolveMarketingPermissions } from './marketingRoles.js'
import { executeAutomationGraphStep } from './automationGraphRunner.js'

const MAX_RUNS_PER_CRON = 20

export function getMarketingAutomation(store, user, automationId) {
  const row = (store.marketingAutomations || []).find((a) => a.id === automationId)
  if (!row || !canAccessMarketingAsset(row, user)) return null
  return row
}

export function listMarketingAutomations(store, user) {
  return filterMarketingRows(store.marketingAutomations || [], user).sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  )
}

export async function createMarketingAutomation(user, payload) {
  const perms = resolveMarketingPermissions(user, await readStore())
  if (!perms.canManageAutomations && !perms.canCreate) {
    throw new Error('You do not have permission to create automations')
  }

  const now = new Date().toISOString()
  const automation = {
    id: createId('mauto'),
    ...marketingScopeKey(user),
    name: String(payload.name || '').trim().slice(0, 120),
    description: String(payload.description || '').trim().slice(0, 400) || null,
    status: 'draft',
    trigger: payload.trigger || { type: 'contact_added', config: {} },
    graph: payload.graph || { nodes: [], edges: [] },
    campaignId: payload.campaignId || null,
    segmentId: payload.segmentId || null,
    listId: payload.listId || null,
    delayDays: Math.max(0, Math.min(30, Number(payload.delayDays) || 0)),
    createdByUserId: user.id,
    createdAt: now,
    updatedAt: now,
  }

  if (!automation.name) throw new Error('Automation name is required')

  await updateStore((draft) => {
    draft.marketingAutomations = draft.marketingAutomations || []
    draft.marketingAutomations.push(automation)
    return draft
  })

  return automation
}

export async function updateMarketingAutomation(user, automationId, patch) {
  const store = await readStore({ only: ['marketingAutomations'] })
  const existing = getMarketingAutomation(store, user, automationId)
  if (!existing) throw new Error('Automation not found')

  const now = new Date().toISOString()
  await updateStore((draft) => {
    const row = (draft.marketingAutomations || []).find((a) => a.id === automationId)
    if (!row) return draft
    if (patch.name !== undefined) row.name = String(patch.name).trim().slice(0, 120)
    if (patch.description !== undefined) {
      row.description = String(patch.description || '').trim().slice(0, 400) || null
    }
    if (patch.status !== undefined) row.status = patch.status
    if (patch.trigger !== undefined) row.trigger = patch.trigger
    if (patch.graph !== undefined) row.graph = patch.graph
    if (patch.campaignId !== undefined) row.campaignId = patch.campaignId
    if (patch.segmentId !== undefined) row.segmentId = patch.segmentId
    if (patch.listId !== undefined) row.listId = patch.listId
    if (patch.delayDays !== undefined) row.delayDays = Math.max(0, Math.min(30, Number(patch.delayDays) || 0))
    row.updatedAt = now
    return draft
  })

  const updatedStore = await readStore({ only: ['marketingAutomations'] })
  return getMarketingAutomation(updatedStore, user, automationId)
}

export async function enqueueAutomationRun(automation, leadId, { delayDays = 0 } = {}) {
  const now = Date.now()
  const nextRunAt = new Date(now + delayDays * 86400000).toISOString()
  const run = {
    id: createId('marun'),
    automationId: automation.id,
    organizationId: automation.organizationId || null,
    createdByUserId: automation.createdByUserId || null,
    leadId,
    status: 'pending',
    currentNodeId: automation.graph?.nodes?.[0]?.id || 'start',
    nextRunAt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  await updateStore((draft) => {
    draft.marketingAutomationRuns = draft.marketingAutomationRuns || []
    draft.marketingAutomationRuns.push(run)
    return draft
  })

  return run
}

export async function processDueAutomationRuns({ limit = MAX_RUNS_PER_CRON } = {}) {
  const store = await readStore({
    only: [
      'marketingAutomations',
      'marketingAutomationRuns',
      'marketingCampaigns',
      'marketingLists',
      'marketingSegments',
      'marketingTemplates',
      'marketingSuppressions',
      'users',
      'organizations',
      'organizationMemberships',
    ],
  })

  const now = new Date().toISOString()
  const due = (store.marketingAutomationRuns || [])
    .filter((r) => r.status === 'pending' && r.nextRunAt <= now)
    .slice(0, limit)

  let processed = 0
  let sent = 0

  for (const run of due) {
    const automation = (store.marketingAutomations || []).find((a) => a.id === run.automationId)
    if (!automation || automation.status !== 'active') {
      await markRunComplete(run.id, 'skipped')
      continue
    }

    try {
      const result = await executeAutomationGraphStep(automation, run)
      if (result?.deferred) {
        processed += 1
        continue
      }
      if (result?.sent) sent += 1
      await markRunComplete(run.id, 'completed')
      processed += 1
    } catch (err) {
      await markRunFailed(run.id, err.message)
      processed += 1
    }
  }

  return { processed, sent }
}

async function markRunComplete(runId, status) {
  const now = new Date().toISOString()
  await updateStore((draft) => {
    const row = (draft.marketingAutomationRuns || []).find((r) => r.id === runId)
    if (row) {
      row.status = status
      row.updatedAt = now
      row.completedAt = now
    }
    return draft
  })
}

async function markRunFailed(runId, error) {
  const now = new Date().toISOString()
  await updateStore((draft) => {
    const row = (draft.marketingAutomationRuns || []).find((r) => r.id === runId)
    if (row) {
      row.status = 'failed'
      row.lastError = String(error || 'Failed').slice(0, 240)
      row.updatedAt = now
    }
    return draft
  })
}

