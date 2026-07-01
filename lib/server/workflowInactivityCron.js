import { readStore } from './store.js'
import { buildOrgUserResponse } from './organizations.js'
import {
  loadPipelineStoreContext,
  pipelineOrgShardName,
  readPipelineShardEntries,
  writePipelineShardEntries,
} from './pipelineShard.js'
import { getOrgCrmSettings } from './crmWorkflowRules.js'
import { leadInactiveDays, leadMatchesInactivityThreshold } from './leadInactivity.js'
import { applyCrmWorkflowRules, fireWorkflowAutomationsAndAudit } from './workflowEngine.js'
import { buildWorkflowIdempotencyKey, finishWorkflowRun, startWorkflowRun } from './workflowRuns.js'

const SYSTEM_ACTOR = { id: 'system', name: 'Workflow cron' }

function minInactivityThresholdFromAutomations(automations, orgId) {
  let min = null
  for (const a of automations || []) {
    if (a.status !== 'active' || a.organizationId !== orgId) continue
    const triggerType = a.trigger?.type || a.graph?.nodes?.find((n) => n.type === 'trigger')?.config?.type
    if (triggerType !== 'no_activity_days') continue
    const config = a.trigger?.config || {}
    const days = Number(config.days ?? config.inactivityDays ?? 7)
    if (min === null || days < min) min = days
  }
  return min
}

function minInactivityThresholdFromRules(settings) {
  let min = null
  for (const rule of settings.workflowRules || []) {
    if (rule.enabled === false || rule.trigger !== 'no_activity_days') continue
    const days = Number(rule.days ?? rule.inactivityDays ?? 7)
    if (min === null || days < min) min = days
  }
  for (const wf of settings.visualWorkflows || []) {
    if (wf.enabled === false || wf.trigger !== 'no_activity_days') continue
    const days = Number(wf.days ?? wf.inactivityDays ?? 7)
    if (min === null || days < min) min = days
  }
  return min
}

function orgNeedsInactivityScan(automations, settings, orgId) {
  const autoMin = minInactivityThresholdFromAutomations(automations, orgId)
  const ruleMin = minInactivityThresholdFromRules(settings)
  if (autoMin === null && ruleMin === null) return null
  if (autoMin === null) return ruleMin
  if (ruleMin === null) return autoMin
  return Math.min(autoMin, ruleMin)
}

/**
 * Daily cron: fire no_activity_days CRM rules + marketing automations for stale leads.
 */
export async function processNoActivityWorkflows({
  maxOrgs = 40,
  maxLeadsPerOrg = 80,
  maxFiresPerOrg = 15,
} = {}) {
  const meta = await readStore({
    only: ['organizations', 'users', 'marketingAutomations'],
  })

  let orgsScanned = 0
  let leadsScanned = 0
  let fired = 0
  let skippedDuplicate = 0

  for (const org of (meta.organizations || []).slice(0, maxOrgs)) {
    if (!org?.id || !org.ownerUserId) continue

    const settings = getOrgCrmSettings(meta, org.id)
    const threshold = orgNeedsInactivityScan(meta.marketingAutomations, settings, org.id)
    if (threshold === null) continue

    const owner = (meta.users || []).find((u) => u.id === org.ownerUserId)
    if (!owner) continue

    const user = buildOrgUserResponse({ ...owner, organizationId: org.id, accountType: 'company' }, meta)
    let visible = []
    try {
      const ctx = await loadPipelineStoreContext(user, { shardOnly: true })
      visible = ctx.visible || []
    } catch {
      continue
    }

    orgsScanned += 1
    let orgFires = 0
    const shardName = pipelineOrgShardName(org.id)
    let shardEntries = null

    for (const entry of visible) {
      if (orgFires >= maxFiresPerOrg) break
      if (leadsScanned >= maxLeadsPerOrg * maxOrgs) break

      leadsScanned += 1
      if (!leadMatchesInactivityThreshold(entry, threshold)) continue

      const leadId = entry.lead?.id || entry.id
      if (!leadId) continue

      const inactiveDays = leadInactiveDays(entry)
      const idempotencyKey = buildWorkflowIdempotencyKey({
        triggerType: 'no_activity_days',
        workflowKey: `org:${org.id}`,
        leadId,
        bucket: 'day',
      })

      const probe = await startWorkflowRun({
        organizationId: org.id,
        workflowKey: `inactivity:${org.id}`,
        workflowType: 'crm_rule',
        triggerType: 'no_activity_days',
        leadId,
        idempotencyKey,
        actorUserId: SYSTEM_ACTOR.id,
        meta: { inactiveDays, cron: true },
        store: meta,
      })

      if (probe.duplicate) {
        skippedDuplicate += 1
        continue
      }
      if (probe.skipped && probe.reason === 'table_missing') {
        /* continue without idempotency when SQL tables not migrated */
      } else if (!probe.ok && !probe.skipped) {
        continue
      }

      const runId = probe.runId

      try {
        if (shardEntries === null) {
          shardEntries = await readPipelineShardEntries(shardName)
        }
        const idx = shardEntries.findIndex((e) => String(e.lead?.id || e.id) === String(leadId))
        if (idx >= 0) {
          const ruleStore = { ...meta, savedLeads: shardEntries }
          applyCrmWorkflowRules(ruleStore, shardEntries[idx], {
            trigger: 'no_activity_days',
            organizationId: org.id,
            actor: SYSTEM_ACTOR,
            meta: { inactiveDays },
          })
          await writePipelineShardEntries(shardName, shardEntries, {
            mirrorToSavedLeads: true,
            refreshIndex: false,
          })
        }

        await fireWorkflowAutomationsAndAudit({
          trigger: 'no_activity_days',
          leadId,
          organizationId: org.id,
          actor: SYSTEM_ACTOR,
          meta: { inactiveDays, cron: true },
        })

        if (runId) await finishWorkflowRun(runId, { status: 'completed' })
        orgFires += 1
        fired += 1
      } catch (error) {
        if (runId) {
          await finishWorkflowRun(runId, {
            status: 'failed',
            errorMessage: error?.message || 'no_activity cron failed',
          })
        }
      }
    }
  }

  return { orgsScanned, leadsScanned, fired, skippedDuplicate }
}
