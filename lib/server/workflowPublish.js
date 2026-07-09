/**
 * Snapshot workflow definitions into workflow_versions on publish/save (Deploy 4).
 */

import crypto from 'node:crypto'
import { ensureWorkflowVersion } from './workflowRuns.js'
import {
  crmRuleToWorkflowDefinition,
  crmVisualWorkflowToDefinition,
  marketingAutomationToDefinition,
} from './workflowRuleBridge.js'

export function workflowDefinitionHash(definition = {}) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(definition || {}))
    .digest('hex')
    .slice(0, 24)
}

export async function stampCrmWorkflowVersions(organizationId, settings, store = null) {
  if (!organizationId || !settings) return settings

  const rules = settings.workflowRules || []
  for (const rule of rules) {
    if (rule.enabled === false) continue
    const definition = crmRuleToWorkflowDefinition(rule)
    const versionId = await ensureWorkflowVersion({
      organizationId,
      workflowKey: rule.id,
      workflowType: 'crm_rule',
      definition,
      store,
    })
    if (versionId) {
      rule.publishedVersionId = versionId
      rule.definitionHash = workflowDefinitionHash(definition)
      rule.publishedAt = new Date().toISOString()
    }
  }

  const visuals = settings.visualWorkflows || []
  for (const workflow of visuals) {
    if (workflow.enabled === false) continue
    const definition = crmVisualWorkflowToDefinition(workflow)
    const versionId = await ensureWorkflowVersion({
      organizationId,
      workflowKey: workflow.id,
      workflowType: 'crm_visual',
      definition,
      store,
    })
    if (versionId) {
      workflow.publishedVersionId = versionId
      workflow.definitionHash = workflowDefinitionHash(definition)
      workflow.publishedAt = new Date().toISOString()
    }
  }

  return settings
}

export async function stampMarketingAutomationVersion(organizationId, automation, store = null) {
  if (!organizationId || !automation || automation.status !== 'active') return automation

  const definition = marketingAutomationToDefinition(automation)
  const versionId = await ensureWorkflowVersion({
    organizationId,
    workflowKey: automation.id,
    workflowType: 'marketing_automation',
    definition,
    store,
  })
  if (versionId) {
    automation.publishedVersionId = versionId
    automation.definitionHash = workflowDefinitionHash(definition)
    automation.publishedAt = new Date().toISOString()
  }
  return automation
}
